import base64
import json
import re
from typing import Protocol

import httpx

from app.core.config import Settings

PROMPT = """You extract data from an invoice or receipt image. Reply with ONE JSON object only,
no prose, using exactly these keys:
{"vendor": string|null, "invoice_number": string|null, "invoice_date": "YYYY-MM-DD"|null,
 "currency": ISO code like "PKR" or "USD"|null, "subtotal": number|null, "tax": number|null,
 "total": number|null,
 "items": [{"description": string, "quantity": number|null, "unit_price": number|null,
            "amount": number|null}]}
Rules: numbers have no currency symbols or thousands separators. If a value is not clearly
visible use null. Never guess or calculate values that are not printed on the document."""


class ExtractionError(Exception):
    pass


class Extractor(Protocol):
    def extract(self, data: bytes, content_type: str) -> dict: ...


def parse_json_object(text: str) -> dict:
    """LLMs sometimes wrap JSON in prose or code fences; pull out the first object."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ExtractionError("model returned no JSON object")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ExtractionError(f"model returned invalid JSON: {exc}") from exc


def to_images(data: bytes, content_type: str, max_pages: int = 2) -> list[tuple[bytes, str]]:
    """Return [(bytes, mime)]. PDFs are rendered to PNG pages."""
    if content_type != "application/pdf":
        return [(data, content_type)]
    import pymupdf  # imported lazily: only needed for PDFs

    images = []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        for page in list(doc)[:max_pages]:
            images.append((page.get_pixmap(dpi=150).tobytes("png"), "image/png"))
    if not images:
        raise ExtractionError("PDF has no pages")
    return images


class GroqExtractor:
    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is required when EXTRACTOR=groq")
        self.api_key, self.model = api_key, model

    def extract(self, data: bytes, content_type: str) -> dict:
        content: list[dict] = [{"type": "text", "text": PROMPT}]
        for img, mime in to_images(data, content_type):
            b64 = base64.b64encode(img).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
        r = httpx.post(
            self.URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0,
                "max_tokens": 2000,
            },
            timeout=90,
        )
        if r.status_code == 429:
            raise ExtractionError("rate limited by Groq (will retry)")
        if r.status_code >= 400:
            raise ExtractionError(f"Groq error {r.status_code}: {r.text[:300]}")
        return parse_json_object(r.json()["choices"][0]["message"]["content"])


class GeminiExtractor:
    """Vision extraction via Google Gemini. Chosen over Groq because, as of Sep 2026, this
    project's Groq account offers no vision-capable model at all (verified by calling Groq's
    own /models endpoint) — text models only. Gemini's free tier (aistudio.google.com) does
    support image input."""

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required when EXTRACTOR=gemini")
        self.api_key, self.model = api_key, model

    def extract(self, data: bytes, content_type: str) -> dict:
        parts: list[dict] = [{"text": PROMPT}]
        for img, mime in to_images(data, content_type):
            b64 = base64.b64encode(img).decode()
            parts.append({"inline_data": {"mime_type": mime, "data": b64}})
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            params={"key": self.api_key},
            json={
                "contents": [{"parts": parts}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 2000},
            },
            timeout=90,
        )
        if r.status_code == 429:
            raise ExtractionError("rate limited by Gemini (will retry)")
        if r.status_code >= 400:
            raise ExtractionError(f"Gemini error {r.status_code}: {r.text[:300]}")
        body = r.json()
        candidates = body.get("candidates") or []
        if not candidates:
            reason = body.get("promptFeedback", {}).get("blockReason", "no candidates returned")
            raise ExtractionError(f"Gemini returned nothing ({reason})")
        text = "".join(p.get("text", "") for p in candidates[0]["content"]["parts"])
        return parse_json_object(text)


class FakeExtractor:
    """Deterministic extractor for tests and offline demos. Not real OCR."""

    def __init__(self, result: dict | None = None):
        self.result = result or {
            "vendor": "Demo Traders",
            "invoice_number": "INV-001",
            "invoice_date": "2026-01-15",
            "currency": "PKR",
            "subtotal": 1000,
            "tax": 170,
            "total": 1170,
            "items": [
                {"description": "Widget", "quantity": 2, "unit_price": 250, "amount": 500},
                {"description": "Gadget", "quantity": 1, "unit_price": 500, "amount": 500},
            ],
        }

    def extract(self, data: bytes, content_type: str) -> dict:
        return dict(self.result)


def build_extractor(s: Settings) -> Extractor:
    if s.extractor == "fake":
        return FakeExtractor()
    if s.extractor == "groq":
        return GroqExtractor(s.groq_api_key, s.groq_model)
    return GeminiExtractor(s.gemini_api_key, s.gemini_model)
