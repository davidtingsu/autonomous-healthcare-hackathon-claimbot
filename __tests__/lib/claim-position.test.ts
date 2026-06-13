import { describe, expect, it } from "vitest";
import { getClaimStage, getClaimsByStage, countActiveClaims } from "@/lib/diagram/claim-position";
import type { ClaimEvent, ClaimRequest } from "@/lib/types";

const claim: ClaimRequest = {
  id: "c1",
  user_id: "u1",
  claimed_amount: 100,
  service_date: "2024-01-01",
  receipt_url: null,
  receipt_extracted_patient_name: null,
  receipt_extracted_amount: null,
  receipt_extracted_date: null,
  status: "reviewing",
  graph_thread_id: "t1",
  created_at: "",
  updated_at: "",
};

const events: ClaimEvent[] = [
  {
    id: "e1",
    claim_request_id: "c1",
    event_type: "enters_benefits_review",
    actor_role: "system",
    payload: {},
    created_at: "2024-01-02T00:00:00Z",
  },
  {
    id: "e2",
    claim_request_id: "c1",
    event_type: "benefits_submits_to_insurance",
    actor_role: "benefits_company",
    payload: {},
    created_at: "2024-01-03T00:00:00Z",
  },
];

describe("claim-position", () => {
  it("maps latest event to stage", () => {
    expect(getClaimStage("c1", events, claim)).toBe("submitted");
  });

  it("groups claims by stage", () => {
    const grouped = getClaimsByStage([claim], events);
    expect(grouped.get("submitted")).toHaveLength(1);
  });

  it("counts active claims excluding terminal stages", () => {
    expect(countActiveClaims([claim], events)).toBe(1);
  });
});
