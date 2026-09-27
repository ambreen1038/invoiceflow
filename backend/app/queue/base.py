import uuid
from typing import Protocol

from sqlalchemy.orm import Session


class JobQueue(Protocol):
    """Everything the API needs from a queue backend. Swap via QUEUE_BACKEND."""

    def enqueue(self, invoice_id: uuid.UUID, session: Session) -> None:
        """Schedule processing. Called inside the request's transaction, before commit."""

    def start(self) -> None:
        """Start any in-process worker (no-op for backends with external workers)."""

    def stop(self) -> None: ...
