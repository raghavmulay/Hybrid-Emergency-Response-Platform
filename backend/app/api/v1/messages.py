from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_current_admin, get_db
from app.db.models import ConversationMember, Message, PredefinedMessage, User

router = APIRouter(tags=["Messages"])

PRIORITY_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


# ─────────────────────────── Schemas ─────────────────────────────────────────

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


# ─────────────────────────── Message Endpoints ───────────────────────────────

@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Verify sender is member of conversation
    member = db.query(ConversationMember).filter_by(
        conversation_id=body.conversation_id, user_id=current_user.id
    ).first()
    if not member and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    if body.is_emergency and body.priority and body.priority not in PRIORITY_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Priority must be one of: {', '.join(PRIORITY_LEVELS)}"
        )

    msg = Message(
        conversation_id=body.conversation_id,
        sender_id=current_user.id,
        content=body.content,
        is_emergency=body.is_emergency,
        priority=body.priority,
        score=body.score,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        safe_routes=body.safe_routes,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    member = db.query(ConversationMember).filter_by(
        conversation_id=conversation_id, user_id=current_user.id
    ).first()
    if not member and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    return db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp).all()


@router.get("/admin/emergency-messages", response_model=List[MessageOut])
@router.get("/messages/emergency", response_model=List[MessageOut])
def list_emergency_messages(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin: list all emergency messages sorted by priority and score."""
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    messages = db.query(Message).filter(Message.is_emergency == True).all()
    messages.sort(key=lambda m: (priority_order.get(m.priority or "LOW", 4), -(m.score or 0)))
    return messages


@router.put("/messages/{message_id}", response_model=MessageOut)
def edit_message(
    message_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    # Only sender or admin can edit
    if msg.sender_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
    # Update fields (allow partial update)
    if body.content:
        msg.content = body.content
    msg.is_emergency = body.is_emergency
    msg.priority = body.priority
    msg.score = body.score
    msg.latitude = body.latitude
    msg.longitude = body.longitude
    msg.address = body.address
    msg.safe_routes = body.safe_routes
    db.commit()
    db.refresh(msg)
    return msg

@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    db.delete(msg)
    db.commit()
    return None

# ─────────────────────── Predefined Message Endpoints ────────────────────────

@router.get("/predefined-messages", response_model=List[PredefinedMessageOut])
def list_predefined(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Return all predefined emergency messages for users to pick from."""
    return db.query(PredefinedMessage).all()


@router.post("/predefined-messages", response_model=PredefinedMessageOut, status_code=status.HTTP_201_CREATED)
def create_predefined(
    body: PredefinedMessageCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin only: add a new predefined message."""
    pm = PredefinedMessage(title=body.title, content=body.content, category=body.category)
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.delete("/predefined-messages/{pm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_predefined(
    pm_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin only: delete a predefined message."""
    pm = db.query(PredefinedMessage).filter(PredefinedMessage.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Predefined message not found")
    db.delete(pm)
    db.commit()
    return None
