# Stage 1 Product Flow — Weekly Cycles

_Added Sep 2026. **Update:** the schema section below is now built —
`Project`, `Week`, `Task.deadline`/`submitted_at`/`completed_at`/`is_late`,
and `Review.kind`/`week_id` all exist in `backend/app/models.py`, and the
Mentor's review is now iterative (`needs_changes` bounces a task back to
`in_progress` instead of dead-ending in `reviewed`). What's still missing
is the orchestration that actually populates the new tables: starting a
week, releasing subtasks one at a time, and running the end-of-week
cascade. See `docs/PROJECT_STATUS.md` for the current state and the open
questions below (now resolved with working defaults, flagged as such) that
whoever picks up the orchestration should sanity-check with Meshari._

## The flow, end to end

**1. Onboarding**
CV intake (already built — `/onboarding/cv`, paste-only, skippable).
Optionally, later: a short Q&A or an extra selectable field during intake
— deferred for now, not needed yet.

**2. Orientation**
Before formal work starts, the user gets a walkthrough of how Venv works,
and is introduced to the "main project" they'll be working on. Not built
— this is a new UI step (`/board` today assumes the user already knows
what they're looking at).

**3. Formal work — week cycles**
Work runs in cycles of 5 workdays. Each week:
- The Manager first defines a "big task" (the week's overarching goal),
  then breaks it into 5 subtasks.
- The user receives subtasks **one at a time per topic** — gradual
  progression, not all 5 dropped on the board at once. (Today's
  `assign_task` does one task total, with no concept of a week or a
  parent "big task" it belongs to.)
- Each task has a specific deadline. Completing it after that deadline
  marks it **late**. Example given: due October 1st, completed October
  2nd → late.
- Every task is reviewed until fully completed — the Mentor reviews each
  submitted subtask. (Today's Mentor review is single-shot: one review,
  task moves to `reviewed` regardless of verdict. This flow implies
  resubmission + re-review is possible before a task counts as done.)
- The Mentor is meant to work with the user throughout the week, not
  only through the task breakdown that the Manager does.

**4. End of week — the evaluation cascade**
Three steps, in this order:
1. **Mentor** has already been reviewing each subtask as it's submitted
   through the week.
2. **Manager** reviews the user's overall progress for the week, based
   on the Mentor's summary of that week's reviews.
3. **HR** evaluates behavioral aspects — attendance, consistency, and
   absence — after the Manager's review. Late submissions (from step 3
   above) feed into this behavioral evaluation.

## Task source

Two ways a task's content originates:
- **Companies** may upload tasks directly, or assign them to the agent
  (the agent then presents/formulates the task from what the company
  gave it). This is the near-term source — ties directly into the
  existing "task bank content" open item; the bank isn't purely
  Manager-improvised, it's meant to be sourced from real companies.
- **Phase 3**: the user can upload their own project to work on instead.

*Open question worth reconciling: `Project-Summary.md`'s three-stage
roadmap calls Stage 3 "companies build their own [environments]", while
this "Phase 3" is described as the user uploading their own project —
similar numbering, not obviously the same concept. Worth a quick check
with Meshari on whether "Phase 3" here is the same milestone as "Stage 3"
elsewhere, or a distinct sub-phase within Stage 1's task-sourcing model.*

## What this means for the schema — built

- **`Project`** — the "main project" introduced during orientation, what a
  week's big task belongs to. `title`, `description`, `status`
  (active/completed), owned by a `user_id`.
- **`Week`** — one 5-workday cycle within a `Project`: `week_number`,
  `status`, `big_task_title`/`big_task_description`, `started_at`/
  `target_end_at`/`ended_at`. The 5 subtasks the Manager plans up front
  live in `subtasks_plan_json` (not yet real `Task` rows) and get turned
  into one at a time via `next_subtask_index` as each prior one is
  approved — that's how "one at a time per topic" is enforced without a
  new hidden-task status.
- **`Task.deadline` / `submitted_at` / `completed_at` / `is_late`** — all
  added. `is_late` is a computed property (`completed_at > deadline`),
  `None` until both exist. Judged against `completed_at`, not
  `submitted_at`, per the Oct 1 / Oct 2 example, since a submission can now
  bounce back and get resubmitted before it's actually done.
- **Iterative review — done.** `Mentor.review_task` now sets `Task.status`
  to `reviewed` (+ stamps `completed_at`) only on `approved`; `needs_changes`
  sends it back to `in_progress` so the graduate can revise and resubmit.
- **`Review.kind`** (`task_review` / `week_progress` / `behavioral` /
  `skills_rollup`) and **`Review.week_id`** — added so the Manager's
  end-of-week progress review and HR's behavioral evaluation can share the
  `reviews` table with the existing Mentor/rollup reviews instead of
  needing new tables. `week_progress` and `behavioral` aren't written by
  anything yet — no orchestration calls them into being.
- **HR behavioral evaluation** — schema-ready via `Review(kind="behavioral",
  week_id=...)`, but attendance/consistency/absence aren't computed
  anywhere yet — see open question 2 below, still unresolved.

**Not yet built:** anything that actually creates or advances a `Project`/
`Week` — starting one, releasing the next subtask, running the end-of-week
cascade. That's the next piece of work; see `PROJECT_STATUS.md`.

## Open questions — working defaults chosen, worth a quick sanity check

These were "settle before writing schema code" per the original note below;
the schema went ahead with the defaults marked ✅ so this round's work
wasn't blocked, but they weren't explicitly re-confirmed with Meshari and
should be before the orchestration is built on top of them:

1. **Is the big task LLM-generated by the Manager on the fly, or sourced
   from the company task bank?** ✅ Default: LLM-generated for now (the
   task bank doesn't exist yet), via `Week.subtasks_plan_json` — shaped so
   a populated task bank can feed it later without a schema change.
2. **What does "attendance" mean with no fixed login hours?** ❓ Still
   open — not assumed. Needs answering before the HR behavioral eval can
   actually compute anything (days active? tasks touched per day?
   something else?).
3. **Is a "week" a real calendar week, or 5 units of work at the user's own
   pace?** ✅ Default: self-paced — `Week.started_at`/`target_end_at` are
   set relative to when the week starts for that user, not a fixed
   calendar week, consistent with CV intake already being self-paced.
4. **Phase 3 (user uploads own project) vs. Stage 3 (companies build their
   own) naming** — ❓ still unreconciled, doesn't block schema or the next
   round of orchestration work.
