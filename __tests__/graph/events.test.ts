import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_MESSAGES,
} from "@/lib/graph/events";

describe("notification messages", () => {
  it("has messages for all notification types", () => {
    expect(NOTIFICATION_MESSAGES.revision_requested).toContain("revision");
    expect(NOTIFICATION_MESSAGES.cancelled_for_submission).toContain("cancelled");
    expect(NOTIFICATION_MESSAGES.claim_matched_approved).toContain("approved");
    expect(NOTIFICATION_MESSAGES.claim_matched_denied).toContain("denied");
  });
});
