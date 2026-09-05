# Venv Backend (Stage 1)

FastAPI + PostgreSQL backend for Venv — auth, task board, and the shared
Employee File that the Manager/Mentor/HR agents will read and write.

## Quickstart

From the **repo root** first, start Postgres via Docker (see root README):
```bash
docker compose up -d
```

Then, from this `backend/` folder:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env already points at the Docker Postgres above — no edits needed.
# Quick local check without Docker? Set DATABASE_URL=sqlite:///./dev.db instead.

uvicorn app.main:app --reload
```

Then open http://localhost:8000/docs for interactive Swagger UI.

Verify everything works end-to-end:
```bash
python smoke_test.py
```

## What's here

| File | Purpose |
|---|---|
| `app/models.py` | SQLAlchemy schema: Organization, User, EmployeeFile, Task, TaskMessage, Review |
| `app/schemas.py` | Pydantic request/response shapes |
| `app/auth.py` | Password hashing + JWT issue/verify + `get_current_user` dependency |
| `app/routers/auth.py` | `POST /auth/register`, `POST /auth/login` |
| `app/routers/users.py` | `GET /users/me`, `POST /users/me/cv` |
| `app/routers/tasks.py` | Task board CRUD + threaded messages |
| `smoke_test.py` | End-to-end check of the whole flow against sqlite |

## Schema notes for the rest of the team

- **`organization_id` is nullable on every core table** (Users, Tasks, EmployeeFile,
  Reviews) even though Stage 1 has no organizations. This was a deliberate call from
  the proposal so Stage 3 (companies build their own Venvs) is additive — you add
  rows to `organizations` and start setting the FK — instead of a migration that
  touches every table.
- **`EmployeeFile` is the shared context object.** Every user gets one automatically
  at registration (see `routers/auth.py`). This is what should back the Manager's
  task-difficulty calibration, the Mentor's findings, and HR's rollup reviews — write
  to `skills_json` / `strengths_json` / `growth_areas_json` / `summary_text` rather
  than inventing a parallel structure.
- **`Task.created_by_agent`** defaults to `manager`. Right now `POST /tasks` is a
  plain authenticated endpoint for testing the board — once the Manager agent's
  tool-calling is live, it should call this same endpoint (or the same service
  function) rather than writing to the DB directly, so task creation stays in one
  code path.
- **`TaskMessage.sender_type`** is derived automatically: pass `agent_type` in the
  request body and it's recorded as an agent message; omit it and it's recorded as
  the user. This is the endpoint the AI/Agents track should call to post agent
  replies into a task's thread.
- **CV parsing is intentionally not done here.** `POST /users/me/cv` just stores
  `cv_raw_text`. Turning that into structured `EmployeeFile.skills_json` is AI/Agents
  work — the column is already there waiting for it.

## Still open (from the proposal)

- Example task bank content — not modeled as a separate table yet; Manager can
  either generate tasks live or `POST /tasks` from a seed script once the bank
  exists.
- Mentor's exact review checklist / rubric — will likely shape `Review.metrics_json`.
- Final LLM provider choice — doesn't affect this schema either way.
- Migrations: tables are currently created via `Base.metadata.create_all` on startup
  for dev speed. Once the schema stabilizes (probably after Week 2), switch to
  Alembic so schema changes don't require dropping data — happy to set that up next.

## Auth flow for the frontend team

1. `POST /auth/register` → `{email, password, full_name}` → returns the created user.
2. `POST /auth/login` → form-encoded `username`/`password` (OAuth2 password flow) →
   returns `{access_token, token_type}`.
3. Send `Authorization: Bearer <access_token>` on every subsequent request.
