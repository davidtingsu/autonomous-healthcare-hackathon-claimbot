import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resumeInsuranceReview } from "@/lib/graph/claim-workflow";
import { getClaimById, getClaimWithUserById } from "@/lib/graph/events";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { getDb, schema } from "@/lib/db";

export const maxDuration = 60;

const { insuranceClaims } = schema;

const schemaBody = z.object({
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
    const { action } = schemaBody.parse(await request.json());
    const claim = await getClaimById(id);
    const db = getDb();

    const [insuranceClaim] = await db
      .select()
      .from(insuranceClaims)
      .where(eq(insuranceClaims.claim_request_id, id))
      .orderBy(desc(insuranceClaims.created_at))
      .limit(1);

    if (!insuranceClaim || insuranceClaim.status !== "created") {
      return NextResponse.json(
        { error: "No pending insurance claim found" },
        { status: 400 }
      );
    }

    await resumeInsuranceReview(claim.graph_thread_id, action);
    const updated = await getClaimWithUserById(id);
    return NextResponse.json({ claim: updated, insuranceClaim });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
