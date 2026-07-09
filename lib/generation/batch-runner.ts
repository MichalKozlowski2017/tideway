import { describeAiSetup, getAiProvider, getAiModel } from "@/lib/ai/client";
import {
  generatePendingArticles,
  type GeneratePendingProgressEvent,
} from "@/lib/ai/generate";

export const ARTICLES_PER_BATCH = 4;

export type GenerateBatchResult = Awaited<ReturnType<typeof generatePendingArticles>>;

export type GenerateRunSummary = {
  runsRequested: number;
  runsCompleted: number;
  totalGenerated: number;
  totalTokens: number;
  aiProvider: string;
  aiModel: string;
  runResults: GenerateBatchResult[];
};

type RunScopedProgress = GeneratePendingProgressEvent & {
  run: number;
  totalRuns: number;
  articlesTotal: number;
  tokensTotal: number;
};

export type GenerateProgressEvent =
  | { type: "start"; runs: number; ai: string; estimatedArticles: number }
  | { type: "run_start"; run: number; total: number }
  | RunScopedProgress
  | { type: "run_done"; run: number; result: GenerateBatchResult }
  | { type: "done"; summary: GenerateRunSummary }
  | { type: "error"; message: string };

export async function runGenerateBatches(options: {
  runs: number;
  onEvent?: (event: GenerateProgressEvent) => void;
}): Promise<GenerateRunSummary> {
  const runs = Math.max(1, Math.min(20, Math.floor(options.runs)));
  const runResults: GenerateBatchResult[] = [];
  let totalGenerated = 0;
  let totalTokens = 0;

  options.onEvent?.({
    type: "start",
    runs,
    ai: describeAiSetup(),
    estimatedArticles: runs * ARTICLES_PER_BATCH,
  });

  for (let i = 0; i < runs; i += 1) {
    options.onEvent?.({ type: "run_start", run: i + 1, total: runs });

    let runArticles = 0;
    let runTokens = 0;

    const result = await generatePendingArticles({
      onProgress: (event) => {
        if (event.type === "task_done") {
          runTokens += event.tokensUsed;
          if (event.published) runArticles += 1;
        }
        if (event.type === "backup_done") {
          runTokens += event.tokensUsed;
          if (event.published) runArticles += 1;
        }
        options.onEvent?.({
          ...event,
          run: i + 1,
          totalRuns: runs,
          articlesTotal: totalGenerated + runArticles,
          tokensTotal: totalTokens + runTokens,
        });
      },
    });
    runResults.push(result);
    totalGenerated += result.generated;
    totalTokens += result.tokensUsed;

    options.onEvent?.({ type: "run_done", run: i + 1, result });

    if (result.generated === 0) break;
  }

  const summary: GenerateRunSummary = {
    runsRequested: runs,
    runsCompleted: runResults.length,
    totalGenerated,
    totalTokens,
    aiProvider: getAiProvider(),
    aiModel: getAiModel(),
    runResults,
  };

  options.onEvent?.({ type: "done", summary });
  return summary;
}

export function runsForTargetArticles(target: number): number {
  return Math.max(1, Math.ceil(target / ARTICLES_PER_BATCH));
}
