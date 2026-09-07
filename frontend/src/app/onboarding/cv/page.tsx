"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

export default function CvOnboardingPage() {
  const { user, loading: authLoading, refreshUser } = useRequireAuth();
  const router = useRouter();

  const [cvText, setCvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleContinue() {
    setError(null);
    setBusy(true);
    try {
      await api.cv.submit(cvText.trim());
      await refreshUser();
      router.push("/board");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your CV.");
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="bg-blueprint-grid flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv
          </Link>
          <h1 className="mt-1 text-2xl font-medium text-text-primary">
            {user.hasCv ? "Update your CV" : "Tell us about yourself"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {user.hasCv
              ? "Paste an updated CV or summary — this replaces what's on file. The Manager uses it to calibrate your next task."
              : "Paste your CV, or just a summary of your background and skills. The Manager uses this to calibrate your first task — it's not required, and you can always add it later."}
          </p>
        </div>

        <div className="rounded border border-border bg-bg-surface p-5">
          <label className="font-mono text-[11px] text-text-muted">cv</label>
          <textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="e.g. Recent CS grad, built two React apps, comfortable with Python, new to testing..."
            rows={10}
            className="mt-1.5 w-full resize-none rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
          />

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/board")}
              className="text-xs text-text-muted transition-colors hover:text-text-secondary"
            >
              {user.hasCv ? "Cancel" : "Skip for now"}
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!cvText.trim() || busy}
              className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
