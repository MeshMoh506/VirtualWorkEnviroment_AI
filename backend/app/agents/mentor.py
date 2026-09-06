"""
Mentor agent. Reads a submitted task's github_link, writes a structured
Review (metrics_json holds verdict + rubric categories + inline comments —
see tools.SUBMIT_REVIEW_TOOL for the exact contract, matching
frontend/src/lib/reviews.ts's proposed shape), posts a summary message in
the task thread, and moves the task to 'reviewed' — per agents/README.md,
that transition is the Mentor's job, not the graduate's.
"""
from sqlalchemy.orm import Session

from app.agents.github_client import fetch_repo_context
from app.agents.llm_client import call_with_tool
from app.agents.tools import SUBMIT_REVIEW_TOOL
from app.models import AgentType, Review, SenderType, Task, TaskMessage, TaskStatus, User

SYSTEM_PROMPT = (
    "You are the Mentor at Venv, reviewing a recent graduate's submitted "
    "work. Be specific and constructive: point at what's actually in the "
    "repo, not generic advice. Score each rubric category 1-5. Use "
    "'needs_changes' only when something genuinely blocks the task's "
    "goal — minor gaps (missing tests, thin docs) can still be 'approved' "
    "with a comment about what to improve next time, the way a real "
    "early-career review would handle it."
)


def review_task(db: Session, task: Task, user: User) -> Review:
    if not task.github_link:
        raise ValueError("Task has no github_link to review yet.")

    repo_context = fetch_repo_context(task.github_link)
    prompt = (
        f"Task assigned: {task.title}\n{task.description}\n\n"
        f"Submitted repo:\n{repo_context}\n\n"
        "Submit your review now via the submit_review tool."
    )
    result = call_with_tool(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        tools=[SUBMIT_REVIEW_TOOL],
        force_tool="submit_review",
        max_tokens=2000,
    )
    data = result["input"]

    review = Review(
        user_id=user.id,
        task_id=task.id,
        agent_type=AgentType.MENTOR,
        content=data["summary"],
        metrics_json={
            "verdict": data["verdict"],
            "categories": data["categories"],
            "comments": data["comments"],
        },
    )
    db.add(review)

    task.status = TaskStatus.REVIEWED
    db.add(task)

    db.add(
        TaskMessage(
            task_id=task.id,
            sender_type=SenderType.AGENT,
            agent_type=AgentType.MENTOR,
            content=data["summary"],
        )
    )
    db.commit()
    db.refresh(review)
    return review
