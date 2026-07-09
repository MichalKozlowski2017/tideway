"use client";

import { useCallback, useEffect, useState } from "react";

type PanelStats = {
  enabled: boolean;
  aiProvider: string;
  aiModel: string;
  aiSetup: string;
  articlesPerBatch: number;
  rawItems: { pending: number; processing: number; failed: number };
  recentJobs: Array<{
    id: string;
    job_type: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    items_processed: number;
    error: string | null;
  }>;
};

type LogLine = {
  id: string;
  text: string;
  tone?: "ok" | "err" | "muted";
};

type TaskStatus = "pending" | "active" | "done" | "skipped";

type BatchTask = {
  title: string;
  kind: string;
  status: TaskStatus;
};

type ProgressState = {
  active: boolean;
  runsTotal: number;
  runCurrent: number;
  articlesTarget: number;
  articlesPublished: number;
  tokensUsed: number;
  currentTitle: string | null;
  currentKind: string | null;
  batchTasks: BatchTask[];
  percent: number;
};

const INITIAL_PROGRESS: ProgressState = {
  active: false,
  runsTotal: 0,
  runCurrent: 0,
  articlesTarget: 0,
  articlesPublished: 0,
  tokensUsed: 0,
  currentTitle: null,
  currentKind: null,
  batchTasks: [],
  percent: 0,
};

type StreamEvent = {
  type: string;
  runs?: number;
  run?: number;
  total?: number;
  totalRuns?: number;
  ai?: string;
  estimatedArticles?: number;
  tasks?: number;
  items?: Array<{ title: string; kind: string }>;
  index?: number;
  title?: string;
  kind?: string;
  published?: boolean;
  tokensUsed?: number;
  articlesTotal?: number;
  tokensTotal?: number;
  result?: { generated: number; tokensUsed: number };
  summary?: { totalGenerated: number; totalTokens: number; runsCompleted: number };
  message?: string;
};

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    trend: "Trend",
    synteza: "Synteza",
    essay: "Esej",
    analysis: "Analiza",
    story: "Reportaż",
    community: "Społeczność",
    guide: "Poradnik",
    list: "Lista",
    quiz: "Quiz",
    backup: "Backup",
    artykuł: "Artykuł",
  };
  return labels[kind] ?? kind;
}

function truncateTitle(title: string, max = 72): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1)}…`;
}

export function LocalGenerationPanel() {
  const [stats, setStats] = useState<PanelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"runs" | "target">("target");
  const [runs, setRuns] = useState(2);
  const [targetArticles, setTargetArticles] = useState(8);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);

  const appendLog = useCallback((text: string, tone?: LogLine["tone"]) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, text, tone },
    ]);
  }, []);

  const refreshStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/local/panel/stats");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStats(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać statusu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  function handleProgressEvent(event: StreamEvent) {
    if (event.type === "start") {
      setProgress({
        ...INITIAL_PROGRESS,
        active: true,
        runsTotal: event.runs ?? 1,
        articlesTarget: event.estimatedArticles ?? 4,
      });
      return;
    }

    if (event.type === "run_start" && event.run && event.total) {
      setProgress((prev) => ({
        ...prev,
        active: true,
        runCurrent: event.run!,
        runsTotal: event.total!,
        batchTasks: [],
        currentTitle: null,
        currentKind: null,
      }));
      return;
    }

    if (event.type === "batch_planned" && event.items) {
      setProgress((prev) => ({
        ...prev,
        batchTasks: event.items!.map((item) => ({
          title: item.title,
          kind: item.kind,
          status: "pending",
        })),
      }));
      return;
    }

    if (event.type === "task_start" && event.index && event.title) {
      setProgress((prev) => {
        const batchTasks = prev.batchTasks.map((task, i) => ({
          ...task,
          status:
            i + 1 === event.index!
              ? ("active" as const)
              : task.status === "active"
                ? task.status
                : task.status,
        }));
        return {
          ...prev,
          currentTitle: event.title!,
          currentKind: event.kind ?? null,
          batchTasks,
          percent: computePercent(
            prev.articlesPublished,
            prev.articlesTarget,
            event.index! - 1,
            event.total ?? prev.batchTasks.length,
            prev.runsTotal,
            prev.runCurrent,
            true,
          ),
        };
      });
      return;
    }

    if (event.type === "task_done" && event.index) {
      setProgress((prev) => {
        const published = event.published ?? false;
        const articlesPublished = event.articlesTotal ?? prev.articlesPublished;
        const batchTasks = prev.batchTasks.map((task, i) => ({
          ...task,
          status:
            i + 1 === event.index!
              ? published
                ? ("done" as const)
                : ("skipped" as const)
              : task.status,
        }));
        return {
          ...prev,
          articlesPublished,
          tokensUsed: event.tokensTotal ?? prev.tokensUsed,
          currentTitle: null,
          currentKind: null,
          batchTasks,
          percent: computePercent(
            articlesPublished,
            prev.articlesTarget,
            event.index!,
            event.total ?? prev.batchTasks.length,
            prev.runsTotal,
            prev.runCurrent,
            false,
          ),
        };
      });
      return;
    }

    if (event.type === "backup_start" && event.title) {
      setProgress((prev) => ({
        ...prev,
        currentTitle: event.title!,
        currentKind: "backup",
        batchTasks: [
          ...prev.batchTasks,
          { title: event.title!, kind: "backup", status: "active" },
        ],
      }));
      return;
    }

    if (event.type === "backup_done") {
      setProgress((prev) => {
        const published = event.published ?? false;
        const articlesPublished = event.articlesTotal ?? prev.articlesPublished;
        const batchTasks = [...prev.batchTasks];
        const last = batchTasks[batchTasks.length - 1];
        if (last?.kind === "backup") {
          batchTasks[batchTasks.length - 1] = {
            ...last,
            status: published ? "done" : "skipped",
          };
        }
        return {
          ...prev,
          articlesPublished,
          tokensUsed: event.tokensTotal ?? prev.tokensUsed,
          currentTitle: null,
          currentKind: null,
          batchTasks,
          percent: Math.min(
            100,
            (articlesPublished / Math.max(prev.articlesTarget, 1)) * 100,
          ),
        };
      });
    }
  }

  async function startGeneration() {
    if (running) return;
    setRunning(true);
    setSummary(null);
    setError(null);
    setLogs([]);
    setProgress(INITIAL_PROGRESS);

    const body =
      mode === "target"
        ? { targetArticles }
        : { runs };

    appendLog(
      `Start generowania (${mode === "target" ? `cel: ${targetArticles} artykułów` : `${runs} batchy`})…`,
    );

    try {
      const res = await fetch("/api/local/panel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          handleProgressEvent(event);

          if (event.type === "start") {
            appendLog(`AI: ${event.ai}`, "muted");
          } else if (event.type === "run_start") {
            appendLog(`Batch ${event.run}/${event.total}…`);
          } else if (event.type === "batch_planned" && event.items) {
            appendLog(
              `Plan batcha: ${event.tasks ?? event.items.length} zadań`,
              "muted",
            );
          } else if (event.type === "task_start" && event.title) {
            appendLog(
              `→ [${kindLabel(event.kind ?? "artykuł")}] ${truncateTitle(event.title, 60)}`,
            );
          } else if (event.type === "task_done" && event.title) {
            appendLog(
              event.published
                ? `✓ ${truncateTitle(event.title, 50)}`
                : `⊘ pominięto: ${truncateTitle(event.title, 50)}`,
              event.published ? "ok" : "muted",
            );
          } else if (event.type === "backup_start" && event.title) {
            appendLog(`↻ backup: ${truncateTitle(event.title, 50)}`, "muted");
          } else if (event.type === "backup_done" && event.title) {
            appendLog(
              event.published
                ? `✓ backup: ${truncateTitle(event.title, 50)}`
                : `⊘ backup nieudany`,
              event.published ? "ok" : "muted",
            );
          } else if (event.type === "run_done" && event.result) {
            appendLog(
              `Batch ${event.run} gotowy: ${event.result.generated} artykułów, ${event.result.tokensUsed} tokenów`,
              event.result.generated > 0 ? "ok" : "muted",
            );
          } else if (event.type === "done" && event.summary) {
            const s = event.summary;
            setSummary(
              `Opublikowano ${s.totalGenerated} artykułów w ${s.runsCompleted} batchach (${s.totalTokens} tokenów)`,
            );
            setProgress((prev) => ({
              ...prev,
              active: false,
              articlesPublished: s.totalGenerated,
              tokensUsed: s.totalTokens,
              percent: 100,
              currentTitle: null,
              currentKind: null,
            }));
            appendLog("Zakończono.", "ok");
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Błąd generowania");
          }
        }
      }

      await refreshStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Błąd generowania";
      setError(message);
      appendLog(message, "err");
      setProgress((prev) => ({ ...prev, active: false }));
    } finally {
      setRunning(false);
    }
  }

  const estimatedArticles =
    mode === "target"
      ? targetArticles
      : runs * (stats?.articlesPerBatch ?? 4);

  const showProgress = running || (progress.percent > 0 && progress.articlesPublished > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-violet-700">Panel lokalny</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Generowanie artykułów
        </h1>
        <p className="text-zinc-500">
          Odpal batch z Maca na lokalny model (Ollama). Vercel tylko robi ingest.
        </p>
      </header>

      {loading && <p className="text-sm text-zinc-400">Ładowanie statusu…</p>}

      {stats && (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard label="AI provider" value={stats.aiSetup} />
          <StatCard
            label="Kolejka pending"
            value={String(stats.rawItems.pending)}
            hint={`processing: ${stats.rawItems.processing}, failed: ${stats.rawItems.failed}`}
          />
          <StatCard
            label="Artykułów na batch"
            value={`~${stats.articlesPerBatch}`}
            hint="zależy od dostępnych pending i walidacji"
          />
          <StatCard label="Model" value={stats.aiModel} />
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Nowe generowanie</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          <ModeButton
            active={mode === "target"}
            onClick={() => setMode("target")}
            label="Liczba artykułów"
          />
          <ModeButton
            active={mode === "runs"}
            onClick={() => setMode("runs")}
            label="Liczba batchy"
          />
        </div>

        <div className="mt-4">
          {mode === "target" ? (
            <label className="block space-y-2">
              <span className="text-sm text-zinc-600">Ile artykułów wygenerować (orientacyjnie)</span>
              <input
                type="number"
                min={1}
                max={80}
                value={targetArticles}
                onChange={(e) => setTargetArticles(Number(e.target.value))}
                disabled={running}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-zinc-900"
              />
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm text-zinc-600">Ile batchy odpalić (1 batch ≈ 4 artykuły)</span>
              <input
                type="number"
                min={1}
                max={20}
                value={runs}
                onChange={(e) => setRuns(Number(e.target.value))}
                disabled={running}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-zinc-900"
              />
            </label>
          )}
          <p className="mt-2 text-sm text-zinc-400">
            Szacunek: ~{estimatedArticles} artykułów. Czas lokalnie: ~5–8 min / artykuł.
          </p>
        </div>

        {showProgress && (
          <GenerationProgress
            progress={progress}
            running={running}
            estimatedArticles={estimatedArticles}
          />
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startGeneration()}
            disabled={running || loading}
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {running ? "Generuję…" : "Start generowania"}
          </button>
          <button
            type="button"
            onClick={() => void refreshStats()}
            disabled={running}
            className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Odśwież status
          </button>
        </div>

        {summary && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {summary}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {logs.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-sm text-zinc-100">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Log
          </h2>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {logs.map((line) => (
              <p
                key={line.id}
                className={
                  line.tone === "ok"
                    ? "text-emerald-400"
                    : line.tone === "err"
                      ? "text-red-400"
                      : line.tone === "muted"
                        ? "text-zinc-400"
                        : "text-zinc-200"
                }
              >
                {line.text}
              </p>
            ))}
          </div>
        </section>
      )}

      {stats?.recentJobs && stats.recentJobs.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Ostatnie joby</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600">
            {stats.recentJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 py-2">
                <span>
                  {job.job_type} · {job.status} · {job.items_processed} szt.
                </span>
                <span className="text-zinc-400">
                  {new Date(job.started_at).toLocaleString("pl-PL")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function computePercent(
  articlesPublished: number,
  articlesTarget: number,
  tasksDoneInBatch: number,
  tasksInBatch: number,
  runsTotal: number,
  runCurrent: number,
  taskInProgress: boolean,
): number {
  const target = Math.max(articlesTarget, 1);
  const fromArticles = (articlesPublished / target) * 100;

  if (runsTotal <= 0 || tasksInBatch <= 0) {
    return Math.min(99, fromArticles);
  }

  const runWeight = 100 / runsTotal;
  const completedRuns = Math.max(0, runCurrent - 1);
  const batchProgress =
    (tasksDoneInBatch + (taskInProgress ? 0.35 : 0)) / tasksInBatch;
  const fromRuns =
    completedRuns * runWeight + batchProgress * runWeight;

  return Math.min(99, Math.max(fromArticles, fromRuns));
}

function GenerationProgress({
  progress,
  running,
  estimatedArticles,
}: {
  progress: ProgressState;
  running: boolean;
  estimatedArticles: number;
}) {
  const target = progress.articlesTarget || estimatedArticles;
  const isActive = running && progress.active;

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
            Postęp
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {progress.articlesPublished}
            <span className="text-lg font-normal text-zinc-400">
              {" "}
              / {target} artykułów
            </span>
          </p>
        </div>
        <div className="text-right text-sm text-zinc-500">
          {progress.runCurrent > 0 && (
            <p>
              Batch {progress.runCurrent}/{progress.runsTotal || "?"}
            </p>
          )}
          <p className="tabular-nums">{progress.tokensUsed.toLocaleString("pl-PL")} tokenów</p>
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-violet-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-600 transition-[width] duration-700 ease-out ${
            isActive ? "shadow-[0_0_12px_rgba(139,92,246,0.45)]" : ""
          }`}
          style={{ width: `${Math.max(progress.percent, isActive ? 4 : 0)}%` }}
        />
        {isActive && (
          <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
        )}
      </div>

      <p className="text-sm text-zinc-600">
        {isActive && progress.currentTitle ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
              </span>
              Tworzę{" "}
              <span className="font-medium text-zinc-900">
                {kindLabel(progress.currentKind ?? "artykuł")}
              </span>
              :
            </span>{" "}
            <span className="text-zinc-800">{truncateTitle(progress.currentTitle)}</span>
          </>
        ) : running ? (
          "Przygotowuję kolejny batch…"
        ) : (
          "Generowanie zakończone."
        )}
      </p>

      {progress.batchTasks.length > 0 && (
        <ul className="space-y-2">
          {progress.batchTasks.map((task, i) => (
            <li
              key={`${task.title}-${i}`}
              className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm"
            >
              <TaskIcon status={task.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-medium ${
                    task.status === "active"
                      ? "text-violet-900"
                      : task.status === "done"
                        ? "text-emerald-800"
                        : task.status === "skipped"
                          ? "text-zinc-400 line-through"
                          : "text-zinc-700"
                  }`}
                >
                  {truncateTitle(task.title, 64)}
                </p>
                <p className="text-xs text-zinc-400">{kindLabel(task.kind)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskIcon({ status }: { status: TaskStatus }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.25 8a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.54-7.29a1 1 0 011.42 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path d="M5.5 5.5a.75.75 0 011.06 0L10 8.94l3.44-3.44a.75.75 0 111.06 1.06L11.06 10l3.44 3.44a.75.75 0 11-1.06 1.06L10 11.06l-3.44 3.44a.75.75 0 11-1.06-1.06L8.94 10 5.5 6.56a.75.75 0 010-1.06z" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50" />
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-zinc-900">{value}</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-violet-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
