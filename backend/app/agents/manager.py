"""
Manager agent. Two jobs, matching agents/README.md:
  1. Assign a task, calibrated against the graduate's CV / Employee File.
  2. Reply in a task's comment thread when the graduate posts something.

Creating a Task here has the same effect as POST /tasks (see
routers/tasks.py's comment) — this module builds the row directly rather
than making an HTTP call to its own server, which avoids a pointless
self-request but produces an identical row.

Scoping note: new Task rows are only ever created via `assign_task` (called
again once the current task reaches 'reviewed'). `respond_in_thread` only
posts messages — it never assigns a new task mid-conversation. That keeps
"who can create a task" unambiguous as the agent logic grows.
"""
from sqlalchemy.orm import Session

from app.agents.llm_client import call_agentic, call_with_tool
from app.agents.tools import CREATE_TASK_TOOL, POST_MESSAGE_TOOL
from app.models import AgentType, SenderType, Task, TaskMessage, User

SYSTEM_PROMPT = (
    "You are the Manager at Venv, a simulated software team a recent "
    "graduate has just joined. Your job is to assign one clear, scoped "
    "task at a time from the AI-powered-web-apps track, calibrated to "
    "what you know about this graduate's skills so far. Keep your tone "
    "professional and encouraging, like a good real manager onboarding a "
    "junior engineer — brief context, then a concrete, testable "
    "deliverable. Never assign more than one task at once."
)


def _cv_context(user: User) -> str:
    parts = []
    if user.cv_raw_text:
        parts.append(f"CV (raw text at intake):\n{user.cv_raw_text}")
    ef = user.employee_file
    if ef and ef.skills_json:
        parts.append(f"Known skills so far: {ef.skills_json}")
    if ef and ef.summary_text:
        parts.append(f"HR summary so far: {ef.summary_text}")
    return "\n\n".join(parts) if parts else "No CV or history yet — this is their first task."


def assign_task(db: Session, user: User) -> Task:
    """Assigns the next task and posts the intro message in its thread."""
    existing_titles = [t.title for t in user.tasks]
    prompt = (
        f"{_cv_context(user)}\n\n"
        f"Tasks already assigned so far: {existing_titles or 'none'}.\n"
        "Assign the next task now via the create_task tool."
    )
    result = call_with_tool(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        tools=[CREATE_TASK_TOOL],
        force_tool="create_task",
    )
    data = result["input"]

    task = Task(
        title=data["title"],
        description=data["description"],
        user_id=user.id,
        created_by_agent=AgentType.MANAGER,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    db.add(
        TaskMessage(
            task_id=task.id,
            sender_type=SenderType.AGENT,
            agent_type=AgentType.MANAGER,
            content=f"New task: {task.title}\n\n{task.description}",
        )
    )
    db.commit()
    db.refresh(task)
    return task


def respond_in_thread(db: Session, task: Task, user: User) -> TaskMessage:
    """Reads the task's thread and posts a reply. Called after the graduate
    posts a message via POST /tasks/{id}/messages."""
    history = [
        {
            "role": "assistant" if m.sender_type == SenderType.AGENT else "user",
            "content": m.content,
        }
        for m in task.messages
    ]
    system = (
        SYSTEM_PROMPT
        + f"\n\nCurrent task: {task.title} — {task.description}\n"
        + f"Status: {task.status.value}.\n{_cv_context(user)}"
    )
    response = call_agentic(
        system=system,
        messages=history or [{"role": "user", "content": "(no messages yet)"}],
        tools=[POST_MESSAGE_TOOL],
    )

    content = None
    for block in response.content:
        if block.type == "tool_use" and block.name == "post_message":
            content = block.input["content"]
        elif block.type == "text" and block.text:
            content = block.text
    content = content or "Got it — keep going, and let me know if you get stuck."

    message = TaskMessage(
        task_id=task.id,
        sender_type=SenderType.AGENT,
        agent_type=AgentType.MANAGER,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
