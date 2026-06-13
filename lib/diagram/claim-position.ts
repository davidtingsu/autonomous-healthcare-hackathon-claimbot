import { EVENT_TO_NODE } from "@/lib/types";
import type { ClaimEvent, ClaimRequest } from "@/lib/types";
import { STAGE_BY_ID, TERMINAL_STAGES } from "@/lib/diagram/nodes";

const STATUS_TO_STAGE: Record<string, string> = {
  created: "created",
  reviewing: "benefits_hitl",
  revision_requested: "revision",
  cancelled_for_submission: "cancelled",
  submitted: "submitted",
};

export function getClaimStage(
  claimId: string,
  events: ClaimEvent[],
  claim?: ClaimRequest
): string {
  const claimEvents = events
    .filter((event) => event.claim_request_id === claimId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  if (claimEvents.length > 0) {
    return EVENT_TO_NODE[claimEvents[0].event_type] ?? "created";
  }

  if (claim?.status) {
    return STATUS_TO_STAGE[claim.status] ?? "created";
  }

  return "created";
}

export type ClaimAtStage = {
  claim: ClaimRequest;
  stageId: string;
};

export function getClaimsByStage(
  claims: ClaimRequest[],
  events: ClaimEvent[]
): Map<string, ClaimRequest[]> {
  const grouped = new Map<string, ClaimRequest[]>();

  for (const claim of claims) {
    const stageId = getClaimStage(claim.id, events, claim);
    const list = grouped.get(stageId) ?? [];
    list.push(claim);
    grouped.set(stageId, list);
  }

  return grouped;
}

export function countActiveClaims(
  claims: ClaimRequest[],
  events: ClaimEvent[]
): number {
  return claims.filter((claim) => {
    const stage = getClaimStage(claim.id, events, claim);
    return !TERMINAL_STAGES.has(stage);
  }).length;
}

export function getTokenOffset(index: number, total: number): { x: number; y: number } {
  const baseY = 72;
  const spacing = 28;
  const center = (total - 1) / 2;
  return {
    x: (index - center) * spacing,
    y: baseY + Math.abs(index - center) * 8,
  };
}

export function isTerminalStage(stageId: string): boolean {
  return TERMINAL_STAGES.has(stageId);
}

export function getStageDef(stageId: string) {
  return STAGE_BY_ID[stageId];
}
