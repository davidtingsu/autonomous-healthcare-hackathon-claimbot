import { NextResponse } from "next/server";
import { z } from "zod";
import { emitEvent } from "@/lib/graph/events";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { ClaimEvent } from "@/lib/types";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: claims, error } = await supabase
      .from("claim_requests")
      .select("*, users(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: events } = await supabase
      .from("claim_events")
      .select("*")
      .order("created_at", { ascending: false });

    const latestEventByClaim = new Map<string, ClaimEvent>();
    for (const event of events ?? []) {
      if (!latestEventByClaim.has(event.claim_request_id)) {
        latestEventByClaim.set(event.claim_request_id, event);
      }
    }

    return NextResponse.json({
      claims: (claims ?? []).map((c) => ({
        ...c,
        latestEvent: latestEventByClaim.get(c.id) ?? null,
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
    const supabase = createSupabaseServerClient();
    const contentType = request.headers.get("content-type") ?? "";
    let userId: string;
    let claimedAmount: number;
    let serviceDate: string;
    let receiptUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      userId = String(form.get("userId"));
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
          userId: z.string().uuid(),
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
    const { data: claim, error } = await supabase
      .from("claim_requests")
      .insert({
        user_id: userId,
        claimed_amount: claimedAmount,
        service_date: serviceDate,
        receipt_url: receiptUrl,
        status: "created",
        graph_thread_id: threadId,
      })
      .select()
      .single();

    if (error) throw error;

    await emitEvent(supabase, claim.id, "claim_created", "user", {
      claimedAmount,
      serviceDate,
    });

    await runBenefitsReview(
      supabase,
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

    const { data: updated } = await supabase
      .from("claim_requests")
      .select("*, users(*)")
      .eq("id", claim.id)
      .single();

    return NextResponse.json({ claim: updated }, { status: 201 });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
