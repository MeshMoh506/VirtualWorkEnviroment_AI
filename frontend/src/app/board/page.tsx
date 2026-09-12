"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { fetchTasks, type Task } from "@/lib/tasks";
import { fetchMyProject, currentWeek, type Project } from "@/lib/projects";
import { fetchDashboard, type Dashboard } from "@/lib/dashboard";
import { fetchMyReviews, type Review } from "@/lib/reviews";
import { DetailPanel, type BoardSelection } from "@/components/board/detail-panel";
import { FocusHero } from "@/components/dashboard/focus-hero";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { StatRow } from "@/components/dashboard/stat-row";
import { AgentCards } from "@/components/dashboard/agent-cards";
import { FlowSection } from "@/components/dashboard/flow-section";

// The one task the graduate should act on now: the most recent
// non-reviewed task (todo/in_progress/submitted). Mirrors the backend's
// "one subtask at a time" rule — there's normally at most one open.
function focusTask(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.status !== "reviewed");
  if (open.length === 0) return null;
  return open.reduce((latest, t) =>
    new Date(t.createdAt) > new Date(latest.createdAt) ? t : latest
  );
}

export default function BoardPage() {
  const { user, loading, logout } = useRequireAuth();
  const [selection, setSelection] = useState<BoardSelection>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // One place pulls everything the dashboard needs. Individual failures
    // fall back to empty rather than blanking the whole page — a missing
    // project (404 before the first task) is a normal state, not an error.
    Promise.allSettled([
      fetchTasks(),
      fetchMyProject(),
      fetchDashboard(),
      fetchMyReviews(),
    ])
      .then(([t, p, d, r]) => {
        if (t.status === "fulfilled") setTasks(t.value);
        if (p.status === "fulfilled") setProject(p.value);
        if (d.status === "fulfilled") setDashboard(d.value);
        if (r.status === "fulfilled") setReviews(r.value);
      })
      .finally(() => setDataLoading(false));
  }, [user]);

  const week = project ? currentWeek(project) : null;
  const focus = focusTask(tasks);
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    // Controlled scroll: the page scrolls through deliberate sections
    // (h-dvh + overflow-y-auto), it isn't an infinite canvas or an
    // endless feed. Header stays put; content below it scrolls.
    <main className="grid h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            Home board
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-text-muted sm:inline">
            {user.email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="thin-scrollbar overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
          <div>
            <p className="text-sm text-text-secondary">Welcome back,</p>
            <h2 className="text-2xl font-medium text-text-primary">
              {firstName}
            </h2>
          </div>

          {dataLoading ? (
            <div className="rounded border border-border bg-bg-surface p-8 text-center">
              <p className="text-sm text-text-muted">Loading your workspace...</p>
            </div>
          ) : (
            <>
              <FocusHero
                task={focus}
                week={week}
                hasProject={dashboard?.hasActiveProject ?? project !== null}
              />

              {dashboard && <StatRow dashboard={dashboard} />}

              <WeekStrip week={week} projectTitle={project?.title ?? null} />

              {dashboard && (
                <div>
                  <p className="mb-3 font-mono text-[11px] text-text-muted">
                    your_team
                  </p>
                  <AgentCards dashboard={dashboard} reviews={reviews} />
                </div>
              )}

              <FlowSection onSelect={setSelection} />
            </>
          )}
        </div>
      </div>

      <DetailPanel
        selection={selection}
        hasCv={user.hasCv}
        reviewedTaskId={
          tasks.find((t) => t.status === "reviewed")?.id ?? null
        }
        week={week}
        projectTitle={project?.title ?? null}
        onClose={() => setSelection(null)}
      />
    </main>
  );
}
