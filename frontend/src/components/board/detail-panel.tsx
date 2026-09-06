"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { AGENTS, type AgentId } from "@/lib/agents";

export type BoardSelection = AgentId | "employee-file" | null;

interface DetailPanelProps {
  selection: BoardSelection;
  onClose: () => void;
}

const NEXT_UP: Record<AgentId, string> = {
  manager: "The task board is live — see and act on what the manager assigns.",
  mentor:
    "See a worked example: feedback plus a rubric score on a submitted task.",
  hr: "The growth view is live — a score trend and timeline across reviews.",
};

const BOX_LABEL: Record<AgentId, string> = {
  manager: "task board",
  mentor: "example review",
  hr: "growth view",
};

const AGENT_LINK: Partial<Record<AgentId, { href: string; label: string }>> = {
  manager: { href: "/tasks", label: "Open task board" },
  mentor: { href: "/tasks/t1/review", label: "See a review example" },
  hr: { href: "/growth", label: "Open growth view" },
};

export function DetailPanel({ selection, onClose }: DetailPanelProps) {
  const isAgent = selection !== null && selection !== "employee-file";
  const meta = isAgent ? AGENTS[selection as AgentId] : null;

  return (
    <AnimatePresence>
      {selection && (
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-bg-surface-raised p-6"
          >
            {meta ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: `var(${meta.colorVar})` }}
                  />
                  <h2 className="text-lg font-medium text-text-primary">
                    {meta.name}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{meta.role}</p>
                <p className="mt-5 text-sm leading-relaxed text-text-secondary">
                  {meta.description}
                </p>
                <div className="mt-8 rounded border border-border bg-bg-surface px-4 py-3">
                  <p className="font-mono text-xs text-text-muted">
                    {BOX_LABEL[meta.id]}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {NEXT_UP[meta.id]}
                  </p>
                  {AGENT_LINK[meta.id] && (
                    <Link
                      href={AGENT_LINK[meta.id]!.href}
                      className="mt-3 inline-block rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-accent-strong"
                    >
                      {AGENT_LINK[meta.id]!.label}
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium text-text-primary">
                  Employee file
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  The one record all three agents read from and write to.
                </p>
                <p className="mt-5 text-sm leading-relaxed text-text-secondary">
                  Your CV, skills, task history, and every review live
                  here. When the mentor reviews your code, HR sees it.
                  When HR notes a growth area, the manager&apos;s next
                  task can account for it — no agent works from a stale
                  or partial picture of you.
                </p>
                <div className="mt-8 rounded border border-border bg-bg-surface px-4 py-3">
                  <p className="font-mono text-xs text-text-muted">
                    growth view
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Skills, strengths, growth areas, and the score trend
                    behind them — HR&apos;s view of this same file.
                  </p>
                  <Link
                    href="/growth"
                    className="mt-3 inline-block rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-accent-strong"
                  >
                    Open growth view
                  </Link>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-auto self-start rounded border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Close
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
