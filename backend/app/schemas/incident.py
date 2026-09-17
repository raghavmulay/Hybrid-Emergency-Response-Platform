from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, validator
from enum import Enum

class IncidentType(str, Enum):
    fire = "fire"
    flood = "flood"
    medical = "medical"
    other = "other"
    road_accident = "road_accident"
    building_collapse = "building_collapse"
    electrical_hazard = "electrical_hazard"
    missing_person = "missing_person"
    trapped_person = "trapped_person"
    security_emergency = "security_emergency"
    road_blockage = "road_blockage"
    # add more as needed

class IncidentPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class IncidentStatus(str, Enum):
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
    false_alarm = "false_alarm"
    duplicate = "duplicate"
    cancelled = "cancelled"
    needs_information = "needs_information"

class CreateIncident(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    type: IncidentType
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    # Dynamic questionnaire answers – generic JSON container
    details: Optional[Any] = None
    # Optional user‑selected priority (can be omitted)
    user_selected_priority: Optional[IncidentPriority] = None

    @validator("latitude")
    def lat_range(cls, v):
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @validator("longitude")
    def lon_range(cls, v):
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

class UpdateIncident(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    details: Optional[Any] = None
    user_selected_priority: Optional[IncidentPriority] = None

    @validator("latitude")
    def lat_range(cls, v):
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @validator("longitude")
    def lon_range(cls, v):
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    reason: Optional[str] = None

class IncidentStatusHistoryResponse(BaseModel):
    status: IncidentStatus
    changed_at: datetime
    reason: Optional[str] = None

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    incident_number: str
    title: str
    description: Optional[str]
    type: IncidentType
    status: IncidentStatus
    priority: IncidentPriority
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    reporter_id: int
    created_at: datetime
    updated_at: datetime
    details: Optional[Any]
    resource_recommendations: List[str] = []
    severity_score: Optional[int] = None
    calculated_priority: IncidentPriority
    user_selected_priority: Optional[IncidentPriority] = None

    class Config:
        from_attributes = True

class IncidentListResponse(BaseModel):
    incidents: List[IncidentResponse]

    class Config:
        from_attributes = True
