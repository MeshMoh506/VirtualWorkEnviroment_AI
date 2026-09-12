"use client";

import { useState } from "react";
import Link from "next/link";
import { GitPullRequest, Calendar, CircleCheck, Clock } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { STATUS_LABEL, STATUS_ORDER, type Task } from "@/lib/tasks";
import { timeUntil, timeAgo } from "@/lib/format";

interface TaskWorkspaceProps {
  task: Task;
  busy: "review" | "reply" | null;
  onAdvance: (githubLink?: string) => void;
}

export function TaskWorkspace({ task, busy, onAdvance }: TaskWorkspaceProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const agent = AGENTS[task.createdByAgent];

  return (
    <div className="thin-scrollbar h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-8">
        {/* meta line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `var(${agent.colorVar})` }}
            />
            <span className="font-mono text-[11px] text-text-muted">
              assigned by {agent.name}
            </span>
          </span>
          {task.deadline && (
            <span
              className={`flex items-center gap-1 font-mono text-[11px] ${
                task.isLate ? "text-danger" : "text-text-muted"
              }`}
            >
              <Calendar className="h-3 w-3" />
              {task.status === "reviewed"
                ? task.isLate
                  ? "completed late"
                  : "completed on time"
                : `due ${timeUntil(task.deadline)}`}
            </span>
          )}
          <span className="flex items-center gap-1 font-mono text-[11px] text-text-muted">
            <Clock className="h-3 w-3" />
            {timeAgo(task.createdAt)}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-medium leading-snug text-text-primary">
          {task.title}
        </h1>

        {/* status progress bar */}
        <div className="mt-6">
          <div className="flex items-center gap-1.5">
            {STATUS_ORDER.map((s) => {
              const active =
                STATUS_ORDER.indexOf(s) <= STATUS_ORDER.indexOf(task.status);
              return (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded ${
                    active ? "bg-accent" : "bg-border"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            {STATUS_ORDER.map((s) => (
              <span
                key={s}
                className={`font-mono text-[10px] ${
                  s === task.status ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* description */}
        <div className="mt-8">
          <p className="font-mono text-[11px] text-text-muted">description</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {task.description}
          </p>
        </div>

        {/* action zone, status-driven */}
        <div className="mt-8 rounded border border-border bg-bg-surface p-5">
          {task.status === "todo" && (
            <>
              <p className="text-sm text-text-secondary">
                Ready when you are. Starting moves this into your in-progress
                column.
              </p>
              <button
                type="button"
                onClick={() => onAdvance()}
                className="mt-3 rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
              >
                Start this task
              </button>
            </>
          )}
          {task.status === "in_progress" && (
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[11px] text-text-muted">
                submit a github link for review
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://github.com/you/repo"
                  disabled={busy === "review"}
                  className="flex-1 rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!linkDraft.trim() || busy === "review"}
                  onClick={() => {
                    onAdvance(linkDraft.trim());
                    setLinkDraft("");
                  }}
                  className="shrink-0 rounded border border-accent bg-accent px-5 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "review" ? "Submitting..." : "Submit for review"}
                </button>
              </div>
            </div>
          )}
          {task.status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <GitPullRequest className="h-4 w-4" />
              <span>
                {busy === "review"
                  ? "The mentor is reviewing this now..."
                  : "Waiting on the mentor's review."}
              </span>
            </div>
          )}
          {task.status === "reviewed" && (
            <div className="flex flex-col items-start gap-3">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <CircleCheck className="h-4 w-4 text-accent" />
                <span>Reviewed by the mentor.</span>
              </div>
              <Link
                href={`/tasks/${task.id}/review`}
                className="rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
              >
                See the full review
              </Link>
            </div>
          )}
        </div>

        {task.githubLink && (
          <a
            href={task.githubLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-text-muted transition-colors hover:text-text-secondary"
          >
            <GitPullRequest className="h-3 w-3" /> {task.githubLink}
          </a>
        )}
      </div>
    </div>
  );
}
