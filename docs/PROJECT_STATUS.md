# Project Status — Venv

> **Stage 2 — complete, merged to `main`.** Stage 1 (Manager/Mentor/HR,
> the weekly cycle, one track) plus everything Stage 2 added: CV-file
> intake with agent-generated Q&A, track selection across six IT majors,
> a selectable optional-agent roster, an own-project path, a guided
> first-time orientation walkthrough, the Meeting Room open to any agent
> on your team, multi-modal task submissions (link/text/images/files,
> with real vision review), and the **agent roundtable** — optional
> agents actually discussing a submission with each other, then the
> Manager synthesizing the discussion. On top of that: Arabic (RTL)
> support and a real light theme, and multi-provider LLM support
> (Anthropic/OpenAI/DeepSeek/Qwen) with tier-aware routing and automatic
> failover. 546 backend checks across 21 smoke suites, all passing;
> frontend eslint clean; full `next build` succeeds. See "Stage 2, in
> full" below for the doc-by-doc breakdown, and "Frontend polish" /
> "Handoff" further down for what's recently done vs. still open.

_Last updated: Sep 2026._

## Where things stand right now

**Backend** (FastAPI + SQLAlchemy, Postgres or sqlite; LangGraph for the
onboarding flow and the weekly-cycle cascade — see
`docs/STAGE2_ONBOARDING_FLOW.md` for why that framework, and
`docs/STAGE2_WEEKLY_CYCLE_FLOW.md` for what stayed plain Python and why):

- Auth, CV file intake (PDF/.docx/plain text), the full weekly-cycle flow
  (Manager plans a project → one big task/week → 5 subtasks released one
  at a time → Mentor reviews each, iteratively → end-of-week Manager
  progress + HR behavioral evaluation, both now genuinely informed by
  consulting the Mentor directly → next week), a home-dashboard
  aggregation endpoint, and the Meeting Room — open to the default three
  agents plus whichever optional agents a graduate added, gated on their
  actual roster.
- Task submission is multi-modal: a GitHub link, free text, and up to 5
  files/images, any combination. Images go to the Mentor as real vision
  content blocks, not just filenames.
- The **agent roundtable**: after the Mentor's review, any optional
  agents on the graduate's team (Security Reviewer / Data Reviewer /
  DevOps) discuss the submission with each other in sequence — each one
  sees the Mentor's review and every prior teammate's turn — then the
  Manager posts a synthesis. Career Coach stays meeting-room-only by
  design (not a code review). Full writeup: `docs/STAGE2_ROUNDTABLE.md`.
- Models: `Organization`, `User` (+ Stage 2 onboarding fields), `Track`
  (six IT majors + the Stage 1 default), `AgentCatalog`/`UserAgent` (the
  optional-agent catalog and roster), `EmployeeFile`, `Project` (+
  `source`: Manager-planned or the graduate's own), `Week`, `Task` (+
  `submission_text`), `TaskAttachment`, `TaskMessage`, `Review`,
  `ChatMessage`.
- Local file storage for attachments (`app/storage.py`, one module so a
  future cloud-storage swap is contained) — dev-scope, one box, not yet
  cloud.
- 21 smoke suites, 546 checks, all passing together (mocked LLM, no API
  key needed to run them) — see the updated list further down.
- **Database migrations (Alembic)** — the schema is now built and evolved
  by versioned migrations applied at startup, not `create_all`. Existing
  dev databases are adopted safely; out-of-date ones get a clear error.
  Verified on SQLite and PostgreSQL 16. See `docs/MIGRATIONS.md`.
- **Onboarding resume + CV replacement** — a closed tab, a server restart
  or a second API worker no longer strands a graduate mid-wizard (state is
  saved on the `User` row and the graph is rebuilt from it, with no LLM
  calls); `POST /users/me/cv/file` replaces a CV without touching
  onboarding. See `docs/ONBOARDING_RESUME.md`.

**Frontend** (Next.js + React Flow, dark-by-default "blueprint" design
system with a light theme and Arabic/RTL support — `frontend/DESIGN.md`):

- `/onboarding/cv` — a 5-step wizard: CV file upload → adaptive,
  agent-generated Q&A (skippable) → track suggestion with an override →
  optional-agent roster (suggested + editable) → own-project choice
  ("let the Manager plan it" or bring your own). `POST
  /onboarding/reset` sends a graduate back to the start if they want to
  redo it — also the fix for any account whose onboarding state got
  stuck (see "Recently fixed" below).
- `/orientation` — shown once right after onboarding: the graduate's
  project (bootstrapped automatically if they picked "let the Manager
  plan it"), their full team (default three + any extras), and a short
  "how it works" walkthrough.
- `/board` — the agents graph, team cards, and detail panel all render
  extra agents dynamically now, not just the fixed three.
- `/workspace` — task rail + detail + the agents-meeting thread, which
  now renders the whole roundtable discussion (Mentor → specialists →
  Manager synthesis), each correctly attributed and colored.
- `/meeting` — open to any agent on the graduate's actual team, not just
  the fixed three.
- `/growth`, `/tasks/[id]/review` — unchanged in shape, now also show
  submission text/attachments alongside the GitHub link.
- Verified: eslint clean across `src/`, full `next build` succeeds (13
  routes).

**Recently fixed:** every graduate was hitting a dead-end "you've
already been through onboarding" screen — pre-Stage-2 accounts never had
`onboarding_stage` properly initialized (no migration tooling, schema
changed via `create_all`), so they read as complete. `POST
/onboarding/reset` + a "Go through it again" button fixes it for anyone
stuck, going forward.

**Multi-provider LLM support, with tier-aware routing.** The backend is
no longer hard-wired to Anthropic — Anthropic, OpenAI, DeepSeek, and
Qwen are all supported, with automatic failover between them (built by
Faisal Alrashed, `Venv-llm-provider-update`). On top of that: provider
selection is now genuinely tier-aware — a "main"-tier call (real
judgment — Mentor's review, the Manager's synthesis) and a "small"-tier
call (cheap/mechanical — onboarding suggestions, a roundtable
specialist's comment) can route through *different* provider priorities
via `LLM_PROVIDER_PRIORITY_MAIN`/`_SMALL`, not just different model
names within whichever provider happens to be first. This also caught
and fixed a real bug: `call_agentic` and the LangGraph model chain both
accepted a `tier` argument but never actually used it to pick the
provider chain, only the model name — meaning tier never affected
*which* provider got tried, only *what* it was asked to run. Full
writeup, including the bug and the failover proof: `docs/
LLM_PROVIDER_FAILOVER.md`. Every LLM call also now logs which
provider/model actually answered — see that doc's "Terminal logging"
section.

**Root-caused and fixed a real hydration bug affecting every non-English
and light-mode visitor.** `ThemeProvider`/`LocaleProvider` were both
reading the anti-flash script's *already-applied* `<html>` attributes as
their React state's initial value — correct-looking (matches what's on
screen instantly), but wrong for SSR: the server always renders with the
default ("dark"/"en"), so any visitor with a different stored preference
got a client-vs-server text mismatch on their very first render — a
hydration error, on every page, for every Arabic or light-mode graduate.
Orientation, being the most translation-heavy page, hit this hardest —
worth knowing if "the greeting page doesn't work" comes up again for a
non-English visitor. Fixed by starting state at the SSR default always,
then adopting the real applied value in a layout effect (post-hydration,
never compared against server output) — the same pattern `next-themes`
uses. See `frontend/src/lib/use-isomorphic-layout-effect.ts`.

## Stage 2, in full — one doc per slice, in build order

1. `docs/STAGE2_ONBOARDING_FLOW.md` — the onboarding LangGraph (CV → Q&A
   → track → roster) and why LangGraph was the right call here.
2. `docs/STAGE2_WEEKLY_CYCLE_FLOW.md` — the end-of-week cascade ported
   to a small StateGraph, Manager/HR actually consulting the Mentor.
3. `docs/STAGE2_OWN_PROJECT.md` — `POST /projects/own`, and why it
   needed almost no new code (Stage 1's `Project`/`Week` tables were
   already general-purpose).
4. `docs/STAGE2_ONBOARDING_FRONTEND.md` — the wizard UI.
5. `docs/STAGE2_TEAM_AND_ORIENTATION.md` — extra agents in the team
   graph, the first-time orientation screen.
6. `docs/STAGE2_MEETING_AND_SUBMISSIONS.md` — extra agents in the
   Meeting Room, multi-modal submissions with vision review.
7. `docs/STAGE2_AGENT_TASK_WORK.md` — the first version of optional
   agents doing task work (parallel co-reviews) — superseded by #8, kept
   as the simpler fallback (`co_reviewers.py`).
8. `docs/STAGE2_ROUNDTABLE.md` — the roundtable (sequential discussion +
   Manager synthesis) and the onboarding-reset fix.

## Not built yet

- **Roundtable specialists don't get vision** — only the Mentor's review
  sees image attachments as real content blocks; specialists just see
  filenames.
- Task bank content — the Manager's tasks are still improvised. (The Mentor's
  rubric is now v2 — anchored scores, one enforced verdict rule, memory of its
  own earlier feedback — as *proposed defaults awaiting team approval*; see
  `docs/MENTOR_RUBRIC.md`.)

## Hardening — built after Stage 2's original scope

1. `docs/MIGRATIONS.md` — Alembic replaces `create_all`; legacy databases
   adopted safely; a drift guard keeps models and migrations in step.
2. `docs/ONBOARDING_RESUME.md` — onboarding resumes after a closed tab or a
   restart; the CV can be replaced after onboarding.
3. `docs/NEEDS_CHANGES_VISIBLE.md` — a task the Mentor bounced back now says
   so (task rail badge, workspace banner, dashboard), derived from the reviews.
4. `docs/AGENT_LANGUAGE.md` — every agent answers in the language the UI is
   showing (Arabic or English), via one header and two hooks in `llm_client`.
5. `docs/MENTOR_RUBRIC.md` — the Mentor's rubric v2 (proposed defaults to
   confirm): anchors, one enforced verdict rule, memory of its own feedback.
6. `docs/LLM_PROVIDER_FAILOVER.md` ("Malformed tool output") — found by the first
   real-model run: Claude returned a list as a string and crashed the Manager.
   Now repaired, retried, failed over, and never a 500.

## Frontend polish — completed since the last handoff, no dedicated docs yet

The three items from the previous "starting the next chat" handoff were
built (by a separate frontend-focused pass, not documented per-slice the
way `STAGE2_*.md` does) and merged to `main` before the LLM-provider/
hydration work above. Noting the actual scope here so a future session
doesn't have to rediscover it from the diffs:

- **Orientation reworked** into a guided multi-step walkthrough
  (`feature/orientation-rework`, PR #33) — `frontend/src/app/
  orientation/page.tsx` grew substantially (255 insertions). Supersedes
  the simpler version `STAGE2_TEAM_AND_ORIENTATION.md` describes — that
  doc is now stale for orientation's actual UI/flow, though the backend
  side it documents (bootstrapping via `assign-task`, the team-graph
  fix) is unaffected and still accurate.
- **Arabic i18n + RTL** (`feature/arabic-support`, PR unnumbered in this
  log, 33 files) — `frontend/src/lib/i18n/` (`en.ts`/`ar.ts` dictionaries,
  `locale.tsx` — the `LocaleProvider`/`useLocale`/`t()` this session's
  hydration fix patched), a `locale-toggle.tsx` component, and every
  major screen/component updated to use `t()` instead of hardcoded
  English strings. `lib/agent-display.ts` (a small helper from
  `STAGE2_TEAM_AND_ORIENTATION.md`) was removed — its logic looks to
  have been folded into `lib/agents.ts` directly.
- **Light mode** (`feature/light-mode`, PR #34, 16 files) — real light
  theme tokens in `globals.css`, a `theme-toggle.tsx` component, and
  `lib/theme.tsx` (the `ThemeProvider` this session's hydration fix also
  patched). Confirmed still dark-mode-default; light is opt-in via the
  toggle.

**Worth doing at some point, not urgent:** write a proper `STAGE2_*.md`-
style doc for these three (or fold an updated summary into
`STAGE2_TEAM_AND_ORIENTATION.md`) — right now the only writeup of *why*
particular decisions were made lives in those PRs' own commit messages,
not in `docs/`, breaking this project's usual documentation discipline.

## Handoff — starting the next chat

No specific ask queued up right now — Stage 2's original scope, the
frontend polish above, the multi-provider LLM work, and this session's
bug fixes are all merged and passing. Reasonable next directions, not
yet prioritized:

- The doc-writing gap just above (cheap, worth doing before it's
  forgotten).
- Anything in "Not built yet" below.
- Stage 3, whatever that turns out to be — no scope defined yet.

## Repo map

```
.
├── docker-compose.yml   one-command local Postgres
├── backend/
│   └── app/
│       ├── agents/       Manager/Mentor/HR/Meeting + Stage 2's roundtable,
│       │                 co_reviewers, weekly_cycle, scheduling — see
│       │                 app/agents/README.md
│       │   └── graph/    LangGraph agents: onboarding_graph, weekly_cycle_graph,
│       │                 collaboration (ask_mentor), models (model routing), catalog
│       ├── routers/      onboarding, projects, tasks, meeting, agents, users, auth
│       └── storage.py    local-disk attachment storage
├── frontend/
│   └── src/
│       ├── app/           landing, login, board, orientation, onboarding/cv,
│       │                  workspace, meeting, growth, tasks/[id]/review
│       ├── components/    board/, dashboard/, workspace/ (incl. attachment-list)
│       └── lib/           api.ts (wire format), one file per domain
└── .vscode/              shared editor config
```

## Working approach — follow this in every chat, every session

1. New piece of work → new branch off `main`: `feature/...`, `fix/...`,
   `chore/...`, `docs/...`.
2. Commit in small, logical chunks with imperative messages ("add X", not
   "added X"). Code gets brief comments explaining *why*, not just what.
3. Test before committing — don't commit something known-broken. Run the
   full smoke suite (all of it, not just the file you touched) before
   calling anything done.
4. Push the branch, open a PR on GitHub, merge into `main`.
5. `main` stays deployable at all times.

## Conventions established so far (keep these consistent going forward)

- Every core table carries a nullable `organization_id`, even where
  nothing uses it yet.
- `EmployeeFile` is the one shared context object — new agent logic
  reads/writes its existing fields rather than inventing a parallel
  structure.
- `TaskMessage.sender_type` is derived, not set directly: pass
  `agent_type` in the request to record it as an agent message, omit it
  for a user message.
- Secrets live in `.env` (gitignored), never committed; `.env.example`
  is the template.
- Frontend: hairline borders + a faint grid instead of rounded cards and
  shadows, one accent color, monospace reserved for actual technical
  content — see `frontend/DESIGN.md` before adding new UI. (Note for the
  light-mode work above: check whether these tokens generalize or need a
  parallel light set before assuming a simple swap.)
- Model routing (Stage 2): cheap/mechanical steps (onboarding
  suggestions, roundtable specialist comments) use the small model
  (`settings.small_llm_model`); the primary judgment calls (Mentor's
  review, the Manager's synthesis/progress writeups) use the main model.
  See `STAGE2_ONBOARDING_FLOW.md` and `STAGE2_ROUNDTABLE.md`.
- Any new agent capability that isn't a hard requirement for every
  graduate goes through the `AgentCatalog`/`UserAgent` roster pattern,
  not a new always-on code path — that's the whole reason Stage 2's
  extra agents were cheap to add.

## Reference: full API surface

- Backend base URL in dev: `http://localhost:8000`. Interactive schema
  for every endpoint at `/docs`.
- **Auth**: `POST /auth/register`, `POST /auth/login` (form-encoded).
  `GET /users/me` (includes `has_cv`, `track`). `GET /users/me/agents`
  (selected optional agents). `GET /users/me/dashboard`,
  `/users/me/employee-file`, `/users/me/reviews`.
- **Onboarding**: `POST /onboarding/cv` (file upload, starts the graph),
  `POST /onboarding/qa`, `POST /onboarding/track`, `POST
  /onboarding/agents`, `GET /onboarding/state`, `POST /onboarding/reset`,
  `GET /onboarding/catalog` (full agent catalog, no auth required).
- **Projects**: `GET /projects/me`, `POST /projects/own`.
- **Tasks**: `GET /tasks`, `POST /tasks` (admin/manual — the app itself
  never calls this), `GET /tasks/{id}`, `PATCH /tasks/{id}/status`,
  `POST /tasks/{id}/submit` (multipart — link/text/files, the path the
  frontend actually uses), `GET /tasks/{id}/attachments/{attachment_id}`
  (owner-only download), `POST /tasks/{id}/messages`, `GET
  /tasks/{id}/review`.
- **Agents**: `POST /agents/manager/assign-task` (bootstraps/advances the
  weekly cycle), `POST /agents/manager/reply/{task_id}`, `POST
  /agents/mentor/review/{task_id}` (also runs the roundtable), `POST
  /agents/hr/rollup`.
- **Meeting**: `GET /meeting/{agent}`, `POST /meeting/{agent}` — `agent`
  is any of the seven `AgentType` values; the router 403s an optional
  agent the graduate hasn't added.
- All of the above is wired into `frontend/src/lib/api.ts` and the
  per-domain `lib/*.ts` files — nothing calls `fetch` directly elsewhere.

## Running the smoke suite

Mocked LLM calls throughout — no API key needed:

```bash
cd backend
python smoke_test.py                        # auth → task → thread (20)
python smoke_test_agents.py                  # Manager/Mentor/HR basics (19)
python smoke_test_weekly_cycle.py            # Project/Week schema + iterative review (17)
python smoke_test_orchestration.py           # full weekly cycle, end to end (57)
python smoke_test_meeting.py                 # direct agent chat, Stage 1 scope (15)
python smoke_test_llm_errors.py              # graceful LLM-failure handling (10)
python smoke_test_llm_provider_routing.py    # tier-aware provider selection (14)
python smoke_test_stage2_onboarding.py       # onboarding graph, isolated (28)
python smoke_test_stage2_onboarding_router.py # onboarding endpoints, incl. reset (36)
python smoke_test_stage2_collaboration.py    # Manager/HR consulting the Mentor (9)
python smoke_test_stage2_own_project.py      # POST /projects/own (12)
python smoke_test_stage2_meeting.py          # Meeting Room roster gating (9)
python smoke_test_stage2_submissions.py      # multi-modal submission + vision (41)
python smoke_test_stage2_co_reviews.py       # co_reviewers.py unit tests (11)
python smoke_test_stage2_roundtable.py       # the roundtable, end to end (20)
python smoke_test_migrations.py              # Alembic + model-drift guard (19; +10 with Postgres)
python smoke_test_stage2_onboarding_resume.py # restart-proof onboarding + CV replacement (54)
python smoke_test_needs_changes.py            # visible 'needs changes' state (29)
python smoke_test_agent_language.py           # agents answer in Arabic (29)
python smoke_test_mentor_rubric.py            # Mentor rubric v2 + enforcement (49)
python smoke_test_llm_tool_output.py          # repair / retry / fail over on unusable model output (48)
```

If the LLM key is missing, wrong, or out of credit, the agent endpoints
return a clean, actionable error (503/429/502) rather than a 500 stack
trace — so a missing key never looks like a crash.

**Before a demo, run the real-model check too** — the suites above mock
every model call, so only this one can catch a slow provider, malformed
tool output, a provider without image support, or a failover that doesn't
fail over:

```bash
cd backend
python e2e_real_llm.py                    # providers as set in .env
python e2e_real_llm.py --provider qwen    # one provider for every call
python e2e_real_llm.py --language ar           # do the agents really answer in Arabic?
python e2e_real_llm.py --full-week --force-approve   # run the end-of-week cascade even if the Mentor keeps bouncing
```

It drives onboarding, the Manager's plan, a submission (optionally with an
image), the Mentor's review and roundtable, meeting-room chat and the HR
rollup, then prints per-step timing, calls per provider and every
failover. It reports how often a model's output had to be repaired or retried.
First real run (DeepSeek and Claude) found the crash above - the script
earned its keep.
