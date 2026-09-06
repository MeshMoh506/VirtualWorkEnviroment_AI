# Agents

Manager, Mentor, and HR are implemented — LLM: Anthropic Claude, model
configurable via `LLM_MODEL` in `.env` (default `claude-sonnet-5`).
Orchestration is a plain custom router (`orchestrator.py`), not a framework
like CrewAI — three agents sharing one Employee File didn't need one.

- **Manager** (`manager.py`) — assigns the first/next task by building a
  `Task` row directly (same effect as `POST /tasks`, see
  `app/routers/tasks.py`'s comment), calibrated against
  `User.cv_raw_text` / `EmployeeFile.skills_json`. Also replies in a task's
  thread (`respond_in_thread`) when the graduate posts a message.
- **Mentor** (`mentor.py`) — reads a submitted task's `github_link` via
  `github_client.py` (real GitHub API, unauthenticated, public repos only —
  matches Project-Summary.md's Stage 1 scope), writes a structured `Review`
  (`agent_type="mentor"`, `metrics_json` = verdict + rubric categories +
  inline comments — see `tools.py`'s `SUBMIT_REVIEW_TOOL`), posts a summary
  message, and moves the task to `reviewed`.
- **HR** (`hr.py`) — reads a graduate's Mentor review history and writes a
  rollup `Review` (`agent_type="hr"`, `task_id=None`), and refreshes
  `EmployeeFile.skills_json` / `strengths_json` / `growth_areas_json` /
  `summary_text` (each holds `{"items": [...]}` once HR has run — see the
  storage note at the top of `hr.py`).

## Files

```
agents/
├── llm_client.py     # thin Anthropic wrapper — swap providers here only
├── tools.py           # tool schemas (create_task, post_message, submit_review, update_employee_file)
├── github_client.py   # unauthenticated GitHub API client for Mentor's repo context
├── manager.py         # assign_task, respond_in_thread
├── mentor.py          # review_task
├── hr.py              # run_rollup
└── orchestrator.py    # routes API calls to the above — see routers/agents.py
```

Triggered via `POST /agents/manager/assign-task`, `POST
/agents/manager/reply/{task_id}`, `POST /agents/mentor/review/{task_id}`,
`POST /agents/hr/rollup`. Read the results back via `GET
/tasks/{task_id}/review`, `GET /users/me/employee-file`, `GET
/users/me/reviews`.

Test with `python smoke_test_agents.py` — mocks the three LLM calls (no
API key needed to run it) but hits the real GitHub API for Mentor's repo
fetch.

## Still open

- **Task bank**: the Manager's system prompt currently improvises tasks
  from the CV/skills context alone — no curated task bank exists yet
  (Project-Summary.md flags this as still open).
- **Rubric categories are a first pass**, not a finalized contract — see
  `tools.py`'s comment above `SUBMIT_REVIEW_TOOL`.
- **HR cadence** — currently "run it once, on demand" via the endpoint;
  whether it should trigger automatically after every N reviews or on a
  schedule is still open.
- **CV parsing** — Manager reads `cv_raw_text` as raw text in the prompt;
  no structured extraction into `EmployeeFile.skills_json` happens before
  HR's first rollup.
