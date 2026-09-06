from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Review, User
from app.schemas import CVIntake, EmployeeFileOut, ReviewOut, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/employee-file", response_model=EmployeeFileOut)
def read_employee_file(current_user: User = Depends(get_current_user)):
    """The shared record HR maintains and Manager/Mentor read — powers the
    growth view's Employee File snapshot."""
    return current_user.employee_file


@router.get("/me/reviews", response_model=list[ReviewOut])
def list_my_reviews(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Powers the growth view's review timeline — both per-task Mentor
    reviews and HR's periodic rollups, oldest first."""
    return (
        db.query(Review)
        .filter(Review.user_id == current_user.id)
        .order_by(Review.created_at)
        .all()
    )


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
