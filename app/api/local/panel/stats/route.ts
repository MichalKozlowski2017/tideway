import { NextRequest, NextResponse } from "next/server";
import { describeAiSetup, getAiProvider, getAiModel } from "@/lib/ai/client";
import { ARTICLES_PER_BATCH } from "@/lib/generation/batch-runner";
import { getSql, hasDatabaseConfig } from "@/lib/db/client";
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

  if (hasDatabaseConfig()) {
    const sql = getSql();
    const [pendingRows, processingRows, failedRows] = await Promise.all([
      sql.query(
        `SELECT count(*)::int AS count FROM raw_items WHERE status = $1`,
        ["pending"],
      ),
      sql.query(
        `SELECT count(*)::int AS count FROM raw_items WHERE status = $1`,
        ["processing"],
      ),
      sql.query(
        `SELECT count(*)::int AS count FROM raw_items WHERE status = $1`,
        ["failed"],
      ),
    ]);
    pending = (pendingRows[0] as { count: number } | undefined)?.count ?? 0;
    processing =
      (processingRows[0] as { count: number } | undefined)?.count ?? 0;
    failed = (failedRows[0] as { count: number } | undefined)?.count ?? 0;
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
