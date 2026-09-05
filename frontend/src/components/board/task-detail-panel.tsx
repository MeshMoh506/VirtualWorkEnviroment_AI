"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { GitPullRequest } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { STATUS_LABEL, STATUS_ORDER, type Task } from "@/lib/tasks";

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
  onAdvance: (githubLink?: string) => void;
  onAddMessage: (content: string) => void;
}

export function TaskDetailPanel({
  task,
  onClose,
  onAdvance,
  onAddMessage,
}: TaskDetailPanelProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-bg-surface-raised"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: `var(${AGENTS[task.createdByAgent].colorVar})`,
                  }}
                />
                <span className="font-mono text-[11px] text-text-muted">
                  assigned by {AGENTS[task.createdByAgent].name}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-medium text-text-primary">
                {task.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {task.description}
              </p>

              <div className="mt-6 flex items-center gap-2">
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
              <p className="mt-2 font-mono text-[11px] text-text-muted">
                {STATUS_LABEL[task.status]}
              </p>

              <div className="mt-4 rounded border border-border bg-bg-surface p-4">
                {task.status === "todo" && (
                  <button
                    type="button"
                    onClick={() => onAdvance()}
                    className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
                  >
                    Start task
                  </button>
                )}
                {task.status === "in_progress" && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[11px] text-text-muted">
                      github link
                    </label>
                    <input
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                      placeholder="https://github.com/you/repo/pull/1"
                      className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!linkDraft.trim()}
                      onClick={() => {
                        onAdvance(linkDraft.trim());
                        setLinkDraft("");
                      }}
                      className="self-start rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Submit for review
                    </button>
                  </div>
                )}
                {task.status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <GitPullRequest className="h-4 w-4" />
                    <span>Waiting on the mentor&apos;s review.</span>
                  </div>
                )}
                {task.status === "reviewed" && (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-text-secondary">
                      Reviewed by the mentor.
                    </p>
                    <Link
                      href={`/tasks/${task.id}/review`}
                      className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
                    >
                      See the review
                    </Link>
                  </div>
                )}
              </div>

              {task.githubLink && (
                <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                  <GitPullRequest className="h-3 w-3" /> {task.githubLink}
                </p>
              )}

              <div className="mt-8">
                <p className="font-mono text-[11px] text-text-muted">thread</p>
                <div className="mt-3 flex flex-col gap-3">
                  {task.messages.length === 0 && (
                    <p className="text-xs text-text-muted">No messages yet.</p>
                  )}
                  {task.messages.map((m) => {
                    const agentMeta = m.agentType ? AGENTS[m.agentType] : null;
                    return (
                      <div
                        key={m.id}
                        className="rounded border border-border bg-bg-surface p-3"
                      >
                        <div className="flex items-center gap-1.5">
                          {agentMeta && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: `var(${agentMeta.colorVar})`,
                              }}
                            />
                          )}
                          <span className="font-mono text-[11px] text-text-muted">
                            {agentMeta ? agentMeta.name : "You"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">
                          {m.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <input
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Add a comment"
                  className="flex-1 rounded border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!messageDraft.trim()}
                  onClick={() => {
                    onAddMessage(messageDraft.trim());
                    setMessageDraft("");
                  }}
                  className="rounded border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-xs text-text-muted hover:text-text-secondary"
              >
                Close
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
