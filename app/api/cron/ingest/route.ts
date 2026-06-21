import { NextRequest, NextResponse } from "next/server";
import { ingestAllSources } from "@/lib/sources/ingest";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { finishJob, startJob } from "@/lib/ai/generate";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await startJob("ingest");
  if (!job) {
    return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
  }

  try {
    const result = await ingestAllSources();
    await finishJob(job.id, "completed", result.inserted, 0);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", 0, 0, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
