import type { ClaimRequest, InsuranceClaimStatus } from "@/lib/types";

export type ClaimDisplayStatus =
  | ClaimRequest["status"]
  | Extract<InsuranceClaimStatus, "approved" | "denied">;

export function getClaimInsuranceDecision(
  claim: Pick<ClaimRequest, "insurance_claim">
): "approved" | "denied" | null {
  const status = claim.insurance_claim?.status;
  if (status === "approved" || status === "denied") return status;
  return null;
}

/** Status label for UI: insurance approved/denied overrides claim request status when set. */
export function getClaimDisplayStatus(claim: ClaimRequest): ClaimDisplayStatus {
  const decision = getClaimInsuranceDecision(claim);
  if (decision) return decision;
  return claim.status;
}

export function claimDisplayStatusLabel(status: ClaimDisplayStatus): string {
  return status.replace(/_/g, " ");
}
