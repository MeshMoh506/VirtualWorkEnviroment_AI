import type { AgentId } from "./agents";

export type ReviewVerdict = "approved" | "needs_changes";

export interface RubricCategory {
  key: string;
  label: string;
  score: number; // out of 5
}

export interface ReviewComment {
  id: string;
  category: string; // matches a RubricCategory.key
  content: string;
}

export interface Review {
  id: string;
  taskId: string;
  agentType: AgentId;
  verdict: ReviewVerdict;
  content: string;
  categories: RubricCategory[];
  comments: ReviewComment[];
  createdAt: string;
}

// backend/app/models.py already has a Review table (id, user_id, task_id,
// agent_type, content, metrics_json, created_at), but there's no Pydantic
// schema or endpoint for it yet — and the rubric categories below aren't
// an agreed contract. This is a reasonable starting shape (matches
// Project-Summary.md's note about "general categories" existing beyond
// what's written down), to confirm once the Mentor's actual rubric is
// decided. `verdict` + `categories` here would live inside `metrics_json`.
export const REVIEWS_BY_TASK: Record<string, Review> = {
  t1: {
    id: "r1",
    taskId: "t1",
    agentType: "mentor",
    verdict: "approved",
    content:
      "Clean start. Structure matches what the team agreed on, and everything the task asked for is here — Next.js, Tailwind, and React Flow all installed and wired up. Testing is the one gap, but that's reasonable for a pure setup task — worth adding a basic smoke test on the next one.",
    categories: [
      { key: "correctness", label: "Meets requirements", score: 5 },
      { key: "code_quality", label: "Code quality", score: 4 },
      { key: "testing", label: "Testing", score: 3 },
      { key: "documentation", label: "Documentation", score: 4 },
    ],
    comments: [
      {
        id: "c1",
        category: "correctness",
        content:
          "Everything asked for in the task is here — Next.js, Tailwind, and React Flow all installed and wired.",
      },
      {
        id: "c2",
        category: "code_quality",
        content:
          "Folder structure matches the team's agreed layout — good to keep that consistent as more routes get added.",
      },
      {
        id: "c3",
        category: "testing",
        content:
          "No tests yet, which is fine for a pure setup task, but the next one should include at least a basic smoke test for whatever it adds.",
      },
      {
        id: "c4",
        category: "documentation",
        content:
          "frontend/README.md covers running it locally, which is exactly what the next person on the team needs.",
      },
    ],
    createdAt: new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  t6: {
    id: "r2",
    taskId: "t6",
    agentType: "mentor",
    verdict: "approved",
    content:
      "Works end to end and the validation logic is solid. Two gaps this time though: no tests, and the README wasn't touched even though the login flow changed how the app starts. Approved since neither blocks the next task, but worth tightening up.",
    categories: [
      { key: "correctness", label: "Meets requirements", score: 4 },
      { key: "code_quality", label: "Code quality", score: 4 },
      { key: "testing", label: "Testing", score: 2 },
      { key: "documentation", label: "Documentation", score: 2 },
    ],
    comments: [
      {
        id: "c5",
        category: "testing",
        content:
          "No tests on the validation logic — that's exactly the kind of thing worth covering, since it's easy to regress silently.",
      },
      {
        id: "c6",
        category: "documentation",
        content:
          "The README still describes the old (no-login) flow. Update it in the same PR next time, not as a follow-up.",
      },
    ],
    createdAt: new Date(
      Date.now() - 4 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  t7: {
    id: "r3",
    taskId: "t7",
    agentType: "mentor",
    verdict: "approved",
    content:
      "Good jump from last time. Tests are in this round, and the PR description actually explains the approach instead of just what changed. This is the standard to keep hitting going forward.",
    categories: [
      { key: "correctness", label: "Meets requirements", score: 5 },
      { key: "code_quality", label: "Code quality", score: 5 },
      { key: "testing", label: "Testing", score: 4 },
      { key: "documentation", label: "Documentation", score: 4 },
    ],
    comments: [
      {
        id: "c7",
        category: "testing",
        content:
          "Test for the unread count is exactly the right thing to cover — that's the part most likely to silently break.",
      },
      {
        id: "c8",
        category: "code_quality",
        content:
          "Dropdown closes on outside click and on Escape — small detail, but it's the kind of thing that makes a feature feel finished.",
      },
    ],
    createdAt: new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
};

export function averageScore(review: Review): number {
  const total = review.categories.reduce((sum, c) => sum + c.score, 0);
  return total / review.categories.length;
}
