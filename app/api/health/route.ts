import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "@/lib/db/client";

/** Lightweight health check — do not query Neon (avoids waking compute). */
export async function GET() {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({
      status: "degraded",
      message: "Database not configured",
    });
  }

  return NextResponse.json({ status: "ok" });
}
