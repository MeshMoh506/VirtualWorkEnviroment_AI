"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import { api, type ApiTrack } from "@/lib/api";
import { useLocale, useTrackLabels } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// The settings page: the usual things a person expects to control on any
// site (their name, password, language, theme) plus the one thing
// specific to Venv — updating the CV that feeds the Manager's planning.
// Kept as three independent forms (profile / password / preferences) so
// one save never risks the others: renaming yourself shouldn't require
// re-typing a password, and vice versa.
export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useRequireAuth();
  const { t } = useLocale();
  const trackLabels = useTrackLabels();

  const [track, setTrack] = useState<ApiTrack | null>(null);

  const [fullName, setFullName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setFullName(user.fullName);
  }, [user]);

  useEffect(() => {
    if (user) api.me().then((me) => setTrack(me.track as ApiTrack)).catch(() => {});
  }, [user]);

  async function saveName() {
    const name = fullName.trim();
    if (!name) return;
    setNameBusy(true);
    setNameError(null);
    setNameSaved(false);
    try {
      await api.updateMe({ full_name: name });
      await refreshUser();
      setNameSaved(true);
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : t("settings.errors.couldntSaveName"));
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword() {
    if (!currentPassword || !newPassword) return;
    setPwBusy(true);
    setPwError(null);
    setPwSaved(false);
    try {
      await api.updateMe({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwSaved(true);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : t("settings.errors.couldntSavePassword"));
    } finally {
      setPwBusy(false);
    }
  }

  if (authLoading || !user) {
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
          <h1 className="mt-1 text-lg font-medium text-text-primary">{t("nav.settingsTitle")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("nav.workspace")}
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
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
          {/* Profile */}
          <Section title={t("settings.profile.title")} body={t("settings.profile.body")}>
            <Field label={t("settings.profile.emailLabel")}>
              <p dir="ltr" className="text-sm text-text-secondary">{user.email}</p>
            </Field>
            <Field label={t("settings.profile.nameLabel")}>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setNameSaved(false);
                }}
                className="w-full rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              />
            </Field>
            {track && (
              <Field label={t("settings.profile.trackLabel")}>
                <p className="text-sm text-text-secondary">{trackLabels[track]}</p>
              </Field>
            )}
            {nameError && <p className="text-sm text-danger">{nameError}</p>}
            {nameSaved && !nameError && (
              <p className="text-sm text-accent-ink">{t("settings.saved")}</p>
            )}
            <div>
              <button
                type="button"
                onClick={saveName}
                disabled={nameBusy || !fullName.trim() || fullName.trim() === user.fullName}
                className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nameBusy ? t("common.working") : t("settings.profile.save")}
              </button>
            </div>
          </Section>

          {/* Password */}
          <Section title={t("settings.password.title")} body={t("settings.password.body")}>
            <Field label={t("settings.password.currentLabel")}>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPwSaved(false);
                }}
                className="w-full rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              />
            </Field>
            <Field label={t("settings.password.newLabel")}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwSaved(false);
                }}
                className="w-full rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              />
            </Field>
            {pwError && <p className="text-sm text-danger">{pwError}</p>}
            {pwSaved && !pwError && <p className="text-sm text-accent-ink">{t("settings.saved")}</p>}
            <div>
              <button
                type="button"
                onClick={savePassword}
                disabled={pwBusy || !currentPassword || !newPassword}
                className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pwBusy ? t("common.working") : t("settings.password.save")}
              </button>
            </div>
          </Section>

          {/* CV */}
          <Section title={t("settings.cv.title")} body={t("settings.cv.body")}>
            <Link
              href="/profile/cv"
              className="inline-block rounded border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {t("settings.cv.cta")}
            </Link>
          </Section>

          {/* Preferences */}
          <Section title={t("settings.preferences.title")} body={t("settings.preferences.body")}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">{t("settings.preferences.language")}</span>
                <LocaleToggle />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">{t("settings.preferences.theme")}</span>
                <ThemeToggle />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-bg-surface p-5">
      <h2 className="text-base font-medium text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[11px] text-text-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
