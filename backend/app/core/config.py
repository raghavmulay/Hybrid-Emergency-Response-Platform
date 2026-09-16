from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = BASE_DIR / "emergency.db"


class Settings(BaseSettings):
    # JWT - Stable key so tokens remain valid across server restarts
    SECRET_KEY: str = "supersecretkeyforemergencyplatform2026jwtencryption"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database - points reliably to backend/emergency.db
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
