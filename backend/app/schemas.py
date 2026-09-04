from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import AgentType, SenderType, TaskStatus, TrackEnum


# ---- Auth ----

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- User ----

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    track: TrackEnum
    is_active: bool
    created_at: datetime


class CVIntake(BaseModel):
    cv_raw_text: str


# ---- Task ----

class TaskCreate(BaseModel):
    title: str
    description: str
    user_id: str


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    github_link: str | None = None


class TaskMessageCreate(BaseModel):
    content: str
    # Only set when an agent posts; omitted/None means the human user posted.
    agent_type: AgentType | None = None


class TaskMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_type: SenderType
    agent_type: AgentType | None
    content: str
    created_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    status: TaskStatus
    github_link: str | None
    created_by_agent: AgentType
    created_at: datetime
    updated_at: datetime


class TaskDetailOut(TaskOut):
    messages: list[TaskMessageOut] = []
