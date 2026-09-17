"""
Part 2 End-to-End Acceptance Test — all 20 steps from the spec.
Run from backend/ directory: python e2e_acceptance.py
"""
import os
import sys

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.models import Base, User
from app.db.init_db import get_db
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings

DB_PATH = "./e2e_test.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)


def override_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def make_user(email, role="user", avail="OFFLINE", lat=None, lon=None):
    db = Session()
    u = User(
        email=email,
        hashed_password=get_password_hash("pass"),
        is_active=True,
        role=role,
        availability=avail,
        latitude=lat,
        longitude=lon,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    db.close()
    return u


def tok(u):
    t = create_access_token({"sub": str(u.id), "role": u.role}, settings.SECRET_KEY)
    return {"Authorization": f"Bearer {t}"}


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}  {detail}")
        sys.exit(1)


print("=" * 60)
print("  PART 2 — END-TO-END ACCEPTANCE TEST")
print("=" * 60)

# ── Step 1: Create users ──────────────────────────────────────
citizen = make_user("citizen@e2e.com")
admin   = make_user("admin@e2e.com",  role="admin")
respA   = make_user("respA@e2e.com",  role="responder", avail="OFFLINE", lat=18.50, lon=73.80)
respB   = make_user("respB@e2e.com",  role="responder", avail="OFFLINE", lat=18.60, lon=73.90)
check("Step 1 — Users created (citizen, admin, respA, respB)", True)

# ── Step 2: Set both responders AVAILABLE ─────────────────────
r = client.patch("/api/v1/responders/me/availability", json={"availability": "AVAILABLE"}, headers=tok(respA))
check("Step 2a — Responder A set AVAILABLE", r.status_code == 200 and r.json()["availability"] == "AVAILABLE", r.text)
r = client.patch("/api/v1/responders/me/availability", json={"availability": "AVAILABLE"}, headers=tok(respB))
check("Step 2b — Responder B set AVAILABLE", r.status_code == 200 and r.json()["availability"] == "AVAILABLE", r.text)

# ── Step 3: Citizen creates high/critical accident incident ───
r = client.post("/api/v1/incidents", json={
    "title": "Critical Road Accident",
    "type": "road_accident",
    "details": {"injured": 5, "trapped": True, "children": True},
    "latitude": 18.52,
    "longitude": 73.85,
    "address": "NH4 Pune",
}, headers=tok(citizen))
check("Step 3 — Incident created (201)", r.status_code == 201, r.text)
inc = r.json()
check("Step 3 — Priority is high or critical", inc["priority"] in ("high", "critical"), inc["priority"])
check("Step 3 — Status is reported", inc["status"] == "reported")
check("Step 3 — Resource recommendations present", len(inc["resource_recommendations"]) > 0)
print(f"         incident_number={inc['incident_number']}  priority={inc['priority']}  resources={inc['resource_recommendations']}")

# ── Step 4: Admin sees incident in Command Center ─────────────
r = client.get("/api/v1/incidents", headers=tok(admin))
check("Step 4 — Admin lists incidents (200)", r.status_code == 200, r.text)
check("Step 4 — Incident appears in list", any(i["id"] == inc["id"] for i in r.json()["incidents"]))

# ── Step 5: Admin opens incident ─────────────────────────────
r = client.get(f"/api/v1/incidents/{inc['id']}", headers=tok(admin))
check("Step 5 — Admin opens incident (200)", r.status_code == 200, r.text)

# ── Step 6: Admin sees resources and suggested responders ─────
r = client.get(f"/api/v1/responders/suggest/{inc['id']}", headers=tok(admin))
check("Step 6 — Suggest endpoint returns 200", r.status_code == 200, r.text)
suggestions = r.json()
check("Step 6 — Both AVAILABLE responders suggested", len(suggestions) == 2, str(len(suggestions)))
check("Step 6 — Sorted by distance (closer first)", suggestions[0]["distance_km"] <= suggestions[1]["distance_km"])
print(f"         suggestions: {[(s['email'], s['distance_km']) for s in suggestions]}")

# ── Steps 7+8: Admin verifies then assigns Responder A ────────
r = client.patch(f"/api/v1/incidents/{inc['id']}/status", json={"status": "acknowledged"}, headers=tok(admin))
check("Step 7a — Admin acknowledges incident", r.status_code == 200, r.text)
r = client.patch(f"/api/v1/incidents/{inc['id']}/status", json={"status": "verified"}, headers=tok(admin))
check("Step 7b — Admin verifies incident", r.status_code == 200, r.text)
r = client.post(f"/api/v1/responders/incidents/{inc['id']}/assign",
                json={"responder_id": respA.id}, headers=tok(admin))
check("Step 8 — Admin assigns Responder A (200)", r.status_code == 200, r.text)
assignment = r.json()
check("Step 8 — Assignment status is pending", assignment["status"] == "pending")
aid = assignment["id"]
print(f"         assignment_id={aid}")

# ── Step 9: Responder A receives the assignment ───────────────
r = client.get("/api/v1/responders/me/assignments", headers=tok(respA))
check("Step 9 — Responder A sees assignment", any(a["id"] == aid for a in r.json()), r.text)

# ── Step 10: Responder A accepts ─────────────────────────────
r = client.post(f"/api/v1/responders/assignments/{aid}/accept", headers=tok(respA))
check("Step 10 — Responder A accepts (200)", r.status_code == 200, r.text)
check("Step 10 — Assignment status = accepted", r.json()["status"] == "accepted")
check("Step 10 — accepted_at recorded", r.json()["accepted_at"] is not None)

# ── Step 11: Incident becomes ACCEPTED ───────────────────────
r = client.get(f"/api/v1/incidents/{inc['id']}", headers=tok(respA))
check("Step 11 — Incident status = accepted", r.json()["status"] == "accepted", r.json()["status"])

# ── Steps 12-15: Operational status chain ────────────────────
for step, s in [(12, "en_route"), (13, "on_scene"), (14, "resolving"), (15, "resolved")]:
    r = client.patch(f"/api/v1/incidents/{inc['id']}/status", json={"status": s}, headers=tok(respA))
    check(f"Step {step} — Responder A updates to {s}", r.status_code == 200 and r.json()["status"] == s, r.text)

# ── Step 16: Verify full timeline ────────────────────────────
r = client.get(f"/api/v1/incidents/{inc['id']}/timeline", headers=tok(admin))
check("Step 16 — Timeline endpoint (200)", r.status_code == 200, r.text)
tl_statuses = [e["status"] for e in r.json()]
expected_statuses = ["reported", "acknowledged", "verified", "assigned", "accepted",
                     "en_route", "on_scene", "resolving", "resolved"]
for s in expected_statuses:
    check(f"Step 16 — Timeline contains '{s}'", s in tl_statuses, f"got {tl_statuses}")
print(f"         full timeline: {tl_statuses}")

# ── Step 17: Verify assignment history ───────────────────────
r = client.get(f"/api/v1/incidents/{inc['id']}/assignments", headers=tok(admin))
check("Step 17 — Assignments endpoint (200)", r.status_code == 200, r.text)
assignments = r.json()
check("Step 17 — Exactly 1 assignment record", len(assignments) == 1, str(len(assignments)))
a = assignments[0]
check("Step 17 — Assignment status = completed", a["status"] == "completed", a["status"])
check("Step 17 — accepted_at recorded", a["accepted_at"] is not None)
check("Step 17 — completed_at recorded", a["completed_at"] is not None)
print(f"         assignment: status={a['status']}  accepted_at={str(a['accepted_at'])[:19]}  completed_at={str(a['completed_at'])[:19]}")

# ── Step 18: Admin sees live updates ─────────────────────────
r = client.get("/api/v1/incidents", headers=tok(admin))
fi = next(i for i in r.json()["incidents"] if i["id"] == inc["id"])
check("Step 18 — Admin sees incident as resolved", fi["status"] == "resolved", fi["status"])

# ── Step 19: Citizen sees incident progression ───────────────
r = client.get("/api/v1/incidents/my", headers=tok(citizen))
ci = next(i for i in r.json()["incidents"] if i["id"] == inc["id"])
check("Step 19 — Citizen sees incident as resolved", ci["status"] == "resolved", ci["status"])

# ── Step 20: Existing chat still works ───────────────────────
r = client.post("/api/v1/conversations/", json={"title": "Emergency Chat"}, headers=tok(citizen))
check("Step 20 — Citizen can create conversation (201)", r.status_code == 201, r.text)
conv_id = r.json()["id"]
r = client.post("/api/v1/messages", json={"conversation_id": conv_id, "content": "Help needed!"}, headers=tok(citizen))
check("Step 20 — Citizen can send message (201)", r.status_code == 201, r.text)
r = client.get(f"/api/v1/conversations/{conv_id}/messages", headers=tok(citizen))
check("Step 20 — Messages retrievable", r.status_code == 200 and len(r.json()) == 1, r.text)

print()
print("=" * 60)
print("  ALL 20 E2E ACCEPTANCE STEPS PASSED")
print("=" * 60)

# Cleanup
os.remove(DB_PATH)
