import { api, type MentorMetricsApi, type ReviewApiOut } from "./api";
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
  taskId: string | null;
  agentType: AgentId;
  verdict: ReviewVerdict | null; // null for HR rollups, which have no verdict
  content: string;
  categories: RubricCategory[];
  comments: ReviewComment[];
  createdAt: string;
}

function isMentorMetrics(
  metrics: ReviewApiOut["metrics_json"]
): metrics is MentorMetricsApi {
  return !!metrics && "verdict" in metrics;
}

function toReview(r: ReviewApiOut): Review {
  const metrics = isMentorMetrics(r.metrics_json) ? r.metrics_json : null;
  return {
    id: r.id,
    taskId: r.task_id,
    agentType: r.agent_type,
    verdict: metrics?.verdict ?? null,
    content: r.content,
    categories: metrics?.categories ?? [],
    comments: (metrics?.comments ?? []).map((c, i) => ({
      id: `${r.id}-c${i}`,
      category: c.category,
      content: c.content,
    })),
    createdAt: r.created_at,
  };
}

/** Mentor's review for a single task (matches GET /tasks/{id}/review). */
export async function fetchTaskReview(taskId: string): Promise<Review | null> {
  try {
    const raw = await api.tasks.review(taskId);
    return toReview(raw);
  } catch {
    return null; // 404 — no review yet, a normal state, not an error to surface
  }
}

/** Every review (Mentor + HR rollups) for the growth timeline, oldest first. */
export async function fetchMyReviews(): Promise<Review[]> {
  const raw = await api.reviews();
  return raw.map(toReview);
}

export function averageScore(review: Review): number {
  if (review.categories.length === 0) return 0;
  const total = review.categories.reduce((sum, c) => sum + c.score, 0);
  return total / review.categories.length;
}
