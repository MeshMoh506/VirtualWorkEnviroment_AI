"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { ApiError, useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// Replace the CV after onboarding. Unlike /onboarding/cv (which starts the
// wizard over), this only swaps the stored CV text: the graduate's track,
// team, project and tasks are untouched — the Manager just reads the new CV
// when it plans the next week. See docs/ONBOARDING_RESUME.md.
type Mode = "loading" | "form" | "mid-onboarding" | "done";

export default function UpdateCvPage() {
  const { user, loading: authLoading, refreshUser } = useRequireAuth();
  const { t } = useLocale();

  const [mode, setMode] = useState<Mode>("loading");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The server refuses a swap while the wizard is holding questions and a
  // track suggestion built from the old CV — so say so up front, and send
  // the graduate back to finish (resume) the wizard instead of a dead-end.
  useEffect(() => {
    if (!user) return;
    api.onboarding
      .state()
      .then((s) =>
        setMode(["qa", "track", "agents"].includes(s.onboarding_stage) ? "mid-onboarding" : "form"),
      )
      .catch(() => setMode("form"));
  }, [user]);

  async function handleReplace() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await api.cv.uploadFile(file);
      await refreshUser();
      setMode("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("cvUpdate.errors.couldntUpdate"));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || mode === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="bg-blueprint-grid flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            {t("common.venv")}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {mode === "mid-onboarding" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">{t("cvUpdate.midOnboardingTitle")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t("cvUpdate.midOnboardingBody")}</p>
            <div className="mt-5">
              <LinkButton href="/onboarding/cv">{t("cvUpdate.continueOnboarding")}</LinkButton>
            </div>
          </Panel>
        )}

        {mode === "form" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">{t("cvUpdate.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t("cvUpdate.body")}</p>

            <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed border-border bg-bg-surface-raised px-4 py-8 text-center transition-colors hover:border-border-strong">
              <Upload size={18} className="text-text-muted" />
              <span className="text-sm text-text-secondary">{file ? file.name : t("onboarding.chooseFile")}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex items-center justify-between">
              <Link href="/board" className="text-xs text-text-muted transition-colors hover:text-text-secondary">
                {t("cvUpdate.backToBoard")}
              </Link>
              <button
                type="button"
                onClick={handleReplace}
                disabled={!file || busy}
                className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("cvUpdate.uploading") : t("cvUpdate.replace")}
              </button>
            </div>
          </Panel>
        )}

        {mode === "done" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">{t("cvUpdate.done")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t("cvUpdate.body")}</p>
            <div className="mt-5">
              <LinkButton href="/board">{t("cvUpdate.backToBoard")}</LinkButton>
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-border bg-bg-surface p-5">{children}</div>;
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong"
    >
      {children}
    </Link>
  );
}
