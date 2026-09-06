from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AgentType, Review, SenderType, Task, TaskMessage, User
from app.schemas import (
    ReviewOut,
    TaskCreate,
    TaskDetailOut,
    TaskMessageCreate,
    TaskMessageOut,
    TaskOut,
    TaskStatusUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_owned_task(task_id: str, current_user: User, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_my_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Powers the task board columns (To Do / In Progress / Submitted / Reviewed)."""
    return db.query(Task).filter(Task.user_id == current_user.id).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manual/admin creation for now, for testing the board end-to-end. Once the
    Manager agent's tool-calling is live, it will call this same path
    internally to assign real tasks.
    """
    task = Task(
        title=payload.title,
        description=payload.description,
        user_id=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskDetailOut)
def get_task(task_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Task detail view with its full comment thread."""
    return _get_owned_task(task_id, current_user, db)


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user, db)
    task.status = payload.status
    if payload.github_link is not None:
        task.github_link = payload.github_link
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/messages", response_model=TaskMessageOut, status_code=201)
def post_message(
    task_id: str,
    payload: TaskMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(task_id, current_user, db)
    message = TaskMessage(
        task_id=task.id,
        sender_type=SenderType.AGENT if payload.agent_type else SenderType.USER,
        agent_type=payload.agent_type,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get("/{task_id}/review", response_model=ReviewOut)
def get_task_review(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mentor's review for this task — powers the review view once it exists."""
    task = _get_owned_task(task_id, current_user, db)
    review = (
        db.query(Review)
        .filter(Review.task_id == task.id, Review.agent_type == AgentType.MENTOR)
        .order_by(Review.created_at.desc())
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="No review yet for this task")
    return review
