import { NextResponse } from "next/server";
import { resumeBenefitsReview } from "@/lib/graph/claim-workflow";
import { getClaimById, getClaimWithUserById } from "@/lib/graph/events";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { z } from "zod";

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
    const { action } = schema.parse(await request.json());
    const claim = await getClaimById(id);

    if (claim.status !== "reviewing") {
      return NextResponse.json(
        { error: "Claim is not in reviewing status" },
        { status: 400 }
      );
    }

    await resumeBenefitsReview(claim.graph_thread_id, action);
    const updated = await getClaimWithUserById(id);
    return NextResponse.json({ claim: updated });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
