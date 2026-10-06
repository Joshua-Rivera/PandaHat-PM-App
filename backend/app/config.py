from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables (or backend/.env).

    Secrets (Resend key, GitHub webhook secret) will be added here in later
    phases as `SecretStr` so they never appear in logs or reprs.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://pandahat:pandahat@localhost:5432/pandahat"
    # "development" | "production". Production refuses to start with dev auth.
    ENVIRONMENT: str = "development"
    # "dev" trusts the X-Dev-User-Id header (laptop only).
    # "firebase" verifies a Firebase ID token (Sign in with GitHub) on every request.
    AUTH_MODE: str = "dev"
    APP_BASE_URL: str = "http://localhost:3000"
    # Extra allowed browser origins, comma-separated (e.g. the Firebase App Hosting URL).
    CORS_EXTRA_ORIGINS: str = ""
    # Firebase project whose ID tokens we accept (the token's audience).
    FIREBASE_PROJECT_ID: str = ""
    # Comma-separated emails that become admins on first sign-in, so a fresh
    # deployment has someone who can approve everyone else.
    BOOTSTRAP_ADMIN_EMAILS: str = ""

    @model_validator(mode="after")
    def _psycopg_driver(self) -> "Settings":
        # Neon/Supabase hand out "postgresql://…?sslmode=require"; SQLAlchemy needs the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if self.DATABASE_URL.startswith(prefix):
                self.DATABASE_URL = "postgresql+psycopg://" + self.DATABASE_URL[len(prefix):]
        return self

    @model_validator(mode="after")
    def _dev_auth_never_in_production(self) -> "Settings":
        # The "Viewing as" switcher works by trusting a header. That is fine on a
        # laptop and catastrophic on a server, so make the combination impossible.
        if self.ENVIRONMENT == "production" and self.AUTH_MODE == "dev":
            raise ValueError("AUTH_MODE=dev is not allowed when ENVIRONMENT=production")
        if self.AUTH_MODE not in ("dev", "firebase"):
            raise ValueError("AUTH_MODE must be 'dev' or 'firebase'")
        if self.AUTH_MODE == "firebase" and not self.FIREBASE_PROJECT_ID:
            raise ValueError("AUTH_MODE=firebase needs FIREBASE_PROJECT_ID")
        return self

    @property
    def is_dev_auth(self) -> bool:
        return self.AUTH_MODE == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def bootstrap_admin_emails() -> set[str]:
    return {e.lower() for e in _csv(get_settings().BOOTSTRAP_ADMIN_EMAILS)}


def allowed_origins() -> list[str]:
    s = get_settings()
    return [s.APP_BASE_URL, *_csv(s.CORS_EXTRA_ORIGINS)]
