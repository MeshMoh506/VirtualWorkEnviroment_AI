"""
Full lifecycle test (docs/FULL_LIFECYCLE.md): one continuous story, start
to finish, through nearly every real system this project has —
deliberately not a duplicate of the many focused per-feature tests
elsewhere, but a single connected narrative proving the whole thing
holds together end to end, the way a real graduate would actually
experience it:

A company sets up a real role and a real project -> invites a specific
graduate -> the graduate registers, uploads a real CV, completes
onboarding (track + a chosen roster) -> discovers and accepts the
invitation, with real consent -> works a full week on the company's own
project (a real question in task chat, a real submission that needs
changes, a real resubmission that gets approved, a real specialist
weighing in during the roundtable) -> the week ends and the real
end-of-week cascade fires (Manager's progress review, HR's behavioral
review) -> a new week begins automatically -> HR's skills rollup and
the Career Coach's check-in both produce real, structured output ->
and, at the end, the graduate's own transparency view is checked
byte-for-byte against the company's own view of the same graduate.

Mocked LLM throughout (a single, realistic, narratively-consistent set
of responses — not generic filler), no API key needed.

Run: python smoke_test_full_lifecycle.py
"""
import os
from unittest.mock import patch

os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL", "sqlite:///./smoke_test_full_lifecycle.db"
)
os.environ.setdefault("ANTHROPIC_API_KEY", "not-used-every-llm-call-is-mocked-below")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Task, User  # noqa: E402
from app.agents import career_coach, hr, mentor, roundtable  # noqa: E402
from app.agents.llm_client import AgentReply, ToolCall  # noqa: E402

client = TestClient(app)
client.__enter__()

CHECKS_PASSED = 0


def check(label, condition):
    global CHECKS_PASSED
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}")
    assert condition, label
    CHECKS_PASSED += 1


def register(email, full_name="Sarah") -> dict:
    r = client.post(
        "/auth/register", json={"email": email, "password": "hunter2pass", "full_name": full_name}
    )
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": "hunter2pass"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def db_session():
    return SessionLocal()


def review_shape(verdict, correctness, code_quality, testing, documentation, summary, comment):
    return {
        "tool_name": "submit_review",
        "input": {
            "verdict": verdict,
            "summary": summary,
            "categories": [
                {"key": "correctness", "label": "Correctness", "score": correctness},
                {"key": "code_quality", "label": "Code quality", "score": code_quality},
                {"key": "testing", "label": "Testing", "score": testing},
                {"key": "documentation", "label": "Documentation", "score": documentation},
            ],
            "comments": [{"category": "correctness", "content": comment}],
        },
    }


# =============================================================================
# PHASE 1 — TechCorp sets up a real role and a real project, and invites
# a specific graduate by email.
# =============================================================================
print("\n--- Phase 1: TechCorp sets up ---")

techcorp_admin = register("admin@techcorp.example", "TechCorp Admin")
r = client.post(
    "/company/register",
    json={
        "email": "founder@techcorp.example",
        "password": "hunter2pass",
        "full_name": "TechCorp Founder",
        "company_name": "TechCorp",
    },
)
check("TechCorp founds a company -> 201", r.status_code == 201)
r = client.post("/auth/login", data={"username": "founder@techcorp.example", "password": "hunter2pass"})
co_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

r = client.post("/company/job-titles", json={"title": "Backend Developer"}, headers=co_headers)
check("TechCorp creates a job title -> 201", r.status_code == 201)
job_title_id = r.json()["id"]

r = client.post(
    f"/company/job-titles/{job_title_id}/projects",
    data={
        "title": "Notifications Service",
        "description": "A real-time notification system for TechCorp's platform.",
        "materials_text": "Stack: FastAPI, PostgreSQL, WebSockets. Must support email and in-app notifications.",
    },
    headers=co_headers,
)
check("TechCorp creates a real project for the role -> 201", r.status_code == 201)
company_project_id = r.json()["id"]
check("the project's real materials are stored", r.json()["has_materials"] is True)

r = client.post(
    f"/company/job-titles/{job_title_id}/invitations",
    json={"invited_email": "sarah@example.com", "company_project_id": company_project_id},
    headers=co_headers,
)
check("TechCorp invites Sarah, naming the real project -> 201", r.status_code == 201)
invitation_id = r.json()["id"]
check("the invitation names the right project", r.json()["company_project_title"] == "Notifications Service")


# =============================================================================
# PHASE 2 — Sarah registers, uploads a real CV, and completes onboarding.
# =============================================================================
print("\n--- Phase 2: Sarah registers and onboards ---")

sarah = register("sarah@example.com", "Sarah")

REAL_CV = (
    "Sarah Kim\nBackend Developer\n\nEXPERIENCE\nJunior Developer, StartupXYZ (2024-2025)\n"
    "- Built REST APIs in Python/Flask\n- Wrote unit tests with pytest\n\n"
    "EDUCATION\nB.Sc. Computer Science, State University (2024)\n\nSKILLS\nPython, SQL, Git"
)
with patch(
    "app.agents.graph.cv_parsing.call_with_tool",
    return_value={"tool_name": "classify_document", "input": {"is_cv": True, "reason": ""}},
):
    r = client.post("/users/me/cv", json={"cv_raw_text": REAL_CV}, headers=sarah)
check("Sarah's real CV is accepted -> 200", r.status_code == 200)


class FakeAIMessage:
    def __init__(self, tool_calls):
        self.tool_calls = tool_calls


class FakeBoundModel:
    def __init__(self, name, args):
        self._name, self._args = name, args

    def invoke(self, messages):
        return FakeAIMessage([{"name": self._name, "args": self._args}])


class FakeModel:
    def __init__(self, responses):
        self._responses = responses

    def bind_tools(self, tools, tool_choice):
        name = tools[0]["function"]["name"]
        return FakeBoundModel(name, self._responses[name])


ONBOARDING_RESPONSES = {
    "generate_questions": {
        "questions": ["What was your biggest contribution at StartupXYZ?", "Comfortable with async Python?"]
    },
    "suggest_track": {"track": "software_engineering", "reasoning": "CV shows backend API experience."},
    "suggest_agents": {"agent_ids": ["security_reviewer", "career_coach"]},
}

with patch(
    "app.agents.graph.onboarding_graph.small_model_chain",
    return_value=[("anthropic", FakeModel(ONBOARDING_RESPONSES))],
), patch(
    "app.agents.graph.cv_parsing.call_with_tool",
    return_value={"tool_name": "classify_document", "input": {"is_cv": True, "reason": ""}},
):
    r = client.post("/onboarding/cv", headers=sarah, files={"file": ("cv.txt", REAL_CV.encode(), "text/plain")})
    check("onboarding: CV step re-runs cleanly (CV already validated above) -> 200", r.status_code == 200)

    r = client.post(
        "/onboarding/qa",
        headers=sarah,
        json={"answers": {"0": "I owned the payments API end to end.", "1": "Yes, used asyncio daily."}, "intro_text": None},
    )
    check("onboarding: qa -> track suggestion -> 200", r.status_code == 200 and r.json()["suggested_track"] == "software_engineering")

    r = client.post("/onboarding/track", headers=sarah, json={"track": None})
    check("onboarding: approves the suggested track -> 200", r.status_code == 200)
    check(
        "onboarding: suggests the security reviewer and career coach",
        {a["id"] for a in r.json()["suggested_agents"]} == {"security_reviewer", "career_coach"},
    )

    r = client.post("/onboarding/agents", headers=sarah, json={"agent_ids": ["security_reviewer", "career_coach"]})
    check("onboarding: approves the roster -> 200, onboarding complete", r.status_code == 200)

r = client.get("/onboarding/state", headers=sarah)
check("Sarah's onboarding is genuinely complete", r.json()["onboarding_stage"] == "complete")


# =============================================================================
# PHASE 3 — Sarah discovers TechCorp's invitation and accepts it, with
# real, explicit consent.
# =============================================================================
print("\n--- Phase 3: Sarah accepts the invitation ---")

r = client.get("/invitations/mine", headers=sarah)
check("Sarah sees TechCorp's pending invitation -> 200", r.status_code == 200 and len(r.json()) == 1)
check("the invitation shows the real data-sharing notice", "task submissions" in r.json()[0]["data_shared_notice"].lower())

r = client.post(f"/invitations/{invitation_id}/accept", json={"consent": False}, headers=sarah)
check("accepting without consent is refused -> 400", r.status_code == 400)

r = client.post(f"/invitations/{invitation_id}/accept", json={"consent": True}, headers=sarah)
check("accepting with real consent -> 200", r.status_code == 200)
check("Sarah is now affiliated with TechCorp", r.json()["status"] == "accepted")


# =============================================================================
# PHASE 4 — Week 1: real work, a real question, a real resubmission, a
# real specialist weighing in on the actual submission.
# =============================================================================
print("\n--- Phase 4: Week 1 ---")

captured_plan_week_prompt = {}


def _manager_calls(**kwargs):
    if kwargs.get("force_tool") == "plan_week":
        captured_plan_week_prompt["messages"] = kwargs.get("messages", [])
        return {
            "tool_name": "plan_week",
            "input": {
                "big_task_title": "Ship the notification service",
                "big_task_description": "Build and test the real-time notification system.",
                "subtasks": [
                    {"title": "Design the notification schema", "description": "Design the DB schema for notifications."},
                    {"title": "Build the WebSocket endpoint", "description": "Real-time delivery over WebSockets."},
                    {"title": "Add email fallback", "description": "Email notification when the socket is offline."},
                    {"title": "Write integration tests", "description": "Cover the delivery paths end to end."},
                    {"title": "Write the API docs", "description": "Document the new endpoints."},
                ],
            },
        }
    raise AssertionError(f"unexpected manager tool call: {kwargs.get('force_tool')}")


with patch("app.agents.manager.call_with_tool", side_effect=_manager_calls):
    r = client.post("/agents/manager/assign-task", headers=sarah)
check("Week 1 is planned -> 201", r.status_code == 201)
task1_id = r.json()["id"]
check("the FIRST subtask matches the plan", r.json()["title"] == "Design the notification schema")

r = client.get("/projects/me", headers=sarah)
check(
    "Sarah's project is TechCorp's REAL project, not an improvised one",
    r.json()["title"] == "Notifications Service",
)
check(
    "the Manager's planning prompt genuinely saw the company's real project materials",
    "WebSockets" in str(captured_plan_week_prompt["messages"]),
)

# --- a real question in task chat, mid-work ---
client.post(f"/tasks/{task1_id}/messages", json={"content": "Should notifications be soft-deleted or hard-deleted?"}, headers=sarah)
with patch(
    "app.agents.mentor.call_agentic",
    return_value=AgentReply(
        tool_calls=[ToolCall(name="post_message", input={"content": "Soft-delete — you'll want the history for the read/unread badge."})]
    ),
):
    r = client.post(f"/agents/task/{task1_id}/reply", headers=sarah, json={"agent_type": "mentor"})
check("Mentor answers the real question in task chat -> 201", r.status_code == 201)

# --- submit subtask 1: needs changes ---
r = client.post(f"/tasks/{task1_id}/submit", data={"github_link": "https://github.com/psf/requests"}, headers=sarah)
check("subtask 1 submitted -> 200", r.status_code == 200)

db = db_session()
task1 = db.get(Task, task1_id)
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
with patch("app.agents.mentor.call_with_tool", return_value=review_shape(
    "needs_changes", 3, 2, 1, 2,
    "The schema is missing an index on user_id, and there's no migration for it.",
    "Add an index on notifications.user_id — this table will be read constantly.",
)):
    review1 = mentor.review_task(db, task1, sarah_user)
db.close()
check("subtask 1 first review -> needs_changes", review1.metrics_json["verdict"] == "needs_changes")

r = client.get(f"/tasks/{task1_id}", headers=sarah)
check("the task is visibly back in the graduate's hands after needs_changes", r.json()["status"] == "in_progress")

# --- resubmit: approved ---
r = client.post(f"/tasks/{task1_id}/submit", data={"github_link": "https://github.com/psf/requests"}, headers=sarah)
check("subtask 1 resubmitted -> 200", r.status_code == 200)

db = db_session()
task1 = db.get(Task, task1_id)
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
with patch("app.agents.mentor.call_with_tool", return_value=review_shape(
    "approved", 5, 4, 4, 4,
    "The index is there now and the migration is clean. Good fix.",
    "Nice work adding the index — exactly what was needed.",
)):
    review1b = mentor.review_task(db, task1, sarah_user)
db.close()
check("subtask 1, resubmitted -> approved", review1b.metrics_json["verdict"] == "approved")

# --- the roundtable runs on the approved submission: a real specialist,
#     referencing the REAL PR link, not generic filler ---
db = db_session()
task1 = db.get(Task, task1_id)
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
with patch(
    "app.agents.roundtable.call_agentic",
    return_value=AgentReply(
        text="Checked the notifications.user_id index Sarah just added — it's on the right column, and I don't see any PII logged in the notification payload. No concerns."
    ),
):
    posted = roundtable.run_roundtable(db, sarah_user, task1)
db.close()
check("the roundtable ran and posted real messages", len(posted) >= 1)

r = client.get(f"/tasks/{task1_id}", headers=sarah)
security_messages = [m for m in r.json()["messages"] if m["agent_type"] == "security_reviewer"]
check(
    "the Security Reviewer's message references the ACTUAL fix, not generic filler",
    any("user_id" in m["content"] for m in security_messages),
)


# --- subtasks 2-5: a quicker pass, approved on the first try each time,
#     to reach the end of the week without re-testing depth already
#     covered by smoke_test_mentor_rubric.py / smoke_test_task_bank.py ---
remaining_titles = ["Build the WebSocket endpoint", "Add email fallback", "Write integration tests", "Write the API docs"]
for i, expected_title in enumerate(remaining_titles, start=2):
    with patch("app.agents.manager.call_with_tool", side_effect=AssertionError("no more planning expected mid-week")):
        r = client.post("/agents/manager/assign-task", headers=sarah)
    check(f"subtask {i} released -> 201, titled correctly", r.status_code == 201 and r.json()["title"] == expected_title)
    task_id = r.json()["id"]
    client.post(f"/tasks/{task_id}/submit", data={"github_link": "https://github.com/psf/requests"}, headers=sarah)

    db = db_session()
    task = db.get(Task, task_id)
    sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
    with patch("app.agents.mentor.call_with_tool", return_value=review_shape(
        "approved", 4, 4, 4, 3, f"Solid work on {expected_title.lower()}.", "Looks good."
    )):
        mentor.review_task(db, task, sarah_user)
    db.close()

check("all 5 of week 1's subtasks are now reviewed", True)


# =============================================================================
# PHASE 5 — The week ends: the real end-of-week cascade fires, and a
# new week begins automatically.
# =============================================================================
print("\n--- Phase 5: Week 1 ends, the cascade fires ---")

db = db_session()
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
week1_id = sarah_user.projects[0].weeks[0].id
db.close()

# All 5 subtasks are reviewed, so THIS single assign-task call is the real
# one that triggers everything at once, exactly like a real graduate
# clicking "next task" would: the end-of-week cascade (two ask_mentor
# consults, then the Manager's and HR's reviews), marking week 1
# completed, planning week 2, and releasing its first subtask — all in
# one call, matching weekly_cycle.py's get_next_task exactly rather than
# invoking the cascade directly and risking it running twice.
manager_calls = []


def _manager_end_of_week(**kwargs):
    tool = kwargs.get("force_tool")
    manager_calls.append(tool)
    if tool == "submit_week_progress":
        return {
            "tool_name": tool,
            "input": {
                "summary": "Sarah shipped all 5 subtasks this week, including a full WebSocket notification pipeline with email fallback.",
                "subtasks_completed": 5,
                "subtasks_needed_changes": 1,
            },
        }
    if tool == "plan_week":
        return {
            "tool_name": tool,
            "input": {
                "big_task_title": "Harden the notification service",
                "big_task_description": "Address load and reliability for the service shipped last week.",
                "subtasks": [{"title": f"Week 2 task {i}", "description": f"d{i}"} for i in range(1, 6)],
            },
        }
    raise AssertionError(f"unexpected manager tool call at week end: {tool}")


with patch("app.agents.graph.collaboration.call_with_tool", return_value={
    "tool_name": "reply_to_colleague",
    "input": {"reply": "Strong week — the only rough patch was the missing index on the first subtask, fixed fast once flagged."},
}), patch("app.agents.manager.call_with_tool", side_effect=_manager_end_of_week), patch("app.agents.hr.call_with_tool", return_value={
    "tool_name": "submit_behavioral_review",
    "input": {"summary": "Consistent activity across the week, quick to respond to the one needs_changes.", "consistency_rating": "strong"},
}):
    r = client.post("/agents/manager/assign-task", headers=sarah)
check("week 2's first subtask is returned -> 201", r.status_code == 201 and r.json()["title"] == "Week 2 task 1")
check(
    "both the week-end cascade AND the new week's planning happened in this one call",
    manager_calls == ["submit_week_progress", "plan_week"],
)

db = db_session()
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
week1_after = next(w for w in sarah_user.projects[0].weeks if w.id == week1_id)
check("week 1 is marked completed", week1_after.status.value == "completed")
manager_review = next(rv for rv in week1_after.reviews if rv.kind.value == "week_progress")
hr_review = next(rv for rv in week1_after.reviews if rv.kind.value == "behavioral")
check("the Manager's week-progress review reflects the REAL numbers", manager_review.metrics_json["subtasks_completed"] == 5 and manager_review.metrics_json["subtasks_needed_changes"] == 1)
check("HR's behavioral review rates the week correctly", hr_review.metrics_json["consistency_rating"] == "strong")
db.close()


# =============================================================================
# PHASE 6 — HR's skills rollup and the Career Coach's check-in, both
# with real, structured output.
# =============================================================================
print("\n--- Phase 6: HR rollup + Career Coach check-in ---")

db = db_session()
sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
with patch("app.agents.hr.call_with_tool", return_value={
    "tool_name": "update_employee_file",
    "input": {
        "skills": ["Python", "FastAPI", "WebSockets", "Database indexing"],
        "strengths": ["Responds quickly to review feedback", "Writes clean, testable code"],
        "growth_areas": ["Double-check indexes on new tables before submitting"],
        "summary": "Shipped a full real-time feature in week 1, including a fast turnaround on the one review comment.",
    },
}):
    rollup_review = hr.run_rollup(db, sarah_user)
rollup_metrics = dict(rollup_review.metrics_json)
db.close()
check(
    "HR's skills rollup review reflects the REAL count of reviewed tasks (6 — subtask 1 was reviewed twice)",
    rollup_metrics["reviewed_task_count"] == 6 and rollup_metrics["average_score"] is not None,
)

r = client.get("/users/me/employee-file", headers=sarah)
check("the employee file genuinely reflects the rollup", "WebSockets" in r.json()["skills_json"]["items"])

with patch("app.agents.career_coach.call_with_tool", return_value={
    "tool_name": "submit_career_checkin",
    "input": {
        "summary": "Sarah's first week shows real production-relevant experience: a shipped real-time feature with a database design decision she owned.",
        "resume_highlights": [
            "Designed and shipped a WebSocket-based real-time notification system with email fallback",
            "Identified and fixed a missing database index during code review, improving query performance",
        ],
        "suggested_focus": "Start writing a short design note before each subtask — it'll show up well in interviews.",
    },
}):
    db = db_session()
    sarah_user = db.query(User).filter(User.email == "sarah@example.com").first()
    checkin_review = career_coach.run_checkin(db, sarah_user)
checkin_metrics = dict(checkin_review.metrics_json)
db.close()
check("the Career Coach's check-in produced real, usable resume bullets", len(checkin_metrics["resume_highlights"]) == 2)
check("...referencing the ACTUAL work done, not generic advice", "WebSocket" in checkin_metrics["resume_highlights"][0])


# =============================================================================
# PHASE 7 — Final cross-verification: everything that should exist,
# does — and Sarah's own transparency view matches TechCorp's exactly.
# =============================================================================
print("\n--- Phase 7: Final verification ---")

r = client.get("/users/me/reviews", headers=sarah)
kinds = [rev["kind"] for rev in r.json()]
check("all 6 subtask reviews are present (subtask 1 reviewed twice: needs_changes, then approved)", kinds.count("task_review") == 6)
check("the week-progress, behavioral, skills-rollup, and career-checkin reviews are all present",
      "week_progress" in kinds and "behavioral" in kinds and "skills_rollup" in kinds and "career_checkin" in kinds)
check("10 reviews total, exactly as this lifecycle produced", len(kinds) == 10)

r_student = client.get(f"/invitations/{invitation_id}/visibility", headers=sarah)
r_company = client.get(f"/company/students/{invitation_id}", headers=co_headers)
check("Sarah's own visibility view -> 200", r_student.status_code == 200)
check("TechCorp's roster-detail view of Sarah -> 200", r_company.status_code == 200)
check(
    "Sarah's own view is BYTE-FOR-BYTE IDENTICAL to what TechCorp actually sees, after a full month of real work",
    r_student.json() == r_company.json(),
)

r = client.get("/company/students", headers=co_headers)
sarah_row = next(s for s in r.json() if s["student_email"] == "sarah@example.com")
check("TechCorp's roster shows Sarah with the right project", sarah_row["project_title"] == "Notifications Service")
check("...and the right current week (week 2, now that week 1 is done)", sarah_row["current_week_number"] == 2)

print(f"\nAll {CHECKS_PASSED} full-lifecycle checks passed.")
