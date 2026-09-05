"use client";

import { GitPullRequest } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { timeAgo } from "@/lib/format";
import type { Task } from "@/lib/tasks";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const agent = AGENTS[task.createdByAgent];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-border bg-bg-surface p-3 text-left transition-colors hover:border-border-strong"
    >
      <p className="text-sm font-medium text-text-primary">{task.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
        {task.description}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: `var(${agent.colorVar})` }}
          />
          <span className="font-mono text-[11px] text-text-muted">
            {agent.id}
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
          {task.githubLink && <GitPullRequest className="h-3 w-3" />}
          {timeAgo(task.createdAt)}
        </span>
      </div>
    </button>
  );
}
