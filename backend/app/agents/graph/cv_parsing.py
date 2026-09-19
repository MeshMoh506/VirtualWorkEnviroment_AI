"""
Extracts raw text from an uploaded CV file. Supports PDF and Word (.docx);
anything else falls back to plain text, so the existing paste-based
POST /users/me/cv keeps working unchanged.
"""
import io

from docx import Document
from pypdf import PdfReader

MAX_CV_BYTES = 5 * 1024 * 1024  # a CV is a few pages; 5 MB is generous


class CVReadError(Exception):
    """A CV upload we can't use. `status_code` is what the API should answer
    with; `str(exc)` is a message safe to show the graduate."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def extract_cv_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return _extract_pdf(content)
    if name.endswith(".docx"):
        return _extract_docx(content)
    return content.decode("utf-8", errors="ignore").strip()


def _extract_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def _extract_docx(content: bytes) -> str:
    document = Document(io.BytesIO(content))
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def read_cv_upload(filename: str | None, content: bytes) -> str:
    """The one way every endpoint turns an uploaded CV into text: size-capped,
    and a corrupt or unreadable file becomes a clean 400 instead of a 500
    stack trace from deep inside pypdf / python-docx."""
    if len(content) > MAX_CV_BYTES:
        raise CVReadError(f"That file is too large — CVs are limited to {MAX_CV_BYTES // (1024 * 1024)} MB.", 413)
    try:
        text = extract_cv_text(filename or "cv.txt", content)
    except Exception as exc:  # noqa: BLE001 — parser errors vary by library
        raise CVReadError("Couldn't read that file. Try a PDF, Word (.docx) or plain-text CV.") from exc
    if not text.strip():
        raise CVReadError("Couldn't extract any text from that file.")
    return text
