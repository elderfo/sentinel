import { describe, it, expect, expectTypeOf } from "vitest";
import { APP_TITLE, SENTINEL_VERSION, type CheckResult, type Scenario } from "../index.js";

describe("@sentinel/web", () => {
  describe("APP_TITLE", () => {
    it("is a non-empty string", () => {
      expect(typeof APP_TITLE).toBe("string");
      expect(APP_TITLE.length).toBeGreaterThan(0);
    });

    it("equals 'Sentinel'", () => {
      expect(APP_TITLE).toBe("Sentinel");
    });

    it("has the correct literal type", () => {
      expectTypeOf(APP_TITLE).toEqualTypeOf<"Sentinel">();
    });
  });

  describe("re-exports", () => {
    it("re-exports SENTINEL_VERSION from @sentinel/shared", () => {
      expect(typeof SENTINEL_VERSION).toBe("string");
    });

    it("re-exports Scenario type from @sentinel/core", () => {
      const scenario: Scenario = { id: "sc-1", name: "Dashboard view" };
      expect(scenario.name).toBe("Dashboard view");
    });

    it("re-exports CheckResult type from @sentinel/core", () => {
      const result: CheckResult = { status: "pass" };
      expect(result.status).toBe("pass");
    });
  });
});
