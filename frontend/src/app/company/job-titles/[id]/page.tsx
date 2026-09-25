"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth, ApiError } from "@/lib/auth-context";
import {
  fetchJobTitle,
  fetchMaterials,
  queryKnowledgeBase,
  uploadMaterial,
  type JobTitle,
  type KnowledgeMaterial,
  type RAGChunk,
} from "@/lib/company";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// A job title's knowledge base (docs/STAGE3_COMPANY_RAG.md): upload
// pasted text or a file, see what's been chunked/embedded so far, and
// test the actual RAG retrieval against a question — real cosine
// similarity scores, not a mock.
export default function JobTitleDetailPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const jobTitleId = params.id;
  const { t } = useLocale();

  const [jobTitle, setJobTitle] = useState<JobTitle | null>(null);
  const [materials, setMaterials] = useState<KnowledgeMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pasteText, setPasteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RAGChunk[] | null>(null);

  function load() {
    Promise.all([fetchJobTitle(jobTitleId), fetchMaterials(jobTitleId)])
      .then(([jt, mats]) => {
        setJobTitle(jt);
        setMaterials(mats);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.genericError")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, jobTitleId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText.trim() && !file) return;
    setUploading(true);
    setError(null);
    try {
      const material = await uploadMaterial(jobTitleId, pasteText.trim() || undefined, file || undefined);
      setMaterials((prev) => [material, ...prev]);
      setJobTitle((prev) =>
        prev
          ? { ...prev, materialCount: prev.materialCount + 1, chunkCount: prev.chunkCount + material.chunkCount }
          : prev
      );
      setPasteText("");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("company.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await queryKnowledgeBase(jobTitleId, query.trim());
      setResults(res.chunks);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("company.queryError"));
    } finally {
      setSearching(false);
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
          <Link href="/company" className="font-mono text-xs text-text-muted hover:text-text-secondary">
            {t("common.venv")} / {t("company.nav")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{jobTitle?.title}</h1>
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
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Upload */}
          <form onSubmit={handleUpload} className="rounded border border-border bg-bg-surface p-5">
            <h2 className="text-base font-medium text-text-primary">{t("company.uploadTitle")}</h2>
            <p className="mt-1 text-sm text-text-secondary">{t("company.uploadBody")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                placeholder={t("company.pasteTextPlaceholder")}
                className="thin-scrollbar resize-none rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
              />
              <p className="text-center text-xs text-text-muted">{t("common.or")}</p>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-text-secondary"
              />
              <div>
                <button
                  type="submit"
                  disabled={uploading || (!pasteText.trim() && !file)}
                  className="rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? t("company.uploading") : t("company.upload")}
                </button>
              </div>
            </div>
          </form>

          {/* Materials */}
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium text-text-primary">
              {t("company.materialsTitle", { count: String(materials.length) })}
            </h2>
            {materials.length === 0 ? (
              <p className="text-sm text-text-muted">{t("company.noMaterials")}</p>
            ) : (
              materials.map((m) => (
                <div key={m.id} className="rounded border border-border bg-bg-surface px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">
                      {m.filename ?? t("company.pastedText")}
                    </p>
                    <p className="font-mono text-[11px] text-text-muted">
                      {t("company.chunksCount", { count: String(m.chunkCount) })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{m.preview}</p>
                </div>
              ))
            )}
          </div>

          {/* RAG query tester */}
          <form onSubmit={handleSearch} className="rounded border border-border bg-bg-surface p-5">
            <h2 className="text-base font-medium text-text-primary">{t("company.searchTitle")}</h2>
            <p className="mt-1 text-sm text-text-secondary">{t("company.searchBody")}</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("company.searchPlaceholder")}
                className="flex-1 rounded border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="shrink-0 rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? t("common.working") : t("company.search")}
              </button>
            </div>

            {results && (
              <div className="mt-4 flex flex-col gap-2">
                {results.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("company.noResults")}</p>
                ) : (
                  results.map((chunk) => (
                    <div key={chunk.id} className="rounded border border-border bg-bg-surface-raised px-3 py-2">
                      <p className="font-mono text-[10px] text-text-muted">
                        {t("company.score")}: {chunk.score.toFixed(3)}
                      </p>
                      <p className="mt-1 text-sm text-text-primary">{chunk.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
