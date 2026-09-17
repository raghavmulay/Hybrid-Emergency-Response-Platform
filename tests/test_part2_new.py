"""
Part 2 backend tests: RBAC, availability, assignment, acceptance, rejection,
status transitions, and regression tests for Part 1 triage/incident reporting.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.models import Base, User, Incident, IncidentAssignment, IncidentStatus, AssignmentStatus
from app.db.init_db import get_db
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash

from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Install override BEFORE TestClient so on_startup uses the test DB
app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_user(email: str, role: str = "user", availability: str = "OFFLINE",
              lat: float = None, lon: float = None) -> User:
    db = TestingSessionLocal()
    u = User(
        email=email,
        hashed_password=get_password_hash("pass"),
        is_active=True,
        role=role,
        availability=availability,
        latitude=lat,
        longitude=lon,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    db.close()
    return u


def token(user: User) -> dict:
    t = create_access_token({"sub": str(user.id), "role": user.role}, settings.SECRET_KEY)
    return {"Authorization": f"Bearer {t}"}


def make_incident(reporter: User, lat: float = 18.5, lon: float = 73.8) -> dict:
    r = client.post("/api/v1/incidents", json={
        "title": "Test incident",
        "type": "road_accident",
        "details": {"injured": 2},
        "latitude": lat,
        "longitude": lon,
    }, headers=token(reporter))
    assert r.status_code == 201
    return r.json()


# ═══════════════════════════════════════════════════════════════════════════
# RBAC
# ═══════════════════════════════════════════════════════════════════════════

class TestRBAC:
    def test_citizen_cannot_assign(self):
        citizen = make_user("c@t.com")
        responder = make_user("r@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(citizen))
        assert r.status_code == 403

    def test_citizen_cannot_accept_assignment(self):
        citizen = make_user("c2@t.com")
        admin = make_user("a@t.com", role="admin")
        responder = make_user("r2@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        # Admin verifies then assigns
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        assert assign_r.status_code == 200
        aid = assign_r.json()["id"]
        r = client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(citizen))
        assert r.status_code == 403

    def test_responder_cannot_assign(self):
        citizen = make_user("c3@t.com")
        responder = make_user("r3@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(responder))
        assert r.status_code == 403

    def test_admin_can_assign(self):
        citizen = make_user("c4@t.com")
        admin = make_user("a2@t.com", role="admin")
        responder = make_user("r4@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(admin))
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_citizen_cannot_view_all_responders(self):
        citizen = make_user("c5@t.com")
        r = client.get("/api/v1/responders", headers=token(citizen))
        assert r.status_code == 403

    def test_citizen_cannot_change_operational_status(self):
        citizen = make_user("c6@t.com")
        inc = make_incident(citizen)
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "en_route"}, headers=token(citizen))
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════
# Availability
# ═══════════════════════════════════════════════════════════════════════════

class TestAvailability:
    def test_responder_can_update_own_availability(self):
        r = make_user("r5@t.com", role="responder")
        resp = client.patch("/api/v1/responders/me/availability",
                            json={"availability": "AVAILABLE"}, headers=token(r))
        assert resp.status_code == 200
        assert resp.json()["availability"] == "AVAILABLE"

    def test_responder_cannot_update_another_responder(self):
        r1 = make_user("r6@t.com", role="responder")
        r2 = make_user("r7@t.com", role="responder")
        # r1 tries to update r2 — no direct endpoint for that, but verify
        # the /me endpoint only updates the authenticated user
        resp = client.patch("/api/v1/responders/me/availability",
                            json={"availability": "AVAILABLE"}, headers=token(r1))
        assert resp.status_code == 200
        # r2 should still be OFFLINE
        db = TestingSessionLocal()
        r2_db = db.query(User).filter(User.id == r2.id).first()
        db.close()
        assert r2_db.availability == "OFFLINE"

    def test_invalid_availability_rejected(self):
        r = make_user("r8@t.com", role="responder")
        resp = client.patch("/api/v1/responders/me/availability",
                            json={"availability": "SLEEPING"}, headers=token(r))
        assert resp.status_code == 400

    def test_admin_can_view_responder_availability(self):
        make_user("r9@t.com", role="responder", availability="AVAILABLE")
        admin = make_user("a3@t.com", role="admin")
        resp = client.get("/api/v1/responders", headers=token(admin))
        assert resp.status_code == 200
        assert any(r["availability"] == "AVAILABLE" for r in resp.json())


# ═══════════════════════════════════════════════════════════════════════════
# Assignment
# ═══════════════════════════════════════════════════════════════════════════

class TestAssignment:
    def _setup(self):
        citizen = make_user("cit@t.com")
        admin = make_user("adm@t.com", role="admin")
        responder = make_user("res@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        return citizen, admin, responder, inc

    def test_admin_creates_assignment(self):
        _, admin, responder, inc = self._setup()
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(admin))
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        assert r.json()["responder_id"] == responder.id

    def test_assignment_persists(self):
        _, admin, responder, inc = self._setup()
        client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                    json={"responder_id": responder.id}, headers=token(admin))
        db = TestingSessionLocal()
        a = db.query(IncidentAssignment).filter(IncidentAssignment.incident_id == inc["id"]).first()
        db.close()
        assert a is not None
        assert a.status == AssignmentStatus.pending

    def test_duplicate_accepted_assignment_rejected(self):
        _, admin, responder, inc = self._setup()
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        aid = assign_r.json()["id"]
        client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
        # Try to assign same responder again
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(admin))
        assert r.status_code == 400

    def test_assignment_history_preserved_on_reassign(self):
        citizen, admin, responder, inc = self._setup()
        responder2 = make_user("res2@t.com", role="responder", availability="AVAILABLE")
        # Assign responder, reject, then assign responder2
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        aid = assign_r.json()["id"]
        client.post(f"/api/v1/responders/assignments/{aid}/reject",
                    json={"reason": "unavailable"}, headers=token(responder))
        # Reassign
        client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                    json={"responder_id": responder2.id}, headers=token(admin))
        db = TestingSessionLocal()
        assignments = db.query(IncidentAssignment).filter(
            IncidentAssignment.incident_id == inc["id"]
        ).all()
        db.close()
        assert len(assignments) == 2
        statuses = {a.status for a in assignments}
        assert AssignmentStatus.rejected in statuses
        assert AssignmentStatus.pending in statuses


# ═══════════════════════════════════════════════════════════════════════════
# Acceptance
# ═══════════════════════════════════════════════════════════════════════════

class TestAcceptance:
    def _setup(self):
        citizen = make_user("cit2@t.com")
        admin = make_user("adm2@t.com", role="admin")
        responder = make_user("res3@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        return citizen, admin, responder, inc, assign_r.json()["id"]

    def test_responder_can_accept_own_assignment(self):
        _, _, responder, inc, aid = self._setup()
        r = client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"

    def test_accepted_timestamp_recorded(self):
        _, _, responder, _, aid = self._setup()
        client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
        db = TestingSessionLocal()
        a = db.query(IncidentAssignment).filter(IncidentAssignment.id == aid).first()
        db.close()
        assert a.accepted_at is not None

    def test_responder_cannot_accept_another_responders_assignment(self):
        _, admin, _, inc, aid = self._setup()
        other = make_user("other@t.com", role="responder", availability="AVAILABLE")
        r = client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(other))
        assert r.status_code == 403

    def test_incident_becomes_accepted(self):
        _, _, responder, inc, aid = self._setup()
        client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(responder))
        assert r.json()["status"] == "accepted"


# ═══════════════════════════════════════════════════════════════════════════
# Rejection
# ═══════════════════════════════════════════════════════════════════════════

class TestRejection:
    def _setup(self):
        citizen = make_user("cit3@t.com")
        admin = make_user("adm3@t.com", role="admin")
        responder = make_user("res4@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        return citizen, admin, responder, inc, assign_r.json()["id"]

    def test_responder_can_reject_own_assignment(self):
        _, _, responder, _, aid = self._setup()
        r = client.post(f"/api/v1/responders/assignments/{aid}/reject",
                        json={"reason": "off duty"}, headers=token(responder))
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_rejection_reason_preserved(self):
        _, _, responder, _, aid = self._setup()
        client.post(f"/api/v1/responders/assignments/{aid}/reject",
                    json={"reason": "off duty"}, headers=token(responder))
        db = TestingSessionLocal()
        a = db.query(IncidentAssignment).filter(IncidentAssignment.id == aid).first()
        db.close()
        assert a.rejection_reason == "off duty"

    def test_incident_reverts_to_reported_on_rejection(self):
        _, admin, responder, inc, aid = self._setup()
        client.post(f"/api/v1/responders/assignments/{aid}/reject",
                    json={"reason": "busy"}, headers=token(responder))
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(admin))
        assert r.json()["status"] == "reported"


# ═══════════════════════════════════════════════════════════════════════════
# Status Transitions
# ═══════════════════════════════════════════════════════════════════════════

class TestStatusTransitions:
    def _full_setup(self):
        citizen = make_user("cit4@t.com")
        admin = make_user("adm4@t.com", role="admin")
        responder = make_user("res5@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        aid = assign_r.json()["id"]
        client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
        return citizen, admin, responder, inc, aid

    def test_valid_operational_chain(self):
        _, _, responder, inc, _ = self._full_setup()
        for s in ["en_route", "on_scene", "resolving", "resolved"]:
            r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                             json={"status": s}, headers=token(responder))
            assert r.status_code == 200, f"Failed at {s}: {r.json()}"
            assert r.json()["status"] == s

    def test_invalid_transition_blocked(self):
        _, _, responder, inc, _ = self._full_setup()
        # Jump from accepted directly to resolved — invalid
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "resolved"}, headers=token(responder))
        assert r.status_code == 400

    def test_admin_cannot_set_operational_status_directly(self):
        _, admin, _, inc, _ = self._full_setup()
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "en_route"}, headers=token(admin))
        assert r.status_code == 400

    def test_timeline_contains_all_transitions(self):
        citizen, admin, responder, inc, _ = self._full_setup()
        for s in ["en_route", "on_scene", "resolving", "resolved"]:
            client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": s}, headers=token(responder))
        r = client.get(f"/api/v1/incidents/{inc['id']}/timeline", headers=token(admin))
        statuses = [e["status"] for e in r.json()]
        assert "reported" in statuses
        assert "acknowledged" in statuses
        assert "verified" in statuses
        assert "assigned" in statuses
        assert "accepted" in statuses
        assert "en_route" in statuses
        assert "on_scene" in statuses
        assert "resolving" in statuses
        assert "resolved" in statuses


# ═══════════════════════════════════════════════════════════════════════════
# Responder suggestion
# ═══════════════════════════════════════════════════════════════════════════

class TestSuggestion:
    def test_suggest_returns_available_responders_sorted(self):
        citizen = make_user("cit5@t.com")
        admin = make_user("adm5@t.com", role="admin")
        # Responder close to incident
        make_user("r_close@t.com", role="responder", availability="AVAILABLE", lat=18.5, lon=73.8)
        # Responder far from incident
        make_user("r_far@t.com", role="responder", availability="AVAILABLE", lat=28.6, lon=77.2)
        # Offline responder — should not appear
        make_user("r_off@t.com", role="responder", availability="OFFLINE")
        inc = make_incident(citizen, lat=18.5, lon=73.8)
        r = client.get(f"/api/v1/responders/suggest/{inc['id']}", headers=token(admin))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        # Closest should be first
        assert data[0]["distance_km"] < data[1]["distance_km"]


# ═══════════════════════════════════════════════════════════════════════════
# Part 1 Regression
# ═══════════════════════════════════════════════════════════════════════════

class TestPart1Regression:
    def test_incident_reporting_still_works(self):
        citizen = make_user("reg1@t.com")
        r = client.post("/api/v1/incidents", json={
            "title": "Regression test",
            "type": "fire",
            "details": {"trapped": True, "injured": 3},
        }, headers=token(citizen))
        assert r.status_code == 201
        data = r.json()
        assert data["status"] == "reported"
        assert data["severity_score"] is not None
        assert data["priority"] in ("high", "critical")

    def test_triage_still_calculates_severity(self):
        citizen = make_user("reg2@t.com")
        r = client.post("/api/v1/incidents", json={
            "title": "SOS test",
            "type": "other",
            "details": {"sos": True},
        }, headers=token(citizen))
        assert r.status_code == 201
        # sos=True adds 50 + base 10 = 60 → high priority
        assert r.json()["priority"] in ("high", "critical")

    def test_admin_status_update_still_works(self):
        citizen = make_user("reg3@t.com")
        admin = make_user("adm_reg@t.com", role="admin")
        inc = make_incident(citizen)
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "acknowledged"}, headers=token(admin))
        assert r.status_code == 200
        assert r.json()["status"] == "acknowledged"

    def test_timeline_created_on_report(self):
        citizen = make_user("reg4@t.com")
        admin = make_user("adm_reg2@t.com", role="admin")
        inc = make_incident(citizen)
        r = client.get(f"/api/v1/incidents/{inc['id']}/timeline", headers=token(admin))
        assert r.status_code == 200
        assert r.json()[0]["status"] == "reported"
