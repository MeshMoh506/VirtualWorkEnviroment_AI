"""
The weekly-cycle state machine (docs/STAGE1_PRODUCT_FLOW.md): decides what
should happen next when the graduate asks for their next task, and drives
the whole Project -> Week -> subtask -> end-of-week cascade -> next Week
lifecycle from that single entry point (orchestrator.manager_assign_task,
called by POST /agents/manager/assign-task — no new endpoint needed).

This replaces the old flat "always create a brand new task" behavior.
manager.py/hr.py own the individual LLM-calling steps this composes; this
file only owns the sequencing between them. get_next_task is idempotent:
calling it again while a subtask is still in flight just returns that same
subtask rather than creating a duplicate.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.agents import hr, manager
from app.models import Project, ProjectStatus, Task, TaskStatus, User, Week, WeekStatus


def _active_project(db: Session, user: User) -> Project | None:
    return (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.status == ProjectStatus.ACTIVE)
        .order_by(Project.created_at.desc())
        .first()
    )


def _active_week(db: Session, project: Project) -> Week | None:
    return (
        db.query(Week)
        .filter(Week.project_id == project.id, Week.status == WeekStatus.ACTIVE)
        .order_by(Week.week_number.desc())
        .first()
    )


def _open_task(week: Week) -> Task | None:
    """The most recently released subtask, if it's not yet approved. None
    once it's REVIEWED — that's what signals room for the next one."""
    if not week.tasks:
        return None
    latest = max(week.tasks, key=lambda t: t.created_at)
    return latest if latest.status != TaskStatus.REVIEWED else None


def get_next_task(db: Session, user: User) -> Task:
    project = _active_project(db, user)
    if project is None:
        project = manager.create_project(db, user)

    week = _active_week(db, project)
    if week is None:
        week = manager.plan_week(db, user, project)
        return manager.release_next_subtask(db, week)

    open_task = _open_task(week)
    if open_task is not None:
        return open_task

    if week.next_subtask_index < len(week.subtasks_plan_json):
        return manager.release_next_subtask(db, week)

    # All 5 subtasks approved this week -> end-of-week cascade (Manager's
    # progress review, then HR's behavioral review reading it alongside —
    # confirmed order), close out the week, and roll straight into the
    # next one so this call always returns a real task to work on.
    manager.submit_week_progress(db, user, week)
    hr.run_behavioral_review(db, user, week)
    week.status = WeekStatus.COMPLETED
    week.ended_at = datetime.utcnow()
    db.add(week)
    db.commit()

    new_week = manager.plan_week(db, user, project)
    return manager.release_next_subtask(db, new_week)
