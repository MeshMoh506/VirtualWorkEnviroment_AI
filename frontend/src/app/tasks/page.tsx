"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TaskCard } from "@/components/board/task-card";
import { TaskDetailPanel } from "@/components/board/task-detail-panel";
import { useRequireAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import {
  assignNextTask,
  fetchTaskDetail,
  fetchTasks,
  managerReply,
  postUserMessage,
  requestMentorReview,
  STATUS_LABEL,
  STATUS_ORDER,
  startTask,
  submitTask,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

export default function TasksPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  // which agent is currently working, and on which task
  const [busy, setBusy] = useState<{ taskId: string; kind: "review" | "reply" } | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      const list = await fetchTasks();
      setTasks(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the "subscribe to an external system" case
    // this rule allows; setState only runs after the fetch resolves,
    // not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) refresh();
  }, [user, refresh]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      submitted: [],
      reviewed: [],
    };
    for (const task of tasks) map[task.status].push(task);
    return map;
  }, [tasks]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  async function openTask(id: string) {
    setSelectedId(id);
    try {
      const detail = await fetchTaskDetail(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? detail : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load that task.");
    }
  }

  async function handleAskManager() {
    setAssigning(true);
    setError(null);
    try {
      const task = await assignNextTask();
      setTasks((prev) => [task, ...prev]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "The manager couldn't assign a task."
      );
    } finally {
      setAssigning(false);
    }
  }

  async function handleAdvance(githubLink?: string) {
    if (!selected) return;
    try {
      if (selected.status === "todo") {
        const task = await startTask(selected.id);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } else if (selected.status === "in_progress" && githubLink) {
        const task = await submitTask(selected.id, githubLink);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        // Auto-trigger the Mentor's review right after submission — no
        // separate "run review" button, matches "waiting on the mentor"
        // reading as something that's actually in progress, not stalled.
        setBusy({ taskId: task.id, kind: "review" });
        try {
          const reviewed = await requestMentorReview(task.id);
          setTasks((prev) => prev.map((t) => (t.id === reviewed.id ? reviewed : t)));
        } catch (err) {
          setError(
            err instanceof ApiError
              ? err.message
              : "The mentor couldn't review this yet."
          );
        } finally {
          setBusy(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the task.");
    }
  }

  async function handleAddMessage(content: string) {
    if (!selected) return;
    try {
      const message = await postUserMessage(selected.id, content);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selected.id ? { ...t, messages: [...t.messages, message] } : t
        )
      );
      // Auto-trigger the Manager's reply — this is a conversation, not a
      // one-way comment box.
      setBusy({ taskId: selected.id, kind: "reply" });
      try {
        const reply = await managerReply(selected.id);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selected.id ? { ...t, messages: [...t.messages, reply] } : t
          )
        );
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "The manager couldn't reply yet."
        );
      } finally {
        setBusy(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that message.");
    }
  }

  if (authLoading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="grid h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/board"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv / board
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            Task board
          </h1>
        </div>
        <button
          type="button"
          onClick={handleAskManager}
          disabled={assigning}
          className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {assigning ? "Manager is thinking..." : "Ask manager for a task"}
        </button>
      </header>

      {error && (
        <div className="border-b border-border bg-bg-surface px-6 py-2">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-text-secondary">
            No tasks yet — ask your manager for one to get started.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 gap-4 overflow-x-auto p-6">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex w-72 shrink-0 flex-col">
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-sm font-medium text-text-primary">
                  {STATUS_LABEL[status]}
                </h2>
                <span className="font-mono text-xs text-text-muted">
                  {grouped[status].length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {grouped[status].length === 0 && (
                  <p className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
                    Nothing here yet
                  </p>
                )}
                {grouped[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => openTask(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDetailPanel
        task={selected}
        busy={selected && busy?.taskId === selected.id ? busy.kind : null}
        onClose={() => setSelectedId(null)}
        onAdvance={handleAdvance}
        onAddMessage={handleAddMessage}
      />
    </main>
  );
}
