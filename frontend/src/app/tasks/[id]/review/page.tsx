import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENTS } from "@/lib/agents";
import { INITIAL_TASKS } from "@/lib/tasks";
import { REVIEWS_BY_TASK } from "@/lib/reviews";
import { RubricBar } from "@/components/rubric-bar";

export function generateStaticParams() {
  return INITIAL_TASKS.map((task) => ({ id: task.id }));
}

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const task = INITIAL_TASKS.find((t) => t.id === id);
  if (!task) notFound();

  const review = REVIEWS_BY_TASK[id];
  const mentor = AGENTS.mentor;

  return (
    <main className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/tasks"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv / tasks
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            Mentor&apos;s review
          </h1>
        </div>
        <span className="rounded border border-border bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
          preview
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded border border-border bg-bg-surface p-4">
          <p className="font-mono text-[11px] text-text-muted">task</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {task.title}
          </p>
          {task.githubLink && (
            <p className="mt-2 font-mono text-[11px] text-text-muted">
              {task.githubLink}
            </p>
          )}
        </div>

        {!review ? (
          <p className="mt-8 text-sm text-text-secondary">
            No review yet for this task.
          </p>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `var(${mentor.colorVar})` }}
              />
              <span className="text-sm font-medium text-text-primary">
                {review.verdict === "approved" ? "Approved" : "Needs changes"}
              </span>
              <span className="font-mono text-[11px] text-text-muted">
                by {mentor.name}
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              {review.content}
            </p>

            <div className="mt-8 flex flex-col gap-4 rounded border border-border bg-bg-surface p-4">
              {review.categories.map((category) => (
                <RubricBar
                  key={category.key}
                  label={category.label}
                  score={category.score}
                />
              ))}
            </div>

            <div className="mt-8">
              <p className="font-mono text-[11px] text-text-muted">comments</p>
              <div className="mt-3 flex flex-col gap-3">
                {review.comments.map((comment) => {
                  const categoryLabel =
                    review.categories.find((c) => c.key === comment.category)
                      ?.label ?? comment.category;
                  return (
                    <div
                      key={comment.id}
                      className="rounded border border-border bg-bg-surface p-3"
                    >
                      <span className="font-mono text-[11px] text-text-muted">
                        {categoryLabel}
                      </span>
                      <p className="mt-1 text-sm text-text-secondary">
                        {comment.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Link
          href="/tasks"
          className="mt-10 inline-block text-xs text-text-muted hover:text-text-secondary"
        >
          Back to task board
        </Link>
      </div>
    </main>
  );
}
