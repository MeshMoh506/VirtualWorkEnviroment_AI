# Project Status — Venv

_Last updated: Sep 2026, after agent logic (Manager/Mentor/HR) went in.
Backend now has real AI agents on top of the schema; frontend is still on
mock data — wiring it to this is the next piece._

## Where things stand right now

**Backend: built, tested, running — now with agent logic.**
- Schema live: `Organization`, `User`, `EmployeeFile`, `Task`, `TaskMessage`, `Review`
  (`organization_id` nullable everywhere, so Stage 3 multi-tenancy is additive later)
- JWT auth, task board CRUD with status transitions, per-task threaded messages,
  CV intake endpoint
- `EmployeeFile` auto-created per user at registration — the shared context
  object all three agents read/write
- Verified with `smoke_test.py` (17 checks) against real Postgres
- Local dev database: `docker compose up -d` from repo root
- Confirmed running locally via `uvicorn app.main:app --reload` →
  `http://localhost:8000/docs`

**Agent logic (`backend/app/agents/`) — new this round.**
- LLM: Anthropic Claude (`ANTHROPIC_API_KEY` + `LLM_MODEL` in `.env`,
  default `claude-sonnet-5`). Orchestration is a plain custom router, not a
  framework (CrewAI was considered — not worth the dependency at 3-agent scale).
- **Manager** — assigns tasks calibrated to CV/skills (`assign_task`),
  replies in the task thread (`respond_in_thread`). New `Task` rows are
  only ever created via the former; the latter only posts messages.
- **Mentor** — reads a submitted task's real public `github_link` (via a
  new unauthenticated `github_client.py`), writes a structured `Review`
  (verdict + 4-category rubric + inline comments, matching the frontend's
  proposed shape in `reviews.ts`), and moves the task to `reviewed`.
- **HR** — rolls up Mentor review history into `EmployeeFile` (skills,
  strengths, growth areas, summary) plus a standalone rollup `Review`.
- New endpoints: `POST /agents/manager/assign-task`, `POST
  /agents/manager/reply/{task_id}`, `POST /agents/mentor/review/{task_id}`,
  `POST /agents/hr/rollup`; reads via `GET /tasks/{id}/review`, `GET
  /users/me/employee-file`, `GET /users/me/reviews`.
- Tested with `smoke_test_agents.py` (17 checks) — mocks the three LLM
  calls (no API key needed to run it) but hits the real GitHub API for
  Mentor's repo fetch. Both smoke tests pass together, no regressions.
- Full detail and what's still open (task bank, rubric finalization, HR
  cadence, CV parsing) in `backend/app/agents/README.md`.

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
had 10 merged PRs as of the last frontend update (repo scaffold + VS Code
config, backend + Docker Postgres, project status doc, frontend scaffold +
design system, home board, task board, the React Flow height fix + docs
update, Mentor's review view, a docs refresh, HR's growth view). This
round adds agent logic on a new branch, not yet merged — see below.

**Not built yet:**
- Frontend ↔ backend wiring: real auth, real tasks, reviews, and employee
  file data (currently all mock) — **now unblocked, since agent logic
  exists to actually generate this data** — this is the natural next piece
- CV upload flow — next frontend piece after wiring is real
- Concrete task bank content, finalized Mentor rubric (current one is a
  first pass, not team-agreed) — still open, see
  `backend/app/agents/README.md`'s "Still open" section
- HR rollup cadence (currently manual/on-demand only)
- Alembic migrations — schema currently created via `create_all` on
  startup; fine while the schema is still moving

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/             FastAPI — done, tested, running
│   └── app/agents/       Manager/Mentor/HR — implemented, see its README
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

## Handoff notes for frontend ↔ backend wiring (starting in a new chat)

This is the next piece of work — replace the frontend's mock data with
real fetch calls against the now-complete backend:

- Backend base URL in dev: `http://localhost:8000`. Interactive schema for
  every endpoint at `/docs`.
- Auth: `POST /auth/register` → `{email, password, full_name}`. `POST
  /auth/login` → **form-encoded** `username`/`password` (OAuth2 password
  flow) → `{access_token, token_type}`. Send `Authorization: Bearer <token>`
  on everything after.
- Task board: `GET /tasks` (list), `POST /tasks` (create), `GET /tasks/{id}`
  (detail + thread), `PATCH /tasks/{id}/status`, `POST /tasks/{id}/messages`,
  `GET /tasks/{id}/review`.
- Agents: `POST /agents/manager/assign-task`, `POST
  /agents/manager/reply/{task_id}`, `POST /agents/mentor/review/{task_id}`,
  `POST /agents/hr/rollup`. `GET /users/me/employee-file`, `GET
  /users/me/reviews`.
- All four screens exist on mock data — `/board`, `/tasks`,
  `/tasks/[id]/review`, `/growth`. Replace `src/lib/tasks.ts`, `reviews.ts`,
  and `employee-file.ts`'s mock data with real fetch calls. `tasks.ts` and
  `reviews.ts` should be close to a rename job; `employee-file.ts` needs a
  small `.items` unwrap on `skills_json`/`strengths_json`/`growth_areas_json`
  (see `backend/app/agents/hr.py`'s storage note) since those are `{}` until
  HR's first rollup, then `{"items": [...]}`.
- The home board (`/board`) is a natural place to wire the "assign task" /
  "run review" / "run HR rollup" triggers — its Manager/Mentor/HR nodes
  already exist, they just don't call anything real yet.
- Then the CV upload flow.
- `frontend/DESIGN.md` has the full design rationale — read it before
  adding new colors, fonts, or components.
