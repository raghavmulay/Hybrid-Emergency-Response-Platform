"""
Phase 3 backend tests:
  - Security: JWT validation (invalid / expired / missing)
  - RBAC: horizontal access control (citizen A vs citizen B)
  - Audit logs: events recorded for key actions
  - Operational timestamps: set on status transitions, never overwritten
  - Duplicate detection: same type + location within 15 min flagged
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.models import Base, User, Incident, AuditLog, IncidentStatus, IncidentType
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


def make_incident(reporter: User, lat: float = 18.5204, lon: float = 73.8567,
                  inc_type: str = "fire") -> dict:
    r = client.post("/api/v1/incidents", json={
        "title": "Test incident",
        "type": inc_type,
        "details": {},
        "latitude": lat,
        "longitude": lon,
    }, headers=token(reporter))
    assert r.status_code == 201, r.text
    return r.json()


def full_workflow_to_accepted(citizen, admin, responder):
    """Drive an incident through reported → acknowledged → verified → assigned → accepted."""
    inc = make_incident(citizen)
    client.patch(f"/api/v1/incidents/{inc['id']}/status",
                 json={"status": "acknowledged"}, headers=token(admin))
    client.patch(f"/api/v1/incidents/{inc['id']}/status",
                 json={"status": "verified"}, headers=token(admin))
    assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                           json={"responder_id": responder.id}, headers=token(admin))
    aid = assign_r.json()["id"]
    client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=token(responder))
    return inc, aid


# ═══════════════════════════════════════════════════════════════════════════
# SECURITY — JWT validation
# ═══════════════════════════════════════════════════════════════════════════

class TestJWTSecurity:
    def test_missing_token_rejected(self):
        r = client.get("/api/v1/incidents/my")
        assert r.status_code == 401

    def test_invalid_token_rejected(self):
        r = client.get("/api/v1/incidents/my",
                       headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401

    def test_expired_token_rejected(self):
        user = make_user("exp@t.com")
        expired = create_access_token(
            {"sub": str(user.id), "role": user.role},
            settings.SECRET_KEY,
            expires_delta=timedelta(seconds=-1),
        )
        r = client.get("/api/v1/incidents/my",
                       headers={"Authorization": f"Bearer {expired}"})
        assert r.status_code == 401

    def test_valid_token_accepted(self):
        user = make_user("valid@t.com")
        r = client.get("/api/v1/incidents/my", headers=token(user))
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# RBAC — horizontal access control
# ═══════════════════════════════════════════════════════════════════════════

class TestHorizontalRBAC:
    def test_citizen_cannot_view_other_citizens_incident(self):
        citizen_a = make_user("ca@t.com")
        citizen_b = make_user("cb@t.com")
        inc = make_incident(citizen_a)
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(citizen_b))
        assert r.status_code in (403, 404)

    def test_citizen_can_view_own_incident(self):
        citizen = make_user("co@t.com")
        inc = make_incident(citizen)
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(citizen))
        assert r.status_code == 200

    def test_citizen_cannot_access_admin_incidents_list(self):
        citizen = make_user("cadmin@t.com")
        r = client.get("/api/v1/incidents", headers=token(citizen))
        assert r.status_code == 403

    def test_citizen_cannot_access_audit_logs(self):
        citizen = make_user("caudit@t.com")
        r = client.get("/api/v1/audit-logs", headers=token(citizen))
        assert r.status_code == 403

    def test_responder_cannot_access_audit_logs(self):
        responder = make_user("raudit@t.com", role="responder")
        r = client.get("/api/v1/audit-logs", headers=token(responder))
        assert r.status_code == 403

    def test_admin_can_access_audit_logs(self):
        admin = make_user("aaudit@t.com", role="admin")
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        assert r.status_code == 200

    def test_responder_cannot_view_unassigned_incident(self):
        citizen = make_user("cu@t.com")
        responder = make_user("ru@t.com", role="responder")
        inc = make_incident(citizen)
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(responder))
        assert r.status_code == 403

    def test_responder_cannot_modify_another_responders_availability(self):
        r1 = make_user("r1avail@t.com", role="responder")
        r2 = make_user("r2avail@t.com", role="responder")
        # r1 updates /me — should only affect r1
        client.patch("/api/v1/responders/me/availability",
                     json={"availability": "AVAILABLE"}, headers=token(r1))
        db = TestingSessionLocal()
        r2_db = db.query(User).filter(User.id == r2.id).first()
        db.close()
        assert r2_db.availability == "OFFLINE"

    def test_responder_cannot_assign_incident(self):
        citizen = make_user("cassign@t.com")
        responder = make_user("rassign@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(responder))
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════
# AUDIT LOGS
# ═══════════════════════════════════════════════════════════════════════════

class TestAuditLogs:
    def test_incident_created_logged(self):
        citizen = make_user("alog1@t.com")
        admin = make_user("alog1a@t.com", role="admin")
        make_incident(citizen)
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "INCIDENT_CREATED" in actions

    def test_status_change_logged(self):
        citizen = make_user("alog2@t.com")
        admin = make_user("alog2a@t.com", role="admin")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "INCIDENT_STATUS_CHANGED" in actions

    def test_assignment_logged(self):
        citizen = make_user("alog3@t.com")
        admin = make_user("alog3a@t.com", role="admin")
        responder = make_user("alog3r@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                    json={"responder_id": responder.id}, headers=token(admin))
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "RESPONDER_ASSIGNED" in actions

    def test_assignment_accepted_logged(self):
        citizen = make_user("alog4@t.com")
        admin = make_user("alog4a@t.com", role="admin")
        responder = make_user("alog4r@t.com", role="responder", availability="AVAILABLE")
        inc, _ = full_workflow_to_accepted(citizen, admin, responder)
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "ASSIGNMENT_ACCEPTED" in actions

    def test_assignment_rejected_logged(self):
        citizen = make_user("alog5@t.com")
        admin = make_user("alog5a@t.com", role="admin")
        responder = make_user("alog5r@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        aid = assign_r.json()["id"]
        client.post(f"/api/v1/responders/assignments/{aid}/reject",
                    json={"reason": "busy"}, headers=token(responder))
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "ASSIGNMENT_REJECTED" in actions

    def test_availability_change_logged(self):
        responder = make_user("alog6r@t.com", role="responder")
        admin = make_user("alog6a@t.com", role="admin")
        client.patch("/api/v1/responders/me/availability",
                     json={"availability": "AVAILABLE"}, headers=token(responder))
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = [l["action"] for l in r.json()["logs"]]
        assert "RESPONDER_AVAILABILITY_CHANGED" in actions

    def test_audit_log_fields_complete(self):
        citizen = make_user("alog7@t.com")
        admin = make_user("alog7a@t.com", role="admin")
        make_incident(citizen)
        r = client.get("/api/v1/audit-logs", headers=token(admin))
        log = r.json()["logs"][0]
        assert "actor_id" in log
        assert "actor_role" in log
        assert "action" in log
        assert "entity_type" in log
        assert "description" in log
        assert "created_at" in log

    def test_audit_log_filter_by_action(self):
        citizen = make_user("alog8@t.com")
        admin = make_user("alog8a@t.com", role="admin")
        make_incident(citizen)
        r = client.get("/api/v1/audit-logs?action=INCIDENT_CREATED", headers=token(admin))
        logs = r.json()["logs"]
        assert all(l["action"] == "INCIDENT_CREATED" for l in logs)

    def test_audit_log_pagination(self):
        citizen = make_user("alog9@t.com")
        admin = make_user("alog9a@t.com", role="admin")
        for i in range(5):
            make_incident(citizen)
        r = client.get("/api/v1/audit-logs?page=1&page_size=3", headers=token(admin))
        data = r.json()
        assert len(data["logs"]) <= 3
        assert data["total"] >= 5


# ═══════════════════════════════════════════════════════════════════════════
# OPERATIONAL TIMESTAMPS
# ═══════════════════════════════════════════════════════════════════════════

class TestOperationalTimestamps:
    def test_reported_at_set_on_creation(self):
        citizen = make_user("ts1@t.com")
        inc = make_incident(citizen)
        assert inc["reported_at"] is not None

    def test_acknowledged_at_set(self):
        citizen = make_user("ts2@t.com")
        admin = make_user("ts2a@t.com", role="admin")
        inc = make_incident(citizen)
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "acknowledged"}, headers=token(admin))
        assert r.json()["acknowledged_at"] is not None

    def test_verified_at_set(self):
        citizen = make_user("ts3@t.com")
        admin = make_user("ts3a@t.com", role="admin")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "verified"}, headers=token(admin))
        assert r.json()["verified_at"] is not None

    def test_assigned_at_set(self):
        citizen = make_user("ts4@t.com")
        admin = make_user("ts4a@t.com", role="admin")
        responder = make_user("ts4r@t.com", role="responder", availability="AVAILABLE")
        inc = make_incident(citizen)
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "verified"}, headers=token(admin))
        r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                        json={"responder_id": responder.id}, headers=token(admin))
        # Check incident has assigned_at
        inc_r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(admin))
        assert inc_r.json()["assigned_at"] is not None

    def test_accepted_at_set(self):
        citizen = make_user("ts5@t.com")
        admin = make_user("ts5a@t.com", role="admin")
        responder = make_user("ts5r@t.com", role="responder", availability="AVAILABLE")
        inc, _ = full_workflow_to_accepted(citizen, admin, responder)
        r = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(admin))
        assert r.json()["accepted_at"] is not None

    def test_operational_chain_timestamps(self):
        citizen = make_user("ts6@t.com")
        admin = make_user("ts6a@t.com", role="admin")
        responder = make_user("ts6r@t.com", role="responder", availability="AVAILABLE")
        inc, _ = full_workflow_to_accepted(citizen, admin, responder)
        for status, field in [
            ("en_route", "en_route_at"),
            ("on_scene", "on_scene_at"),
            ("resolving", "resolving_at"),
            ("resolved", "resolved_at"),
        ]:
            r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                             json={"status": status}, headers=token(responder))
            assert r.json()[field] is not None, f"{field} not set after {status}"

    def test_timestamp_not_overwritten(self):
        citizen = make_user("ts7@t.com")
        admin = make_user("ts7a@t.com", role="admin")
        inc = make_incident(citizen)
        r1 = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                          json={"status": "acknowledged"}, headers=token(admin))
        first_ts = r1.json()["acknowledged_at"]
        # Transition back to reported then acknowledged again
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "needs_information"}, headers=token(admin))
        client.patch(f"/api/v1/incidents/{inc['id']}/status",
                     json={"status": "acknowledged"}, headers=token(admin))
        r2 = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(admin))
        # acknowledged_at must not change
        assert r2.json()["acknowledged_at"] == first_ts


# ═══════════════════════════════════════════════════════════════════════════
# DUPLICATE DETECTION
# ═══════════════════════════════════════════════════════════════════════════

class TestDuplicateDetection:
    LAT = 18.5204
    LON = 73.8567

    def test_nearby_same_type_flagged(self):
        citizen = make_user("dup1@t.com")
        make_incident(citizen, lat=self.LAT, lon=self.LON, inc_type="fire")
        # Second incident within 100m, same type
        r = client.post("/api/v1/incidents", json={
            "title": "Another fire",
            "type": "fire",
            "details": {},
            "latitude": self.LAT + 0.0005,   # ~55m away
            "longitude": self.LON + 0.0005,
        }, headers=token(citizen))
        assert r.status_code == 201
        data = r.json()
        assert data["possible_duplicate"] is True
        assert data["duplicate_of_incident_id"] is not None

    def test_different_type_not_flagged(self):
        citizen = make_user("dup2@t.com")
        make_incident(citizen, lat=self.LAT, lon=self.LON, inc_type="fire")
        r = client.post("/api/v1/incidents", json={
            "title": "Medical nearby",
            "type": "medical",
            "details": {},
            "latitude": self.LAT + 0.0005,
            "longitude": self.LON + 0.0005,
        }, headers=token(citizen))
        assert r.status_code == 201
        assert r.json()["possible_duplicate"] is False

    def test_far_away_same_type_not_flagged(self):
        citizen = make_user("dup3@t.com")
        make_incident(citizen, lat=self.LAT, lon=self.LON, inc_type="fire")
        r = client.post("/api/v1/incidents", json={
            "title": "Far fire",
            "type": "fire",
            "details": {},
            "latitude": self.LAT + 0.05,   # ~5.5km away
            "longitude": self.LON + 0.05,
        }, headers=token(citizen))
        assert r.status_code == 201
        assert r.json()["possible_duplicate"] is False

    def test_old_incident_not_flagged(self):
        """Manually age an existing incident beyond the 15-min window."""
        citizen = make_user("dup4@t.com")
        inc_data = make_incident(citizen, lat=self.LAT, lon=self.LON, inc_type="fire")
        # Age the existing incident
        db = TestingSessionLocal()
        inc = db.query(Incident).filter(Incident.id == inc_data["id"]).first()
        inc.created_at = datetime.utcnow() - timedelta(minutes=20)
        db.commit()
        db.close()
        r = client.post("/api/v1/incidents", json={
            "title": "New fire",
            "type": "fire",
            "details": {},
            "latitude": self.LAT + 0.0005,
            "longitude": self.LON + 0.0005,
        }, headers=token(citizen))
        assert r.status_code == 201
        assert r.json()["possible_duplicate"] is False

    def test_duplicate_not_auto_rejected(self):
        """Duplicate flag must not change the incident status."""
        citizen = make_user("dup5@t.com")
        make_incident(citizen, lat=self.LAT, lon=self.LON, inc_type="flood")
        r = client.post("/api/v1/incidents", json={
            "title": "Flood nearby",
            "type": "flood",
            "details": {},
            "latitude": self.LAT + 0.0005,
            "longitude": self.LON + 0.0005,
        }, headers=token(citizen))
        assert r.json()["status"] == "reported"


# ═══════════════════════════════════════════════════════════════════════════
# FULL E2E REGRESSION
# ═══════════════════════════════════════════════════════════════════════════

class TestE2ERegression:
    def test_complete_workflow(self):
        citizen = make_user("e2e_c@t.com")
        admin = make_user("e2e_a@t.com", role="admin")
        responder = make_user("e2e_r@t.com", role="responder", availability="AVAILABLE")

        # 1. Citizen reports incident
        inc = make_incident(citizen, inc_type="medical")
        assert inc["status"] == "reported"
        assert inc["severity_score"] is not None
        assert inc["reported_at"] is not None

        # 2. Admin acknowledges
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "acknowledged"}, headers=token(admin))
        assert r.json()["acknowledged_at"] is not None

        # 3. Admin verifies
        r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                         json={"status": "verified"}, headers=token(admin))
        assert r.json()["verified_at"] is not None

        # 4. Admin assigns responder
        assign_r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                               json={"responder_id": responder.id}, headers=token(admin))
        assert assign_r.status_code == 200
        aid = assign_r.json()["id"]

        # 5. Responder accepts
        r = client.post(f"/api/v1/responders/assignments/{aid}/accept",
                        headers=token(responder))
        assert r.json()["status"] == "accepted"

        # 6. Operational chain
        for status in ["en_route", "on_scene", "resolving", "resolved"]:
            r = client.patch(f"/api/v1/incidents/{inc['id']}/status",
                             json={"status": status}, headers=token(responder))
            assert r.status_code == 200, f"Failed at {status}: {r.text}"

        # 7. Citizen sees resolved timeline
        tl = client.get(f"/api/v1/incidents/{inc['id']}/timeline", headers=token(citizen))
        statuses = [e["status"] for e in tl.json()]
        for s in ["reported", "acknowledged", "verified", "assigned",
                  "accepted", "en_route", "on_scene", "resolving", "resolved"]:
            assert s in statuses, f"Missing {s} in timeline"

        # 8. Audit log has all key events
        audit_r = client.get("/api/v1/audit-logs", headers=token(admin))
        actions = {l["action"] for l in audit_r.json()["logs"]}
        assert "INCIDENT_CREATED" in actions
        assert "INCIDENT_STATUS_CHANGED" in actions
        assert "RESPONDER_ASSIGNED" in actions
        assert "ASSIGNMENT_ACCEPTED" in actions

        # 9. Final incident has all timestamps
        final = client.get(f"/api/v1/incidents/{inc['id']}", headers=token(admin)).json()
        for field in ["reported_at", "acknowledged_at", "verified_at", "assigned_at",
                      "accepted_at", "en_route_at", "on_scene_at", "resolving_at", "resolved_at"]:
            assert final[field] is not None, f"{field} is None"
