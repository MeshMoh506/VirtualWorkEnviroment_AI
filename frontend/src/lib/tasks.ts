import type { AgentId } from "./agents";

export type TaskStatus = "todo" | "in_progress" | "submitted" | "reviewed";

export type SenderType = "user" | "agent";

export interface TaskMessage {
  id: string;
  senderType: SenderType;
  agentType: AgentId | null;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  githubLink: string | null;
  createdByAgent: AgentId;
  createdAt: string;
  updatedAt: string;
  messages: TaskMessage[];
}

export const STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "submitted",
  "reviewed",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

function agoISO(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

// Local mock data so the board is fully clickable before it's wired to
// the real API. Nothing here is persisted — refreshing the page resets
// it back to this list.
export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Set up the Next.js project",
    description:
      "Initialize the frontend with the agreed stack — Next.js, Tailwind, React Flow — and push a basic homepage the team can build on.",
    status: "reviewed",
    githubLink: "https://github.com/example/venv-frontend/pull/1",
    createdByAgent: "manager",
    createdAt: agoISO(6),
    updatedAt: agoISO(5),
    messages: [
      {
        id: "m1",
        senderType: "user",
        agentType: null,
        content: "Pushed the initial setup, PR is up.",
        createdAt: agoISO(5, 4),
      },
      {
        id: "m2",
        senderType: "agent",
        agentType: "mentor",
        content:
          "Clean start, structure matches what we agreed on. Approved.",
        createdAt: agoISO(5),
      },
    ],
  },
  {
    id: "t2",
    title: "Build a streaming chatbot UI",
    description:
      "Add a chat panel component that renders streamed model responses token by token, with a stop button.",
    status: "submitted",
    githubLink: "https://github.com/example/venv-frontend/pull/4",
    createdByAgent: "manager",
    createdAt: agoISO(3),
    updatedAt: agoISO(1),
    messages: [
      {
        id: "m3",
        senderType: "user",
        agentType: null,
        content:
          "Submitting this one. Streaming works end to end, but the stop button doesn't cancel the request yet.",
        createdAt: agoISO(1),
      },
    ],
  },
  {
    id: "t3",
    title: "Wire up JWT auth on the frontend",
    description:
      "Add a login form, store the access token, and attach it to every API request.",
    status: "in_progress",
    githubLink: null,
    createdByAgent: "manager",
    createdAt: agoISO(2),
    updatedAt: agoISO(2),
    messages: [],
  },
  {
    id: "t4",
    title: "Add an LLM-powered recommendation widget",
    description:
      "Small feature: given a user's saved items, call an LLM to suggest one more that fits.",
    status: "todo",
    githubLink: null,
    createdByAgent: "manager",
    createdAt: agoISO(1),
    updatedAt: agoISO(1),
    messages: [],
  },
  {
    id: "t5",
    title: "Add an error boundary around the chat panel",
    description:
      "If the streaming request fails, show a retry state instead of a blank panel.",
    status: "todo",
    githubLink: null,
    createdByAgent: "manager",
    createdAt: agoISO(0, 6),
    updatedAt: agoISO(0, 6),
    messages: [],
  },
  {
    id: "t6",
    title: "Build the login page UI",
    description:
      "A login form with email/password fields and client-side validation, matching the design system.",
    status: "reviewed",
    githubLink: "https://github.com/example/venv-frontend/pull/7",
    createdByAgent: "manager",
    createdAt: agoISO(7),
    updatedAt: agoISO(4),
    messages: [
      {
        id: "m4",
        senderType: "user",
        agentType: null,
        content: "Submitting — validation covers empty fields and bad email format.",
        createdAt: agoISO(4, 2),
      },
      {
        id: "m5",
        senderType: "agent",
        agentType: "mentor",
        content: "Works, but no tests and the README wasn't updated. Approved anyway — small enough to fix on the next task.",
        createdAt: agoISO(4),
      },
    ],
  },
  {
    id: "t7",
    title: "Add a notifications dropdown",
    description:
      "A header dropdown showing the last few agent messages across all tasks.",
    status: "reviewed",
    githubLink: "https://github.com/example/venv-frontend/pull/9",
    createdByAgent: "manager",
    createdAt: agoISO(3),
    updatedAt: agoISO(1),
    messages: [
      {
        id: "m6",
        senderType: "user",
        agentType: null,
        content: "This one's ready — added a basic test for the unread count too.",
        createdAt: agoISO(1),
      },
      {
        id: "m7",
        senderType: "agent",
        agentType: "mentor",
        content: "Good jump from last time — tests included this round, and the PR description actually explains the approach. Approved.",
        createdAt: agoISO(0, 20),
      },
    ],
  },
];
