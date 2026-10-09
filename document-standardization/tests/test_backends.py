import io
import json

import pytest
from PIL import Image

from report_to_json import backends, config


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _capture(monkeypatch, reply):
    sent = []

    def fake_urlopen(req, timeout=None):
        sent.append({"url": req.full_url, "body": json.loads(req.data) if req.data else None})
        return _FakeResponse(json.dumps(reply).encode())

    monkeypatch.setattr(backends, "_open", fake_urlopen)
    return sent


def test_server_request_shape(monkeypatch):
    sent = _capture(monkeypatch, {"choices": [{"message": {"content": "{}"}, "finish_reason": "stop"}]})
    profile = config.get_model("nemotron-3-nano-omni")
    backend = backends.OpenAICompatBackend(profile, "http://10.0.0.5:8000/v1/")
    gen = backend.generate("TASK: x", image=Image.new("RGB", (4, 4)), json_schema={"type": "object"})

    body = sent[0]["body"]
    assert sent[0]["url"] == "http://10.0.0.5:8000/v1/chat/completions"
    assert body["model"] == profile.repo_id
    assert body["temperature"] == 0
    content = body["messages"][0]["content"]
    assert content[0]["type"] == "image_url" and content[0]["image_url"]["url"].startswith("data:image/png;base64,")
    assert content[1] == {"type": "text", "text": "TASK: x"}  # image before text
    assert body["chat_template_kwargs"] == {"enable_thinking": False}
    assert body["response_format"]["json_schema"]["schema"] == {"type": "object"}
    assert gen.text == "{}" and not gen.truncated


def test_truncation_is_reported(monkeypatch):
    _capture(monkeypatch, {"choices": [{"message": {"content": "{\"a\":"}, "finish_reason": "length"}]})
    gen = backends.OpenAICompatBackend(config.get_model("nemotron-3-nano-omni"), "http://127.0.0.1:8000/v1").generate("p")
    assert gen.truncated


def test_check_requires_the_served_model(monkeypatch):
    _capture(monkeypatch, {"data": [{"id": "something-else"}]})
    backend = backends.OpenAICompatBackend(config.get_model("nemotron-3-nano-omni"), "http://127.0.0.1:8000/v1")
    with pytest.raises(backends.BackendError, match="SERVED_NAME"):
        backend.check()


def test_unreachable_server_is_a_backend_error(monkeypatch):
    def refuse(req, timeout=None):
        raise backends.urllib.error.URLError("connection refused")
    monkeypatch.setattr(backends, "_open", refuse)
    with pytest.raises(backends.BackendError, match="Cannot reach"):
        backends.OpenAICompatBackend(config.get_model("nemotron-3-nano-omni"), "http://127.0.0.1:8000/v1").generate("p")


def test_create_backend_uses_the_local_server(monkeypatch):
    for var in ("R2J_MODEL_ENDPOINT", "R2J_NEMOTRON_3_NANO_OMNI_ENDPOINT"):
        monkeypatch.delenv(var, raising=False)
    backend = backends.create_backend("nemotron-3-nano-omni")
    assert isinstance(backend, backends.OpenAICompatBackend) and backend.base_url == config.DEFAULT_ENDPOINT

    monkeypatch.setenv("R2J_MODEL_ENDPOINT", "http://10.0.0.5:8000/v1")
    monkeypatch.setenv("R2J_NEMOTRON_3_NANO_OMNI_ENDPOINT", "http://127.0.0.1:8001/v1")
    assert backends.create_backend("nemotron-3-nano-omni").base_url == "http://127.0.0.1:8001/v1"


@pytest.mark.parametrize("url", ["http://8.8.8.8/v1", "https://[2001:4860:4860::8888]/v1", "http:///v1"])
def test_non_local_endpoints_are_refused_before_any_request(monkeypatch, url):
    sent = _capture(monkeypatch, {"data": []})
    with pytest.raises(backends.BackendError, match="non-local|no host"):
        backends.OpenAICompatBackend(config.get_model("nemotron-3-nano-omni"), url).check()
    assert sent == []


@pytest.mark.parametrize("url", ["http://127.0.0.1:8000/v1", "http://localhost:8000/v1", "http://10.1.2.3/v1",
                                 "http://192.168.0.7/v1", "http://172.20.0.4:8000/v1", "http://[::1]:8000/v1"])
def test_local_and_private_endpoints_are_allowed(url):
    backends.require_local(url)


def test_a_host_resolving_outside_the_local_network_is_refused(monkeypatch):
    monkeypatch.setattr(backends.socket, "getaddrinfo",
                        lambda host, port: [(None, None, None, "", ("127.0.0.1", 0)), (None, None, None, "", ("1.1.1.1", 0))])
    with pytest.raises(backends.BackendError, match="1.1.1.1"):
        backends.require_local("http://vllm:8000/v1")


def test_proxy_settings_are_ignored(monkeypatch):
    import http.server
    import threading

    class Models(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps({"data": [{"id": "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16"}]}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Models)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        for var in ("HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY"):
            monkeypatch.setenv(var, "http://127.0.0.1:9")  # nothing listens there
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        monkeypatch.setattr(backends, "_OPENER", backends._build_opener())  # as built with these settings
        url = f"http://127.0.0.1:{server.server_port}/v1"
        backends.OpenAICompatBackend(config.get_model("nemotron-3-nano-omni"), url).check()  # reached directly
    finally:
        server.shutdown()


def test_offline_mode_is_forced():
    import os
    assert os.environ["HF_HUB_OFFLINE"] == "1"


def test_the_pipeline_runs_on_exactly_one_model():
    assert list(config.MODELS) == ["nemotron-3-nano-omni"] == [config.DEFAULT_MODEL]
    assert config.get_model(config.DEFAULT_MODEL).chat_template_kwargs == {"enable_thinking": False}
