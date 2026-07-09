import { NextResponse } from "next/server";

/** Set CRON_AI_ENABLED=false on Vercel to block OpenAI/local AI cron jobs in prod. */
export function isCronAiEnabled(): boolean {
  return process.env.CRON_AI_ENABLED !== "false";
}

export function cronAiDisabledResponse() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "AI cron disabled (CRON_AI_ENABLED=false)",
  });
}
