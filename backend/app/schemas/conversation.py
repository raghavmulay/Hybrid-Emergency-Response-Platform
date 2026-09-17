from datetime import datetime
from pydantic import BaseModel

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
