import hmac
import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

# Use Argon2 for password hashing – avoids bcrypt length limit and requires no binary dependencies
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# ──────────────────────────── Password helpers ────────────────────────────────

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ──────────────────────────── JWT helpers ─────────────────────────────────────

def create_access_token(data: dict, secret_key: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret_key, algorithm=settings.ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

# ──────────────────────── Email verification token ────────────────────────────

def create_email_verification_token(user_id: int, secret_key: str) -> str:
    timestamp = str(int(time.time()))
    message = f"{user_id}:{timestamp}"
    sig = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{message}:{sig}"


def verify_email_verification_token(token: str, secret_key: str, max_age: int = 86400) -> Optional[int]:
    """Returns user_id if token is valid and not expired, else None."""
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id_str, timestamp_str, sig = parts
        message = f"{user_id_str}:{timestamp_str}"
        expected_sig = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        age = int(time.time()) - int(timestamp_str)
        if age > max_age:
            return None
        return int(user_id_str)
    except Exception:
        return None
