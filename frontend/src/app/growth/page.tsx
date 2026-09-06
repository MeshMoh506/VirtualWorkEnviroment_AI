"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AGENTS } from "@/lib/agents";
import { EMPLOYEE_FILE } from "@/lib/employee-file";
import { timeAgo } from "@/lib/format";
import { averageScore, REVIEWS_BY_TASK } from "@/lib/reviews";
import { INITIAL_TASKS } from "@/lib/tasks";

const hr = AGENTS.hr;

const reviewedTasks = INITIAL_TASKS.filter(
  (t) => t.status === "reviewed" && REVIEWS_BY_TASK[t.id]
).sort(
  (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
);

const chartData = reviewedTasks.map((t) => ({
  label: t.title,
  score: Number(averageScore(REVIEWS_BY_TASK[t.id]).toFixed(2)),
}));

interface TooltipPayloadItem {
  value: number;
  payload: { label: string };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded border border-border bg-bg-surface-raised px-3 py-2">
      <p className="text-xs text-text-secondary">{item.payload.label}</p>
      <p className="mt-0.5 font-mono text-[11px] text-text-muted">
        {item.value.toFixed(2)} / 5
      </p>
    </div>
  );
}

export default function GrowthPage() {
  return (
    <main className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/board"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv / board
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            Growth
          </h1>
        </div>
        <span className="rounded border border-border bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
          preview
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: `var(${hr.colorVar})` }}
          />
          <span className="font-mono text-[11px] text-text-muted">
            employee_file
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EMPLOYEE_FILE.skills.map((skill) => (
            <span
              key={skill}
              className="rounded border border-border bg-bg-surface px-2.5 py-1 font-mono text-xs text-text-secondary"
            >
              {skill}
            </span>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-text-secondary">
          {EMPLOYEE_FILE.summary}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-border bg-bg-surface p-4">
            <p className="font-mono text-[11px] text-text-muted">strengths</p>
            <ul className="mt-2 flex flex-col gap-2">
              {EMPLOYEE_FILE.strengths.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-border bg-bg-surface p-4">
            <p className="font-mono text-[11px] text-text-muted">
              growth areas
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {EMPLOYEE_FILE.growthAreas.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-text-secondary">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 font-mono text-[11px] text-text-muted">
          score trend
        </p>
        <div style={{ width: "100%", height: 260 }} className="mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
            >
              <CartesianGrid
                stroke="var(--line-grid)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                angle={-15}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                width={24}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--agent-hr)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--agent-hr)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-10 font-mono text-[11px] text-text-muted">timeline</p>
        <div className="mt-3 flex flex-col gap-3">
          {reviewedTasks.map((task) => {
            const review = REVIEWS_BY_TASK[task.id];
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}/review`}
                className="flex items-center justify-between rounded border border-border bg-bg-surface px-4 py-3 transition-colors hover:border-border-strong"
              >
                <div>
                  <p className="text-sm text-text-primary">{task.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                    {timeAgo(task.updatedAt)} ·{" "}
                    {review.verdict === "approved"
                      ? "approved"
                      : "needs changes"}
                  </p>
                </div>
                <span className="font-mono text-xs text-text-secondary">
                  {averageScore(review).toFixed(2)}/5
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/board"
          className="mt-10 inline-block text-xs text-text-muted hover:text-text-secondary"
        >
          Back to home board
        </Link>
      </div>
    </main>
  );
}
