from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, ProjectStatus, User
from app.schemas import ProjectDetailOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/me", response_model=ProjectDetailOut)
def get_my_project(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    The graduate's active Project with all its Weeks — powers the
    node-based home board (Project-Summary.md). 404 until the first call
    to POST /agents/manager/assign-task bootstraps one.
    """
    project = (
        db.query(Project)
        .filter(Project.user_id == current_user.id, Project.status == ProjectStatus.ACTIVE)
        .order_by(Project.created_at.desc())
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=404,
            detail="No project yet — call POST /agents/manager/assign-task first.",
        )
    return project
