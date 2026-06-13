import { NextResponse } from "next/server";
import type { ActorRole } from "@/lib/types";

export function getActorRole(request: Request): ActorRole | null {
  const role = request.headers.get("X-Actor-Role");
  if (role === "user" || role === "benefits_company" || role === "insurance_company") {
    return role;
  }
  return null;
}

export function requireActor(
  request: Request,
  allowed: ActorRole[]
): ActorRole | NextResponse {
  const role = getActorRole(request);
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ error: "Invalid or missing X-Actor-Role" }, { status: 403 });
  }
  return role;
}

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status });
}
