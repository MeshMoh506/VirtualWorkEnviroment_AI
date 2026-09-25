"""
Stage 3's company side (docs/STAGE3_COMPANY_RAG.md): a company account
registers or joins via a shared org join_code, defines free-text job
titles, uploads materials per job title, and can query that job title's
knowledge base — the RAG system app/rag.py builds. Reuses the exact same
auth system as everything else: a company rep is a User row like any
other (account_type=COMPANY), logs in through the same POST /auth/login,
carries the same bearer token. Nothing here is a parallel auth stack.
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents.graph.cv_parsing import CVReadError, read_cv_upload
from app.auth import get_current_user, hash_password
from app.database import get_db
from app.models import (
    AccountType,
    CompanyRole,
    JobTitle,
    KnowledgeMaterial,
    Organization,
    User,
)
from app.rag import ingest_material, retrieve
from app.schemas import (
    CompanyRegister,
    CompanyRegisterOut,
    JobTitleCreate,
    JobTitleOut,
    KnowledgeMaterialOut,
    OrganizationOut,
    RAGChunkOut,
    RAGQueryRequest,
    RAGQueryResult,
    UserOut,
)

router = APIRouter(prefix="/company", tags=["company"])

MAX_MATERIAL_FILES = 5
# Generous — unlike own-project's materials cap (task_bank.MAX_MATERIALS_CHARS,
# 6000 chars, meant to fit inside one prompt), this gets chunked and
# embedded rather than pasted whole into a prompt, so there's no prompt-
# budget reason to cap it tightly. Still capped, for sane upload/embedding
# cost on a single call.
MAX_MATERIAL_CHARS = 200_000


def get_current_company_user(current_user: User = Depends(get_current_user)) -> User:
    """Gate for every endpoint below except register itself. A student
    account hitting any of these gets a clean 403, not a confusing
    empty result."""
    if current_user.account_type != AccountType.COMPANY:
        raise HTTPException(status_code=403, detail="This is a company-account endpoint.")
    return current_user


def _get_org_job_title(db: Session, user: User, job_title_id: str) -> JobTitle:
    job_title = db.get(JobTitle, job_title_id)
    if not job_title or job_title.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Job title not found.")
    return job_title


@router.post("/register", response_model=CompanyRegisterOut, status_code=201)
def register_company(payload: CompanyRegister, db: Session = Depends(get_db)):
    """Two shapes: found a new company (company_name required — becomes
    its first ADMIN) or join an existing one by join_code (role
    required). No email/invite system exists in this app, so "join" is
    self-serve: anyone with the code picks their own role. That's a
    deliberate MVP simplification for a bootcamp demo, not a security
    boundary — see docs/STAGE3_COMPANY_RAG.md."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.join_code:
        org = db.query(Organization).filter(Organization.join_code == payload.join_code).first()
        if not org:
            raise HTTPException(status_code=404, detail="No company found for that join code.")
        if not payload.role:
            raise HTTPException(status_code=400, detail="role is required when joining with a join_code.")
        role = payload.role
    else:
        if not payload.company_name or not payload.company_name.strip():
            raise HTTPException(
                status_code=400, detail="company_name is required to register a new company."
            )
        org = Organization(name=payload.company_name.strip(), field=(payload.field or "").strip() or None)
        db.add(org)
        db.flush()  # org.id, before the user references it
        role = CompanyRole.ADMIN

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        account_type=AccountType.COMPANY,
        organization_id=org.id,
        company_role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(org)
    return CompanyRegisterOut(user=UserOut.model_validate(user), organization=org)


@router.get("/me", response_model=OrganizationOut)
def read_my_company(current_user: User = Depends(get_current_company_user), db: Session = Depends(get_db)):
    org = db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Company not found.")
    return org


@router.post("/job-titles", response_model=JobTitleOut, status_code=201)
def create_job_title(
    payload: JobTitleCreate,
    current_user: User = Depends(get_current_company_user),
    db: Session = Depends(get_db),
):
    """Free text, on purpose — any company in any field can use this, not
    just IT (see the Q&A behind docs/STAGE3_COMPANY_RAG.md). Any company
    role can create one today; not yet gated to admin/HR specifically."""
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title can't be empty.")
    job_title = JobTitle(
        organization_id=current_user.organization_id,
        title=title,
        description=payload.description,
        created_by_user_id=current_user.id,
    )
    db.add(job_title)
    db.commit()
    db.refresh(job_title)
    return job_title


@router.get("/job-titles", response_model=list[JobTitleOut])
def list_job_titles(
    current_user: User = Depends(get_current_company_user), db: Session = Depends(get_db)
):
    return (
        db.query(JobTitle)
        .filter(JobTitle.organization_id == current_user.organization_id)
        .order_by(JobTitle.created_at.desc())
        .all()
    )


@router.get("/job-titles/{job_title_id}", response_model=JobTitleOut)
def get_job_title(
    job_title_id: str,
    current_user: User = Depends(get_current_company_user),
    db: Session = Depends(get_db),
):
    return _get_org_job_title(db, current_user, job_title_id)


@router.post("/job-titles/{job_title_id}/materials", response_model=KnowledgeMaterialOut, status_code=201)
def upload_material(
    job_title_id: str,
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_company_user),
    db: Session = Depends(get_db),
):
    """Pasted text or one uploaded file (PDF/Word/plain text — reuses the
    same extraction helper as CV intake and own-project uploads, despite
    its module name; see read_cv_upload). Chunked and embedded
    immediately (app/rag.py.ingest_material) so it's searchable as soon
    as this call returns."""
    job_title = _get_org_job_title(db, current_user, job_title_id)

    if file and file.filename:
        try:
            extracted = read_cv_upload(file.filename, file.file.read())
        except CVReadError as exc:
            raise HTTPException(exc.status_code, f"{file.filename}: {exc}")
        filename = file.filename
    elif text and text.strip():
        extracted = text.strip()
        filename = None
    else:
        raise HTTPException(status_code=400, detail="Provide pasted text or a file.")

    if len(extracted) > MAX_MATERIAL_CHARS:
        raise HTTPException(
            status_code=413, detail=f"Material too large — {MAX_MATERIAL_CHARS} characters max."
        )

    material = ingest_material(
        db,
        organization_id=job_title.organization_id,
        job_title_id=job_title.id,
        uploaded_by_user_id=current_user.id,
        filename=filename,
        extracted_text=extracted,
    )
    return KnowledgeMaterialOut.from_material(material)


@router.get("/job-titles/{job_title_id}/materials", response_model=list[KnowledgeMaterialOut])
def list_materials(
    job_title_id: str,
    current_user: User = Depends(get_current_company_user),
    db: Session = Depends(get_db),
):
    job_title = _get_org_job_title(db, current_user, job_title_id)
    materials = (
        db.query(KnowledgeMaterial)
        .filter(KnowledgeMaterial.job_title_id == job_title.id)
        .order_by(KnowledgeMaterial.created_at.desc())
        .all()
    )
    return [KnowledgeMaterialOut.from_material(m) for m in materials]


@router.post("/job-titles/{job_title_id}/query", response_model=RAGQueryResult)
def query_knowledge_base(
    job_title_id: str,
    payload: RAGQueryRequest,
    current_user: User = Depends(get_current_company_user),
    db: Session = Depends(get_db),
):
    """Runs the actual RAG retrieval for this job title — lets a company
    rep sanity-check what the knowledge base would surface for a given
    question before it's relied on elsewhere (e.g. the Manager planning
    company-sourced tasks, a later piece of Stage 3)."""
    job_title = _get_org_job_title(db, current_user, job_title_id)
    scored = retrieve(db, job_title.id, payload.query, k=payload.k)
    return RAGQueryResult(
        query=payload.query,
        chunks=[
            RAGChunkOut(id=c.id, material_id=c.material_id, content=c.content, score=score)
            for score, c in scored
        ],
    )
