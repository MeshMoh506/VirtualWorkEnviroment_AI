# Venv frontend

Next.js (App Router, TypeScript, Tailwind v4) + React Flow for the
node-based home board.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The backend runs separately — see
`backend/README.md` and `docker-compose.yml` at the repo root.

## Scope (from the proposal)

- Home board: user node connected to Manager / Mentor / HR nodes;
  clicking a node opens that agent's interaction panel
- Task board: To Do / In Progress / Submitted / Reviewed columns
- Task detail: description + threaded comments — this is where agent
  replies and user messages live, backed by
  `backend/app/routers/tasks.py`'s `/tasks/{id}/messages` endpoint
- Performance page: HR's rollup view, separate from per-task detail

## Talking to the backend

Base URL in dev: `http://localhost:8000`. Auth is JWT bearer — see the
"Auth flow for the frontend team" section in the root README and
`backend/README.md` for exact request/response shapes. `/docs` on the
running backend gives live, interactive schemas for every endpoint.

## Design system

See `DESIGN.md` before adding new colors, fonts, or components — the
short version is: hairline borders and a faint grid instead of rounded
cards and shadows, one accent color, monospace reserved for actual data
(IDs, timestamps) rather than every label.

## Structure

```
src/app/          App Router pages and layouts
src/app/globals.css   design tokens (colors, fonts) — see DESIGN.md
```

More folders (components, lib, hooks) will get added as the board,
task detail, and review views come online.
