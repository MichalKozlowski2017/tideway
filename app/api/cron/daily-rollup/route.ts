import { NextRequest, NextResponse } from "next/server";
import {
  finishJob,
  generateDigest,
  startJob,
} from "@/lib/ai/generate";
import { activeLocales } from "@/lib/i18n/config";
import { MAIN_CATEGORIES } from "@/lib/types";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { cronAiDisabledResponse, isCronAiEnabled } from "@/lib/utils/cron-ai";

const LOCALES = activeLocales;
const CATEGORIES = MAIN_CATEGORIES;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCronAiEnabled()) {
    return cronAiDisabledResponse();
  }

  const job = await startJob("daily-rollup");
  if (!job) {
    return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
  }

  try {
    let created = 0;
    for (const locale of LOCALES) {
      for (const category of CATEGORIES) {
        const article = await generateDigest(locale, "daily", category);
        if (article) created += 1;
      }
    }
    await finishJob(job.id, "completed", created, 0);
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", 0, 0, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
