# Stage 2 — Own-Project Path

_Added Sep 2026. Third slice of Stage 2: a graduate can bring their own
project instead of the Manager improvising one — confirmed optional, not
the default. Smoke-tested (`smoke_test_stage2_own_project.py`, 12 checks).
See `docs/STAGE2_ONBOARDING_FLOW.md` and `STAGE2_WEEKLY_CYCLE_FLOW.md` for
the other two slices, `docs/PROJECT_STATUS.md` for the overall state._

## The flow

`POST /projects/own` (title + description), called any time **before**
the graduate's first `POST /agents/manager/assign-task`. From then on,
everything downstream behaves exactly as it already did for a
Manager-improvised project — same `Week`/`Task` lifecycle, same
end-of-week cascade, same reviews.

## Why this needed almost no new code

`weekly_cycle.get_next_task`'s bootstrap step already just checks for
*any* active `Project` — it doesn't care who made it:

```python
project = _active_project(db, user)
if project is None:
    project = manager.create_project(db, user)
```

So a `Project` row created via `POST /projects/own` is picked up on the
very next `assign-task` call, `manager.create_project` never runs for
that graduate, and `manager.plan_week` — which only ever reads
`project.title`/`project.description` into its prompt, never anything
specific to how the project came to exist — plans around it exactly as
it would any other project. Confirmed by the smoke test: only 1 Manager
LLM call on the first `assign-task` (`plan_week`), not the usual 2.

This is the second time this session a Stage 1 design decision paid for
itself unasked: `Project`/`Week` already being real, general-purpose
tables (not something Manager-specific) is why this slice was a couple
of small additions rather than a refactor.

## What this means for the code — built

- **`ProjectSource`** (new enum, `manager` / `own`) — `Project.source`,
  default `manager` (existing rows and any Manager-created project stay
  correctly labeled with no migration needed). Doesn't affect behavior
  anywhere; it's bookkeeping for later (e.g. a "your project" vs. an
  "assigned project" distinction in the UI).
- **`POST /projects/own`** (`app/routers/projects.py`) — creates the
  `Project` with `source=own`. Rejects with 400 if the graduate already
  has an active project — this only works pre-bootstrap; swapping an
  in-progress project isn't supported (weeks already have real
  progress against it).
- **`manager.create_project`** — now sets `source=ProjectSource.MANAGER`
  explicitly (was implicit via the column default before this enum
  existed). Nothing else in `manager.py` changed — confirmed by the full
  regression run.
- `smoke_test_stage2_own_project.py` (new, 12 checks) — own-project
  creation, the duplicate-rejection, and the actual `assign-task` call
  proving `create_project` is skipped and `plan_week` plans into the
  graduate's own project.
- All 10 smoke suites pass together — 209 checks total, no regressions.

## Not built yet

- **Frontend** — nothing in `frontend/` reflects any of Stage 2 yet
  (onboarding, the weekly-cycle collaboration, or this).
- **Switching an in-progress project** — a graduate who started with a
  Manager-improvised project can't later switch to their own mid-stream;
  out of scope for this slice, not clearly needed yet either.
- **Richer own-project context** — today it's just title + description,
  same as a Manager-invented one. A real repo link / tech-stack field
  would let `plan_week` ground subtasks in an actual existing codebase
  rather than a description of one — worth a look once this is wired to
  the frontend and real usage shows whether that's needed.
