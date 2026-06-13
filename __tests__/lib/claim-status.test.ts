import { describe, expect, it } from "vitest";
import {
  claimDisplayStatusLabel,
  getClaimDisplayStatus,
  getClaimInsuranceDecision,
} from "@/lib/claim-status";
import type { ClaimRequest } from "@/lib/types";

function claim(overrides: Partial<ClaimRequest> = {}): ClaimRequest {
  return {
    id: "c1",
    user_id: "u1",
    claimed_amount: 100,
    service_date: "2024-01-01",
    receipt_url: null,
    receipt_extracted_patient_name: null,
    receipt_extracted_amount: null,
    receipt_extracted_date: null,
    status: "submitted",
    graph_thread_id: "t1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getClaimInsuranceDecision", () => {
  it("returns approved or denied from joined insurance claim", () => {
    expect(
      getClaimInsuranceDecision({
        insurance_claim: {
          id: "i1",
          claim_request_id: "c1",
          claimed_amount: 100,
          service_date: "2024-01-01",
          status: "approved",
          created_at: "",
          updated_at: "",
        },
      })
    ).toBe("approved");

    expect(
      getClaimInsuranceDecision({
        insurance_claim: {
          id: "i1",
          claim_request_id: "c1",
          claimed_amount: 100,
          service_date: "2024-01-01",
          status: "denied",
          created_at: "",
          updated_at: "",
        },
      })
    ).toBe("denied");
  });

  it("returns null when insurance claim is missing or still created", () => {
    expect(getClaimInsuranceDecision(claim())).toBe(null);
    expect(
      getClaimInsuranceDecision(
        claim({
          insurance_claim: {
            id: "i1",
            claim_request_id: "c1",
            claimed_amount: 100,
            service_date: "2024-01-01",
            status: "created",
            created_at: "",
            updated_at: "",
          },
        })
      )
    ).toBe(null);
  });
});

describe("getClaimDisplayStatus", () => {
  it("shows approved/denied when insurance claim has a decision", () => {
    expect(
      getClaimDisplayStatus(
        claim({
          status: "submitted",
          insurance_claim: {
            id: "i1",
            claim_request_id: "c1",
            claimed_amount: 100,
            service_date: "2024-01-01",
            status: "approved",
            created_at: "",
            updated_at: "",
          },
        })
      )
    ).toBe("approved");

    expect(
      getClaimDisplayStatus(
        claim({
          status: "submitted",
          insurance_claim: {
            id: "i1",
            claim_request_id: "c1",
            claimed_amount: 100,
            service_date: "2024-01-01",
            status: "denied",
            created_at: "",
            updated_at: "",
          },
        })
      )
    ).toBe("denied");
  });

  it("falls back to claim request status otherwise", () => {
    expect(getClaimDisplayStatus(claim({ status: "reviewing" }))).toBe("reviewing");
    expect(getClaimDisplayStatus(claim({ status: "submitted" }))).toBe("submitted");
  });
});

describe("claimDisplayStatusLabel", () => {
  it("formats status for display", () => {
    expect(claimDisplayStatusLabel("revision_requested")).toBe("revision requested");
    expect(claimDisplayStatusLabel("approved")).toBe("approved");
  });
});
