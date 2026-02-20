import { describe, it, expect, expectTypeOf } from "vitest";
import { SENTINEL_VERSION, type CheckResult, type Scenario } from "../index.js";

describe("@sentinel/core", () => {
  describe("Scenario", () => {
    it("accepts a minimal scenario with required fields", () => {
      const scenario: Scenario = { id: "sc-1", name: "Login flow" };
      expect(scenario.id).toBe("sc-1");
      expect(scenario.name).toBe("Login flow");
    });

    it("accepts a scenario with an optional description", () => {
      const scenario: Scenario = {
        id: "sc-2",
        name: "Checkout flow",
        description: "Tests the full checkout process",
      };
      expect(scenario.description).toBe("Tests the full checkout process");
    });

    it("has the correct shape", () => {
      expectTypeOf<Scenario>().toHaveProperty("id");
      expectTypeOf<Scenario>().toHaveProperty("name");
    });
  });

  describe("re-exports from @sentinel/shared", () => {
    it("re-exports SENTINEL_VERSION", () => {
      expect(typeof SENTINEL_VERSION).toBe("string");
    });

    it("re-exports CheckResult type", () => {
      const result: CheckResult = { status: "pass" };
      expect(result.status).toBe("pass");
    });
  });
});
