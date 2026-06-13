import { NextResponse } from "next/server";
import { z } from "zod";
import { resumeInsuranceReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const maxDuration = 60;

const schema = z.object({
  action: z.enum(["approve", "deny"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = requireActor(request, ["insurance_company"]);
  if (role instanceof NextResponse) return role;

  try {
    const supabase = createSupabaseServerClient();
    const { action } = schema.parse(await request.json());

    const { data: claim, error } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;

    const { data: insuranceClaim } = await supabase
      .from("insurance_claims")
      .select("*")
      .eq("claim_request_id", id)
      .eq("status", "created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!insuranceClaim) {
      return NextResponse.json(
        { error: "No pending insurance claim found" },
        { status: 400 }
      );
    }

    await resumeInsuranceReview(supabase, claim.graph_thread_id, action);

    const { data: updated } = await supabase
      .from("claim_requests")
      .select("*, users(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({ claim: updated, insuranceClaim });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
