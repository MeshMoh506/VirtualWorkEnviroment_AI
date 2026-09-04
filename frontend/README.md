# Venv Frontend

Not started yet. Scope per the proposal:

- React + Next.js, React Flow for the node-based home board
- Home board: user node connected to Manager / Mentor / HR nodes; clicking a
  node opens that agent's task board
- Task board: To Do / In Progress / Submitted / Reviewed columns
- Task detail view: description + threaded comments (this is where agent
  replies and user questions live — see `backend/app/routers/tasks.py`'s
  `/tasks/{id}/messages` endpoint)
- Performance page: HR's rollup view, separate from per-task detail

## Talking to the backend

Base URL in dev: `http://localhost:8000`. Auth is JWT bearer — see the
"Auth flow for the frontend team" section in the root README and
`backend/README.md` for the exact request/response shapes. `/docs` on the
running backend gives you live, interactive schemas for every endpoint.

## Suggested setup (once you start)

```bash
npx create-next-app@latest .
npm install reactflow
```
