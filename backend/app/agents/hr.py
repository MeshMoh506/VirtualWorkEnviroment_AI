"""
HR agent. Periodically rolls up a graduate's Mentor review history into an
updated Employee File (the shared record Manager and Mentor also read) plus
a standalone rollup Review (task_id=None — see the Review model's
docstring in models.py). Run cadence (after every task? weekly?) is still
an open decision per docs/PROJECT_STATUS.md; this module just implements
"run it once now" — call it from a manual endpoint, a cron job, or after N
reviews, whichever gets decided later.

Storage note: EmployeeFile.skills_json / strengths_json / growth_areas_json
are typed `dict` in models.py (so the SQLAlchemy default of `{}` before any
HR rollup stays valid). Each holds `{"items": [...]}` once HR has written to
it — the frontend will need a one-line `.items` unwrap when it's wired to
this instead of its current mock arrays.
"""
from sqlalchemy.orm import Session

from app.agents.llm_client import call_with_tool
from app.agents.tools import UPDATE_EMPLOYEE_FILE_TOOL
from app.models import AgentType, Review, User

SYSTEM_PROMPT = (
    "You are HR at Venv. You maintain one graduate's Employee File based "
    "on their Mentor review history: what skills they've demonstrated, "
    "genuine strengths, and honest growth areas. Be specific and "
    "evidence-based — reference what actually happened in the reviews, "
    "not generic praise. Growth areas should be actionable, not vague "
    "('add tests alongside the feature' rather than 'improve quality')."
)


def run_rollup(db: Session, user: User) -> Review:
    mentor_reviews = [r for r in user.reviews if r.agent_type == AgentType.MENTOR]
    if not mentor_reviews:
        raise ValueError("No Mentor reviews yet — nothing for HR to roll up.")

    ef = user.employee_file
    history_text = "\n\n".join(
        f"Review {i + 1} (verdict: {r.metrics_json.get('verdict', '?') if r.metrics_json else '?'}): {r.content}"
        for i, r in enumerate(mentor_reviews)
    )
    prompt = (
        "Current Employee File:\n"
        f"  Skills: {ef.skills_json}\n"
        f"  Strengths: {ef.strengths_json}\n"
        f"  Growth areas: {ef.growth_areas_json}\n"
        f"  Summary: {ef.summary_text}\n\n"
        f"Mentor review history ({len(mentor_reviews)} reviews):\n{history_text}\n\n"
        "Update the Employee File now via the update_employee_file tool."
    )
    result = call_with_tool(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        tools=[UPDATE_EMPLOYEE_FILE_TOOL],
        force_tool="update_employee_file",
        max_tokens=1500,
    )
    data = result["input"]

    ef.skills_json = {"items": data["skills"]}
    ef.strengths_json = {"items": data["strengths"]}
    ef.growth_areas_json = {"items": data["growth_areas"]}
    ef.summary_text = data["summary"]
    db.add(ef)

    scored = [
        c["score"]
        for r in mentor_reviews
        for c in (r.metrics_json or {}).get("categories", [])
    ]
    average_score = round(sum(scored) / len(scored), 2) if scored else None

    review = Review(
        user_id=user.id,
        task_id=None,
        agent_type=AgentType.HR,
        content=data["summary"],
        metrics_json={
            "reviewed_task_count": len(mentor_reviews),
            "average_score": average_score,
        },
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
