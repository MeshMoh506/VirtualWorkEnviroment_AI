# Venv — Virtual Work Environment

A simulated company for recent graduates: a **Manager** agent assigns real-world
tasks, a **Mentor** agent reviews submitted code, and an **HR** agent tracks
growth over time. Stage 1 (this bootcamp, Sep 1 – Oct 1 2026) is scoped to one
track (junior developer) and these three agents.

## Repo structure

```
.
├── backend/     FastAPI + PostgreSQL — auth, task board API, agent orchestration
│   └── app/agents/   Manager / Mentor / HR prompts + orchestrator (AI/Agents track)
├── frontend/    React + React Flow — node board, task board, thread UI
└── .vscode/     Shared editor settings so the whole team gets the same setup
```

## Team roles → where your code goes

| Role | Folder | Owns |
|---|---|---|
| Backend & Data | `backend/app/` (minus `agents/`) | DB schema, auth, task/CV/review APIs |
| AI / Agent engineering | `backend/app/agents/` | Manager, Mentor, HR prompts, tool-calling, orchestrator |
| Frontend | `frontend/` | Node board, task board, thread UI, performance page |
| Product, integration & QA | across both | task bank content, Mentor's review rubric, end-to-end testing |

## Getting started

**1. Start the database.** Install [Docker
Desktop](https://www.docker.com/products/docker-desktop/) once, then from the
repo root:

```bash
docker compose up -d
```

This runs a real Postgres in the background, already matching the credentials
in `backend/.env.example` — no extra config needed. Leave it running while you
work; `docker compose down` stops it.

**2. Run the backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # already points at the Docker Postgres above
uvicorn app.main:app --reload
```

No Docker yet, or just testing something quick? Set `DATABASE_URL=sqlite:///./dev.db`
in `.env` instead — the app runs fine on either, but **Postgres is what the
team should actually develop against**, since that's what we'll deploy on.

Open http://localhost:8000/docs for the interactive API. Run `python
smoke_test.py` any time to sanity-check the whole auth → task → thread flow.

See `backend/README.md` for schema details and exactly where each track's
work is meant to plug in.

## Git workflow

Keep `main` deployable. For any real chunk of work:

```bash
git checkout main && git pull
git checkout -b feature/short-description   # or fix/..., chore/...
# ... do the work, commit as you go ...
git push -u origin feature/short-description
# open a PR into main, get it reviewed, then merge
```

Commit often and in small, meaningful chunks — one logical change per commit,
written in the imperative ("add task status endpoint", not "added" or "stuff").
Merge to `main` once a piece is working end-to-end, not mid-broken.
