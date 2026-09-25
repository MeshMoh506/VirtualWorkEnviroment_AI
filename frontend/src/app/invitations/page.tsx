"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import {
  acceptInvitation,
  declineInvitation,
  fetchMyInvitations,
  type InvitationDetail,
} from "@/lib/invitations";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// A student's own invitations (docs/STAGE3_COMPANY_RAG.md) — the consent
// screen. Accepting isn't a single click: the person has to read exactly
// what the company will (and won't) see and explicitly check a box
// before the Accept button does anything, enforced server-side too
// (POST /invitations/{id}/accept 400s without consent:true).
export default function InvitationsPage() {
  const { user, loading: authLoading, refreshUser } = useRequireAuth();
  const router = useRouter();
  const { t } = useLocale();

  const [invitations, setInvitations] = useState<InvitationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyInvitations()
      .then(setInvitations)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.genericError")))
      .finally(() => setLoading(false));
  }, [user, t]);

  async function handleAccept(inv: InvitationDetail) {
    if (!consented[inv.id]) {
      setError(t("invitations.mustConsent"));
      return;
    }
    setBusyId(inv.id);
    setError(null);
    try {
      const updated = await acceptInvitation(inv.id, true);
      setInvitations((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("invitations.acceptError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(inv: InvitationDetail) {
    setBusyId(inv.id);
    setError(null);
    try {
      const updated = await declineInvitation(inv.id);
      setInvitations((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("invitations.declineError"));
    } finally {
      setBusyId(null);
    }
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
          <Link href="/board" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            {t("nav.venvBoard")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{t("invitations.title")}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t("invitations.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/board"
            className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("nav.homeBoardTitle")}
          </Link>
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="thin-scrollbar overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-8">
          {error && <p className="text-sm text-danger">{error}</p>}

          {invitations.length === 0 ? (
            <p className="text-sm text-text-muted">{t("invitations.empty")}</p>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="rounded border border-border bg-bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-text-primary">{inv.organizationName}</p>
                    <p className="mt-0.5 text-sm text-text-secondary">{inv.jobTitle}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {inv.companyProjectTitle ?? t("invitations.platformTrack")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border border-border px-2 py-1 font-mono text-[10px] text-text-muted">
                    {t(`company.invitationStatus.${inv.status}`)}
                  </span>
                </div>

                {inv.status === "pending" && (
                  <>
                    <p className="mt-4 rounded border border-border bg-bg-surface-raised p-3 text-sm text-text-secondary">
                      {inv.dataSharedNotice}
                    </p>
                    <label className="mt-3 flex items-start gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={Boolean(consented[inv.id])}
                        onChange={(e) =>
                          setConsented((prev) => ({ ...prev, [inv.id]: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      {t("invitations.consentLabel")}
                    </label>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(inv)}
                        disabled={busyId === inv.id || !consented[inv.id]}
                        className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === inv.id ? t("common.working") : t("invitations.accept")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(inv)}
                        disabled={busyId === inv.id}
                        className="rounded border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("invitations.decline")}
                      </button>
                    </div>
                  </>
                )}

                {inv.status === "accepted" && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-text-secondary">{t("invitations.accepted")}</p>
                    <button
                      type="button"
                      onClick={() => router.push("/workspace")}
                      className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      {t("nav.workspace")}
                    </button>
                  </div>
                )}

                {inv.status === "declined" && (
                  <p className="mt-3 text-sm text-text-muted">{t("invitations.declined")}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
