import { describe, expect, it } from "vitest";
import { buildClaimWorkflow } from "@/lib/graph/claim-workflow";
import { EVENT_TO_NODE } from "@/lib/types";

describe("claim-workflow", () => {
  it("builds a compiled LangGraph workflow", () => {
    const graph = buildClaimWorkflow();
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
