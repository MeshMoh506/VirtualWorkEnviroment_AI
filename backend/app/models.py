import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TrackEnum(str, enum.Enum):
    JUNIOR_DEV = "junior_dev"  # only track that exists in Stage 1


class AgentType(str, enum.Enum):
    MANAGER = "manager"
    MENTOR = "mentor"
    HR = "hr"


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"


class SenderType(str, enum.Enum):
    USER = "user"
    AGENT = "agent"


# ---------------------------------------------------------------------------
# Organization — not used in Stage 1, exists now so Stage 3 (companies build
# their own Venvs) is additive instead of a schema rewrite. Every core table
# below carries a nullable organization_id for the same reason.
# ---------------------------------------------------------------------------

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )

    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)

    track: Mapped[TrackEnum] = mapped_column(
        Enum(TrackEnum), default=TrackEnum.JUNIOR_DEV, nullable=False
    )

    # Raw CV text stored at intake; structured parsing is owned by the
    # AI/Agents team and can populate employee_file.skills_json downstream.
    cv_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    employee_file: Mapped["EmployeeFile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class EmployeeFile(Base):
    """
    The persistent, shared record all three agents read from and write to.
    This is what makes the agents feel like one workplace rather than three
    isolated chatbots — Manager reads it to calibrate task difficulty, Mentor
    writes findings into it, HR summarizes it into reviews.
    """

    __tablename__ = "employee_files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False
    )

    skills_json: Mapped[dict] = mapped_column(JSON, default=dict)
    strengths_json: Mapped[dict] = mapped_column(JSON, default=dict)
    growth_areas_json: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="employee_file")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.TODO, nullable=False
    )
    github_link: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_agent: Mapped[AgentType] = mapped_column(
        Enum(AgentType), default=AgentType.MANAGER, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="tasks")
    messages: Mapped[list["TaskMessage"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskMessage.created_at"
    )
    reviews: Mapped[list["Review"]] = relationship(back_populates="task")


class TaskMessage(Base):
    """The threaded comment view under each task card."""

    __tablename__ = "task_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)

    sender_type: Mapped[SenderType] = mapped_column(Enum(SenderType), nullable=False)
    agent_type: Mapped[AgentType | None] = mapped_column(Enum(AgentType), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["Task"] = relationship(back_populates="messages")


class Review(Base):
    """
    Mentor reviews are tied to a task_id. HR reviews are periodic and roll up
    multiple tasks, so task_id is nullable for that case.
    """

    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)

    agent_type: Mapped[AgentType] = mapped_column(Enum(AgentType), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metrics_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="reviews")
    task: Mapped["Task"] = relationship(back_populates="reviews")
