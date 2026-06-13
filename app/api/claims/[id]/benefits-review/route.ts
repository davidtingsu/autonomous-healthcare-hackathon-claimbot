import { NextResponse } from "next/server";
import { z } from "zod";
import { resumeBenefitsReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const maxDuration = 60;

const schema = z.object({
  action: z.enum(["revise", "submit", "cancel"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = requireActor(request, ["benefits_company"]);
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
    if (claim.status !== "reviewing") {
      return NextResponse.json(
        { error: "Claim is not in reviewing status" },
        { status: 400 }
      );
    }

    await resumeBenefitsReview(supabase, claim.graph_thread_id, action);

    const { data: updated } = await supabase
      .from("claim_requests")
      .select("*, users(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({ claim: updated });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
