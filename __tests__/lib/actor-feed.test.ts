import { describe, expect, it } from "vitest";
import {
  eventSummary,
  filterEventsForActor,
  filterNotificationsForUser,
} from "@/lib/actor-feed";
import type { ClaimEvent, ClaimRequest, Notification } from "@/lib/types";

const claims: ClaimRequest[] = [
  {
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
  },
  {
    id: "c2",
    user_id: "u2",
    claimed_amount: 200,
    service_date: "2024-02-01",
    receipt_url: null,
    receipt_extracted_patient_name: null,
    receipt_extracted_amount: null,
    receipt_extracted_date: null,
    status: "submitted",
    graph_thread_id: "t2",
    created_at: "",
    updated_at: "",
  },
];

const events: ClaimEvent[] = [
  {
    id: "e1",
    claim_request_id: "c1",
    event_type: "enters_benefits_review",
    actor_role: "system",
    payload: {},
    created_at: "",
  },
  {
    id: "e2",
    claim_request_id: "c2",
    event_type: "insurance_claim_created",
    actor_role: "system",
    payload: {},
    created_at: "",
  },
];

describe("actor-feed", () => {
  it("filters benefits events for reviewing claims", () => {
    const result = filterEventsForActor(events, claims, "benefits_company");
    expect(result.some((e) => e.claim_request_id === "c1")).toBe(true);
  });

  it("filters insurance events", () => {
    const result = filterEventsForActor(events, claims, "insurance_company");
    expect(result.some((e) => e.event_type.includes("insurance"))).toBe(true);
  });

  it("filters user events by user id", () => {
    const result = filterEventsForActor(events, claims, "user", "u1");
    expect(result.every((e) => claims.find((c) => c.id === e.claim_request_id)?.user_id === "u1" || e.actor_role === "user")).toBe(true);
  });

  it("filters notifications for user", () => {
    const notifications: Notification[] = [
      {
        id: "n1",
        user_id: "u1",
        claim_request_id: "c1",
        type: "revision_requested",
        message: "test",
        read: false,
        created_at: "",
      },
    ];
    expect(filterNotificationsForUser(notifications, "u1")).toHaveLength(1);
    expect(filterNotificationsForUser(notifications, "u2")).toHaveLength(0);
  });

  it("summarizes receipt validation events", () => {
    expect(eventSummary({
      id: "e",
      claim_request_id: "c1",
      event_type: "receipt_validation_faked",
      actor_role: "system",
      payload: {},
      created_at: "",
    })).toContain("faked");
  });
});
