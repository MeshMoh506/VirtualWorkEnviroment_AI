# Project Status — Venv

_Last updated: Sep 2026, after the frontend was wired to the real backend
+ agent logic. Auth, tasks, reviews, and the employee file are all real
now — no more mock data anywhere in the app. Next piece: the CV upload
flow._

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

**Frontend: all four screens built and wired to the real backend — no mock data left.**
- Next.js (App Router, TypeScript, Tailwind v4), a real design system
  documented in `frontend/DESIGN.md` — a dark "blueprint" look (hairline
  borders, faint grid, one accent color) instead of a generic SaaS theme.
  Fonts self-hosted via `@fontsource`, no external font CDN call.
- **Auth is real**: `/login` (toggles sign-in/register), `lib/auth-context.tsx`
  (`AuthProvider`, `useAuth`, `useRequireAuth` — redirects signed-out
  visitors to `/login`). JWT in `localStorage`. Every other page is
  auth-gated.
- **`lib/api.ts`** is the one place that knows the backend's wire format
  (snake_case, matching `schemas.py` exactly) — every page/lib function
  goes through it, nothing calls `fetch` directly elsewhere.
- `/board` — React Flow canvas: a You node connects to Manager, Mentor, and
  HR, all three feeding into a shared Employee File node (dashed, animated
  edges — the shared-memory differentiator made visible, not just claimed).
  Clicking a node opens a slide-over detail panel. Header now shows the
  signed-in user's email + a logout button.
- `/tasks` — kanban board (To do / In progress / Submitted / Reviewed),
  fetching real tasks. "Ask manager for a task" button calls
  `POST /agents/manager/assign-task`. Submitting a task auto-triggers the
  Mentor's review (`POST /agents/mentor/review/{id}`) — no separate "run
  review" button. Posting a thread message auto-triggers the Manager's
  reply (`POST /agents/manager/reply/{id}`) — it's a live conversation now,
  not a one-way comment box. `TaskDetailPanel` shows which agent is
  currently working (`busy: "review" | "reply" | null`).
- `/tasks/[id]/review` — Mentor's review, now a client component fetching
  the real task + `GET /tasks/{id}/review`. **The rubric categories are
  still a first pass, not a finalized contract** — see
  `backend/app/agents/README.md`'s "Still open" section.
- `/growth` — HR's view: real `GET /users/me/employee-file` +
  `GET /users/me/reviews`, a "Ask HR for a review" button
  (`POST /agents/hr/rollup`), and an empty state before any reviews exist
  (`employeeFile.summary` is `null` until HR's first rollup — see
  `hr.py`'s storage note for why skills/strengths/growth-areas are `{}`
  until then, `{"items": [...]}` after).
- One new design token: `danger` (`#d9765f`), documented in `DESIGN.md`,
  used only for error text — the app can now actually fail (bad login,
  server down, an agent call erroring) and needed a way to show that.
- Hit and fixed a newer ESLint rule (`react-hooks/set-state-in-effect`)
  false-positive on the standard "fetch on mount" pattern across three
  files — targeted, commented `eslint-disable-next-line`s rather than
  restructuring working code; see the comments at each site for why.
- Verified end-to-end against the real running backend (not just
  `npm run build`/`lint`): register → login → `/users/me` → task
  create/detail/status/messages → employee-file/reviews reads. Every
  response matched the TypeScript wire types field-for-field, including
  CORS preflight from `localhost:3000`.

**Repo:** https://github.com/MeshMoh506/VirtualWorkEnviroment_AI — `main`
had 12 merged PRs as of the agent-logic update (repo scaffold + VS Code
config, backend + Docker Postgres, project status doc, frontend scaffold +
design system, home board, task board, the React Flow height fix + docs
update, Mentor's review view, a docs refresh, HR's growth view, agent
logic). This round adds frontend wiring on a new branch, not yet merged —
see below.

**Not built yet:**
- CV upload flow — the natural next piece; Manager already handles a
  missing CV gracefully (falls back to "no CV or history yet" in its
  prompt), so this isn't blocking anything, just missing
- Concrete task bank content, finalized Mentor rubric (current one is a
  first pass, not team-agreed) — still open, see
  `backend/app/agents/README.md`'s "Still open" section
- HR rollup cadence (currently manual/on-demand only, via the "Ask HR for
  a review" button)
- Alembic migrations — schema currently created via `create_all` on
  startup; fine while the schema is still moving

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/             FastAPI — done, tested, running
│   └── app/agents/       Manager/Mentor/HR — implemented, see its README
├── frontend/             Next.js + React Flow — all 4 screens (home
│                         board, task board, review, growth) built AND
│                         wired to the real backend — no mock data left
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

## Handoff notes for the CV upload flow (starting in a new chat)

This is the next piece of work:

- Backend already has what's needed: `POST /users/me/cv` takes
  `{cv_raw_text}` — see `backend/app/routers/users.py` and
  `schemas.py`'s `CVIntake`. It's plain text, no file parsing on the
  backend side (no PDF/docx extraction exists) — the frontend either
  collects pasted text directly, or extracts text from an uploaded file
  client-side before sending it.
- Manager already reads `User.cv_raw_text` when assigning a task (see
  `backend/app/agents/manager.py`'s `_cv_context`) and degrades
  gracefully with no CV — so this piece is additive, not fixing anything
  broken.
- Natural place for it: right after registration, before landing on
  `/board` for the first time — a short "tell us about yourself" step.
  Could also be reachable later from the board (e.g. via the Employee
  File node) for graduates who skip it initially and add a CV later.
- `lib/auth-context.tsx`'s `register()` already exists — this would sit
  right after it in the sign-up flow, calling a new `api.submitCv(text)`
  function (add to `lib/api.ts`, following the same pattern as everything
  else there).
- `frontend/DESIGN.md` has the full design rationale — read it before
  adding new colors, fonts, or components.

## Reference: full API surface (for the CV flow or anything else)

- Backend base URL in dev: `http://localhost:8000`. Interactive schema
  for every endpoint at `/docs`.
- Auth: `POST /auth/register` → `{email, password, full_name}`. `POST
  /auth/login` → **form-encoded** `username`/`password` (OAuth2 password
  flow) → `{access_token, token_type}`. `GET /users/me`.
- CV: `POST /users/me/cv` → `{cv_raw_text}`.
- Tasks: `GET /tasks`, `POST /tasks` (manual/admin — the app itself never
  calls this; real tasks come from the Manager agent), `GET /tasks/{id}`,
  `PATCH /tasks/{id}/status`, `POST /tasks/{id}/messages`,
  `GET /tasks/{id}/review`.
- Agents: `POST /agents/manager/assign-task`, `POST
  /agents/manager/reply/{task_id}`, `POST /agents/mentor/review/{task_id}`,
  `POST /agents/hr/rollup`.
- `GET /users/me/employee-file`, `GET /users/me/reviews`.
- All of this is already wired into `frontend/src/lib/api.ts`,
  `tasks.ts`, `reviews.ts`, and `employee-file.ts` except the CV endpoint.
