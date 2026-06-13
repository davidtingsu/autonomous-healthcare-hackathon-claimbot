import { describe, expect, it, vi } from "vitest";
import { buildClaimWorkflow } from "@/lib/graph/claim-workflow";
import { EVENT_TO_NODE } from "@/lib/types";

function createMockSupabase() {
  const insertCalls: unknown[] = [];
  return {
    insertCalls,
    from: vi.fn(() => ({
      insert: vi.fn((row: unknown) => {
        insertCalls.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: { id: "ins-1", ...(row as object) },
              error: null,
            }),
          }),
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: async () => ({
            data: {
              id: "claim-1",
              user_id: "user-1",
              claimed_amount: 150,
              service_date: "2024-06-01",
              receipt_url: null,
              users: { first_name: "John", last_name: "Smith" },
            },
            error: null,
          }),
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "ins-1",
                  claimed_amount: 150,
                  service_date: "2024-06-01",
                  status: "approved",
                },
                error: null,
              }),
            }),
          }),
        })),
      })),
    })),
  };
}

describe("claim-workflow", () => {
  it("builds a compiled LangGraph workflow", () => {
    const supabase = createMockSupabase();
    const graph = buildClaimWorkflow(supabase as never);
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe("function");
  });

  it("maps lifecycle events to diagram nodes", () => {
    expect(EVENT_TO_NODE.claim_created).toBe("created");
    expect(EVENT_TO_NODE.enters_benefits_review).toBe("benefits_hitl");
    expect(EVENT_TO_NODE.benefits_submits_to_insurance).toBe("submitted");
    expect(EVENT_TO_NODE.claim_matched_approved).toBe("notified");
  });
});
