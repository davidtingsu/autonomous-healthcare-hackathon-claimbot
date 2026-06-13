import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const url = new URL(request.url);
    const claimId = url.searchParams.get("claimId");

    let query = supabase
      .from("claim_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (claimId) query = query.eq("claim_request_id", claimId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
