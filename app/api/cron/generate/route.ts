import { NextRequest, NextResponse } from "next/server";
import {
  finishJob,
  generatePendingArticles,
  startJob,
} from "@/lib/ai/generate";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await startJob("generate");
  if (!job) {
    return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
  }

  try {
    const { generated, tokensUsed } = await generatePendingArticles();
    await finishJob(job.id, "completed", generated, tokensUsed);
    return NextResponse.json({ ok: true, generated, tokensUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", 0, 0, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
