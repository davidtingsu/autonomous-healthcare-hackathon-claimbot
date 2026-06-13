import { describe, expect, it } from "vitest";
import { DEMO_USER_IDS } from "@/lib/db/constants";
import { userIdSchema } from "@/lib/validation";

describe("validation", () => {
  it("accepts demo user UUIDs", () => {
    for (const id of Object.values(DEMO_USER_IDS)) {
      expect(userIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it("rejects legacy invalid-variant demo UUIDs", () => {
    expect(
      userIdSchema.safeParse("22222222-2222-2222-2222-222222222201").success
    ).toBe(false);
  });
});
