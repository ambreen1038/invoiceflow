import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import invoices
from app.core.config import get_settings
from app.queue.factory import build_queue
from app.services.storage import build_storage

logging.basicConfig(level=logging.INFO)


def create_app(queue=None, storage=None) -> FastAPI:
    """Dependencies can be injected (tests do); otherwise they are built from settings."""
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.storage = storage or build_storage(settings)
        app.state.queue = queue or build_queue(settings)
        if settings.queue_backend == "postgres" and settings.run_worker_in_api:
            app.state.queue.start()
        yield
        app.state.queue.stop()

    app = FastAPI(title="InvoiceFlow API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(invoices.router)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok", "queue": settings.queue_backend}

    return app


app = create_app()
