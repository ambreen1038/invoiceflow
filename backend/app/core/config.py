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

    extractor: str = "groq"  # groq | fake
    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    queue_backend: str = "postgres"  # postgres | celery
    redis_url: str = "redis://localhost:6379/0"
    run_worker_in_api: bool = True
    worker_poll_seconds: float = 2.0
    job_max_attempts: int = 3
    job_stale_seconds: int = 300

    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 10

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
