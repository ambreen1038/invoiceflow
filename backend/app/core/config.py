from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "sqlite:///./dev.db"

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "invoices"

    storage_backend: str = "local"  # local | supabase
    local_storage_dir: str = "./storage"

    extractor: str = "gemini"  # gemini | groq | fake
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"
    groq_api_key: str = ""
    groq_model: str = ""  # set to a current vision-capable model id if you switch back to Groq

    queue_backend: str = "postgres"  # postgres | celery
    redis_url: str = "redis://localhost:6379/0"
    run_worker_in_api: bool = True
    worker_poll_seconds: float = 2.0
    job_max_attempts: int = 3
    job_stale_seconds: int = 300

    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 10

    # Error monitoring. Left blank, this is a true no-op: sentry_sdk.init() is simply never
    # called, so there's no dependency on having an account to run the app locally.
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    # Fraction of requests to trace for performance data, on top of error reporting (which is
    # always on when sentry_dsn is set). Kept at 0 by default — this app doesn't need request
    # tracing, and Sentry's free tier has a much smaller monthly quota for traces than errors.
    sentry_traces_sample_rate: float = 0.0

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
