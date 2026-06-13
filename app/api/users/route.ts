import { NextResponse } from "next/server";
import { listUsers } from "@/lib/graph/events";
import { errorResponse } from "@/lib/api/helpers";

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}
