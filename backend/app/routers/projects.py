from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents.graph.cv_parsing import CVReadError, read_cv_upload
from app.agents.task_bank import MAX_MATERIALS_CHARS
from app.auth import get_current_user
from app.database import get_db
from app.models import Project, ProjectSource, ProjectStatus, User
from app.schemas import ProjectDetailOut, ProjectOut

router = APIRouter(prefix="/projects", tags=["projects"])

MAX_MATERIALS_FILES = 3
_TRUNCATION_NOTE = "\n\n[...materials truncated to the first {cap} characters...]"


def _combine_materials(materials_text: str | None, files: list[UploadFile]) -> str | None:
    """Pasted notes plus every uploaded file's extracted text, one block per file
    (so the Manager can tell them apart), combined and capped — see
    task_bank.MAX_MATERIALS_CHARS. None if there is nothing at all. Raises
    HTTPException (400/413) on a bad file, via read_cv_upload — reused as-is: it
    is already a generic "turn an upload into text, cleanly" helper, not
    CV-specific despite its module name."""
    parts = []
    if materials_text and materials_text.strip():
        parts.append(materials_text.strip())
    real_files = [f for f in files if f.filename]
    if len(real_files) > MAX_MATERIALS_FILES:
        raise HTTPException(400, f"Up to {MAX_MATERIALS_FILES} files.")
    for f in real_files:
        try:
            text = read_cv_upload(f.filename, f.file.read())
        except CVReadError as exc:
            raise HTTPException(exc.status_code, f"{f.filename}: {exc}")
        parts.append(f"--- {f.filename} ---\n{text}")
    if not parts:
        return None
    combined = "\n\n".join(parts)
    if len(combined) > MAX_MATERIALS_CHARS:
        note = _TRUNCATION_NOTE.format(cap=MAX_MATERIALS_CHARS)
        combined = combined[: MAX_MATERIALS_CHARS - len(note)] + note
    return combined


@router.get("/me", response_model=ProjectDetailOut)
def get_my_project(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    The graduate's active Project with all its Weeks — powers the
    node-based home board (Project-Summary.md). 404 until the first call
    to POST /agents/manager/assign-task bootstraps one (or until
    POST /projects/own is used instead — see below).
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


@router.post("/own", response_model=ProjectOut, status_code=201)
def create_own_project(
    title: str = Form(...),
    description: str = Form(...),
    materials_text: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stage 2 (docs/STAGE2_OWN_PROJECT.md): lets the graduate bring their
    own project instead of the Manager improvising one — confirmed with
    Meshari as an optional alternative, not the default. Must be called
    before the first POST /agents/manager/assign-task: weekly_cycle.py's
    bootstrap step only ever improvises a project when the graduate
    doesn't already have an active one, so creating one here first makes
    the very next assign-task call plan straight into it instead.

    materials_text (pasted notes) and/or files (PDF/Word/text, up to
    MAX_MATERIALS_FILES) are optional — real material about the project so
    manager.plan_week can plan actual subtasks instead of working from a
    one-line description. See _combine_materials and docs/STAGE2_OWN_PROJECT.md.
    """
    materials = _combine_materials(materials_text, files)
    existing = (
        db.query(Project)
        .filter(Project.user_id == current_user.id, Project.status == ProjectStatus.ACTIVE)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an active project — this only works before your first task.",
        )

    project = Project(
        user_id=current_user.id,
        title=title,
        description=description,
        source=ProjectSource.OWN,
        materials_text=materials,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
