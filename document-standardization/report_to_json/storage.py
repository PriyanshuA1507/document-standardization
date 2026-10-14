"""
Deep storage for images offloaded from documents.

Images are stored content-addressed (by SHA-256), so identical logos or
screenshots are stored once. Each processed document gets a manifest mapping
its placeholder tags (``[IMAGE_PAGE_3_FIG_1]``) to the stored objects; the tag is
the image's pointer from the JSON back into storage.

``DeepStorage`` is the interface; ``LocalDeepStorage`` stores on a filesystem
path (local disk or a mounted share). Another backend (object store, DMS) only
needs ``put`` / ``get`` / ``write_manifest`` / ``read_manifest``.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Protocol


@dataclass
class StoredImage:
    tag: str            # placeholder written into the page, e.g. [IMAGE_PAGE_3_FIG_1]
    page: int           # 1-based page number
    figure: int         # 1-based figure index on the page
    sha256: str         # storage key
    uri: str            # where the object lives (backend-specific)
    format: str
    width: int
    height: int
    bbox: Optional[List[float]]  # [x0, y0, x1, y1] in PDF points, None if not placed on the page


class DeepStorage(Protocol):
    def put(self, data: bytes, ext: str) -> tuple[str, str]:
        """Store bytes; return (sha256, uri). Must be idempotent."""

    def get(self, sha256: str) -> bytes: ...

    def write_manifest(self, document_id: str, manifest: dict) -> str: ...

    def read_manifest(self, document_id: str) -> dict: ...


class LocalDeepStorage:
    """``<root>/objects/ab/cd/<sha256>.<ext>`` plus ``<root>/manifests/<document_id>.json``."""

    def __init__(self, root: Path):
        self.root = Path(root)

    def _object_path(self, sha256: str, ext: str) -> Path:
        return self.root / "objects" / sha256[:2] / sha256[2:4] / f"{sha256}.{ext}"

    def put(self, data: bytes, ext: str) -> tuple[str, str]:
        sha256 = hashlib.sha256(data).hexdigest()
        path = self._object_path(sha256, ext.lower().lstrip(".") or "bin")
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_bytes(data)
            tmp.replace(path)
        return sha256, path.resolve().as_uri()

    def get(self, sha256: str) -> bytes:
        matches = list((self.root / "objects" / sha256[:2] / sha256[2:4]).glob(f"{sha256}.*"))
        if not matches:
            raise KeyError(sha256)
        return matches[0].read_bytes()

    def write_manifest(self, document_id: str, manifest: dict) -> str:
        path = self.root / "manifests" / f"{document_id}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return str(path)

    def read_manifest(self, document_id: str) -> dict:
        return json.loads((self.root / "manifests" / f"{document_id}.json").read_text(encoding="utf-8"))


class SeaweedFSDeepStorage:
    """Store images in SeaweedFS via the Filer HTTP API, grouped per report.

    Path layout inside SeaweedFS::

        images/<report_id>/figures/<sha256>.<ext>
        images/<report_id>/layout/<sha256>.<ext>
        images/<report_id>/manifest.json

    ``report_id`` is typically the backend ``report_id`` (UUID) so that all
    images for a report can be retrieved or deleted as a group.
    """

    def __init__(self, filer_url: str, report_id: str):
        self.filer_url = filer_url.rstrip("/")
        self.report_id = str(report_id)
        self._seen: Dict[str, str] = {}  # sha256 -> seaweed_path (dedup within a run)

    def _upload(self, path: str, data: bytes, filename: str) -> None:
        import httpx
        url = f"{self.filer_url}/{path}"
        resp = httpx.post(url, files={"file": (filename, data)}, timeout=60.0)
        resp.raise_for_status()

    def put(self, data: bytes, ext: str) -> tuple[str, str]:
        """Store image bytes; return (sha256, seaweed_path). Idempotent."""
        sha256 = hashlib.sha256(data).hexdigest()
        ext = ext.lower().lstrip(".") or "bin"
        if sha256 in self._seen:
            return sha256, self._seen[sha256]
        path = f"images/{self.report_id}/figures/{sha256}.{ext}"
        self._upload(path, data, f"{sha256}.{ext}")
        self._seen[sha256] = path
        return sha256, path

    def put_layout(self, data: bytes, ext: str) -> tuple[str, str]:
        """Store a layout image (icon, rule, background) under layout/."""
        sha256 = hashlib.sha256(data).hexdigest()
        ext = ext.lower().lstrip(".") or "bin"
        if sha256 in self._seen:
            return sha256, self._seen[sha256]
        path = f"images/{self.report_id}/layout/{sha256}.{ext}"
        self._upload(path, data, f"{sha256}.{ext}")
        self._seen[sha256] = path
        return sha256, path

    def get(self, sha256: str) -> bytes:
        """Retrieve an image by its SHA-256 from SeaweedFS."""
        import httpx
        if sha256 in self._seen:
            url = f"{self.filer_url}/{self._seen[sha256]}"
            resp = httpx.get(url, timeout=60.0)
            if resp.status_code == 200:
                return resp.content
        # Try figures/ then layout/
        for subdir in ("figures", "layout"):
            # We don't know the extension, so list the directory
            base = f"images/{self.report_id}/{subdir}"
            url = f"{self.filer_url}/{base}/?prefix={sha256}"
            resp = httpx.get(url, timeout=30.0)
            if resp.status_code == 200:
                # Try direct fetch with common extensions
                for ext in ("png", "jpg", "jpeg", "gif", "bmp", "tiff", "bin"):
                    fetch = httpx.get(f"{self.filer_url}/{base}/{sha256}.{ext}", timeout=30.0)
                    if fetch.status_code == 200:
                        return fetch.content
        raise KeyError(f"Image {sha256} not found in SeaweedFS for report {self.report_id}")

    def write_manifest(self, document_id: str, manifest: dict) -> str:
        """Write the image manifest to SeaweedFS; return the seaweed path."""
        path = f"images/{self.report_id}/manifest.json"
        data = json.dumps(manifest, indent=2).encode("utf-8")
        self._upload(path, data, "manifest.json")
        return path

    def read_manifest(self, document_id: str) -> dict:
        """Read the image manifest from SeaweedFS."""
        import httpx
        path = f"images/{self.report_id}/manifest.json"
        resp = httpx.get(f"{self.filer_url}/{path}", timeout=30.0)
        if resp.status_code == 404:
            raise KeyError(f"Manifest not found for report {self.report_id}")
        resp.raise_for_status()
        return resp.json()

    def stored_images(self) -> list:
        """Return all StoredImage-like dicts that were put() during this run."""
        return list(self._seen.items())


def build_manifest(document_id: str, source_name: str, figures: List[StoredImage],
                   layout: Optional[List[StoredImage]] = None) -> Dict:
    """``images`` maps each tag to its object; ``layout_images`` lists stored images left
    visible on the page (too small to be figures, e.g. slices of a rasterised table header)."""
    return {
        "document_id": document_id,
        "source_file": source_name,
        "images": {img.tag: asdict(img) for img in figures},
        "layout_images": [asdict(img) for img in layout or []],
    }
