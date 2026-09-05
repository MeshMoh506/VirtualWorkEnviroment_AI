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
};
