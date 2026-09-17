from pydantic import BaseModel

class UserOut(BaseModel):
    id: int
    email: str
    is_active: bool
    role: str

    class Config:
        from_attributes = True

class RoleUpdate(BaseModel):
    role: str
