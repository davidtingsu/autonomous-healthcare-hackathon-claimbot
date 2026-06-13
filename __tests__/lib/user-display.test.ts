import { describe, expect, it } from "vitest";
import { eventSummaryWithUser } from "@/lib/actor-feed";
import type { ClaimEvent, ClaimRequest, User } from "@/lib/types";
import {
  buildUsersById,
  filterClaimsByUserId,
  filterEventsByClaimUser,
  formatUserLabel,
  formatUserName,
  getClaimUserName,
} from "@/lib/user-display";

const users: User[] = [
  {
    id: "u1",
    first_name: "John",
    last_name: "Smith",
    primary_id: null,
  },
  {
    id: "u2",
    first_name: "Emily",
    last_name: "Smith",
    primary_id: "u1",
  },
];

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
    users: users[0],
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

describe("user-display", () => {
  it("formats user names", () => {
    expect(formatUserName(users[0])).toBe("John Smith");
    expect(formatUserName(undefined)).toBe("Unknown user");
  });

  it("labels dependents", () => {
    expect(formatUserLabel(users[1])).toBe("Emily Smith (dependent)");
    expect(formatUserLabel(users[0])).toBe("John Smith");
  });

  it("gets claim user name from join or map", () => {
    const usersById = buildUsersById(users);
    expect(getClaimUserName(claims[0], usersById)).toBe("John Smith");

    const claimWithoutJoin = { ...claims[1], users: undefined };
    expect(getClaimUserName(claimWithoutJoin, usersById)).toBe("Emily Smith");
  });

  it("filters claims by user id", () => {
    expect(filterClaimsByUserId(claims, null)).toHaveLength(2);
    expect(filterClaimsByUserId(claims, "u2")).toHaveLength(1);
    expect(filterClaimsByUserId(claims, "u2")[0].id).toBe("c2");
  });

  it("filters events by claim user", () => {
    expect(filterEventsByClaimUser(events, claims, null)).toHaveLength(2);
    expect(filterEventsByClaimUser(events, claims, "u1")).toHaveLength(1);
    expect(filterEventsByClaimUser(events, claims, "u1")[0].id).toBe("e1");
  });

  it("adds user name to event summary", () => {
    expect(eventSummaryWithUser(events[0], "John Smith")).toContain("John Smith");
  });
});
