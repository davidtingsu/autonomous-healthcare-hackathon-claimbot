import { NextResponse } from "next/server";
import { listEvents } from "@/lib/graph/events";
import { errorResponse } from "@/lib/api/helpers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const claimId = url.searchParams.get("claimId");
    const events = await listEvents(200, claimId);
    return NextResponse.json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}
