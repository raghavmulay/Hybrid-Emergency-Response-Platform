from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class MessageCreate(BaseModel):
    conversation_id: int
    content: str
    # Emergency fields (all optional)
    is_emergency: bool = False
    priority: Optional[str] = Field(None, description="LOW | MEDIUM | HIGH | CRITICAL")
    score: Optional[int] = Field(None, ge=1, le=10, description="Severity 1–10")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    safe_routes: Optional[List[str]] = None

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    timestamp: datetime
    is_emergency: bool
    priority: Optional[str]
    score: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    safe_routes: Optional[List[str]]

    class Config:
        from_attributes = True

class PredefinedMessageCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = None

class PredefinedMessageOut(BaseModel):
    id: int
    title: str
    content: str
    category: Optional[str]

    class Config:
        from_attributes = True
