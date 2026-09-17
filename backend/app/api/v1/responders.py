"""
Responder management API — availability, profile, assignment workflow.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_current_admin, get_db
from app.db.models import (
    AssignmentStatus,
    Incident,
    IncidentAssignment,
    IncidentStatus,
    IncidentStatusHistory,
    User,
)
from app.api.v1.audit import create_audit_log

router = APIRouter(prefix="/responders", tags=["Responders"])

VALID_AVAILABILITY = {"AVAILABLE", "BUSY", "OFFLINE"}

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AvailabilityUpdate(BaseModel):
    availability: str


class AssignRequest(BaseModel):
    responder_id: int
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = None


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _responder_dict(u: User, db: Session) -> dict:
    active_count = (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.responder_id == u.id,
            IncidentAssignment.status == AssignmentStatus.accepted,
        )
        .count()
    )
    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "availability": u.availability,
        "latitude": u.latitude,
        "longitude": u.longitude,
        "active_assignments": active_count,
    }


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _add_history(db: Session, incident_id: int, new_status: IncidentStatus, reason: str, changed_by_id: int | None = None):
    db.add(IncidentStatusHistory(
        incident_id=incident_id,
        status=new_status,
        changed_at=datetime.utcnow(),
        changed_by_id=changed_by_id,
        reason=reason,
    ))


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


# ---------------------------------------------------------------------------
# Responder profile / availability
# ---------------------------------------------------------------------------

@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")
    return _responder_dict(current_user, db)


@router.patch("/me/availability")
async def update_my_availability(
    body: AvailabilityUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")
    if body.availability not in VALID_AVAILABILITY:
        raise HTTPException(status_code=400, detail=f"availability must be one of {VALID_AVAILABILITY}")
    old_avail = current_user.availability
    current_user.availability = body.availability
    create_audit_log(
        db, current_user, "RESPONDER_AVAILABILITY_CHANGED", "RESPONDER", current_user.id,
        f"Responder #{current_user.id} changed availability: {old_avail} → {body.availability}",
    )
    db.commit()
    db.refresh(current_user)
    from app.main import manager
    await manager.broadcast_incident("responder_status_updated", {
        "responder_id": current_user.id,
        "availability": current_user.availability,
    })
    return _responder_dict(current_user, db)


@router.patch("/me/location")
def update_my_location(
    body: LocationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")
    current_user.latitude = body.latitude
    current_user.longitude = body.longitude
    db.commit()
    db.refresh(current_user)
    return _responder_dict(current_user, db)


@router.get("/me/assignments")
def get_my_assignments(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")
    assignments = (
        db.query(IncidentAssignment)
        .filter(IncidentAssignment.responder_id == current_user.id)
        .order_by(IncidentAssignment.assigned_at.desc())
        .all()
    )
    result = []
    for a in assignments:
        d = _assignment_dict(a)
        inc = a.incident
        if inc:
            d["incident"] = {
                "id": inc.id,
                "incident_number": inc.incident_number,
                "title": inc.title,
                "type": inc.type.value if inc.type else None,
                "priority": inc.priority.value if inc.priority else None,
                "status": inc.status.value if inc.status else None,
                "latitude": inc.latitude,
                "longitude": inc.longitude,
                "address": inc.address,
                "severity_score": inc.severity_score,
                "resource_recommendations": inc.resource_recommendations or [],
                "description": inc.description,
                "details": inc.details,
            }
        result.append(d)
    return result


# ---------------------------------------------------------------------------
# Admin: list / suggest responders
# ---------------------------------------------------------------------------

@router.get("")
def list_responders(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    responders = db.query(User).filter(User.role == "responder").all()
    return [_responder_dict(r, db) for r in responders]


@router.get("/available")
def list_available_responders(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    responders = (
        db.query(User)
        .filter(User.role == "responder", User.availability == "AVAILABLE")
        .all()
    )
    return [_responder_dict(r, db) for r in responders]


@router.get("/suggest/{incident_id}")
def suggest_responders(
    incident_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Deterministic suggestion: filter AVAILABLE responders, sort by
    (active_assignment_count ASC, distance_km ASC).
    Admin makes the final assignment decision.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    responders = db.query(User).filter(User.role == "responder", User.availability == "AVAILABLE").all()

    candidates = []
    for r in responders:
        active_count = (
            db.query(IncidentAssignment)
            .filter(
                IncidentAssignment.responder_id == r.id,
                IncidentAssignment.status == AssignmentStatus.accepted,
            )
            .count()
        )
        distance_km: Optional[float] = None
        if r.latitude is not None and r.longitude is not None and incident.latitude is not None and incident.longitude is not None:
            distance_km = round(_haversine(r.latitude, r.longitude, incident.latitude, incident.longitude), 2)

        candidates.append({
            **_responder_dict(r, db),
            "distance_km": distance_km,
            "active_assignments": active_count,
        })

    candidates.sort(key=lambda c: (c["active_assignments"], c["distance_km"] if c["distance_km"] is not None else 9999))
    return candidates


# ---------------------------------------------------------------------------
# Admin: assign responder to incident
# ---------------------------------------------------------------------------

@router.post("/incidents/{incident_id}/assign")
async def assign_responder(
    incident_id: int,
    body: AssignRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    responder = db.query(User).filter(User.id == body.responder_id, User.role == "responder").first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    # Cancel any existing PENDING assignment for this incident
    existing_pending = (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.incident_id == incident_id,
            IncidentAssignment.status == AssignmentStatus.pending,
        )
        .first()
    )
    if existing_pending:
        existing_pending.status = AssignmentStatus.cancelled

    # Reject if responder already has an ACCEPTED assignment on this incident
    already_accepted = (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.incident_id == incident_id,
            IncidentAssignment.responder_id == body.responder_id,
            IncidentAssignment.status == AssignmentStatus.accepted,
        )
        .first()
    )
    if already_accepted:
        raise HTTPException(status_code=400, detail="Responder already has an accepted assignment for this incident")

    assignment = IncidentAssignment(
        incident_id=incident_id,
        responder_id=body.responder_id,
        assigned_by=current_user.id,
        notes=body.notes,
    )
    db.add(assignment)

    # Transition incident to ASSIGNED and set operational timestamp
    from app.api.v1.incidents import VALID_TRANSITIONS, _to_response
    allowed = VALID_TRANSITIONS.get(incident.status, set())
    if IncidentStatus.assigned in allowed:
        incident.status = IncidentStatus.assigned
        incident.updated_at = datetime.utcnow()
        if incident.assigned_at is None:
            incident.assigned_at = datetime.utcnow()
        _add_history(db, incident.id, IncidentStatus.assigned,
                     f"Assigned to responder #{body.responder_id} by admin", current_user.id)

    create_audit_log(
        db, current_user, "RESPONDER_ASSIGNED", "ASSIGNMENT", None,
        f"Admin #{current_user.id} assigned responder #{body.responder_id} to incident {incident.incident_number}",
    )
    db.commit()
    db.refresh(assignment)

    from app.main import manager
    await manager.broadcast_incident("incident_assigned", {
        "incident_id": incident_id,
        "assignment_id": assignment.id,
        "responder_id": body.responder_id,
        "incident": _to_response(incident),
    })
    return _assignment_dict(assignment)


# ---------------------------------------------------------------------------
# Assignment accept / reject
# ---------------------------------------------------------------------------

@router.post("/assignments/{assignment_id}/accept")
async def accept_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")

    assignment = db.query(IncidentAssignment).filter(IncidentAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.responder_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if assignment.status != AssignmentStatus.pending:
        raise HTTPException(status_code=400, detail=f"Assignment is {assignment.status.value}, not pending")

    assignment.status = AssignmentStatus.accepted
    assignment.accepted_at = datetime.utcnow()

    incident = assignment.incident
    incident.status = IncidentStatus.accepted
    incident.updated_at = datetime.utcnow()
    if incident.accepted_at is None:
        incident.accepted_at = datetime.utcnow()
    _add_history(db, incident.id, IncidentStatus.accepted,
                 f"Assignment accepted by responder #{current_user.id}", current_user.id)

    # Mark responder busy
    current_user.availability = "BUSY"

    create_audit_log(
        db, current_user, "ASSIGNMENT_ACCEPTED", "ASSIGNMENT", assignment.id,
        f"Responder #{current_user.id} accepted assignment #{assignment.id} for incident {incident.incident_number}",
    )
    db.commit()
    db.refresh(assignment)

    from app.main import manager
    from app.api.v1.incidents import _to_response
    await manager.broadcast_incident("assignment_updated", {
        "assignment": _assignment_dict(assignment),
        "incident": _to_response(incident),
    })
    return _assignment_dict(assignment)


@router.post("/assignments/{assignment_id}/reject")
async def reject_assignment(
    assignment_id: int,
    body: RejectRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "responder":
        raise HTTPException(status_code=403, detail="Responder role required")

    assignment = db.query(IncidentAssignment).filter(IncidentAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.responder_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if assignment.status != AssignmentStatus.pending:
        raise HTTPException(status_code=400, detail=f"Assignment is {assignment.status.value}, not pending")

    assignment.status = AssignmentStatus.rejected
    assignment.rejected_at = datetime.utcnow()
    assignment.rejection_reason = body.reason

    # Revert incident to reported so admin can reassign
    incident = assignment.incident
    incident.status = IncidentStatus.reported
    incident.updated_at = datetime.utcnow()
    _add_history(db, incident.id, IncidentStatus.reported,
                 f"Assignment rejected by responder #{current_user.id}: {body.reason or 'no reason'}", current_user.id)

    create_audit_log(
        db, current_user, "ASSIGNMENT_REJECTED", "ASSIGNMENT", assignment.id,
        f"Responder #{current_user.id} rejected assignment #{assignment.id} for incident {incident.incident_number}"
        + (f": {body.reason}" if body.reason else ""),
    )
    db.commit()
    db.refresh(assignment)

    from app.main import manager
    from app.api.v1.incidents import _to_response
    await manager.broadcast_incident("assignment_updated", {
        "assignment": _assignment_dict(assignment),
        "incident": _to_response(incident),
    })
    return _assignment_dict(assignment)
