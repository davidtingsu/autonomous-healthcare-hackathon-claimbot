import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readReceiptFromFormData } from "@/lib/api/receipt-upload";
import {
  emitEvent,
  getClaimById,
  getClaimWithUserById,
  updateClaimStatus,
} from "@/lib/graph/events";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { revalidateClaimReceipt } from "@/lib/graph/receipt-revalidation";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { getDb, schema } from "@/lib/db";
import { userIdSchema } from "@/lib/validation";

export const maxDuration = 60;

const { claimRequests, notifications } = schema;

const benefitsPatchSchema = z.object({
  userId: userIdSchema.optional(),
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
});

const userPatchSchema = z.object({
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  userId: userIdSchema.optional(),
});

async function parsePatchBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const receiptUrl = await readReceiptFromFormData(form);
    const userIdRaw = form.get("userId");
    const amountRaw = form.get("claimedAmount");
    const dateRaw = form.get("serviceDate");

    return {
      userId: userIdRaw ? userIdSchema.parse(String(userIdRaw)) : undefined,
      claimedAmount: amountRaw ? Number(amountRaw) : undefined,
      serviceDate: dateRaw ? String(dateRaw) : undefined,
      receiptUrl: receiptUrl ?? undefined,
    };
  }

  return request.json();
}

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
    const body = await parsePatchBody(request);

    if (role === "benefits_company") {
      const parsed = benefitsPatchSchema.parse(body);

      if (
        parsed.receiptUrl &&
        existing.status !== "reviewing" &&
        existing.status !== "revision_requested"
      ) {
        return NextResponse.json(
          { error: "Receipt can only be replaced during review or revision" },
          { status: 400 }
        );
      }

      const updates = {
        ...(parsed.userId ? { user_id: parsed.userId } : {}),
        ...(parsed.claimedAmount
          ? { claimed_amount: String(parsed.claimedAmount) }
          : {}),
        ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
        ...(parsed.receiptUrl !== undefined
          ? { receipt_url: parsed.receiptUrl }
          : {}),
        updated_at: new Date(),
      };

      const [data] = await db
        .update(claimRequests)
        .set(updates)
        .where(eq(claimRequests.id, id))
        .returning();

      if (!data) throw new Error("Failed to update claim");

      await emitEvent(id, "benefits_updated_claim", "benefits_company", updates);

      if (parsed.receiptUrl && existing.status === "reviewing") {
        await revalidateClaimReceipt(id);
      }

      const refreshed = await getClaimWithUserById(id);
      return NextResponse.json({ claim: refreshed });
    }

    const parsed = userPatchSchema.parse(body);
    if (
      existing.status !== "revision_requested" &&
      existing.status !== "created"
    ) {
      return NextResponse.json(
        { error: "Claim is not editable in current status" },
        { status: 400 }
      );
    }

    const updates = {
      ...(parsed.userId ? { user_id: parsed.userId } : {}),
      ...(parsed.claimedAmount
        ? { claimed_amount: String(parsed.claimedAmount) }
        : {}),
      ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
      ...(parsed.receiptUrl !== undefined
        ? { receipt_url: parsed.receiptUrl }
        : {}),
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
