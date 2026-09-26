"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Compass, Settings as SettingsIcon } from "lucide-react";
import { useRequireAuth } from "@/lib/auth-context";
import { fetchTasks, type Task } from "@/lib/tasks";
import { fetchMyProject, currentWeek, type Project } from "@/lib/projects";
import { fetchDashboard, type Dashboard } from "@/lib/dashboard";
import { fetchMyReviews, type Review } from "@/lib/reviews";
import { fetchMyExtraAgents, type ExtraAgent } from "@/lib/team";
import { fetchMyInvitations } from "@/lib/invitations";
import { DetailPanel, type BoardSelection } from "@/components/board/detail-panel";
import { FocusHero } from "@/components/dashboard/focus-hero";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { StatRow } from "@/components/dashboard/stat-row";
import { AgentCards } from "@/components/dashboard/agent-cards";
import { FlowSection } from "@/components/dashboard/flow-section";
import { AccountMenu } from "@/components/nav/account-menu";
import { IconLink } from "@/components/nav/icon-link";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

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
  const { user, loading } = useRequireAuth();
  const { t } = useLocale();
  const [selection, setSelection] = useState<BoardSelection>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [extraAgents, setExtraAgents] = useState<ExtraAgent[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      fetchTasks(),
      fetchMyProject(),
      fetchDashboard(),
      fetchMyReviews(),
      fetchMyExtraAgents(),
      fetchMyInvitations(),
    ])
      .then(([t, p, d, r, a, inv]) => {
        if (t.status === "fulfilled") setTasks(t.value);
        if (p.status === "fulfilled") setProject(p.value);
        if (d.status === "fulfilled") setDashboard(d.value);
        if (r.status === "fulfilled") setReviews(r.value);
        if (a.status === "fulfilled") setExtraAgents(a.value);
        if (inv.status === "fulfilled") {
          setPendingInvitations(inv.value.filter((i) => i.status === "pending").length);
        }
      })
      .finally(() => setDataLoading(false));
  }, [user]);

  const week = project ? currentWeek(project) : null;
  const focus = focusTask(tasks);
  const firstName = user?.fullName?.split(" ")[0] || t("orientation.fallbackName");

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="grid h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            {t("common.venv")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            {t("nav.homeBoardTitle")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/workspace"
            className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
          >
            {t("nav.workspace")}
          </Link>
          <Link
            href="/meeting"
            className="rounded border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("nav.meetingRoom")}
          </Link>

          <div className="mx-1 h-5 border-s border-border" />

          <IconLink href="/orientation" label={t("nav.howItWorks")}>
            <Compass className="h-3.5 w-3.5" strokeWidth={2} />
          </IconLink>
          <IconLink href="/settings" label={t("nav.settings")}>
            <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2} />
          </IconLink>
          <IconLink href="/invitations" label={t("invitations.title")} badge={pendingInvitations}>
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          </IconLink>

          <div className="mx-1 h-5 border-s border-border" />

          <AccountMenu email={user.email} />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>


      {/* Two columns: left scrolls through dashboard sections, right is the
          interactive agents graph filling its full half. On narrow screens
          they stack (graph gets a fixed height so it never collapses to
          nothing), and the whole thing scrolls as one column. */}
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overlay-scrollbar min-h-0 overflow-y-auto border-b border-dashed border-border lg:border-b-0 lg:border-e">
          <div className="flex flex-col gap-6 px-6 py-8">
            <div>
              <p className="text-sm text-text-secondary">{t("board.welcomeBack")}</p>
              <h2 className="text-2xl font-medium text-text-primary">
                {firstName}
              </h2>
            </div>

            {dataLoading ? (
              <div className="rounded border border-border bg-bg-surface p-8 text-center">
                <p className="text-sm text-text-muted">
                  {t("board.loadingWorkspace")}
                </p>
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
                      {t("board.yourTeam")}
                    </p>
                    <AgentCards dashboard={dashboard} reviews={reviews} extraAgents={extraAgents} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right column: the interactive graph. Fixed height when stacked
            on mobile; fills the full column height on desktop. */}
        <div className="relative h-[60vh] min-h-0 lg:h-auto">
          <FlowSection onSelect={setSelection} extraAgents={extraAgents} />
        </div>
      </div>

      <DetailPanel
        selection={selection}
        hasCv={user.hasCv}
        reviewedTaskId={tasks.find((t) => t.status === "reviewed")?.id ?? null}
        week={week}
        projectTitle={project?.title ?? null}
        extraAgents={extraAgents}
        onClose={() => setSelection(null)}
      />
    </main>
  );
}
