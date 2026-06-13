import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";
import { getCompiledGraph } from "@/lib/graph/claim-workflow";
import { getClaimById } from "@/lib/graph/events";
import { errorResponse, requireActor } from "@/lib/api/helpers";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = requireActor(_request, ["benefits_company"]);
  if (role instanceof NextResponse) return role;

  try {
    const { id } = await params;
    const claim = await getClaimById(id);
    const graph = getCompiledGraph();
    const stream = await graph.stream(
      {
        claimRequestId: claim.id,
        userId: claim.user_id,
        claimedAmount: Number(claim.claimed_amount),
        serviceDate: String(claim.service_date),
        claimStatus: claim.status,
        receiptUrl: claim.receipt_url,
      },
      {
        configurable: { thread_id: claim.graph_thread_id },
        streamMode: ["values", "custom"],
      }
    );

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
