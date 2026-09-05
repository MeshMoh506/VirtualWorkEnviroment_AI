import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-blueprint-grid flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="rounded border border-border bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
          stage 1 · ai-powered web apps
        </span>
        <h1 className="text-4xl font-medium tracking-tight text-text-primary">
          Venv
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          A simulated workplace for recent graduates. A manager assigns
          tasks, a mentor reviews the work, HR tracks how you grow — all
          three sharing one employee file.
        </p>
        <button
          type="button"
          className="rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong hover:border-accent-strong"
        >
          Upload your CV to start
        </button>
        <Link
          href="/board"
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          Preview: home board
        </Link>
      </div>
    </main>
  );
}
