import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
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


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class WeekStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class ReviewKind(str, enum.Enum):
    """Distinguishes the four review shapes that now share the `reviews`
    table — see STAGE1_PRODUCT_FLOW.md's end-of-week cascade. Each kind's
    metrics_json contract is documented at its creation site."""
    TASK_REVIEW = "task_review"        # Mentor, per submitted subtask (existing)
    WEEK_PROGRESS = "week_progress"    # Manager, end-of-week progress review
    BEHAVIORAL = "behavioral"          # HR, end-of-week attendance/consistency eval
    SKILLS_ROLLUP = "skills_rollup"    # HR, periodic Employee File rollup (existing)


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

    @property
    def has_cv(self) -> bool:
        """Whether cv_raw_text has been set — exposed via UserOut so the
        frontend can offer the CV step once without re-nagging on every
        login, and without shipping the raw text itself in /users/me."""
        return bool(self.cv_raw_text)

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
    projects: Mapped[list["Project"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weeks: Mapped[list["Week"]] = relationship(back_populates="user", cascade="all, delete-orphan")


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


# ---------------------------------------------------------------------------
# Project & Week — the weekly-cycle flow (docs/STAGE1_PRODUCT_FLOW.md).
# A Project is the "main project" introduced during orientation. A Week is
# one 5-workday cycle within it: the Manager defines that week's "big task"
# up front, plans it out into subtasks_plan_json (decided together, per the
# spec), then hands subtasks to the graduate one at a time by creating real
# Task rows from that plan as each prior one is approved — see
# next_subtask_index. Orchestration that actually populates these (starting
# a week, releasing the next subtask, running the end-of-week cascade) is
# the next body of work; this schema is what it will build on.
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="projects")
    weeks: Mapped[list["Week"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Week.week_number"
    )


class Week(Base):
    __tablename__ = "weeks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    # Denormalized alongside project_id, matching Task/Review's existing
    # user_id pattern — keeps "give me this user's weeks" a plain filter.
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)

    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[WeekStatus] = mapped_column(
        Enum(WeekStatus), default=WeekStatus.ACTIVE, nullable=False
    )

    big_task_title: Mapped[str] = mapped_column(String, nullable=False)
    big_task_description: Mapped[str] = mapped_column(Text, nullable=False)
    # The 5 subtasks the Manager plans when setting the big task, e.g.
    # [{"title": ..., "description": ...}, ...] — not yet real Task rows.
    # Each becomes one as its turn comes, via next_subtask_index, so the
    # graduate only ever sees one at a time (STAGE1_PRODUCT_FLOW.md).
    subtasks_plan_json: Mapped[list] = mapped_column(JSON, default=list)
    next_subtask_index: Mapped[int] = mapped_column(Integer, default=0)

    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    target_end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # Set when the end-of-week cascade actually runs — may differ from
    # target_end_at if the graduate finishes early or runs behind.
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="weeks")
    user: Mapped["User"] = relationship(back_populates="weeks")
    tasks: Mapped[list["Task"]] = relationship(back_populates="week")
    reviews: Mapped[list["Review"]] = relationship(back_populates="week")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    organization_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Nullable: the original flat one-task-at-a-time model (and any ad hoc
    # /admin-created task via POST /tasks) has no week. Subtasks released by
    # the weekly-cycle flow set this.
    week_id: Mapped[str | None] = mapped_column(ForeignKey("weeks.id"), nullable=True)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.TODO, nullable=False
    )
    github_link: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_agent: Mapped[AgentType] = mapped_column(
        Enum(AgentType), default=AgentType.MANAGER, nullable=False
    )

    # None outside a week (backward compatible with the flat model).
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Distinct from updated_at (which changes on every edit — thread
    # replies, a needs_changes bounce back to in_progress, etc). Set each
    # time status moves to SUBMITTED; completed_at is set once, the first
    # time the Mentor approves.
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @property
    def is_late(self) -> bool | None:
        """None until both a deadline and a completion exist — lateness
        isn't knowable before then. Judged against actual completion, not
        submission, since a submission can bounce back on needs_changes and
        get resubmitted later (STAGE1_PRODUCT_FLOW.md's Oct 1 / Oct 2
        example)."""
        if not self.deadline or not self.completed_at:
            return None
        return self.completed_at > self.deadline

    user: Mapped["User"] = relationship(back_populates="tasks")
    week: Mapped["Week"] = relationship(back_populates="tasks")
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
    # Set for WEEK_PROGRESS (Manager) and BEHAVIORAL (HR) reviews from the
    # end-of-week cascade. None for TASK_REVIEW (tied to task_id instead)
    # and SKILLS_ROLLUP (periodic, tied to neither).
    week_id: Mapped[str | None] = mapped_column(ForeignKey("weeks.id"), nullable=True)

    agent_type: Mapped[AgentType] = mapped_column(Enum(AgentType), nullable=False)
    # metrics_json's contract differs per kind — see each agent module.
    kind: Mapped[ReviewKind] = mapped_column(
        Enum(ReviewKind), default=ReviewKind.TASK_REVIEW, nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metrics_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="reviews")
    task: Mapped["Task"] = relationship(back_populates="reviews")
    week: Mapped["Week"] = relationship(back_populates="reviews")
