"""
Audit log — simple helper + admin-only read endpoint.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_db
from app.db.models import AuditLog, User

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


# ---------------------------------------------------------------------------
# Helper — call this from any API handler to record an action
# ---------------------------------------------------------------------------

def create_audit_log(
    db: Session,
    actor: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
) -> None:
    """Insert one audit log row. Safe to call inside any request handler."""
    role = actor.role.upper() if actor else "SYSTEM"
    # Normalise role label
    role_map = {"user": "CITIZEN", "admin": "ADMIN", "responder": "RESPONDER"}
    role = role_map.get(actor.role, "CITIZEN") if actor else "SYSTEM"
    db.add(AuditLog(
        actor_id=actor.id if actor else None,
        actor_role=role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        created_at=datetime.utcnow(),
    ))
    # Caller is responsible for db.commit()


# ---------------------------------------------------------------------------
# Admin-only read endpoint
# ---------------------------------------------------------------------------

@router.get("")
def list_audit_logs(
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None, description="ISO date e.g. 2026-01-01"),
    to_date: Optional[str] = Query(None, description="ISO date e.g. 2026-12-31"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if actor_id is not None:
        q = q.filter(AuditLog.actor_id == actor_id)
    if action:
        q = q.filter(AuditLog.action == action.upper())
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type.upper())
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)
    if from_date:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(to_date + "T23:59:59"))
        except ValueError:
            pass
    total = q.count()
    logs = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_role": log.actor_role,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "description": log.description,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
