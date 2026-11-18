"""Application settings loaded from environment via pydantic-settings."""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "JobMail"
    port: int = 8000

    # JWT & Auth
    secret_key: str = "change-me-to-a-super-secret-random-jwt-key"
    encryption_key: str = "5T0h8oW_xY1Q2Z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7="
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # Databases
    mongo_uri: str = "mongodb://localhost:27017/?replicaSet=rs0"
    mongo_db: str = "jobmail"
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Google OAuth / Gmail
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/accounts/oauth/gmail/callback"
    google_pubsub_verification_token: str = ""
    gmail_pubsub_topic: str = ""

    # Microsoft Graph / Outlook
    ms_client_id: str = ""
    ms_client_secret: str = ""
    ms_tenant_id: str = "common"
    ms_redirect_uri: str = "http://localhost:8000/accounts/oauth/outlook/callback"
    ms_webhook_client_state: str = ""

    # AI Providers
    openai_api_key: str = ""
    gemini_api_key: str = ""
    ai_monthly_dollar_limit: float = 20.0

    # Rate Limiting
    rate_limit_auth_per_minute: int = 20
    rate_limit_ai_per_minute: int = 15
    rate_limit_default_per_minute: int = 100

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
