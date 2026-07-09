import { NextRequest, NextResponse } from "next/server";
import { describeAiSetup, getAiProvider, getAiModel } from "@/lib/ai/client";
import { ARTICLES_PER_BATCH } from "@/lib/generation/batch-runner";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/db/supabase";
import { getLatestJobStatus } from "@/lib/db/queries";
import {
  isLocalPanelEnabled,
  isLocalPanelRequest,
  localPanelDisabledResponse,
  localPanelForbiddenResponse,
} from "@/lib/utils/local-panel";

export async function GET(request: NextRequest) {
  if (!isLocalPanelEnabled()) return localPanelDisabledResponse();
  if (!isLocalPanelRequest(request)) return localPanelForbiddenResponse();

  let pending = 0;
  let processing = 0;
  let failed = 0;

  if (hasSupabaseConfig()) {
    const sb = getSupabaseAdmin();
    const [pendingRes, processingRes, failedRes] = await Promise.all([
      sb.from("raw_items").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("raw_items").select("*", { count: "exact", head: true }).eq("status", "processing"),
      sb.from("raw_items").select("*", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    pending = pendingRes.count ?? 0;
    processing = processingRes.count ?? 0;
    failed = failedRes.count ?? 0;
  }

  const jobs = await getLatestJobStatus();

  return NextResponse.json({
    enabled: true,
    aiProvider: getAiProvider(),
    aiModel: getAiModel(),
    aiSetup: describeAiSetup(),
    articlesPerBatch: ARTICLES_PER_BATCH,
    rawItems: { pending, processing, failed },
    recentJobs: jobs,
  });
}
