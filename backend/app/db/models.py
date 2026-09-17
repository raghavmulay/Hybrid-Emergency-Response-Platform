from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey, JSON, Enum
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=False)
    role = Column(String, default="user")  # "user" | "admin" | "responder"
    availability = Column(String, default="OFFLINE") # "AVAILABLE" | "BUSY" | "OFFLINE"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversations = relationship("ConversationMember", back_populates="user")
    messages = relationship("Message", back_populates="sender")
    owned_conversations = relationship("Conversation", back_populates="owner")
    incidents_reported = relationship("Incident", back_populates="reporter", foreign_keys="Incident.reporter_id")
    assignments = relationship("IncidentAssignment", back_populates="responder", foreign_keys="IncidentAssignment.responder_id")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_conversations")
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", back_populates="conversations")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Emergency-specific fields (preserved)
    is_emergency = Column(Boolean, default=False)
    priority = Column(String, nullable=True)        # LOW | MEDIUM | HIGH | CRITICAL
    score = Column(Integer, nullable=True)          # 1-10 severity score
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(Text, nullable=True)
    safe_routes = Column(JSON, nullable=True)       # list of route strings

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="messages")


class PredefinedMessage(Base):
    __tablename__ = "predefined_messages"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=True)  # e.g. "fire", "flood", "medical"


# ---------------------------------------------------------------------------
# Incident Enums
# ---------------------------------------------------------------------------

class IncidentType(PyEnum):
    fire = "fire"
    flood = "flood"
    medical = "medical"
    road_accident = "road_accident"
    building_collapse = "building_collapse"
    electrical_hazard = "electrical_hazard"
    missing_person = "missing_person"
    trapped_person = "trapped_person"
    security_emergency = "security_emergency"
    road_blockage = "road_blockage"
    other = "other"


class IncidentStatus(PyEnum):
    reported = "reported"
    acknowledged = "acknowledged"
    verified = "verified"
    assigned = "assigned"
    accepted = "accepted"
    en_route = "en_route"
    on_scene = "on_scene"
    resolving = "resolving"
    resolved = "resolved"
    rejected = "rejected"
    cancelled = "cancelled"
    duplicate = "duplicate"
    false_alarm = "false_alarm"
    needs_information = "needs_information"


class IncidentPriority(PyEnum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ---------------------------------------------------------------------------
# Incident Model
# ---------------------------------------------------------------------------

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_number = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(IncidentType), nullable=False, default=IncidentType.other)
    status = Column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.reported)
    priority = Column(Enum(IncidentPriority), nullable=False, default=IncidentPriority.low)
    calculated_priority = Column(Enum(IncidentPriority), nullable=True)
    user_selected_priority = Column(Enum(IncidentPriority), nullable=True)
    severity_score = Column(Integer, nullable=True, default=0)
    priority_reason = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)                   # Dynamic questionnaire answers
    resource_recommendations = Column(JSON, nullable=True)  # List of resource category strings
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Phase 3: duplicate detection
    possible_duplicate = Column(Boolean, default=False, nullable=False)
    duplicate_of_incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)

    # Phase 3: operational timestamps (set once, never overwritten)
    reported_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    en_route_at = Column(DateTime, nullable=True)
    on_scene_at = Column(DateTime, nullable=True)
    resolving_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    reporter = relationship("User", back_populates="incidents_reported", foreign_keys=[reporter_id])
    status_history = relationship("IncidentStatusHistory", back_populates="incident", cascade="all, delete-orphan")
    assignments = relationship("IncidentAssignment", back_populates="incident", cascade="all, delete-orphan")


class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    status = Column(Enum(IncidentStatus), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="status_history")


class AssignmentStatus(PyEnum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    cancelled = "cancelled"
    completed = "completed"


class IncidentAssignment(Base):
    __tablename__ = "incident_assignments"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    responder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.pending)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="assignments")
    responder = relationship("User", back_populates="assignments", foreign_keys=[responder_id])


# ---------------------------------------------------------------------------
# Phase 3: Audit Log
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for SYSTEM actions
    actor_role = Column(String, nullable=False)   # CITIZEN | RESPONDER | ADMIN | SYSTEM
    action = Column(String, nullable=False, index=True)  # e.g. INCIDENT_CREATED
    entity_type = Column(String, nullable=False, index=True)  # INCIDENT | ASSIGNMENT | RESPONDER | USER
    entity_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
