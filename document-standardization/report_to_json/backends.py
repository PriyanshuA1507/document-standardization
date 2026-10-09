"""
The model backend: a local OpenAI-compatible server (vLLM, SGLang, TensorRT-LLM).

The server handles the model across GPUs, batches concurrent calls, prefix-caches the
transcript shared by pass-2 calls, and enforces JSON schemas during decoding
(``response_format: json_schema``).

Air-gapped by construction: the endpoint's host must resolve to a loopback, private or
link-local address (checked on every request), and proxy settings in the environment
are ignored, so no request can leave the local network.
"""

from __future__ import annotations

import base64
import io
import ipaddress
import json
import logging
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol

from PIL import Image

from . import config

log = logging.getLogger(__name__)


class BackendError(RuntimeError):
    """The model could not be reached or failed to generate."""


@dataclass
class Generation:
    text: str
    truncated: bool  # hit the output token limit


class ModelBackend(Protocol):
    description: str
    supports_json_schema: bool

    def generate(self, prompt: str, image: Optional[Image.Image] = None,
                 json_schema: Optional[Dict[str, Any]] = None, max_tokens: int = 8192) -> Generation: ...

    def check(self) -> None:
        """Raise BackendError if the model is not usable."""

    def close(self) -> None: ...


def _png_data_url(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _build_opener() -> urllib.request.OpenerDirector:
    # An empty ProxyHandler: HTTP(S)_PROXY in the environment must not route model traffic elsewhere.
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


_OPENER = _build_opener()


def _open(req: urllib.request.Request, timeout: float):
    return _OPENER.open(req, timeout=timeout)


def require_local(base_url: str) -> None:
    """Raise BackendError unless every address ``base_url``'s host resolves to is local or private."""
    host = urllib.parse.urlsplit(base_url).hostname
    if not host:
        raise BackendError(f"Model endpoint {base_url!r} has no host")
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except socket.gaierror as exc:
        raise BackendError(f"Cannot resolve model server host {host!r}: {exc}") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if not (ip.is_loopback or ip.is_private or ip.is_link_local):
            raise BackendError(f"Refusing model endpoint {base_url}: {host} resolves to the non-local "
                               f"address {address}. The model must be hosted on the local network.")


class OpenAICompatBackend:
    supports_json_schema = True

    def __init__(self, profile: config.ModelProfile, base_url: str, timeout: float = 1800):
        self.profile = profile
        self.base_url = base_url.rstrip("/")
        self.model_name = config.served_model_name(profile)
        self.timeout = timeout
        self.description = f"server {self.base_url} ({self.model_name})"
        # How much a call may hold, prompt and answer together. The server's own limit replaces this
        # once check() has read it: a server started with a smaller context than the model's would
        # otherwise reject every long prompt.
        self.context_tokens = profile.context_tokens
        self._api_key = os.environ.get("R2J_API_KEY", "")

    def _request(self, path: str, payload: Optional[dict] = None, timeout: Optional[float] = None) -> dict:
        require_local(self.base_url)
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(self.base_url + path, data=data, method="POST" if data else "GET",
                                     headers={"Content-Type": "application/json",
                                              **({"Authorization": f"Bearer {self._api_key}"} if self._api_key else {})})
        try:
            with _open(req, timeout or self.timeout) as resp:
                body = resp.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise BackendError(f"{self.base_url}{path} returned HTTP {exc.code}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise BackendError(f"Cannot reach model server {self.base_url}: {exc}") from exc
        try:
            reply = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:  # a proxy error page, a truncated body...
            raise BackendError(f"{self.base_url}{path} did not return JSON: {body[:200]!r}") from exc
        if not isinstance(reply, dict):
            raise BackendError(f"{self.base_url}{path} returned unexpected JSON: {str(reply)[:200]}")
        return reply

    def check(self) -> None:
        listing = self._request("/models", timeout=10).get("data", [])
        served = [m.get("id") for m in listing]
        for entry in listing:
            limit = entry.get("max_model_len") if isinstance(entry, dict) else None
            if entry.get("id") == self.model_name and isinstance(limit, int) and limit > 0:
                self.context_tokens = min(limit, self.profile.context_tokens)
        if self.model_name not in served:
            raise BackendError(f"Server {self.base_url} does not serve {self.model_name!r} (serves {served}); "
                               f"set {self.profile.env_prefix}_SERVED_NAME")

    def generate(self, prompt: str, image: Optional[Image.Image] = None,
                 json_schema: Optional[Dict[str, Any]] = None, max_tokens: int = 8192) -> Generation:
        content: list = []
        if image is not None:  # image first, then the instruction
            content.append({"type": "image_url", "image_url": {"url": _png_data_url(image)}})
        content.append({"type": "text", "text": prompt})
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0,
            "max_tokens": min(max_tokens, self.profile.max_output_tokens),
        }
        if self.profile.chat_template_kwargs:
            payload["chat_template_kwargs"] = self.profile.chat_template_kwargs
        mm_kwargs = config.mm_processor_kwargs(self.profile)
        if mm_kwargs and image is not None:
            payload["mm_processor_kwargs"] = mm_kwargs
        if json_schema is not None:
            payload["response_format"] = {"type": "json_schema",
                                          "json_schema": {"name": "section", "schema": json_schema, "strict": True}}
        body = self._request("/chat/completions", payload)
        try:
            choice = body["choices"][0]
            return Generation(text=choice["message"]["content"] or "", truncated=choice.get("finish_reason") == "length")
        except (KeyError, IndexError, TypeError) as exc:
            raise BackendError(f"Unexpected response from {self.base_url}: {str(body)[:300]}") from exc

    def close(self) -> None:
        pass


def create_backend(model_key: str) -> ModelBackend:
    """The backend for ``model_key``: its local server (see ``config.model_endpoint``)."""
    profile = config.get_model(model_key)
    return OpenAICompatBackend(profile, config.model_endpoint(profile))
