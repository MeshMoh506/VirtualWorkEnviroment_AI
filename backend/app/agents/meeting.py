"""
The Meeting Room (/meeting) — a direct, task-free chat with any one of the
three agents. Unlike manager.respond_in_thread (which is scoped to a task's
comment thread), this is open-ended: the graduate asks the Manager about
their week, the Mentor for advice, or HR about their growth, with no task
attached. Persisted as ChatMessage rows, one running thread per
(user, agent).

Each agent answers in its own voice, reusing the same persona the
task-flow agents use, plus whatever shared context (CV, employee file, and
— for grounding — the current project/week) helps it give a useful answer.
The model just replies in plain text here; there are no tools to call in a
conversation, so this uses a plain messages.create rather than
call_agentic/call_with_tool.
"""
from sqlalchemy.orm import Session

from app.agents import hr, manager, mentor
from app.agents.llm_client import get_client
from app.config import settings
from app.models import (
    AgentType,
    ChatMessage,
    Project,
    ProjectStatus,
    SenderType,
    User,
    Week,
    WeekStatus,
)

# Each agent's base persona, reused from the task-flow modules so the
# Meeting Room voice matches the rest of the app.
_PERSONA: dict[AgentType, str] = {
    AgentType.MANAGER: manager.SYSTEM_PROMPT,
    AgentType.MENTOR: mentor.SYSTEM_PROMPT,
    AgentType.HR: hr.SYSTEM_PROMPT,
}

_MEETING_FRAMING = (
    "\n\nYou're in a one-on-one meeting with this graduate — an open "
    "conversation, not tied to any specific task. Answer their questions "
    "directly and helpfully in your own voice, staying in character. Keep "
    "replies concise and conversational (a few sentences), not essays."
)


def _shared_context(db: Session, user: User) -> str:
    parts: list[str] = []
    if user.cv_raw_text:
        parts.append(f"Their CV (raw): {user.cv_raw_text[:1500]}")
    ef = user.employee_file
    if ef and ef.summary_text:
        parts.append(f"HR summary so far: {ef.summary_text}")
    project = (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.status == ProjectStatus.ACTIVE)
        .order_by(Project.created_at.desc())
        .first()
    )
    if project:
        parts.append(f"Current project: {project.title} — {project.description}")
        week = (
            db.query(Week)
            .filter(Week.project_id == project.id, Week.status == WeekStatus.ACTIVE)
            .order_by(Week.week_number.desc())
            .first()
        )
        if week:
            parts.append(
                f"Current week {week.week_number}: {week.big_task_title} — "
                f"{week.big_task_description}"
            )
    return "\n".join(parts) if parts else "No CV, project, or history yet."


def get_history(db: Session, user: User, agent: AgentType) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.agent_type == agent)
        .order_by(ChatMessage.created_at)
        .all()
    )


def send_message(
    db: Session, user: User, agent: AgentType, content: str
) -> ChatMessage:
    """Stores the user's message, generates the agent's reply, stores and
    returns that reply."""
    db.add(
        ChatMessage(
            user_id=user.id,
            agent_type=agent,
            sender_type=SenderType.USER,
            content=content,
        )
    )
    db.commit()

    history = get_history(db, user, agent)
    messages = [
        {
            "role": "assistant" if m.sender_type == SenderType.AGENT else "user",
            "content": m.content,
        }
        for m in history
    ]
    system = _PERSONA[agent] + _MEETING_FRAMING + "\n\n" + _shared_context(db, user)

    response = get_client().messages.create(
        model=settings.llm_model,
        max_tokens=1000,
        system=system,
        messages=messages,
    )
    reply_text = next(
        (b.text for b in response.content if b.type == "text" and b.text),
        "Sorry, I didn't catch that — could you rephrase?",
    )

    reply = ChatMessage(
        user_id=user.id,
        agent_type=agent,
        sender_type=SenderType.AGENT,
        content=reply_text,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply
