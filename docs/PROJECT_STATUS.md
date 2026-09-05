# Project Status — Venv

_Last updated: Sep 2026, after backend + Postgres setup, before frontend work starts._

## Where things stand right now

**Backend: built, tested, running.**
- Schema live: `Organization`, `User`, `EmployeeFile`, `Task`, `TaskMessage`, `Review`
  (`organization_id` nullable everywhere, so Stage 3 multi-tenancy is additive later)
- JWT auth, task board CRUD with status transitions, per-task threaded messages,
  CV intake endpoint
- `EmployeeFile` auto-created per user at registration — the shared context
  object all three agents will read/write
- Verified with `smoke_test.py` (17 checks) against **real Postgres**, not
  just SQLite — enums and JSON columns behave differently between the two,
  so the Postgres run is the one that actually counts
- Local dev database: `docker compose up -d` from repo root (one Postgres,
  same credentials for the whole team, no per-OS install needed)
- Confirmed running locally via `uvicorn app.main:app --reload` →
  `http://localhost:8000/docs`

**Repo:** https://github.com/MeshMoh506/VirtualWorkEnviroment_AI — `main` has
2 merged PRs (repo scaffold + VS Code config, backend + Docker Postgres).

**Not built yet:**
- Frontend (React/Next.js + React Flow) — starting next
- Agent logic (Manager/Mentor/HR prompts, orchestrator, tool-calling) —
  `backend/app/agents/` exists with a README scoping the work, no code yet
- Concrete task bank content, Mentor's review rubric, final LLM provider
  choice — still open from the proposal
- Alembic migrations — schema currently created via `create_all` on startup;
  fine while the schema is still moving, worth switching once it settles

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/             FastAPI — done, tested, running
│   └── app/agents/       Manager/Mentor/HR logic — scoped, not started
├── frontend/             React + React Flow — not started
└── .vscode/              shared editor config
```

## Working approach — follow this in every chat, every session

1. New piece of work → new branch off `main`: `feature/...`, `fix/...`,
   `chore/...`, `docs/...`.
2. Commit in small, logical chunks with imperative messages ("add X", not
   "added X"). Code gets brief comments explaining *why*, not just what.
3. Test before committing — don't commit something known-broken.
4. Push the branch, open a PR on GitHub, merge into `main`.
5. `main` stays deployable at all times.

## Conventions established so far (keep these consistent going forward)

- Every core table carries a nullable `organization_id`, even where Stage 1
  doesn't use it.
- `EmployeeFile` is the one shared context object — new agent logic should
  read/write its existing fields (`skills_json`, `strengths_json`,
  `growth_areas_json`, `summary_text`) rather than inventing a parallel
  structure.
- `TaskMessage.sender_type` is derived, not set directly: pass `agent_type`
  in the request to record it as an agent message, omit it for a user
  message.
- Secrets live in `.env` (gitignored), never committed; `.env.example` is the
  template.

## Handoff notes for the frontend track (starting in a new chat)

- Backend base URL in dev: `http://localhost:8000`. Interactive schema for
  every endpoint at `/docs`.
- Auth: `POST /auth/register` → `{email, password, full_name}`. `POST
  /auth/login` → **form-encoded** `username`/`password` (OAuth2 password
  flow) → `{access_token, token_type}`. Send `Authorization: Bearer <token>`
  on everything after.
- Task board: `GET /tasks` (list), `POST /tasks` (create), `GET /tasks/{id}`
  (detail + thread), `PATCH /tasks/{id}/status`, `POST
  /tasks/{id}/messages`.
- UI scope per the proposal: node-based home board (user node + Manager /
  Mentor / HR nodes) → click a node → task board (To Do / In Progress /
  Submitted / Reviewed) → task detail with threaded comments.
- `frontend/README.md` in the repo already has this plus the suggested
  `npx create-next-app` + `npm install reactflow` starting commands.
