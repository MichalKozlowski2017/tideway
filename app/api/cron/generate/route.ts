import { NextRequest, NextResponse } from "next/server";
import {
  finishJob,
  generatePendingArticles,
  getGenerationBudgetStatus,
  startJob,
} from "@/lib/ai/generate";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { cronAiDisabledResponse, isCronAiEnabled } from "@/lib/utils/cron-ai";
import { isProjectShutdown, projectShutdownResponse } from "@/lib/utils/shutdown";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (isProjectShutdown()) return projectShutdownResponse();
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCronAiEnabled()) {
    return cronAiDisabledResponse();
  }

  const budget = await getGenerationBudgetStatus();
  if (budget.exceeded) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "daily_token_budget",
      tokensUsedToday: budget.tokensUsedToday,
      tokenBudget: budget.tokenBudget,
    });
  }

  const job = await startJob("generate");
  if (!job) {
    return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
  }

  try {
    const result = await generatePendingArticles();
    const { generated, tokensUsed, aiProvider, aiModel } = result;
    await finishJob(job.id, "completed", generated, tokensUsed);
    return NextResponse.json({ ok: true, generated, tokensUsed, aiProvider, aiModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", 0, 0, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
