import type { ClaimRequest } from "@/lib/types";

export type ClaimAggregateStats = {
  claimCount: number;
  totalClaimedAmount: number;
  approvedClaimedAmount: number;
};

export function computeClaimAggregateStats(
  claims: ClaimRequest[]
): ClaimAggregateStats {
  let totalClaimedAmount = 0;
  let approvedClaimedAmount = 0;

  for (const claim of claims) {
    const amount = Number(claim.claimed_amount);
    if (!Number.isNaN(amount)) {
      totalClaimedAmount += amount;
    }
    if (claim.insurance_claim?.status === "approved") {
      approvedClaimedAmount += Number.isNaN(amount) ? 0 : amount;
    }
  }

  return {
    claimCount: claims.length,
    totalClaimedAmount,
    approvedClaimedAmount,
  };
}

export function formatClaimAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
