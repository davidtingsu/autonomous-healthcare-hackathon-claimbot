import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emitEvent,
  getClaimById,
  getClaimWithUserById,
  updateClaimStatus,
} from "@/lib/graph/events";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { getDb, schema } from "@/lib/db";
import { userIdSchema } from "@/lib/validation";

export const maxDuration = 60;

const { claimRequests, notifications } = schema;

const benefitsPatchSchema = z.object({
  userId: userIdSchema.optional(),
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
});

const userPatchSchema = z.object({
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  userId: userIdSchema.optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = requireActor(request, ["user", "benefits_company"]);
  if (role instanceof NextResponse) return role;

  try {
    const existing = await getClaimById(id);
    const db = getDb();
    const body = await request.json();

    if (role === "benefits_company") {
      const parsed = benefitsPatchSchema.parse(body);
      const updates = {
        ...(parsed.userId ? { user_id: parsed.userId } : {}),
        ...(parsed.claimedAmount ? { claimed_amount: String(parsed.claimedAmount) } : {}),
        ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
        updated_at: new Date(),
      };

      const [data] = await db
        .update(claimRequests)
        .set(updates)
        .where(eq(claimRequests.id, id))
        .returning();

      if (!data) throw new Error("Failed to update claim");

      await emitEvent(id, "benefits_updated_claim", "benefits_company", updates);
      return NextResponse.json({ claim: data });
    }

    const parsed = userPatchSchema.parse(body);
    if (existing.status !== "revision_requested" && existing.status !== "created") {
      return NextResponse.json(
        { error: "Claim is not editable in current status" },
        { status: 400 }
      );
    }

    const updates = {
      ...(parsed.userId ? { user_id: parsed.userId } : {}),
      ...(parsed.claimedAmount ? { claimed_amount: String(parsed.claimedAmount) } : {}),
      ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
      ...(parsed.receiptUrl !== undefined ? { receipt_url: parsed.receiptUrl } : {}),
      status: "created" as const,
      updated_at: new Date(),
    };

    const [data] = await db
      .update(claimRequests)
      .set(updates)
      .where(eq(claimRequests.id, id))
      .returning();

    if (!data) throw new Error("Failed to update claim");

    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.claim_request_id, id),
          eq(notifications.type, "revision_requested")
        )
      );

    await emitEvent(id, "claim_created", "user", { revision: true });
    await updateClaimStatus(id, "created");

    await runBenefitsReview(
      {
        claimRequestId: id,
        userId: data.user_id,
        claimedAmount: Number(data.claimed_amount),
        serviceDate: String(data.service_date),
        claimStatus: "created",
        receiptUrl: data.receipt_url,
      },
      data.graph_thread_id
    );

    const refreshed = await getClaimWithUserById(id);
    return NextResponse.json({ claim: refreshed });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
