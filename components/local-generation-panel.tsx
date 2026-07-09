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

  async function startGeneration() {
    if (running) return;
    setRunning(true);
    setSummary(null);
    setError(null);
    setLogs([]);

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
          const event = JSON.parse(line) as {
            type: string;
            run?: number;
            total?: number;
            ai?: string;
            result?: { generated: number; tokensUsed: number };
            summary?: { totalGenerated: number; totalTokens: number; runsCompleted: number };
            message?: string;
          };

          if (event.type === "start") {
            appendLog(`AI: ${event.ai}`, "muted");
          } else if (event.type === "run_start") {
            appendLog(`Batch ${event.run}/${event.total}…`);
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
    } finally {
      setRunning(false);
    }
  }

  const estimatedArticles =
    mode === "target"
      ? targetArticles
      : runs * (stats?.articlesPerBatch ?? 4);

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
