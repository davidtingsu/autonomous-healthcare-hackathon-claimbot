import { describe, expect, it } from "vitest";
import { getActorRole } from "@/lib/api/helpers";

describe("api helpers", () => {
  it("reads actor role from header", () => {
    const req = new Request("http://localhost", {
      headers: { "X-Actor-Role": "benefits_company" },
    });
    expect(getActorRole(req)).toBe("benefits_company");
  });

  it("returns null for invalid role", () => {
    const req = new Request("http://localhost", {
      headers: { "X-Actor-Role": "invalid" },
    });
    expect(getActorRole(req)).toBeNull();
  });
});
