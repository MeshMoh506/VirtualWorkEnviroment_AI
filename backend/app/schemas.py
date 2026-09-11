from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import (
    AgentType,
    ProjectStatus,
    ReviewKind,
    SenderType,
    TaskStatus,
    TrackEnum,
    WeekStatus,
)


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
    has_cv: bool


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
    # week_id/deadline are None for tasks outside the weekly-cycle flow
    # (the original flat model, or ad hoc/admin-created tasks).
    week_id: str | None
    deadline: datetime | None
    submitted_at: datetime | None
    completed_at: datetime | None
    # None until both deadline and completed_at exist — see Task.is_late.
    is_late: bool | None
    created_at: datetime
    updated_at: datetime


class TaskDetailOut(TaskOut):
    messages: list[TaskMessageOut] = []


# ---- Project & Week (weekly-cycle flow — see docs/STAGE1_PRODUCT_FLOW.md).
# No creation endpoints yet; these exist so the shape is ready once the
# orchestration that populates them (start a week, release the next
# subtask, run the end-of-week cascade) lands. ----

class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class WeekOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    week_number: int
    status: WeekStatus
    big_task_title: str
    big_task_description: str
    next_subtask_index: int
    started_at: datetime
    target_end_at: datetime
    ended_at: datetime | None


# ---- Review & Employee File (agent logic output — see app/agents/) ----

class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str | None
    week_id: str | None
    agent_type: AgentType
    kind: ReviewKind
    content: str
    # Mentor (TASK_REVIEW): {verdict, categories, comments} — see
    # agents/tools.py's SUBMIT_REVIEW_TOOL. HR SKILLS_ROLLUP:
    # {reviewed_task_count, average_score}. WEEK_PROGRESS/BEHAVIORAL:
    # contract not yet defined — lands with the end-of-week cascade.
    metrics_json: dict | None
    created_at: datetime


class EmployeeFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Each holds {} until HR's first rollup, then {"items": [...]} — see
    # agents/hr.py's storage note.
    skills_json: dict
    strengths_json: dict
    growth_areas_json: dict
    summary_text: str | None
    updated_at: datetime
