"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import { fetchCompanyStudents, type CompanyStudent } from "@/lib/company";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// The company's live roster (docs/STAGE3_COMPANY_RAG.md) — everyone who
// has actually accepted an invitation, with a quick snapshot of where
// they are. Click through for the week-by-week detail and reviews.
export default function CompanyStudentsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLocale();

  const [students, setStudents] = useState<CompanyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCompanyStudents()
      .then(setStudents)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.genericError")))
      .finally(() => setLoading(false));
  }, [user, t]);

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
          <Link href="/company" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            {t("common.venv")} / {t("company.nav")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{t("company.studentsTitle")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/logout"
            className="rounded border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("common.logOut")}
          </Link>
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="thin-scrollbar overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8">
          {error && <p className="text-sm text-danger">{error}</p>}

          {students.length === 0 ? (
            <p className="text-sm text-text-muted">{t("company.noStudents")}</p>
          ) : (
            students.map((s) => (
              <Link
                key={s.invitationId}
                href={`/company/students/${s.invitationId}`}
                className="flex items-center justify-between rounded border border-border bg-bg-surface px-4 py-3 transition-colors hover:border-border-strong"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.studentName}</p>
                  <p dir="ltr" className="mt-0.5 text-start text-xs text-text-muted">
                    {s.studentEmail}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {s.jobTitle}
                    {s.companyProjectTitle ? ` · ${s.companyProjectTitle}` : ""}
                  </p>
                </div>
                <div className="text-end">
                  {s.currentWeekNumber ? (
                    <p className="font-mono text-[11px] text-text-muted">
                      {t("company.weekLabel", { number: String(s.currentWeekNumber) })}
                    </p>
                  ) : (
                    <p className="font-mono text-[11px] text-text-muted">{t("company.notStartedYet")}</p>
                  )}
                  {s.projectTitle && (
                    <p className="mt-0.5 text-xs text-text-secondary">{s.projectTitle}</p>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
