"""
Thin routing layer between the API (routers/agents.py) and the three agent
modules. Nothing here talks to the LLM directly — it just calls into
manager.py / mentor.py / hr.py, so the router doesn't need to import them
directly or know their internals. This is the seam agents/README.md
describes: as Stage 2 adds more tracks and user-selectable agents, new
routing decisions (e.g. "which agent handles this track") live here, not in
the router or in an individual agent module.
"""
from sqlalchemy.orm import Session

from app.agents import hr, manager, mentor
from app.models import Review, Task, TaskMessage, User


def manager_assign_task(db: Session, user: User) -> Task:
    return manager.assign_task(db, user)


def manager_reply(db: Session, task: Task, user: User) -> TaskMessage:
    return manager.respond_in_thread(db, task, user)


def mentor_review(db: Session, task: Task, user: User) -> Review:
    return mentor.review_task(db, task, user)


def hr_rollup(db: Session, user: User) -> Review:
    return hr.run_rollup(db, user)
