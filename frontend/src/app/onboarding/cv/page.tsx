"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import { ApiError, useRequireAuth } from "@/lib/auth-context";
import { api, type AgentCatalogApiOut, type ApiTrack } from "@/lib/api";
import { SELECTABLE_TRACKS, TRACKS } from "@/lib/tracks";

type Step = "loading" | "cv" | "qa" | "track" | "agents" | "done" | "already-done";

const STEP_NUMBER: Record<Step, number> = {
  loading: 0,
  cv: 1,
  qa: 2,
  track: 3,
  agents: 4,
  done: 4,
  "already-done": 0,
};

export default function OnboardingPage() {
  const { user, loading: authLoading, refreshUser } = useRequireAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // cv
  const [file, setFile] = useState<File | null>(null);

  // qa
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [introText, setIntroText] = useState("");

  // track
  const [suggestedTrack, setSuggestedTrack] = useState<ApiTrack | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<ApiTrack | null>(null);

  // agents
  const [catalog, setCatalog] = useState<AgentCatalogApiOut[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());

  // done
  const [finalTrack, setFinalTrack] = useState<ApiTrack | null>(null);
  const [finalAgents, setFinalAgents] = useState<AgentCatalogApiOut[]>([]);

  // On load, check whether onboarding's already done so we don't make a
  // graduate redo it. Mid-flow resume (picking back up exactly on the qa/
  // track/agents step from a previous session) isn't supported yet — see
  // docs/STAGE2_ONBOARDING_FLOW.md — so anything short of "complete" just
  // starts the wizard fresh from the CV step.
  useEffect(() => {
    if (!user) return;
    api.onboarding
      .state()
      .then((s) => setStep(s.onboarding_stage === "complete" ? "already-done" : "cv"))
      .catch(() => setStep("cv"));
  }, [user]);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const [result, agentCatalog] = await Promise.all([
        api.onboarding.uploadCv(file),
        api.onboarding.catalog(),
      ]);
      setQuestions(result.questions);
      setCatalog(agentCatalog);
      setStep("qa");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkipCv() {
    router.push("/board");
  }

  async function handleSubmitQa() {
    setError(null);
    setBusy(true);
    try {
      const cleanAnswers: Record<string, string> = {};
      for (const [i, text] of Object.entries(answers)) {
        if (text.trim()) cleanAnswers[i] = text.trim();
      }
      const result = await api.onboarding.submitQa(cleanAnswers, introText.trim());
      setSuggestedTrack(result.suggested_track);
      setSelectedTrack(result.suggested_track);
      setReasoning(result.reasoning);
      setStep("track");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your answers.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveTrack() {
    setError(null);
    setBusy(true);
    try {
      const override = selectedTrack !== suggestedTrack ? selectedTrack : null;
      const result = await api.onboarding.approveTrack(override);
      setSelectedAgentIds(new Set(result.suggested_agents.map((a) => a.id)));
      setStep("agents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your track.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveAgents() {
    setError(null);
    setBusy(true);
    try {
      const result = await api.onboarding.approveAgents(Array.from(selectedAgentIds));
      setFinalTrack(result.track);
      setFinalAgents(result.agents);
      await refreshUser();
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your team.");
    } finally {
      setBusy(false);
    }
  }

  function toggleAgent(id: string) {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (authLoading || !user || step === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="bg-blueprint-grid flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            venv
          </Link>
          {step !== "already-done" && step !== "done" && (
            <p className="mt-3 text-xs text-text-muted">Step {STEP_NUMBER[step]} of 4</p>
          )}
        </div>

        {step === "already-done" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">You&apos;re all set</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              You&apos;ve already been through onboarding. Head back to the board to keep
              working.
            </p>
            <div className="mt-5">
              <PrimaryButton onClick={() => router.push("/board")}>Go to board</PrimaryButton>
            </div>
          </Panel>
        )}

        {step === "cv" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">Tell us about yourself</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Upload your CV — the Manager uses it to suggest a track and calibrate your first
              task. A few quick follow-up questions come next; nothing here is required.
            </p>

            <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed border-border bg-bg-surface-raised px-4 py-8 text-center transition-colors hover:border-border-strong">
              <Upload size={18} className="text-text-muted" />
              <span className="text-sm text-text-secondary">
                {file ? file.name : "Choose a PDF or Word file"}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex items-center justify-between">
              <SkipLink onClick={handleSkipCv}>Skip for now</SkipLink>
              <PrimaryButton onClick={handleUpload} disabled={!file || busy}>
                {busy ? "Reading..." : "Continue"}
              </PrimaryButton>
            </div>
          </Panel>
        )}

        {step === "qa" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">A few quick questions</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Based on your CV. Answer what you want — leave the rest blank.
            </p>

            <div className="mt-5 space-y-4">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="text-sm text-text-secondary">{q}</label>
                  <input
                    type="text"
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="mt-1.5 w-full rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="text-sm text-text-secondary">
                  Anything else you want to add?
                </label>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                  className="mt-1.5 w-full resize-none rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end">
              <PrimaryButton onClick={handleSubmitQa} disabled={busy}>
                {busy ? "Saving..." : "Continue"}
              </PrimaryButton>
            </div>
          </Panel>
        )}

        {step === "track" && suggestedTrack && selectedTrack && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">Your track</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{reasoning}</p>

            <div className="mt-5 rounded border border-border-strong bg-bg-surface-raised p-3">
              <p className="text-xs text-text-muted">Suggested</p>
              <p className="mt-0.5 text-sm text-text-primary">{TRACKS[suggestedTrack]}</p>
            </div>

            <div className="mt-4">
              <label className="text-sm text-text-secondary">Not quite right? Pick another</label>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value as ApiTrack)}
                className="mt-1.5 w-full rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              >
                {SELECTABLE_TRACKS.map((t) => (
                  <option key={t} value={t}>
                    {TRACKS[t]}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end">
              <PrimaryButton onClick={handleApproveTrack} disabled={busy}>
                {busy ? "Saving..." : "Continue"}
              </PrimaryButton>
            </div>
          </Panel>
        )}

        {step === "agents" && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">Your team</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Manager, Mentor, and HR are always on your team. Add any of these too — checked
              ones are what we&apos;d suggest for your track.
            </p>

            <div className="mt-5 space-y-2">
              {catalog.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-start gap-3 rounded border border-border bg-bg-surface-raised p-3 transition-colors hover:border-border-strong"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.has(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-sm text-text-primary">{agent.name}</span>
                    <span className="block text-xs text-text-secondary">{agent.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end">
              <PrimaryButton onClick={handleApproveAgents} disabled={busy}>
                {busy ? "Saving..." : "Finish"}
              </PrimaryButton>
            </div>
          </Panel>
        )}

        {step === "done" && finalTrack && (
          <Panel>
            <h1 className="text-2xl font-medium text-text-primary">You&apos;re ready</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {TRACKS[finalTrack]}
              {finalAgents.length > 0 && (
                <> — with {finalAgents.map((a) => a.name).join(", ")} added to your team.</>
              )}
            </p>
            <div className="mt-5">
              <PrimaryButton onClick={() => router.push("/board")}>Go to board</PrimaryButton>
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

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SkipLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-text-muted transition-colors hover:text-text-secondary"
    >
      {children}
    </button>
  );
}
