/**
 * @sentinel/cli
 *
 * Command-line interface for the Sentinel QA automation platform.
 */

export type { Scenario, CheckResult } from "@sentinel/core";
export { SENTINEL_VERSION } from "@sentinel/shared";

/** Entry point descriptor for the Sentinel CLI. */
export const CLI_NAME = "sentinel" as const;
