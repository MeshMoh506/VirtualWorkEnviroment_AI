"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, useAuth } from "@/lib/auth-context";
import { registerCompany } from "@/lib/company";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

type Mode = "found" | "join";
type Role = "admin" | "hr" | "tech_lead";

// Company registration (docs/STAGE3_COMPANY_RAG.md): found a brand new
// company (becomes its first admin) or join an existing one with a
// join code a teammate shared, picking your own role. No email/invite
// system exists in this app, so joining is self-serve — a deliberate
// MVP simplification, not a security boundary.
export default function CompanyRegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useLocale();

  const [mode, setMode] = useState<Mode>("found");
  const [companyName, setCompanyName] = useState("");
  const [field, setField] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [role, setRole] = useState<Role>("hr");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roleLabels: Record<Role, string> = {
    admin: t("companyRegister.roles.admin"),
    hr: t("companyRegister.roles.hr"),
    tech_lead: t("companyRegister.roles.techLead"),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerCompany(
        mode === "found"
          ? { email, password, full_name: fullName, company_name: companyName, field: field || undefined }
          : { email, password, full_name: fullName, join_code: joinCode.trim(), role }
      );
      await login(email, password);
      router.push("/company");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-blueprint-grid flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-mono text-xs text-text-muted hover:text-text-secondary">
              {t("common.venv")}
            </Link>
            <div className="flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>
          <h1 className="mt-3 text-center text-2xl font-medium text-text-primary">
            {t("companyRegister.title")}
          </h1>
          <p className="mt-1 text-center text-sm text-text-secondary">
            {t("companyRegister.subtitle")}
          </p>
        </div>

        <div className="mb-4 flex rounded border border-border p-1">
          <button
            type="button"
            onClick={() => setMode("found")}
            className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors ${
              mode === "found" ? "bg-accent text-accent-text" : "text-text-secondary"
            }`}
          >
            {t("companyRegister.foundTab")}
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors ${
              mode === "join" ? "bg-accent text-accent-text" : "text-text-secondary"
            }`}
          >
            {t("companyRegister.joinTab")}
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded border border-border bg-bg-surface p-5"
        >
          {mode === "found" ? (
            <>
              <Field label={t("companyRegister.companyNameLabel")}>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("companyRegister.companyNamePlaceholder")}
                  className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                />
              </Field>
              <Field label={t("companyRegister.fieldLabel")}>
                <input
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  placeholder={t("companyRegister.fieldPlaceholder")}
                  className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("companyRegister.joinCodeLabel")}>
                <input
                  required
                  dir="ltr"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder={t("companyRegister.joinCodePlaceholder")}
                  className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                />
              </Field>
              <Field label={t("companyRegister.roleLabel")}>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                >
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field label={t("login.fullNameLabel")}>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("login.fullNamePlaceholder")}
              className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            />
          </Field>
          <Field label={t("login.emailLabel")}>
            <input
              required
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            />
          </Field>
          <Field label={t("login.passwordLabel")}>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("common.working") : t("companyRegister.submit")}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-4 block w-full text-center text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          {t("companyRegister.backToLogin")}
        </Link>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] text-text-muted">{label}</label>
      {children}
    </div>
  );
}
