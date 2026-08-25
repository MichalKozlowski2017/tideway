import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "@/lib/db/client";
import { getLatestJobStatus } from "@/lib/db/queries";

export async function GET() {
  try {
    if (!hasDatabaseConfig()) {
      return NextResponse.json({
        status: "degraded",
        message: "Database not configured",
      });
    }

    const jobs = await getLatestJobStatus();
    return NextResponse.json({ status: "ok", jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
