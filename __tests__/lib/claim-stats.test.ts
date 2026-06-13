import { describe, expect, it } from "vitest";
import {
  computeClaimAggregateStats,
  formatClaimAmount,
} from "@/lib/claim-stats";
import type { ClaimRequest } from "@/lib/types";

function claim(
  amount: number,
  insuranceStatus?: "created" | "approved" | "denied"
): ClaimRequest {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    claimed_amount: amount,
    service_date: "2024-01-01",
    receipt_url: null,
    receipt_extracted_patient_name: null,
    receipt_extracted_amount: null,
    receipt_extracted_date: null,
    status: "submitted",
    graph_thread_id: "t1",
    created_at: "",
    updated_at: "",
    insurance_claim: insuranceStatus
      ? {
          id: "i1",
          claim_request_id: "c1",
          claimed_amount: amount,
          service_date: "2024-01-01",
          status: insuranceStatus,
          created_at: "",
          updated_at: "",
        }
      : null,
  };
}

describe("computeClaimAggregateStats", () => {
  it("sums claim count, total claimed, and approved amounts", () => {
    const stats = computeClaimAggregateStats([
      claim(100, "approved"),
      claim(200, "denied"),
      claim(50),
    ]);

    expect(stats.claimCount).toBe(3);
    expect(stats.totalClaimedAmount).toBe(350);
    expect(stats.approvedClaimedAmount).toBe(100);
  });
});

describe("formatClaimAmount", () => {
  it("formats USD currency", () => {
    expect(formatClaimAmount(1500)).toBe("$1,500.00");
  });
});
