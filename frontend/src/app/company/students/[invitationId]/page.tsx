"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import { fetchCompanyStudentDetail, type CompanyStudentDetail } from "@/lib/company";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { AccountMenu } from "@/components/nav/account-menu";

// One hired student's week-by-week detail (docs/STAGE3_COMPANY_RAG.md) —
// each week's tasks plus whichever end-of-week reviews exist for it so
// far (the Manager's progress review, HR's behavioral review). This IS
// the "end-of-week report": the same reviews the weekly cycle already
// writes, not a second report generated just for this screen.
export default function CompanyStudentDetailPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams<{ invitationId: string }>();
  const { t } = useLocale();

  const [detail, setDetail] = useState<CompanyStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCompanyStudentDetail(params.invitationId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.genericError")))
      .finally(() => setLoading(false));
  }, [user, params.invitationId, t]);

  if (authLoading || !user || loading) {
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
          <Link href="/company/students" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            {t("common.venv")} / {t("company.studentsTitle")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{detail?.studentName}</h1>
          {detail && (
            <p className="mt-0.5 text-sm text-text-secondary">
              {detail.jobTitle}
              {detail.companyProjectTitle ? ` · ${detail.companyProjectTitle}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AccountMenu email={user.email} />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="thin-scrollbar overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
          {error && <p className="text-sm text-danger">{error}</p>}

          {detail && detail.weeks.length === 0 && (
            <p className="text-sm text-text-muted">{t("company.notStartedYet")}</p>
          )}

          {detail?.weeks
            .slice()
            .reverse()
            .map((week) => (
              <div key={week.weekNumber} className="rounded border border-border bg-bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-medium text-text-primary">
                    {t("company.weekLabel", { number: String(week.weekNumber) })}
                  </h2>
                  <span className="font-mono text-[10px] text-text-muted">
                    {week.status === "active" ? t("company.weekActive") : t("company.weekCompleted")}
                  </span>
                </div>

                {/* Tasks */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {week.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded border border-border bg-bg-surface-raised px-3 py-2"
                    >
                      <p className="text-sm text-text-primary">{task.title}</p>
                      <span className="font-mono text-[10px] text-text-muted">{task.status}</span>
                    </div>
                  ))}
                </div>

                {/* End-of-week reviews */}
                {week.reviews.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {week.reviews.map((review) => (
                      <div key={review.id} className="rounded border border-border/60 bg-bg-surface-raised px-3 py-2">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                          {review.kind === "week_progress" ? t("company.weekProgressReview") : t("company.behavioralReview")}
                        </p>
                        <p className="mt-1 text-sm text-text-primary">{review.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
