import { NextResponse } from "next/server";
import { z } from "zod";
import { emitEvent, updateClaimStatus } from "@/lib/graph/events";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const maxDuration = 60;

const benefitsPatchSchema = z.object({
  userId: z.string().uuid().optional(),
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
});

const userPatchSchema = z.object({
  claimedAmount: z.number().positive().optional(),
  serviceDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  userId: z.string().uuid().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = requireActor(request, ["user", "benefits_company"]);
  if (role instanceof NextResponse) return role;

  try {
    const supabase = createSupabaseServerClient();
    const body = await request.json();

    const { data: existing, error: fetchError } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    if (role === "benefits_company") {
      const parsed = benefitsPatchSchema.parse(body);
      const updates = {
        ...(parsed.userId ? { user_id: parsed.userId } : {}),
        ...(parsed.claimedAmount ? { claimed_amount: parsed.claimedAmount } : {}),
        ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
      };
      const { data, error } = await supabase
        .from("claim_requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await emitEvent(supabase, id, "benefits_updated_claim", "benefits_company", updates);
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
      ...(parsed.claimedAmount ? { claimed_amount: parsed.claimedAmount } : {}),
      ...(parsed.serviceDate ? { service_date: parsed.serviceDate } : {}),
      ...(parsed.receiptUrl !== undefined ? { receipt_url: parsed.receiptUrl } : {}),
      status: "created" as const,
    };

    const { data, error } = await supabase
      .from("claim_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("claim_request_id", id)
      .eq("type", "revision_requested");

    await emitEvent(supabase, id, "claim_created", "user", { revision: true });
    await updateClaimStatus(supabase, id, "created");

    await runBenefitsReview(
      supabase,
      {
        claimRequestId: id,
        userId: data.user_id,
        claimedAmount: Number(data.claimed_amount),
        serviceDate: data.service_date,
        claimStatus: "created",
        receiptUrl: data.receipt_url,
      },
      data.graph_thread_id
    );

    const { data: refreshed } = await supabase
      .from("claim_requests")
      .select("*, users(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({ claim: refreshed });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
