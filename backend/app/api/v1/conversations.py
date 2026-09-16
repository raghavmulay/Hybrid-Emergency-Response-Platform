from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_current_admin, get_db
from typing import List
from app.db.models import Conversation, ConversationMember, User

router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ─────────────────────────── Schemas ─────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str


class ConversationUpdate(BaseModel):
    title: str


class ConversationOut(BaseModel):
    id: int
    title: str
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MemberAdd(BaseModel):
    user_id: int


# ─────────────────────────── Endpoints ───────────────────────────────────────

@router.post("/", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    body: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = Conversation(title=body.title, owner_id=current_user.id)
    db.add(convo)
    db.flush()  # get convo.id before commit
    # Auto-add creator as member
    member = ConversationMember(conversation_id=convo.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(convo)
    return convo


@router.get("", response_model=List[ConversationOut])
@router.get("/", response_model=List[ConversationOut])
def list_my_conversations(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[Conversation]:
    """Return conversations the current user is a member of with pagination.

    Admins see all conversations.
    """
    if current_user.role == "admin":
        return db.query(Conversation).offset(skip).limit(limit).all()
    memberships = db.query(ConversationMember).filter(
        ConversationMember.user_id == current_user.id
    ).all()
    conv_ids = [m.conversation_id for m in memberships]
    return (
        db.query(Conversation)
        .filter(Conversation.id.in_(conv_ids))
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Only members can view
    member = db.query(ConversationMember).filter_by(
        conversation_id=conversation_id, user_id=current_user.id
    ).first()
    if not member and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
    return convo


@router.put("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner can update this conversation")
    convo.title = body.title
    db.commit()
    db.refresh(convo)
    return convo


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner can delete this conversation")
    db.delete(convo)
    db.commit()
    return None


@router.post("/{conversation_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    conversation_id: int,
    body: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner can add members")
    # Check target user exists
    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Avoid duplicate
    existing = db.query(ConversationMember).filter_by(
        conversation_id=conversation_id, user_id=body.user_id
    ).first()
    if existing:
        return {"msg": "User already a member"}
    db.add(ConversationMember(conversation_id=conversation_id, user_id=body.user_id))
    db.commit()
    return {"msg": "Member added"}


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner can remove members")
    member = db.query(ConversationMember).filter_by(
        conversation_id=conversation_id, user_id=user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return None
