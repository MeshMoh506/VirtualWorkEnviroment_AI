"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TaskCard } from "@/components/board/task-card";
import { TaskDetailPanel } from "@/components/board/task-detail-panel";
import {
  INITIAL_TASKS,
  STATUS_LABEL,
  STATUS_ORDER,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...patch, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }

  function addMessage(id: string, content: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: `local-${Date.now()}`,
                  senderType: "user" as const,
                  agentType: null,
                  content,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : t
      )
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
        <span className="rounded border border-border bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
          preview
        </span>
      </header>

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
                  onClick={() => setSelectedId(task.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <TaskDetailPanel
        task={selected}
        onClose={() => setSelectedId(null)}
        onAdvance={(githubLink) => {
          if (!selected) return;
          if (selected.status === "todo") {
            updateTask(selected.id, { status: "in_progress" });
          } else if (selected.status === "in_progress") {
            updateTask(selected.id, {
              status: "submitted",
              githubLink: githubLink ?? selected.githubLink,
            });
          }
        }}
        onAddMessage={(content) => selected && addMessage(selected.id, content)}
      />
    </main>
  );
}
