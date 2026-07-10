/** Block ingest/generate when shutting down. Override with PROJECT_SHUTDOWN=false locally. */
export function isProjectShutdown(): boolean {
  if (process.env.PROJECT_SHUTDOWN === "false") return false;
  if (process.env.PROJECT_SHUTDOWN === "true") return true;
  return process.env.VERCEL_ENV === "production";
}

export function projectShutdownResponse() {
  return Response.json(
    { ok: false, shutdown: true, reason: "Tideway project discontinued" },
    { status: 410 },
  );
}
