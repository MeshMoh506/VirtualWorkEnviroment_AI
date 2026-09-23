# Project Status — Venv

_Last updated: Sep 2026 — Stage 2 plus a full hardening pass, plus a
task-chat/Team Room/settings enhancement pass on top of that._

> **One-paragraph summary.** Stage 1 (Manager/Mentor/HR, the weekly cycle, one
> track) and all of Stage 2 (CV-file intake with agent Q&A, six IT tracks, a
> selectable optional-agent roster, an own-project path — now with real uploaded
> materials, a guided orientation walkthrough, the Meeting Room open to any agent
> on your team, multi-modal submissions with vision review, and the agent
> roundtable) are built and merged. On top of that, a full hardening pass: Alembic
> migrations, resumable onboarding, a visible "needs changes" state, Arabic agent
> replies, a Mentor rubric v2, a 15-seed task bank, a background roundtable (the
> graduate waits ~10s instead of ~25s), and protection against malformed model
> output on **every** agent tool call. Most recently, a task-chat/collaboration
> pass: the Mentor (not the Manager) is now the default day-to-day agent in a
> task thread, with a switcher to address the Manager or a technical roster
> agent directly (`docs/TASK_CHAT.md`); every agent conversation surface now
> declines off-topic requests instead of acting as a generic assistant
> (`agents/guardrails.py`); a Team Room gives the graduate one shared thread
> with their whole team, not just 1:1 chats (`docs/TEAM_ROOM.md`); and a new
> `/settings` page covers profile, password, CV, and preferences
> (`docs/SETTINGS_PAGE.md`). **29 smoke suites, 779 checks, all passing** on
> SQLite; PostgreSQL 16 was verified through the hardening pass but **not
> re-verified for this latest pass's migration** (0006, `team_messages`) — no
> Postgres instance was reachable in the sandbox that built it, see
> `docs/TEAM_ROOM.md`'s "Not done" section. Frontend eslint clean, `next build`
> passes (15 routes). **Nobody has clicked through the app in a browser yet** —
> see "What's genuinely unverified" below before treating this as demo-ready.

## What's built

**Backend** (FastAPI + SQLAlchemy, SQLite dev / PostgreSQL prod, LangGraph for
onboarding and the weekly-cycle cascade):

- Auth, CV intake (file or paste), the full weekly cycle (Manager plans a
  project → one big task/week → 5 subtasks released one at a time → Mentor
  reviews each iteratively → end-of-week Manager progress + HR behavioral
  review, both consulting the Mentor directly → next week).
- Multi-modal submissions (GitHub link, text, up to 5 files/images — images go
  to the Mentor as real vision content).
- The **agent roundtable**: after the Mentor's review, any optional agents on
  the graduate's roster (Security Reviewer / Data Reviewer / DevOps) discuss
  the submission in a fixed order, then the Manager synthesizes — **now in the
  background**, so the graduate only waits for the Mentor (`docs/BACKGROUND_ROUNDTABLE.md`).
- Multi-provider LLM support (Anthropic/OpenAI/DeepSeek/Qwen) with tier-aware
  routing and automatic failover (`docs/LLM_PROVIDER_FAILOVER.md`).
- **The Manager's task bank**: 15 project seeds (2-3 per track) with four-week
  arcs; a project is based on one and adapted, every week is planned against its
  arc step, and every seed says what evidence to submit — because the Mentor
  only ever sees a repo's file list and README head, never the code itself
  (`docs/TASK_BANK.md`).
- **The Mentor's rubric v2**: anchored 1-5 scores per category, one enforced
  verdict rule (only "meets requirements" below 3 can block a task), memory of
  its own previous feedback on a resubmission (`docs/MENTOR_RUBRIC.md`).
- **Every agent tool call is hardened against malformed model output** —
  repaired where possible (a JSON-string list, a numeric string), checked
  structurally, retried on the same provider, then failed over — never a 500.
  Two separate tool-calling paths both covered: the Manager/Mentor/HR/roundtable
  path (`docs/LLM_PROVIDER_FAILOVER.md`, "Malformed tool output") and the
  onboarding graph's own path (`docs/ONBOARDING_GRAPH_HARDENING.md`) — found by
  running real models, not by any mocked test.
- **Database migrations (Alembic)** replace `create_all`; an existing dev
  database is adopted safely, an out-of-date one gets a clear startup error
  instead of a mystery crash later (`docs/MIGRATIONS.md`).
- **Onboarding survives a closed tab, a restart, or a second API worker** — state
  is saved on the `User` row and the graph thread is rebuilt from it, at zero LLM
  cost (`docs/ONBOARDING_RESUME.md`).
- **A bounced task is visible, not silent** — `Task.needs_changes`/`revision_count`,
  derived from the reviews (`docs/NEEDS_CHANGES_VISIBLE.md`).
- **Agents answer in the language the UI is showing** — one request header, two
  hooks in the LLM layer, no per-agent changes needed (`docs/AGENT_LANGUAGE.md`).
- **A graduate's own project can include real materials** — pasted notes and/or
  uploaded files, which the Manager actually plans around (`docs/STAGE2_OWN_PROJECT.md`).
- Local file storage for attachments (`app/storage.py`) — dev-scope, one box,
  not yet cloud.
- `backend/e2e_real_llm.py` — a one-command check that drives the whole demo
  path with **real** LLM keys (everything above is mocked-model tested only),
  reports what a graduate actually waits for, what got repaired/retried, and can
  save a full report of what the models produced (`--save-report`).
- **Task chat now has an agent switcher, and the Manager is scoped to the big
  picture.** The Mentor (`agents/mentor.py`'s new `respond_in_thread`) is the
  default agent in a task thread — framed as a senior engineer working the
  task day to day — rather than the Manager fielding every message. The
  graduate can also address the Manager (now redirects hands-on task asks to
  the Mentor instead of answering them) or a technical roster agent (Security
  Reviewer/Data Reviewer/DevOps) directly. New `agents/task_chat.py` routes
  `POST /agents/task/{id}/reply` by `agent_type`; the old
  `POST /agents/manager/reply/{id}` is unchanged for any other caller
  (`docs/TASK_CHAT.md`).
- **Every agent conversation surface has a shared behavioral floor**
  (`agents/guardrails.py`): declines requests outside its role at Venv instead
  of acting as a generic assistant, on top of whichever persona/task
  instructions it already had (`docs/TASK_CHAT.md`).
- **Team Room**: one shared thread per graduate (`TeamMessage`,
  `alembic/versions/0006_team_messages.py`) with their whole team, distinct
  from the Meeting Room's one-thread-per-agent chats. Each message is routed
  to whichever single teammate fits (a small-tier tool call), but the whole
  thread — everyone's past turns — stays visible to whoever replies next.
  `GET/POST /meeting/team` (`docs/TEAM_ROOM.md`).
- **Settings**: `PATCH /users/me` — rename yourself and/or change your
  password in one call, with current-password verification and a minimum
  length on the new one (`docs/SETTINGS_PAGE.md`).

**Frontend** (Next.js + React Flow, dark-by-default "blueprint" design system,
light theme, Arabic/RTL — `frontend/DESIGN.md`):

- `/onboarding/cv` — CV upload → adaptive agent Q&A (skippable) → track
  suggestion with override → optional-agent roster → own-project choice (with
  materials upload) or "let the Manager plan it". **Resumes** from wherever a
  graduate left off (closed tab, restart). `POST /onboarding/reset` starts over.
- `/orientation` — shown once after onboarding: the graduate's project, full
  team, a guided walkthrough.
- `/board` — the agents graph, renders any extra agents dynamically.
- `/workspace` — task rail (with a "needs changes" badge) + the full roundtable
  thread, refreshing live while the specialists' discussion is still being
  written. The task-chat panel now shows a "working with" switcher (Mentor by
  default) and a "new task from {agent}" banner on a fresh task
  (`docs/TASK_CHAT.md`).
- `/profile/cv` — replace the CV after onboarding without touching track/team/tasks.
- `/meeting` — open to any agent on the graduate's actual roster, plus a "Team
  room" tab for a shared thread with the whole team at once (`docs/TEAM_ROOM.md`).
- `/settings` — profile (name), password change, a CV section linking to
  `/profile/cv`, and the language/theme toggles in one place
  (`docs/SETTINGS_PAGE.md`).
- `/growth`, `/tasks/[id]/review` — unchanged in shape.
- Verified: eslint clean, full `next build` succeeds (15 routes).

## What's genuinely unverified

Be honest with yourself about this list before calling anything demo-ready:

- **Nobody has used the app in a browser since the hardening pass began** —
  and that now includes this latest task-chat/Team Room/settings pass, built
  entirely against automated tests. Every check above is an automated test or
  a scripted real-model run — real clicking, real screens, real Arabic RTL
  layout, has not happened.
- **The task bank and Mentor rubric are drafts awaiting team sign-off**, not
  team-approved content (`docs/TASK_BANK.md`, `docs/MENTOR_RUBRIC.md` both have a
  "Decisions for the team" section).
- **Real-model coverage is partial.** Confirmed with real keys so far: onboarding
  through HR rollup on DeepSeek and Claude, Arabic replies on DeepSeek, the
  malformed-output bug that started the hardening pass. Not yet confirmed with
  real keys: the task bank's seed adaptation across tracks, the rubric's
  approve-path (every real run so far bounced on an unrelated default repo),
  Qwen (its configured model name is dead — see Setup notes), OpenAI as a
  fallback provider.
- **The roundtable's real-model timing** (background vs. the old inline ~25s) has
  not been measured with real keys, only proven correct in automated tests.
- **This latest pass (task chat, guardrails, Team Room, settings) is mocked-LLM
  tested only, same as everything else above** — the Manager's redirect
  behavior, every agent's off-topic decline, and the Team Room's routing
  quality have not been checked against a real model, only against a mock that
  returns exactly what the test expects.
- **The `0006_team_messages` migration was verified against SQLite's
  model-drift guard only** — no Postgres instance was reachable in the sandbox
  that built it. Run `smoke_test_migrations.py`'s Postgres section
  (`MIGRATIONS_TEST_POSTGRES_URL`) before trusting it beyond SQLite/dev.

## Setup notes for whoever runs this next

- **Qwen is misconfigured**: `qwen/qwen-turbo` returns 404 from the configured
  endpoint. Fix the model name/base URL, or drop it from
  `LLM_PROVIDER_PRIORITY_SMALL` for now.
- **`GITHUB_TOKEN`** (optional, no scopes needed) raises the Mentor's GitHub
  read limit from 60/hour/IP to 5,000/hour — each review costs 3 requests, so
  this matters fast once you're testing repeatedly.
- **First startup after `git pull` runs migrations automatically.** An
  out-of-date SQLite dev DB (schema older than what's in `alembic/versions/`)
  will refuse to start with a message naming the missing column — delete
  `dev.db` and it rebuilds clean.

## Doc index

**Stage 1 & 2 core** (chronological, one doc per slice):
`STAGE1_PRODUCT_FLOW.md` · `STAGE2_ONBOARDING_FLOW.md` ·
`STAGE2_WEEKLY_CYCLE_FLOW.md` · `STAGE2_OWN_PROJECT.md` ·
`STAGE2_ONBOARDING_FRONTEND.md` · `STAGE2_TEAM_AND_ORIENTATION.md`
(orientation's *UI* is superseded by a later frontend pass — see its own note —
but the backend it documents is still accurate) · `STAGE2_MEETING_AND_SUBMISSIONS.md` ·
`STAGE2_AGENT_TASK_WORK.md` (superseded by the roundtable, kept as the simpler
fallback, `co_reviewers.py`) · `STAGE2_ROUNDTABLE.md`.

**Hardening** (this session, roughly in build order): `MIGRATIONS.md` ·
`ONBOARDING_RESUME.md` · `NEEDS_CHANGES_VISIBLE.md` · `AGENT_LANGUAGE.md` ·
`MENTOR_RUBRIC.md` · `LLM_PROVIDER_FAILOVER.md` (incl. "Malformed tool output")
· `TASK_BANK.md` · `BACKGROUND_ROUNDTABLE.md` · `ONBOARDING_GRAPH_HARDENING.md`.

**Task chat / Team Room / settings** (this session, most recent):
`TASK_CHAT.md` (Mentor as the default in-task agent, the Manager scoped to
the big picture, the shared `agents/guardrails.py` role-boundary) ·
`TEAM_ROOM.md` (one shared thread with the whole team, routed replies) ·
`SETTINGS_PAGE.md` (`PATCH /users/me`, the new `/settings` page).

**Frontend-only work with no dedicated doc** (orientation rework, Arabic i18n,
light mode — built in a separate pass, documented only in their own PR/commit
messages): still true, still worth a proper writeup at some point, not urgent.

## Not built yet

- **Roundtable specialists don't get vision** — only the Mentor's review sees
  image attachments as real content; specialists see filenames only.
- **No cloud file storage** — `app/storage.py` is local-disk, one box.
- **The doc-writing gap** above (orientation/Arabic/light-mode).

## Where this leaves Stage 3

Stage 3 ("companies build their own Venv") has a written spec from Meshari
(student/company account split, a company knowledge base per job title with a
RAG system in front of it, HR invites a student choosing company-tasks or
platform-tasks, company monitors submissions live and can add human judgment, an
end-of-week report split for the technical lead and HR) but **no code and no
finalized scope**. The pre-Stage-3 checklist Meshari asked for is now done: own-
project uploads, the task bank, resumable onboarding, Arabic, migrations, the
background roundtable.

**Open questions for Meshari before writing any Stage 3 code** (asked, not yet
answered as of this doc):
1. Are job titles company-defined free text, or drawn from the existing six
   tracks?
2. Is one shared company login enough for the demo (reports labeled per
   department, no separate per-department auth)?
3. Does "own project" already cover what Meshari meant by an uploaded
   project (it now does: `docs/STAGE2_OWN_PROJECT.md`'s materials feature), or
   is a repo-link-only variant also wanted?
4. Should a student see and explicitly consent to what a company will see
   before starting?

**Groundwork already in place, useful for Stage 3:**
- Every core table already carries a nullable `organization_id`.
- Own-project materials (`docs/STAGE2_OWN_PROJECT.md`) is the same shape a
  company's knowledge base will need — extracted document text in a planning
  prompt, capped, no retrieval yet — a straight-line precedent for the later RAG
  work, not a replacement for it.
- The task bank's seed → arc → evidence pattern is a plausible shape for
  "a company's own task set", if that's the direction chosen.
- Agents are a catalog (`AgentCatalog`/`UserAgent`), not hard-coded — adding a
  company-specific agent type is a data change, not new always-on code.

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/
│   ├── e2e_real_llm.py   real-key end-to-end check (docs above; --help for flags)
│   └── app/
│       ├── agents/        Manager/Mentor/HR/Meeting/roundtable/task_bank/rubric/
│       │                  task_chat/guardrails/tool_output — see app/agents/README.md
│       │   └── graph/     LangGraph: onboarding_graph, weekly_cycle_graph,
│       │                  collaboration, models, catalog, cv_parsing
│       ├── routers/       onboarding, projects, tasks, meeting, agents, users, auth
│       ├── migrations.py  startup migration runner (adopt / refuse / upgrade)
│       ├── language.py    per-request agent language (X-Venv-Language)
│       └── storage.py     local-disk attachment storage
│   └── alembic/versions/  0001 baseline … 0006 team_messages
├── frontend/
│   └── src/
│       ├── app/            landing, login, board, orientation, onboarding/cv,
│       │                   workspace, meeting, growth, tasks/[id]/review,
│       │                   profile/cv, settings
│       ├── components/     board/, dashboard/, workspace/
│       └── lib/            api.ts (wire format), one file per domain, i18n/
└── .vscode/               shared editor config
```

## Working approach — follow this in every chat, every session

1. New piece of work → new branch off `main`: `feature/...`, `fix/...`,
   `chore/...`, `docs/...`.
2. Commit in small, logical chunks with imperative messages ("add X", not
   "added X"). Code gets brief comments explaining *why*, not just what.
3. Test before committing — the full smoke suite, not just the file you
   touched, on SQLite **and** PostgreSQL where the change touches the database.
4. Push the branch, merge into `main`.
5. `main` stays deployable at all times.

## Conventions established so far (keep these consistent going forward)

- Every core table carries a nullable `organization_id`, even where nothing
  uses it yet.
- `EmployeeFile` is the one shared context object — new agent logic reads/writes
  its existing fields rather than inventing a parallel structure.
- `TaskMessage.sender_type` is derived, not set directly: pass `agent_type` in
  the request to record it as an agent message, omit it for a user message.
- Secrets live in `.env` (gitignored), never committed; `.env.example` is the
  template.
- Frontend: hairline borders + a faint grid instead of rounded cards and
  shadows, one accent color, monospace reserved for actual technical content —
  see `frontend/DESIGN.md`.
- Model routing: cheap/mechanical steps (onboarding suggestions, roundtable
  specialist comments) use the small model; primary judgment calls (Mentor's
  review, the Manager's synthesis/progress writeups) use the main model.
- Any new agent capability that isn't a hard requirement for every graduate goes
  through the `AgentCatalog`/`UserAgent` roster pattern, not a new always-on
  code path.
- Any model call that forces a tool (JSON-schema-shaped arguments) should go
  through `agents/tool_output.py`'s repair/check, with a `validate` hook for
  anything schema-shape alone can't catch — the pattern both existing
  tool-calling paths (`llm_client.call_with_tool`, the onboarding graph's
  `_forced_tool_call`) now share. A new one should too.
- Test files that exercise a real endpoint under a deliberately-broken mock
  should pin `resolve_provider_chain` explicitly (don't rely on other providers
  being unconfigured in `.env` — a real developer's `.env` usually has every
  key set). A background task's effect should be polled for
  (`roundtable_running`), never assumed complete the instant a request returns.

## Reference: full API surface

Backend base URL in dev: `http://localhost:8000`. Interactive schema for every
endpoint at `/docs`.

- **Auth**: `POST /auth/register`, `POST /auth/login` (form-encoded).
- **Users**: `GET /users/me` (`has_cv`, `track`), `PATCH /users/me` (rename
  and/or change password — the settings page), `GET /users/me/agents`,
  `GET /users/me/dashboard`, `/users/me/employee-file`, `/users/me/reviews`,
  `POST /users/me/cv` (paste), `POST /users/me/cv/file` (replace after
  onboarding — 409 while mid-wizard).
- **Onboarding**: `POST /onboarding/cv` (upload, starts the graph),
  `POST /onboarding/qa`, `POST /onboarding/track`, `POST /onboarding/agents`,
  `GET /onboarding/state`, `GET /onboarding/resume` (resume the wizard from
  wherever it was left, no LLM cost), `POST /onboarding/reset`,
  `GET /onboarding/catalog` (no auth required).
- **Projects**: `GET /projects/me` (`seed_id`, `has_materials`),
  `POST /projects/own` (multipart: `title`, `description`, optional
  `materials_text` + up to 3 `files`).
- **Tasks**: `GET /tasks` (incl. `needs_changes`, `revision_count`,
  `roundtable_running`), `POST /tasks` (admin/manual only), `GET /tasks/{id}`,
  `PATCH /tasks/{id}/status`, `POST /tasks/{id}/submit` (multipart — the path
  the frontend uses), `GET /tasks/{id}/attachments/{attachment_id}`,
  `POST /tasks/{id}/messages`, `GET /tasks/{id}/review`.
- **Agents**: `POST /agents/manager/assign-task` (bootstraps/advances the
  weekly cycle), `POST /agents/manager/reply/{task_id}` (unchanged, still
  Manager-only), `POST /agents/task/{task_id}/reply` (body
  `{"agent_type": ...}`, defaults to `mentor` — the endpoint the app itself
  uses now; 403s an agent not available for task chat, `docs/TASK_CHAT.md`),
  `POST /agents/mentor/review/{task_id}` (schedules the roundtable in the
  background), `POST /agents/hr/rollup`.
- **Meeting**: `GET/POST /meeting/{agent}` — any `AgentType`; 403s an optional
  agent the graduate hasn't added. `GET/POST /meeting/team` — the Team Room's
  shared thread, routed to whichever teammate fits (`docs/TEAM_ROOM.md`).
- Every request should carry `X-Venv-Language: en|ar` (the frontend does this
  automatically) so agent replies match the UI language.
- All of the above is wired into `frontend/src/lib/api.ts` and the per-domain
  `lib/*.ts` files — nothing calls `fetch` directly elsewhere.

## Running the smoke suite

Mocked LLM calls throughout — no API key needed. From `backend/`:

```bash
python smoke_test.py                          # auth → task → thread (20)
python smoke_test_agents.py                    # Manager/Mentor/HR basics (19)
python smoke_test_weekly_cycle.py              # Project/Week schema + iterative review (17)
python smoke_test_orchestration.py             # full weekly cycle, end to end (57)
python smoke_test_meeting.py                   # direct agent chat, Stage 1 scope (15)
python smoke_test_llm_errors.py                # graceful LLM-failure handling (10)
python smoke_test_llm_provider_routing.py      # tier-aware provider selection (14)
python smoke_test_stage2_onboarding.py         # onboarding graph, isolated (28)
python smoke_test_stage2_onboarding_router.py  # onboarding endpoints, incl. reset (36)
python smoke_test_stage2_collaboration.py      # Manager/HR consulting the Mentor (9)
python smoke_test_stage2_own_project.py        # POST /projects/own (12)
python smoke_test_stage2_meeting.py            # Meeting Room roster gating (9)
python smoke_test_stage2_submissions.py        # multi-modal submission + vision (41)
python smoke_test_stage2_co_reviews.py         # co_reviewers.py unit tests (11)
python smoke_test_stage2_roundtable.py         # the roundtable, end to end (20)
python smoke_test_migrations.py                # Alembic + model-drift guard (19; +10 with Postgres)
python smoke_test_stage2_onboarding_resume.py  # restart-proof onboarding + CV replacement (54)
python smoke_test_needs_changes.py             # visible 'needs changes' state (29)
python smoke_test_agent_language.py            # agents answer in Arabic + browser CORS preflight (34)
python smoke_test_mentor_rubric.py             # Mentor rubric v2 + enforcement (49)
python smoke_test_llm_tool_output.py           # repair / retry / fail over on bad model output (48)
python smoke_test_task_bank.py                 # the Manager's task bank: integrity + wiring (62)
python smoke_test_github_client.py             # what the Mentor sees of a repo; token + rate limit (29)
python smoke_test_background_roundtable.py     # roundtable runs after the review; real HTTP timing (43)
python smoke_test_own_project_materials.py     # own-project notes/files reach the Manager's plan (29)
python smoke_test_onboarding_graph_hardening.py # onboarding tool calls: repair/check/retry (16)
python smoke_test_task_chat.py                 # task-thread agent switcher: Mentor default, Manager/roster agents, HR refused (14)
python smoke_test_team_room.py                 # Team Room: routing, fallback, isolation between users (17)
python smoke_test_settings.py                  # PATCH /users/me: rename, password change, validation (15)
```

If the LLM key is missing, wrong, or out of credit, agent endpoints return a
clean, actionable error (503/429/502) rather than a 500 — a missing key never
looks like a crash.

**Before a demo, also run the real-model check** — the suites above mock every
model call, so only this one catches a slow provider, malformed tool output, a
provider without image support, or a failover that doesn't fail over:

```bash
python e2e_real_llm.py                                # providers as set in .env
python e2e_real_llm.py --provider qwen                # one provider for every call
python e2e_real_llm.py --language ar                   # do the agents really answer in Arabic?
python e2e_real_llm.py --full-week --force-approve     # run the end-of-week cascade even if the Mentor keeps bouncing
python e2e_real_llm.py --save-report run.json          # keep what the models produced, to review or share
```

It reports what a graduate actually waits for (over real HTTP), how often a
model's output had to be repaired or retried, and prints the project/tasks/
reviews the models produced so you can judge quality yourself. First real run
(DeepSeek and Claude) found the malformed-output bug that started this whole
hardening pass — it has already earned its keep once.
