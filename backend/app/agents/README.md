# Agents

Not started yet. This is where Manager, Mentor, HR prompts, tool-calling, and
the orchestrator live. Nothing here should need schema changes — the DB
already has the shapes this work plugs into:

- **Manager** — assigns the first task by calling `POST /tasks` (see
  `app/routers/tasks.py`), calibrated against `User.cv_raw_text` /
  `EmployeeFile.skills_json`. Later tasks come from ongoing conversation in
  the task thread (`POST /tasks/{id}/messages` with `agent_type="manager"`).
- **Mentor** — reads a submitted task's `github_link`, posts findings via
  `POST /tasks/{id}/messages` with `agent_type="mentor"`, and writes a
  structured `Review` (`agent_type="mentor"`, `task_id` set).
- **HR** — periodically reads `EmployeeFile` + a user's `Review` history and
  writes a rollup `Review` (`agent_type="hr"`, `task_id=None`), plus keeps
  `EmployeeFile.strengths_json` / `growth_areas_json` / `summary_text` fresh.

## Suggested shape (fill in as you build)

```
agents/
├── manager.py         # system prompt + tool-calling logic for task assignment
├── mentor.py           # code review logic against github_link
├── hr.py                # periodic review generation
├── orchestrator.py     # routes a message to the right agent, shares Employee File context
└── tools.py             # tool definitions the agents call (create_task, post_message, ...)
```

Each agent should be a **config** (system prompt + tools + eval criteria)
against one shared LLM client, not a separate model — this is what keeps
Stage 2 (more tracks, user-selectable agents) additive instead of a rewrite.
LLM provider (Anthropic vs OpenAI) is still an open decision from the
proposal — keep the client call behind a thin wrapper here so swapping it
later doesn't touch `manager.py` / `mentor.py` / `hr.py`.
