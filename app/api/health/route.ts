import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/db/supabase";
import { getLatestJobStatus } from "@/lib/db/queries";

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({
        status: "degraded",
        message: "Supabase not configured",
      });
    }

    const jobs = await getLatestJobStatus();
    return NextResponse.json({ status: "ok", jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
