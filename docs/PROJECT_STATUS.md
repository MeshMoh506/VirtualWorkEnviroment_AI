# Project Status — Venv

_Last updated: Sep 2026, after HR's growth view. All four frontend
screens from the original plan now exist (home board, task board,
Mentor's review, HR's growth view) — frontend pauses here. Next up:
agent logic (backend, new chat)._

## Where things stand right now

**Backend: built, tested, running.** (No change since last update.)
- Schema live: `Organization`, `User`, `EmployeeFile`, `Task`, `TaskMessage`, `Review`
  (`organization_id` nullable everywhere, so Stage 3 multi-tenancy is additive later)
- JWT auth, task board CRUD with status transitions, per-task threaded messages,
  CV intake endpoint
- `EmployeeFile` auto-created per user at registration — the shared context
  object all three agents will read/write
- Verified with `smoke_test.py` (17 checks) against real Postgres
- Local dev database: `docker compose up -d` from repo root
- Confirmed running locally via `uvicorn app.main:app --reload` →
  `http://localhost:8000/docs`

**Frontend: all four planned screens built, on mock data.**
- Next.js (App Router, TypeScript, Tailwind v4), a real design system
  documented in `frontend/DESIGN.md` — a dark "blueprint" look (hairline
  borders, faint grid, one accent color) instead of a generic SaaS theme.
  Fonts self-hosted via `@fontsource`, no external font CDN call.
- `/board` — React Flow canvas: a You node connects to Manager, Mentor, and
  HR, all three feeding into a shared Employee File node (dashed, animated
  edges — the shared-memory differentiator made visible, not just claimed).
  Clicking a node opens a slide-over detail panel.
- `/tasks` — kanban board (To do / In progress / Submitted / Reviewed).
  Click a card for the full description, a status stepper, the right
  action for that stage (start / submit with a GitHub link / waiting on
  review), and a comment thread.
- `/tasks/[id]/review` — Mentor's review: verdict (approved/needs
  changes), a rubric meter per category, categorized inline comments.
  Reachable from a reviewed task's detail panel, and directly from the
  home board's Mentor node ("See a review example"). **The rubric
  categories are a proposed shape, not an agreed contract** — there's no
  Pydantic schema or endpoint for `Review` yet, and the rubric itself is
  still an open decision (see "Not built yet" below). Shape lives in
  `frontend/src/lib/reviews.ts`.
- `/growth` — HR's view: the Employee File snapshot (skills, strengths,
  growth areas, summary — mirrors `User.employee_file`'s real fields), a
  Recharts line chart of average rubric score per reviewed task, and a
  timeline linking back to each review. Reachable from the home board's
  HR node and — since this is genuinely the real view of that file — from
  the Employee File node too, which no longer just points at "coming
  next."
- **Runs entirely on local mock data right now — not wired to the backend
  API yet.** No login, no real tasks, reviews, or employee file. Field
  names in `frontend/src/lib/tasks.ts` and `reviews.ts` mirror
  `backend/app/schemas.py`'s shapes closely, so wiring the real API later
  is mostly a rename job, not a redesign.
- One real bug hit and fixed along the way: React Flow rendered nothing at
  all on `/board` because its container didn't have a measured height —
  flex-1 chains up through `body`/`html` can silently resolve to zero.
  Fixed with a self-contained `h-dvh` + CSS grid layout on `/board` and
  `/tasks`. Worth remembering if a future page adds another canvas or
  chart-style component (Recharts on `/growth` used an explicit pixel
  height from the start for exactly this reason).

**Repo:** https://github.com/MeshMoh506/VirtualWorkEnviroment_AI — `main`
has 10 merged PRs (repo scaffold + VS Code config, backend + Docker
Postgres, project status doc, frontend scaffold + design system, home
board, task board, the React Flow height fix + docs update, Mentor's
review view, a docs refresh, HR's growth view). Nothing currently open.

**Not built yet:**
- Agent logic (Manager/Mentor/HR prompts, orchestrator, tool-calling) —
  `backend/app/agents/` exists with a README scoping the work, no code yet
  — **this is the next piece, in a new chat**
- Frontend ↔ backend wiring: real auth, real tasks, reviews, and employee
  file data (currently all mock) — **makes more sense once agent logic
  exists to actually generate this data**, so this naturally follows the
  backend piece rather than running in parallel
- CV upload flow — next frontend piece after wiring is real
- Concrete task bank content, Mentor's review rubric (the real one, not
  the frontend's placeholder shape), final LLM provider choice — still
  open from the proposal
- Alembic migrations — schema currently created via `create_all` on
  startup; fine while the schema is still moving

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/             FastAPI — done, tested, running
│   └── app/agents/       Manager/Mentor/HR logic — scoped, not started
├── frontend/             Next.js + React Flow — all 4 screens (home
│                         board, task board, review, growth) built;
│                         mock data only, not wired to the backend yet
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
- Secrets live in `.env` (gitignored), never committed; `.env.example` is
  the template.
- Frontend: hairline borders + a faint grid instead of rounded cards and
  shadows, one accent color, monospace reserved for actual technical
  content (IDs, timestamps, links) rather than every label — see
  `frontend/DESIGN.md` before adding new UI.

## Handoff notes for the agent-logic track (starting in a new chat)

This is the next piece of work, and it's backend-side, so it starts fresh:

- `backend/app/agents/README.md` already scopes what each agent does —
  read that first.
- `EmployeeFile` (on the `User` model) is the shared memory: `skills_json`,
  `strengths_json`, `growth_areas_json`, `summary_text`. Every agent should
  read from and write to these same fields, not keep separate state.
- The Manager's task-creation path already exists at `POST /tasks` — per
  `backend/app/routers/tasks.py`'s comment, that's the same path the
  Manager agent's tool-calling should call into once it's live, not a
  separate endpoint.
- Status transitions: the user drives `todo → in_progress → submitted`
  (via `PATCH /tasks/{id}/status`, requiring a `github_link` to reach
  `submitted`). Moving a task to `reviewed` is the Mentor agent's job, not
  the user's — the frontend's task detail panel already assumes this split.
- LLM provider is still an open decision (see "Not built yet" above) —
  worth settling early in that chat since it shapes the orchestrator.
- The frontend's task board (`/tasks`) is ready to receive real data the
  moment agent logic exists — its mock task shape already matches
  `TaskOut`/`TaskDetailOut` field-for-field.
- Same for `frontend/src/lib/employee-file.ts` — its mock shape (skills,
  strengths, growth areas, summary) is a reasonable reference for what
  the HR agent should actually populate on `EmployeeFile`.

## Handoff notes for continuing the frontend (after agent logic exists)

- Backend base URL in dev: `http://localhost:8000`. Interactive schema for
  every endpoint at `/docs`.
- Auth: `POST /auth/register` → `{email, password, full_name}`. `POST
  /auth/login` → **form-encoded** `username`/`password` (OAuth2 password
  flow) → `{access_token, token_type}`. Send `Authorization: Bearer <token>`
  on everything after.
- Task board: `GET /tasks` (list), `POST /tasks` (create), `GET /tasks/{id}`
  (detail + thread), `PATCH /tasks/{id}/status`, `POST
  /tasks/{id}/messages`.
- All four screens exist on mock data — `/board`, `/tasks`,
  `/tasks/[id]/review`, `/growth`. Next piece: replace `src/lib/tasks.ts`,
  `reviews.ts`, and `employee-file.ts`'s mock data with real fetch calls,
  once there's an agent-logic backend actually producing that data. Then
  the CV upload flow.
- `frontend/DESIGN.md` has the full design rationale — read it before
  adding new colors, fonts, or components.
