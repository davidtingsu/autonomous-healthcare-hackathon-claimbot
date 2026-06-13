import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emitEvent,
  getClaimWithUserById,
  listClaimsWithUsers,
  listEvents,
} from "@/lib/graph/events";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { getDb, schema } from "@/lib/db";
import { userIdSchema } from "@/lib/validation";
import type { ClaimEvent } from "@/lib/types";

export const maxDuration = 60;

const { claimRequests } = schema;

export async function GET() {
  try {
    const claims = await listClaimsWithUsers();
    const events = await listEvents();

    const latestEventByClaim = new Map<string, ClaimEvent>();
    for (const event of events) {
      if (!latestEventByClaim.has(event.claim_request_id)) {
        latestEventByClaim.set(event.claim_request_id, event);
      }
    }

    return NextResponse.json({
      claims: claims.map((claim) => ({
        ...claim,
        latestEvent: latestEventByClaim.get(claim.id) ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const role = requireActor(request, ["user"]);
  if (role instanceof NextResponse) return role;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let userId: string;
    let claimedAmount: number;
    let serviceDate: string;
    let receiptUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      userId = userIdSchema.parse(String(form.get("userId")));
      claimedAmount = Number(form.get("claimedAmount"));
      serviceDate = String(form.get("serviceDate"));
      const file = form.get("receipt");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { error: "Receipt file is required" },
          { status: 400 }
        );
      }
      const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      if (mime !== "application/pdf" && !mime.startsWith("image/")) {
        return NextResponse.json(
          { error: "Receipt must be an image or PDF" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      receiptUrl = `data:${mime};base64,${base64}`;
    } else {
      const body = z
        .object({
          userId: userIdSchema,
          claimedAmount: z.number().positive(),
          serviceDate: z.string(),
          receiptUrl: z.string().optional().nullable(),
        })
        .parse(await request.json());
      userId = body.userId;
      claimedAmount = body.claimedAmount;
      serviceDate = body.serviceDate;
      receiptUrl = body.receiptUrl ?? null;
      if (!receiptUrl) {
        return NextResponse.json(
          { error: "Receipt file is required" },
          { status: 400 }
        );
      }
    }

    const threadId = crypto.randomUUID();
    const db = getDb();
    const [claim] = await db
      .insert(claimRequests)
      .values({
        user_id: userId,
        claimed_amount: String(claimedAmount),
        service_date: serviceDate,
        receipt_url: receiptUrl,
        status: "created",
        graph_thread_id: threadId,
      })
      .returning();

    if (!claim) throw new Error("Failed to create claim");

    await emitEvent(claim.id, "claim_created", "user", {
      claimedAmount,
      serviceDate,
    });

    await runBenefitsReview(
      {
        claimRequestId: claim.id,
        userId,
        claimedAmount,
        serviceDate,
        claimStatus: "created",
        receiptUrl,
      },
      threadId
    );

    const updated = await getClaimWithUserById(claim.id);

    return NextResponse.json({ claim: updated }, { status: 201 });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
