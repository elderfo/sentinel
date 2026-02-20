import { describe, it, expect, expectTypeOf } from "vitest";
import { CLI_NAME, SENTINEL_VERSION, type CheckResult, type Scenario } from "../index.js";

describe("@sentinel/cli", () => {
  describe("CLI_NAME", () => {
    it("is a non-empty string", () => {
      expect(typeof CLI_NAME).toBe("string");
      expect(CLI_NAME.length).toBeGreaterThan(0);
    });

    it("equals 'sentinel'", () => {
      expect(CLI_NAME).toBe("sentinel");
    });

    it("has the correct literal type", () => {
      expectTypeOf(CLI_NAME).toEqualTypeOf<"sentinel">();
    });
  });

  describe("re-exports", () => {
    it("re-exports SENTINEL_VERSION from @sentinel/shared", () => {
      expect(typeof SENTINEL_VERSION).toBe("string");
    });

    it("re-exports Scenario type from @sentinel/core", () => {
      const scenario: Scenario = { id: "sc-1", name: "Login flow" };
      expect(scenario.id).toBe("sc-1");
    });

    it("re-exports CheckResult type from @sentinel/core", () => {
      const result: CheckResult = { status: "fail", reason: "timeout" };
      expect(result.status).toBe("fail");
    });
  });
});
