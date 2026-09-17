"""
Full integration test suite for Phase 2 of the Emergency Info System.
Tests cover:
  - Auth: register, email verification, login
  - RBAC: user vs admin access
  - Users: /me, admin list/delete/role-update
  - Conversations: create, list, get, update, delete, member management
  - Messages: regular and emergency, conversation message list, admin emergency view
  - Predefined messages: list and admin CRUD
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.models import Base
from app.db.init_db import get_db
from app.core.config import settings
from app.core.security import (
    create_email_verification_token,
    create_access_token,
    get_password_hash,
)
from app.db.models import User, PredefinedMessage

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


# ────────────────── Helpers ───────────────────────────────────────────────────

def make_user(email: str, password: str = "testpass", role: str = "user", active: bool = True) -> User:
    """Directly create a user in the test DB."""
    db = TestingSessionLocal()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        is_active=active,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def get_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "role": user.role}, settings.SECRET_KEY)


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {get_token(user)}"}


# ══════════════════════════════════════════════════════════════════════════════
# AUTH TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    def test_register_success(self):
        r = client.post("/api/v1/auth/register", json={"email": "a@test.com", "password": "secret1"})
        assert r.status_code == 201
        assert "Registered" in r.json()["msg"]

    def test_register_duplicate_email(self):
        client.post("/api/v1/auth/register", json={"email": "dup@test.com", "password": "secret1"})
        r = client.post("/api/v1/auth/register", json={"email": "dup@test.com", "password": "secret1"})
        assert r.status_code == 400

    def test_login_fails_before_verification(self):
        client.post("/api/v1/auth/register", json={"email": "b@test.com", "password": "secret1"})
        r = client.post("/api/v1/auth/login", json={"email": "b@test.com", "password": "secret1"})
        assert r.status_code == 403

    def test_email_verification_and_login(self):
        client.post("/api/v1/auth/register", json={"email": "c@test.com", "password": "secret1"})
        # Fetch user from DB and generate verification token
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "c@test.com").first()
        db.close()
        token = create_email_verification_token(user.id, settings.SECRET_KEY)
        r = client.get(f"/api/v1/auth/verify-email?token={token}")
        assert r.status_code == 200
        # Now login
        r2 = client.post("/api/v1/auth/login", json={"email": "c@test.com", "password": "secret1"})
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    def test_login_wrong_password(self):
        make_user("d@test.com")
        r = client.post("/api/v1/auth/login", json={"email": "d@test.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_invalid_verification_token(self):
        r = client.get("/api/v1/auth/verify-email?token=bad:token:123")
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# USERS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestUsers:
    def test_get_me(self):
        user = make_user("me@test.com")
        r = client.get("/api/v1/users/me", headers=auth_headers(user))
        assert r.status_code == 200
        assert r.json()["email"] == "me@test.com"

    def test_get_me_unauthenticated(self):
        r = client.get("/api/v1/users/me")
        assert r.status_code == 401

    def test_admin_list_users(self):
        make_user("u1@test.com")
        admin = make_user("admin@test.com", role="admin")
        r = client.get("/api/v1/users/", headers=auth_headers(admin))
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_non_admin_cannot_list_users(self):
        user = make_user("u2@test.com")
        r = client.get("/api/v1/users/", headers=auth_headers(user))
        assert r.status_code == 403

    def test_admin_update_role(self):
        target = make_user("target@test.com")
        admin = make_user("admin2@test.com", role="admin")
        r = client.patch(
            f"/api/v1/users/{target.id}/role",
            json={"role": "admin"},
            headers=auth_headers(admin),
        )
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_delete_user(self):
        target = make_user("del@test.com")
        admin = make_user("admin3@test.com", role="admin")
        r = client.delete(f"/api/v1/users/{target.id}", headers=auth_headers(admin))
        assert r.status_code == 204


# ══════════════════════════════════════════════════════════════════════════════
# CONVERSATION TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestConversations:
    def test_create_conversation(self):
        user = make_user("conv@test.com")
        r = client.post("/api/v1/conversations/", json={"title": "Test Room"}, headers=auth_headers(user))
        assert r.status_code == 201
        assert r.json()["title"] == "Test Room"

    def test_list_my_conversations(self):
        user = make_user("list@test.com")
        client.post("/api/v1/conversations/", json={"title": "Room 1"}, headers=auth_headers(user))
        r = client.get("/api/v1/conversations/", headers=auth_headers(user))
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_get_conversation(self):
        user = make_user("get@test.com")
        c = client.post("/api/v1/conversations/", json={"title": "GetRoom"}, headers=auth_headers(user)).json()
        r = client.get(f"/api/v1/conversations/{c['id']}", headers=auth_headers(user))
        assert r.status_code == 200

    def test_update_conversation(self):
        user = make_user("upd@test.com")
        c = client.post("/api/v1/conversations/", json={"title": "Old"}, headers=auth_headers(user)).json()
        r = client.put(f"/api/v1/conversations/{c['id']}", json={"title": "New"}, headers=auth_headers(user))
        assert r.status_code == 200
        assert r.json()["title"] == "New"

    def test_delete_conversation(self):
        user = make_user("dconv@test.com")
        c = client.post("/api/v1/conversations/", json={"title": "ToDelete"}, headers=auth_headers(user)).json()
        r = client.delete(f"/api/v1/conversations/{c['id']}", headers=auth_headers(user))
        assert r.status_code == 204

    def test_add_and_remove_member(self):
        owner = make_user("owner@test.com")
        member_user = make_user("member@test.com")
        c = client.post("/api/v1/conversations/", json={"title": "Members"}, headers=auth_headers(owner)).json()
        # Add
        r = client.post(
            f"/api/v1/conversations/{c['id']}/members",
            json={"user_id": member_user.id},
            headers=auth_headers(owner),
        )
        assert r.status_code == 201
        # Remove
        r2 = client.delete(
            f"/api/v1/conversations/{c['id']}/members/{member_user.id}",
            headers=auth_headers(owner),
        )
        assert r2.status_code == 204


# ══════════════════════════════════════════════════════════════════════════════
# MESSAGE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestMessages:
    def _setup(self):
        user = make_user("msg@test.com")
        c = client.post("/api/v1/conversations/", json={"title": "MsgRoom"}, headers=auth_headers(user)).json()
        return user, c

    def test_send_regular_message(self):
        user, c = self._setup()
        r = client.post(
            "/api/v1/messages",
            json={"conversation_id": c["id"], "content": "Hello!"},
            headers=auth_headers(user),
        )
        assert r.status_code == 201
        assert r.json()["content"] == "Hello!"
        assert not r.json()["is_emergency"]

    def test_send_emergency_message(self):
        user, c = self._setup()
        r = client.post(
            "/api/v1/messages",
            json={
                "conversation_id": c["id"],
                "content": "FIRE at building A",
                "is_emergency": True,
                "priority": "CRITICAL",
                "score": 9,
                "latitude": 18.52,
                "longitude": 73.85,
                "address": "Building A, Pune",
                "safe_routes": ["Exit via Gate 1", "Emergency Stairs Block B"],
            },
            headers=auth_headers(user),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["is_emergency"] is True
        assert data["priority"] == "CRITICAL"
        assert data["score"] == 9
        assert data["latitude"] == 18.52
        assert len(data["safe_routes"]) == 2

    def test_list_conversation_messages(self):
        user, c = self._setup()
        client.post("/api/v1/messages", json={"conversation_id": c["id"], "content": "Msg 1"}, headers=auth_headers(user))
        r = client.get(f"/api/v1/conversations/{c['id']}/messages", headers=auth_headers(user))
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_admin_emergency_view(self):
        user = make_user("emg@test.com")
        admin = make_user("adminem@test.com", role="admin")
        c = client.post("/api/v1/conversations/", json={"title": "EmgRoom"}, headers=auth_headers(user)).json()
        client.post("/api/v1/messages", json={
            "conversation_id": c["id"],
            "content": "Flood!",
            "is_emergency": True,
            "priority": "HIGH",
            "score": 7,
        }, headers=auth_headers(user))
        r = client.get("/api/v1/admin/emergency-messages", headers=auth_headers(admin))
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_invalid_priority_rejected(self):
        user, c = self._setup()
        r = client.post("/api/v1/messages", json={
            "conversation_id": c["id"],
            "content": "Bad",
            "is_emergency": True,
            "priority": "EXTREME",
        }, headers=auth_headers(user))
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# PREDEFINED MESSAGE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestPredefinedMessages:
    def test_list_predefined(self):
        user = make_user("pre@test.com")
        r = client.get("/api/v1/predefined-messages", headers=auth_headers(user))
        assert r.status_code == 200

    def test_admin_create_predefined(self):
        admin = make_user("admpre@test.com", role="admin")
        r = client.post("/api/v1/predefined-messages", json={
            "title": "Fire Alert",
            "content": "There is a fire. Evacuate immediately.",
            "category": "fire",
        }, headers=auth_headers(admin))
        assert r.status_code == 201
        assert r.json()["title"] == "Fire Alert"

    def test_non_admin_cannot_create_predefined(self):
        user = make_user("preuser@test.com")
        r = client.post("/api/v1/predefined-messages", json={
            "title": "Flood Alert",
            "content": "Flood detected.",
        }, headers=auth_headers(user))
        assert r.status_code == 403

    def test_admin_delete_predefined(self):
        admin = make_user("admdel@test.com", role="admin")
        pm = client.post("/api/v1/predefined-messages", json={
            "title": "ToDelete", "content": "Delete me"
        }, headers=auth_headers(admin)).json()
        r = client.delete(f"/api/v1/predefined-messages/{pm['id']}", headers=auth_headers(admin))
        assert r.status_code == 204
