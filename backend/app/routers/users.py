from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import CVIntake, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/me/cv", response_model=UserOut)
def submit_cv(
    payload: CVIntake,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stores the raw CV text at intake. Structured parsing into
    employee_file.skills_json is owned by the AI/Agents track (Manager uses
    it to calibrate the first task's difficulty) — this endpoint just
    captures the raw input so that work can plug in without a schema change.
    """
    current_user.cv_raw_text = payload.cv_raw_text
    db.commit()
    db.refresh(current_user)
    return current_user
