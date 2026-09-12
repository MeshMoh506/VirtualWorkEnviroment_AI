/**
 * Low-level API client. Talks to the FastAPI backend in its own wire
 * format (snake_case, matching backend/app/schemas.py exactly) — the
 * `lib/tasks.ts` / `reviews.ts` / `employee-file.ts` files each map these
 * into the app's existing camelCase domain types, so the components never
 * see snake_case.
 *
 * Auth: the JWT lives in localStorage (this is a real browser app, not a
 * Claude artifact — that restriction doesn't apply here). Every request
 * attaches it as a Bearer token when present.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const TOKEN_KEY = "venv_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof URLSearchParams) && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Can't reach the server — is the backend running?");
  }

  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // response wasn't JSON — keep the statusText fallback
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Wire types — mirror backend/app/schemas.py field-for-field ----

export type ApiAgentType = "manager" | "mentor" | "hr";
export type ApiTaskStatus = "todo" | "in_progress" | "submitted" | "reviewed";
export type ApiSenderType = "user" | "agent";

export interface UserApiOut {
  id: string;
  email: string;
  full_name: string;
  track: string;
  is_active: boolean;
  created_at: string;
  has_cv: boolean;
}

export interface TaskMessageApiOut {
  id: string;
  sender_type: ApiSenderType;
  agent_type: ApiAgentType | null;
  content: string;
  created_at: string;
}

export interface TaskApiOut {
  id: string;
  title: string;
  description: string;
  status: ApiTaskStatus;
  github_link: string | null;
  created_by_agent: ApiAgentType;
  // week_id/deadline are null for tasks outside the weekly-cycle flow.
  week_id: string | null;
  deadline: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  // null until both deadline and completed_at exist.
  is_late: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDetailApiOut extends TaskApiOut {
  messages: TaskMessageApiOut[];
}

export type ApiReviewKind = "task_review" | "week_progress" | "behavioral" | "skills_rollup";

export interface RubricCategoryApi {
  key: string;
  label: string;
  score: number;
}

export interface ReviewCommentApi {
  category: string;
  content: string;
}

export interface MentorMetricsApi {
  verdict: "approved" | "needs_changes";
  categories: RubricCategoryApi[];
  comments: ReviewCommentApi[];
}

export interface HrMetricsApi {
  reviewed_task_count: number;
  average_score: number | null;
}

export interface WeekProgressMetricsApi {
  subtasks_completed: number;
  subtasks_needed_changes: number;
}

export interface BehavioralMetricsApi {
  attended_days: number;
  absent_days: number;
  late_task_count: number;
  total_subtasks: number;
  consistency_rating: "strong" | "adequate" | "needs_improvement";
}

export interface ReviewApiOut {
  id: string;
  task_id: string | null;
  // null for task_review (tied to task_id instead) and skills_rollup
  // (periodic, tied to neither).
  week_id: string | null;
  agent_type: ApiAgentType;
  kind: ApiReviewKind;
  content: string;
  metrics_json:
    | MentorMetricsApi
    | HrMetricsApi
    | WeekProgressMetricsApi
    | BehavioralMetricsApi
    | null;
  created_at: string;
}

export interface EmployeeFileApiOut {
  skills_json: { items?: string[] };
  strengths_json: { items?: string[] };
  growth_areas_json: { items?: string[] };
  summary_text: string | null;
  updated_at: string;
}

export interface DashboardApiOut {
  tasks_completed: number;
  tasks_total: number;
  on_time_rate: number | null;
  average_score: number | null;
  reviews_count: number;
  weeks_completed: number;
  weeks_total: number;
  has_active_project: boolean;
}

export interface ChatMessageApiOut {
  id: string;
  agent_type: ApiAgentType;
  sender_type: "user" | "agent";
  content: string;
  created_at: string;
}

// ---- Project & Week (weekly-cycle flow) ----

export type ApiProjectStatus = "active" | "completed";
export type ApiWeekStatus = "active" | "completed";

export interface SubtaskPlanApi {
  title: string;
  description: string;
  deadline: string;
}

export interface WeekApiOut {
  id: string;
  project_id: string;
  week_number: number;
  status: ApiWeekStatus;
  big_task_title: string;
  big_task_description: string;
  next_subtask_index: number;
  subtasks_plan_json: SubtaskPlanApi[];
  started_at: string;
  target_end_at: string;
  ended_at: string | null;
}

export interface ProjectApiOut {
  id: string;
  title: string;
  description: string;
  status: ApiProjectStatus;
  created_at: string;
  updated_at: string;
  weeks: WeekApiOut[];
}

// ---- API surface ----

export const api = {
  auth: {
    register: (email: string, password: string, fullName: string) =>
      request<UserApiOut>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName }),
      }),
    login: (email: string, password: string) =>
      request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: new URLSearchParams({ username: email, password }),
      }),
  },

  me: () => request<UserApiOut>("/users/me"),

  cv: {
    submit: (cvRawText: string) =>
      request<UserApiOut>("/users/me/cv", {
        method: "POST",
        body: JSON.stringify({ cv_raw_text: cvRawText }),
      }),
  },

  tasks: {
    list: () => request<TaskApiOut[]>("/tasks"),
    detail: (id: string) => request<TaskDetailApiOut>(`/tasks/${id}`),
    updateStatus: (id: string, status: ApiTaskStatus, githubLink?: string) =>
      request<TaskApiOut>(`/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, github_link: githubLink ?? null }),
      }),
    postMessage: (id: string, content: string) =>
      request<TaskMessageApiOut>(`/tasks/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    review: (id: string) => request<ReviewApiOut>(`/tasks/${id}/review`),
  },

  agents: {
    assignTask: () =>
      request<TaskApiOut>("/agents/manager/assign-task", { method: "POST" }),
    managerReply: (taskId: string) =>
      request<TaskMessageApiOut>(`/agents/manager/reply/${taskId}`, {
        method: "POST",
      }),
    mentorReview: (taskId: string) =>
      request<ReviewApiOut>(`/agents/mentor/review/${taskId}`, {
        method: "POST",
      }),
    hrRollup: () =>
      request<ReviewApiOut>("/agents/hr/rollup", { method: "POST" }),
  },

  employeeFile: () => request<EmployeeFileApiOut>("/users/me/employee-file"),
  reviews: () => request<ReviewApiOut[]>("/users/me/reviews"),
  dashboard: () => request<DashboardApiOut>("/users/me/dashboard"),

  projects: {
    /** The graduate's active Project + all its Weeks. 404s until they've
     * gotten their first task — see lib/projects.ts's fetchMyProject,
     * which treats that as "nothing yet", not an error. */
    me: () => request<ProjectApiOut>("/projects/me"),
  },

  meeting: {
    history: (agent: ApiAgentType) =>
      request<ChatMessageApiOut[]>(`/meeting/${agent}`),
    send: (agent: ApiAgentType, content: string) =>
      request<ChatMessageApiOut>(`/meeting/${agent}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
  },
};
