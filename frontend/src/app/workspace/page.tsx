"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { ApiError, type ApiAgentType } from "@/lib/api";
import {
  assignNextTask,
  DEFAULT_TASK_CHAT_AGENT,
  fetchTaskDetail,
  mergeMessages,
  fetchTasks,
  postUserMessage,
  requestMentorReview,
  startTask,
  submitTask,
  taskChatReply,
  type Task,
} from "@/lib/tasks";
import { TaskRail } from "@/components/workspace/task-rail";
import { TaskWorkspace, type SubmitPayload } from "@/components/workspace/task-workspace";
import { AgentsMeeting } from "@/components/workspace/agents-meeting";
import { fetchMyExtraAgents, type ExtraAgent } from "@/lib/team";
import { useLocale } from "@/lib/i18n/locale";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

// How often to refresh a task whose specialist discussion is still being written, and how long
// to keep trying (a discussion normally takes 15-40 seconds).
const ROUNDTABLE_POLL_MS = 2500;
const ROUNDTABLE_POLL_MAX_MS = 150_000;

export default function WorkspacePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLocale();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [extraAgents, setExtraAgents] = useState<ExtraAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState<{ taskId: string; kind: "review" | "reply" } | null>(
    null
  );
  // Who the graduate is currently addressing in the selected task's
  // thread — defaults to the Mentor (see lib/tasks.ts's
  // DEFAULT_TASK_CHAT_AGENT) every time a different task is opened, so
  // switching tasks never leaves you "still talking to DevOps" by accident.
  const [chatAgent, setChatAgent] = useState<ApiAgentType>(DEFAULT_TASK_CHAT_AGENT);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchTasks();
      setTasks(list);
      setError(null);
      // Auto-select the most sensible task: the open one if any, else the
      // most recent. Keeps the center panel from ever being empty when
      // there's something to show.
      setSelectedId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        const open = list.find((t) => t.status !== "reviewed");
        return open?.id ?? list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("workspace.loadTasksError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) refresh();
    if (user) fetchMyExtraAgents().then(setExtraAgents).catch(() => {});
  }, [user, refresh]);

  // The specialists' discussion runs in the BACKGROUND after the Mentor's review
  // (docs/BACKGROUND_ROUNDTABLE.md). While a task says it is still going, refresh it every
  // couple of seconds so each comment appears as it is written. It stops by itself once the
  // server says the discussion is done, and after a hard cap in case that never arrives.
  const pollTaskId = tasks.find((t) => t.roundtableRunning)?.id ?? null;
  useEffect(() => {
    if (!pollTaskId) return;
    let cancelled = false;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > ROUNDTABLE_POLL_MAX_MS) {
        clearInterval(timer);
        // Give up quietly rather than leave a "discussing..." note that never clears.
        setTasks((prev) => prev.map((t) => (t.id === pollTaskId ? { ...t, roundtableRunning: false } : t)));
        return;
      }
      try {
        const detail = await fetchTaskDetail(pollTaskId);
        if (cancelled) return;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === detail.id ? { ...detail, messages: mergeMessages(t.messages, detail.messages) } : t
          )
        );
      } catch {
        // A missed refresh is harmless: the next one catches up.
      }
    }, ROUNDTABLE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollTaskId]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  async function openTask(id: string) {
    setSelectedId(id);
    setChatAgent(DEFAULT_TASK_CHAT_AGENT);
    try {
      const detail = await fetchTaskDetail(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? detail : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("workspace.loadTaskError"));
    }
  }

  async function handleAskManager() {
    setAssigning(true);
    setError(null);
    try {
      const task = await assignNextTask();
      setTasks((prev) => [task, ...prev]);
      setSelectedId(task.id);
      setChatAgent(DEFAULT_TASK_CHAT_AGENT);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("workspace.assignError"));
    } finally {
      setAssigning(false);
    }
  }

  async function handleAdvance(payload?: SubmitPayload) {
    if (!selected) return;
    try {
      if (selected.status === "todo") {
        const task = await startTask(selected.id);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } else if (selected.status === "in_progress" && payload) {
        const task = await submitTask(selected.id, payload);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        setBusy({ taskId: task.id, kind: "review" });
        try {
          const reviewed = await requestMentorReview(task.id);
          setTasks((prev) => prev.map((t) => (t.id === reviewed.id ? reviewed : t)));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("workspace.reviewError"));
        } finally {
          setBusy(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("workspace.updateError"));
    }
  }

  async function handleSendMessage(content: string, agent: ApiAgentType) {
    if (!selected) return;
    const taskId = selected.id;
    try {
      const message = await postUserMessage(taskId, content);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, messages: [...t.messages, message] } : t
        )
      );
      setBusy({ taskId, kind: "reply" });
      try {
        const reply = await taskChatReply(taskId, agent);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, messages: [...t.messages, reply] } : t
          )
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("workspace.replyError"));
      } finally {
        setBusy(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("workspace.sendMessageError"));
    }
  }

  if (authLoading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      </main>
    );
  }

  const taskBusy = selected && busy?.taskId === selected.id ? busy.kind : null;

  return (
    <main className="grid h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/board"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            {t("nav.venvBoard")}
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">{t("nav.workspaceTitle")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span dir="ltr" className="hidden font-mono text-xs text-text-muted lg:inline">
            {user.email}
          </span>
          <Link
            href="/settings"
            className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {t("nav.settings")}
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

      {error && (
        <div className="border-b border-border bg-bg-surface px-6 py-2">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center">
          <p className="text-sm text-text-muted">{t("workspace.loadingWorkspace")}</p>
        </div>
      ) : (
        // Three regions: task rail | task detail | agents meeting. The two
        // side panels are fixed-width; the center flexes. On smaller
        // screens the meeting panel drops (it's reachable by scrolling the
        // center on tablet) and the rail narrows.
        <div className="grid min-h-0 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_360px]">
          <div className="min-h-0 border-e border-border">
            <TaskRail
              tasks={tasks}
              selectedId={selectedId}
              onSelect={openTask}
              onAskManager={handleAskManager}
              assigning={assigning}
            />
          </div>

          {selected ? (
            <>
              <div className="min-h-0 border-e border-border">
                <TaskWorkspace
                  task={selected}
                  busy={taskBusy}
                  onAdvance={handleAdvance}
                />
              </div>
              <div className="hidden min-h-0 xl:block">
                <AgentsMeeting
                  task={selected}
                  busy={taskBusy}
                  extraAgents={extraAgents}
                  chatAgent={chatAgent}
                  onChangeChatAgent={setChatAgent}
                  onSendMessage={handleSendMessage}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 md:col-span-1 xl:col-span-2">
              <p className="text-sm text-text-secondary">
                {t("workspace.noTaskSelected")}
              </p>
              <button
                type="button"
                onClick={handleAskManager}
                disabled={assigning}
                className="rounded border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {assigning ? t("workspace.managerThinking") : t("workspace.askManagerTask")}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
