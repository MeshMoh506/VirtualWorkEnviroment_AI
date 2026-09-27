# The full lifecycle test

**The ask**: grow the suite past 1,000 checks, and write something that
tests a genuine full lifecycle — not another focused feature test, but
one continuous story through nearly the whole system, the way a real
graduate would actually live it.

`smoke_test_full_lifecycle.py` is that story. **39 test files, 1,022
checks, all passing** (up from 970 across 38 files).

## The story

A company (TechCorp) sets up a real role and a real project, and
invites a specific graduate (Sarah) by email. Sarah registers, uploads
a real CV — passing the CV-content-validation gate added earlier this
session — and completes onboarding: a track suggestion, an approved
roster (Security Reviewer, Career Coach). She discovers the invitation,
sees the real data-sharing notice, and is refused when she tries to
accept without consenting; accepts for real once she does.

Week 1 begins — planned straight into TechCorp's own real project, not
an improvised one (confirmed directly: the Manager's planning prompt
genuinely contained the company's real project materials). She asks a
real question in task chat mid-task. Her first submission comes back
`needs_changes`; she fixes it and resubmits; it's approved. The
roundtable runs, and Security Reviewer's message genuinely references
the *specific* fix just made — not generic filler. Four more subtasks
follow at a lighter pace (depth on any one of them is already covered
by `smoke_test_mentor_rubric.py` and `smoke_test_task_bank.py`
elsewhere; this test's job is proving the whole path connects, not
re-proving any one link in exhaustive detail).

The week ends. The real end-of-week cascade fires — the Manager's
progress review, HR's behavioral review — and week 2 begins
automatically, all in the *same* HTTP call a real graduate's client
would make, not a directly-invoked shortcut (see "A real near-miss"
below for why that distinction mattered). HR's skills rollup and the
Career Coach's check-in both produce real, structured output. And at
the very end: Sarah's own transparency view is checked **byte-for-byte
identical** to TechCorp's own view of her — the same test
`smoke_test_student_visibility.py` ran once at the moment of
acceptance, now proven to hold after a full month of real, lived
history, not just a freshly-accepted invitation.

## A real near-miss, caught before it became a real bug

The first draft of the week-end phase called
`run_end_of_week_cascade` directly (for precise control over its
mocked responses), then separately called the real `assign-task`
endpoint to start week 2. Reading `weekly_cycle.py`'s actual
`get_next_task` closely enough to write this test surfaced something
that direct-call approach would have silently gotten wrong: the cascade
function itself never marks the week `completed` — its *caller* does,
immediately after. Calling the cascade directly and then hitting the
real endpoint would have meant `get_next_task` seeing the exact same
"all subtasks done, week not marked complete" condition a second time —
running the whole cascade again, against the real unmocked API, in the
test.

Restructured to do it the way a real graduate's client actually does:
one HTTP call, with every response the cascade needs mocked at once
(a dispatcher on `force_tool`, since Manager's `call_with_tool` handles
two different tools — `submit_week_progress` then `plan_week` — in
that one call). This is a better test *and* a better description of
the app's real behavior than the direct-call version would have been.

## What else this surfaced — all in the test's own assumptions

Every one of these was caught by the test failing honestly against the
real implementation, not by production code being wrong:

- **The API returns plain snake_case JSON.** Nearly every field access
  in an early draft assumed the frontend's camelCase convention applied
  at the API layer too — it doesn't; that conversion only happens in
  the TypeScript domain layer. Broke most of the test until fixed
  systematically.
- **Mentor's task-chat replies have their own dedicated function**
  (`mentor.respond_in_thread`), separate from the generic
  `_roster_agent_reply` path the other technical specialists
  (Security/Data/DevOps/QA/UX) share in `task_chat.py`. Wrong mock
  target until traced through the actual call chain.
- **The GitHub link parser only accepts a plain repo URL** —
  `github.com/owner/repo` — not a PR-style path. A first draft's
  fictional `.../pull/1` links would never have matched. Switched to
  the same real, reliable public repo (`psf/requests`) already used
  elsewhere in this suite for exactly this reason.
- **A `needs_changes` review sets the task back to `in_progress`, not
  `todo`.**
- **Several stale-SQLAlchemy-session bugs** from reusing an ORM object
  fetched in one `db_session()` after that session had already been
  closed — the classic `DetachedInstanceError`. Fixed by re-fetching
  fresh inside each new session rather than carrying a reference across
  a `db.close()` boundary.
- **The skills-rollup Review's `metrics_json` only ever holds
  `reviewed_task_count` and `average_score`** — the actual skills list
  lives on the Employee File (`skills_json`), never the Review itself.
- **A genuine narrative-consistency catch of the test's own making**:
  subtask 1 was deliberately reviewed twice in this story
  (`needs_changes`, then approved after the fix) — meaning the real
  total is 6 task reviews and 10 reviews overall, not the 5 and 9 a
  first draft assumed before actually counting.

## Why this test exists alongside everything else

Every individual piece this story touches already has deep, focused
coverage elsewhere — `smoke_test_task_bank.py`,
`smoke_test_mentor_rubric.py`, `smoke_test_company_invitations.py`,
`smoke_test_student_visibility.py`, `smoke_test_ten_agents.py`,
`smoke_test_agent_read_write.py`, `smoke_test_cv_validation.py`, and
more. This file isn't trying to out-test any of them on depth. What it
adds is connectedness: proof that the pieces genuinely compose into one
working system a real person could actually live through, start to
finish, rather than each surviving only in the narrow, isolated context
its own test constructs for it.

## Testing

Run directly: `python smoke_test_full_lifecycle.py` (52 checks).

Full suite: **39 files, 1,022 checks, all passing.**
