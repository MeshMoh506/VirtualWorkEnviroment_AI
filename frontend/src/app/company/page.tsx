"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import { createJobTitle, fetchJobTitles, fetchMyCompany, type JobTitle, type Organization } from "@/lib/company";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// The company dashboard (docs/STAGE3_COMPANY_RAG.md): the org's join
// code (for teammates to add themselves with their own role), the list
// of free-text job titles, and a form to add a new one. A job title's
// knowledge base (materials + RAG search) lives on its own detail page.
export default function CompanyDashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLocale();

  const [org, setOrg] = useState<Organization | null>(null);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchMyCompany(), fetchJobTitles()])
      .then(([o, jts]) => {
        setOrg(o);
        setJobTitles(jts);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.genericError")))
      .finally(() => setLoading(false));
  }, [user, t]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const created = await createJobTitle(title, newDescription.trim() || undefined);
      setJobTitles((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDescription("");
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("company.createError"));
    } finally {
      setCreating(false);
    }
  }

  function copyJoinCode() {
    if (!org) return;
    navigator.clipboard?.writeText(org.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

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
          <p className="font-mono text-xs text-text-muted">{t("common.venv")} / {t("company.nav")}</p>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{org?.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/company/students"
            className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("company.studentsTitle")}
          </Link>
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
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Org card: field + join code for teammates */}
          <div className="rounded border border-border bg-bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {org?.field && (
                  <p className="text-sm text-text-secondary">{org.field}</p>
                )}
                <p className="mt-1 font-mono text-xs text-text-muted">
                  {t("company.role")}: {user.companyRole}
                </p>
              </div>
              <div className="text-end">
                <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                  {t("company.joinCodeLabel")}
                </p>
                <button
                  type="button"
                  onClick={copyJoinCode}
                  dir="ltr"
                  className="mt-1 rounded border border-border bg-bg-surface-raised px-3 py-1.5 font-mono text-sm text-text-primary transition-colors hover:border-border-strong"
                >
                  {org?.joinCode} {copied ? `— ${t("company.copied")}` : ""}
                </button>
              </div>
            </div>
          </div>

          {/* New job title */}
          <form onSubmit={handleCreate} className="rounded border border-border bg-bg-surface p-5">
            <h2 className="text-base font-medium text-text-primary">{t("company.newJobTitleTitle")}</h2>
            <p className="mt-1 text-sm text-text-secondary">{t("company.newJobTitleBody")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("company.jobTitlePlaceholder")}
                className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
              />
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t("company.jobDescriptionPlaceholder")}
                className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
              />
              <div>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? t("common.working") : t("company.addJobTitle")}
                </button>
              </div>
            </div>
          </form>

          {/* Job titles list */}
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium text-text-primary">{t("company.jobTitlesTitle")}</h2>
            {jobTitles.length === 0 ? (
              <p className="text-sm text-text-muted">{t("company.noJobTitles")}</p>
            ) : (
              jobTitles.map((jt) => (
                <Link
                  key={jt.id}
                  href={`/company/job-titles/${jt.id}`}
                  className="flex items-center justify-between rounded border border-border bg-bg-surface px-4 py-3 transition-colors hover:border-border-strong"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{jt.title}</p>
                    {jt.description && (
                      <p className="mt-0.5 text-xs text-text-secondary">{jt.description}</p>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-text-muted">
                    {t("company.materialsCount", { count: String(jt.materialCount) })}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
