from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_current_admin, get_db
from app.db.models import (
    Incident,
    IncidentAssignment,
    AssignmentStatus,
    IncidentStatus,
    IncidentStatusHistory,
    IncidentType,
    IncidentPriority,
    User,
)
from app.schemas.incident import CreateIncident, IncidentStatusUpdate, UpdateIncident
from app.utils.triage import calculate_severity
from app.utils.resource import recommend_resources
from app.api.v1.audit import create_audit_log

router = APIRouter(prefix="/incidents", tags=["Incidents"])

# ---------------------------------------------------------------------------
# Valid status transitions
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.reported: {
        IncidentStatus.acknowledged,
        IncidentStatus.rejected,
        IncidentStatus.duplicate,
        IncidentStatus.false_alarm,
        IncidentStatus.needs_information,
    },
    IncidentStatus.acknowledged: {
        IncidentStatus.verified,
        IncidentStatus.rejected,
        IncidentStatus.false_alarm,
        IncidentStatus.duplicate,
        IncidentStatus.needs_information,
    },
    IncidentStatus.needs_information: {
        IncidentStatus.acknowledged,
        IncidentStatus.reported,
    },
    IncidentStatus.verified: {
        IncidentStatus.assigned,
        IncidentStatus.rejected,
        IncidentStatus.false_alarm,
        IncidentStatus.cancelled,
    },
    IncidentStatus.assigned: {
        IncidentStatus.accepted,
        IncidentStatus.reported,   # reassignment path
        IncidentStatus.cancelled,
    },
    IncidentStatus.accepted: {
        IncidentStatus.en_route,
        IncidentStatus.cancelled,
    },
    IncidentStatus.en_route: {
        IncidentStatus.on_scene,
        IncidentStatus.cancelled,
    },
    IncidentStatus.on_scene: {
        IncidentStatus.resolving,
        IncidentStatus.cancelled,
    },
    IncidentStatus.resolving: {
        IncidentStatus.resolved,
    },
    # Terminal states — no further transitions
    IncidentStatus.resolved: set(),
    IncidentStatus.rejected: set(),
    IncidentStatus.cancelled: set(),
    IncidentStatus.duplicate: set(),
    IncidentStatus.false_alarm: set(),
}

ADMIN_ALLOWED_STATUSES = {
    IncidentStatus.acknowledged,
    IncidentStatus.verified,
    IncidentStatus.rejected,
    IncidentStatus.false_alarm,
    IncidentStatus.duplicate,
    IncidentStatus.needs_information,
    IncidentStatus.cancelled,
    IncidentStatus.resolved,
}

RESPONDER_ALLOWED_STATUSES = {
    IncidentStatus.en_route,
    IncidentStatus.on_scene,
    IncidentStatus.resolving,
    IncidentStatus.resolved,
}

# Map status → operational timestamp field name
_STATUS_TIMESTAMP_FIELD: dict[IncidentStatus, str] = {
    IncidentStatus.reported: "reported_at",
    IncidentStatus.acknowledged: "acknowledged_at",
    IncidentStatus.verified: "verified_at",
    IncidentStatus.assigned: "assigned_at",
    IncidentStatus.accepted: "accepted_at",
    IncidentStatus.en_route: "en_route_at",
    IncidentStatus.on_scene: "on_scene_at",
    IncidentStatus.resolving: "resolving_at",
    IncidentStatus.resolved: "resolved_at",
}

# Duplicate detection constants
_DUPLICATE_RADIUS_KM = 0.1   # 100 metres
_DUPLICATE_WINDOW_MIN = 15   # 15-minute window


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _set_operational_timestamp(incident: Incident, new_status: IncidentStatus) -> None:
    """Set the operational timestamp for new_status if not already set."""
    field = _STATUS_TIMESTAMP_FIELD.get(new_status)
    if field and getattr(incident, field) is None:
        setattr(incident, field, datetime.utcnow())


def _check_duplicate(db: Session, inc_type: IncidentType, lat: Optional[float], lon: Optional[float]) -> Optional[Incident]:
    """Return the first recent nearby same-type incident, or None."""
    if lat is None or lon is None:
        return None
    window_start = datetime.utcnow() - timedelta(minutes=_DUPLICATE_WINDOW_MIN)
    candidates = (
        db.query(Incident)
        .filter(
            Incident.type == inc_type,
            Incident.created_at >= window_start,
            Incident.status.notin_([
                IncidentStatus.resolved,
                IncidentStatus.cancelled,
                IncidentStatus.duplicate,
                IncidentStatus.false_alarm,
                IncidentStatus.rejected,
            ]),
            Incident.latitude.isnot(None),
            Incident.longitude.isnot(None),
        )
        .all()
    )
    for c in candidates:
        if _haversine(lat, lon, c.latitude, c.longitude) <= _DUPLICATE_RADIUS_KM:
            return c
    return None


def _generate_incident_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    seq = db.query(Incident.id).count() + 1
    return f"HERP-{year}-{seq:06d}"


def _to_response(inc: Incident) -> dict:
    return {
        "id": inc.id,
        "incident_number": inc.incident_number,
        "title": inc.title,
        "description": inc.description,
        "type": inc.type.value if inc.type else None,
        "status": inc.status.value if inc.status else None,
        "priority": inc.priority.value if inc.priority else None,
        "calculated_priority": inc.calculated_priority.value if inc.calculated_priority else None,
        "user_selected_priority": inc.user_selected_priority.value if inc.user_selected_priority else None,
        "severity_score": inc.severity_score,
        "priority_reason": inc.priority_reason,
        "latitude": inc.latitude,
        "longitude": inc.longitude,
        "address": inc.address,
        "details": inc.details,
        "resource_recommendations": inc.resource_recommendations or [],
        "reporter_id": inc.reporter_id,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "updated_at": inc.updated_at.isoformat() if inc.updated_at else None,
        # Phase 3
        "possible_duplicate": inc.possible_duplicate,
        "duplicate_of_incident_id": inc.duplicate_of_incident_id,
        "reported_at": inc.reported_at.isoformat() if inc.reported_at else None,
        "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
        "verified_at": inc.verified_at.isoformat() if inc.verified_at else None,
        "assigned_at": inc.assigned_at.isoformat() if inc.assigned_at else None,
        "accepted_at": inc.accepted_at.isoformat() if inc.accepted_at else None,
        "en_route_at": inc.en_route_at.isoformat() if inc.en_route_at else None,
        "on_scene_at": inc.on_scene_at.isoformat() if inc.on_scene_at else None,
        "resolving_at": inc.resolving_at.isoformat() if inc.resolving_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
    }


def _add_history(db: Session, incident_id: int, new_status: IncidentStatus, reason: str, changed_by_id: int | None = None):
    db.add(IncidentStatusHistory(
        incident_id=incident_id,
        status=new_status,
        changed_at=datetime.utcnow(),
        changed_by_id=changed_by_id,
        reason=reason,
    ))


def _transition(incident: Incident, new_status: IncidentStatus, actor: User, reason: str, db: Session):
    allowed = VALID_TRANSITIONS.get(incident.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {incident.status.value} → {new_status.value} is not allowed",
        )
    incident.status = new_status
    incident.updated_at = datetime.utcnow()
    _set_operational_timestamp(incident, new_status)
    _add_history(db, incident.id, new_status, reason, actor.id)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_incident(
    payload: CreateIncident,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        inc_type = IncidentType[payload.type.name]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid incident type: {payload.type}")
    details = payload.details or {}
    severity_score, calculated_priority, priority_reason = calculate_severity(inc_type, details)
    if payload.user_selected_priority:
        try:
            final_priority = IncidentPriority[payload.user_selected_priority.name]
        except KeyError:
            final_priority = calculated_priority
    else:
        final_priority = calculated_priority
    resources = recommend_resources(inc_type, details)
    incident_number = _generate_incident_number(db)

    # Duplicate detection
    now = datetime.utcnow()
    dup_incident = _check_duplicate(db, inc_type, payload.latitude, payload.longitude)

    incident = Incident(
        incident_number=incident_number,
        title=payload.title,
        description=payload.description,
        type=inc_type,
        status=IncidentStatus.reported,
        priority=final_priority,
        calculated_priority=calculated_priority,
        user_selected_priority=IncidentPriority[payload.user_selected_priority.name] if payload.user_selected_priority else None,
        severity_score=severity_score,
        priority_reason=priority_reason,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address=payload.address,
        details=details,
        resource_recommendations=resources,
        reporter_id=current_user.id,
        possible_duplicate=dup_incident is not None,
        duplicate_of_incident_id=dup_incident.id if dup_incident else None,
        reported_at=now,
    )
    db.add(incident)
    db.flush()
    _add_history(db, incident.id, IncidentStatus.reported, "Incident reported by citizen", current_user.id)
    create_audit_log(
        db, current_user, "INCIDENT_CREATED", "INCIDENT", incident.id,
        f"Citizen #{current_user.id} reported incident {incident_number} (type={inc_type.value}, priority={final_priority.value})"
        + (f" — possible duplicate of #{dup_incident.id}" if dup_incident else ""),
    )
    db.commit()
    db.refresh(incident)
    from app.main import manager
    await manager.broadcast_incident("created", _to_response(incident))
    return _to_response(incident)


@router.get("/my", response_model=None)
def get_my_incidents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Incident)
        .filter(Incident.reporter_id == current_user.id)
        .order_by(Incident.created_at.desc())
    )
    total = q.count()
    incidents = q.offset(skip).limit(limit).all()
    return {"incidents": [_to_response(i) for i in incidents], "total": total}


@router.get("", response_model=None)
def list_incidents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    priority: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    incident_type: Optional[str] = Query(None),
    assignment_status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Incident).order_by(Incident.created_at.desc())
    if priority:
        try:
            p = IncidentPriority[priority.lower()]
            q = q.filter(Incident.priority == p)
        except KeyError:
            pass
    if status_filter:
        try:
            s = IncidentStatus[status_filter.lower()]
            q = q.filter(Incident.status == s)
        except KeyError:
            pass
    if incident_type:
        try:
            t = IncidentType[incident_type.lower()]
            q = q.filter(Incident.type == t)
        except KeyError:
            pass
    total = q.count()
    incidents = q.offset(skip).limit(limit).all()

    def _with_assignment(inc: Incident) -> dict:
        base = _to_response(inc)
        active = next(
            (a for a in inc.assignments if a.status in (AssignmentStatus.pending, AssignmentStatus.accepted)),
            None,
        )
        if active:
            base["active_assignment"] = {
                "id": active.id,
                "responder_id": active.responder_id,
                "status": active.status.value,
                "assigned_at": active.assigned_at.isoformat() if active.assigned_at else None,
            }
        else:
            base["active_assignment"] = None
        return base

    return {"incidents": [_with_assignment(i) for i in incidents], "total": total}


@router.get("/{incident_id}", response_model=None)
def get_incident(
    incident_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if current_user.role == "admin":
        pass
    elif current_user.role == "responder":
        assigned = any(
            a.responder_id == current_user.id and a.status in (AssignmentStatus.pending, AssignmentStatus.accepted)
            for a in incident.assignments
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Access denied")
    elif incident.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _to_response(incident)


@router.patch("/{incident_id}", response_model=None)
def update_incident(
    incident_id: int,
    payload: UpdateIncident,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(incident, field, value)
    incident.updated_at = datetime.utcnow()
    create_audit_log(
        db, current_user, "INCIDENT_UPDATED", "INCIDENT", incident.id,
        f"Admin #{current_user.id} updated incident {incident.incident_number}",
    )
    db.commit()
    db.refresh(incident)
    return _to_response(incident)


@router.patch("/{incident_id}/status", response_model=None)
async def update_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    try:
        new_status = IncidentStatus[payload.status.name]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    if current_user.role == "admin":
        if new_status not in ADMIN_ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Status not in admin-allowed set")
    elif current_user.role == "responder":
        if new_status not in RESPONDER_ALLOWED_STATUSES:
            raise HTTPException(status_code=403, detail="Responders may only set operational statuses")
        active = next(
            (a for a in incident.assignments
             if a.responder_id == current_user.id and a.status == AssignmentStatus.accepted),
            None,
        )
        if not active:
            raise HTTPException(status_code=403, detail="No accepted assignment for this incident")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update incident status")

    old_status = incident.status.value
    _transition(incident, new_status, current_user, payload.reason or f"Status updated to {new_status.value}", db)

    # Mark assignment completed when incident resolved
    if new_status == IncidentStatus.resolved:
        for a in incident.assignments:
            if a.status == AssignmentStatus.accepted:
                a.status = AssignmentStatus.completed
                a.completed_at = datetime.utcnow()

    create_audit_log(
        db, current_user, "INCIDENT_STATUS_CHANGED", "INCIDENT", incident.id,
        f"{current_user.role.capitalize()} #{current_user.id} changed {incident.incident_number} status: {old_status} → {new_status.value}",
    )
    db.commit()
    db.refresh(incident)
    from app.main import manager
    await manager.broadcast_incident("status_updated", _to_response(incident))
    return _to_response(incident)


@router.get("/{incident_id}/timeline", response_model=None)
def get_incident_timeline(
    incident_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if current_user.role == "admin":
        pass
    elif current_user.role == "responder":
        assigned = any(a.responder_id == current_user.id for a in incident.assignments)
        if not assigned:
            raise HTTPException(status_code=403, detail="Access denied")
    elif incident.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    history = (
        db.query(IncidentStatusHistory)
        .filter(IncidentStatusHistory.incident_id == incident_id)
        .order_by(IncidentStatusHistory.changed_at.asc())
        .all()
    )
    return [
        {"status": h.status.value, "changed_at": h.changed_at.isoformat(), "reason": h.reason}
        for h in history
    ]


@router.get("/{incident_id}/assignments", response_model=None)
def get_incident_assignments(
    incident_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return [_assignment_dict(a) for a in incident.assignments]


def _assignment_dict(a: IncidentAssignment) -> dict:
    return {
        "id": a.id,
        "incident_id": a.incident_id,
        "responder_id": a.responder_id,
        "assigned_by": a.assigned_by,
        "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
        "status": a.status.value,
        "accepted_at": a.accepted_at.isoformat() if a.accepted_at else None,
        "rejected_at": a.rejected_at.isoformat() if a.rejected_at else None,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "rejection_reason": a.rejection_reason,
        "notes": a.notes,
    }
