import { describeAiSetup, getAiProvider, getAiModel } from "@/lib/ai/client";
import { generatePendingArticles } from "@/lib/ai/generate";

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

export type GenerateProgressEvent =
  | { type: "start"; runs: number; ai: string }
  | { type: "run_start"; run: number; total: number }
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
  });

  for (let i = 0; i < runs; i += 1) {
    options.onEvent?.({ type: "run_start", run: i + 1, total: runs });

    const result = await generatePendingArticles();
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
