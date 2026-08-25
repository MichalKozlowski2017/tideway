/** Opt-in kill switch for ingest/generate. Set PROJECT_SHUTDOWN=true to block jobs. */
export function isProjectShutdown(): boolean {
  return process.env.PROJECT_SHUTDOWN === "true";
}

export function projectShutdownResponse() {
  return Response.json(
    { ok: false, shutdown: true, reason: "Tideway project discontinued" },
    { status: 410 },
  );
}
