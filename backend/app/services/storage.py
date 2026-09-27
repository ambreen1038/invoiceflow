from pathlib import Path
from typing import Protocol

import httpx

from app.core.config import Settings


class Storage(Protocol):
    def save(self, path: str, data: bytes, content_type: str) -> None: ...
    def read(self, path: str) -> bytes: ...
    def delete(self, path: str) -> None: ...


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def _resolve(self, path: str) -> Path:
        target = (self.root / path).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError("invalid storage path")
        return target

    def save(self, path: str, data: bytes, content_type: str) -> None:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def read(self, path: str) -> bytes:
        return self._resolve(path).read_bytes()

    def delete(self, path: str) -> None:
        self._resolve(path).unlink(missing_ok=True)


class SupabaseStorage:
    """Private bucket, accessed only server-side with the service-role key."""

    def __init__(self, url: str, service_key: str, bucket: str):
        self.base = f"{url.rstrip('/')}/storage/v1"
        self.bucket = bucket
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    def save(self, path: str, data: bytes, content_type: str) -> None:
        r = httpx.post(
            f"{self.base}/object/{self.bucket}/{path}",
            content=data,
            headers={**self.headers, "Content-Type": content_type},
            timeout=60,
        )
        r.raise_for_status()

    def read(self, path: str) -> bytes:
        r = httpx.get(
            f"{self.base}/object/authenticated/{self.bucket}/{path}",
            headers=self.headers,
            timeout=60,
        )
        r.raise_for_status()
        return r.content

    def delete(self, path: str) -> None:
        httpx.delete(
            f"{self.base}/object/{self.bucket}/{path}", headers=self.headers, timeout=30
        ).raise_for_status()


def build_storage(s: Settings) -> Storage:
    if s.storage_backend == "supabase":
        if not (s.supabase_url and s.supabase_service_role_key):
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        return SupabaseStorage(s.supabase_url, s.supabase_service_role_key, s.supabase_bucket)
    return LocalStorage(s.local_storage_dir)
