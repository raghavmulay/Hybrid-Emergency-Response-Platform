from pydantic_settings import BaseSettings
import os
import secrets


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database
    DATABASE_URL: str = "sqlite:///./emergency.db"

    class Config:
        env_file = ".env"


settings = Settings()
