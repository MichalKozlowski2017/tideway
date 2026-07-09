import { NextRequest } from "next/server";

export function isLocalPanelEnabled(): boolean {
  return process.env.LOCAL_PANEL_ENABLED === "true";
}

/** Allow panel only when explicitly enabled and request is from local network. */
export function isLocalPanelRequest(request: NextRequest | Request): boolean {
  if (!isLocalPanelEnabled()) return false;

  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const forwarded = request.headers.get("x-forwarded-host") ?? "";
  return (
    forwarded.startsWith("localhost") ||
    forwarded.startsWith("127.0.0.1") ||
    forwarded.startsWith("192.168.")
  );
}

export function localPanelDisabledResponse() {
  return new Response(JSON.stringify({ error: "Local panel disabled" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function localPanelForbiddenResponse() {
  return new Response(JSON.stringify({ error: "Local panel only on localhost/LAN" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
