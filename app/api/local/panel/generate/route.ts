import { NextRequest } from "next/server";
import {
  runGenerateBatches,
  runsForTargetArticles,
  type GenerateProgressEvent,
} from "@/lib/generation/batch-runner";
import {
  isLocalPanelEnabled,
  isLocalPanelRequest,
  localPanelDisabledResponse,
  localPanelForbiddenResponse,
} from "@/lib/utils/local-panel";

export const maxDuration = 3600;

export async function POST(request: NextRequest) {
  if (!isLocalPanelEnabled()) return localPanelDisabledResponse();
  if (!isLocalPanelRequest(request)) return localPanelForbiddenResponse();

  let runs = 2;
  try {
    const body = (await request.json()) as { runs?: number; targetArticles?: number };
    if (typeof body.runs === "number" && Number.isFinite(body.runs)) {
      runs = body.runs;
    } else if (
      typeof body.targetArticles === "number" &&
      Number.isFinite(body.targetArticles)
    ) {
      runs = runsForTargetArticles(body.targetArticles);
    }
  } catch {
    // default runs
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runGenerateBatches({
          runs,
          onEvent: send,
        });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
