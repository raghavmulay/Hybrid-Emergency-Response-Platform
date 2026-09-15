from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from typing import List
from app.core.dependencies import get_current_active_user, get_current_admin
from app.db.init_db import get_db
from app.db.models import User

router = APIRouter(prefix="/users", tags=["Users"])


# ─────────────────────────── Schemas ─────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    email: str
    is_active: bool
    role: str

    class Config:
        from_attributes = True


class RoleUpdate(BaseModel):
    role: str


# ─────────────────────────── Endpoints ───────────────────────────────────────

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_active_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin only: list all users."""
    return db.query(User).all()


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin only: change a user's role."""
    allowed_roles = {"user", "admin"}
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {allowed_roles}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin only: delete a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
