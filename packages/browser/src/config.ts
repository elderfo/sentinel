import type { BrowserConfig, BrowserType } from '@sentinel/shared';

const VALID_BROWSER_TYPES: readonly BrowserType[] = ['chromium', 'firefox', 'webkit'] as const;

const nodeEnv =
  (
    (globalThis as Record<string, unknown>)['process'] as
      | { env: Record<string, string | undefined> }
      | undefined
  )?.env ?? {};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

/** Loads browser configuration from environment variables with sensible defaults. */
export function loadBrowserConfig(): BrowserConfig {
  const browserTypeRaw = nodeEnv['BROWSER_TYPE'] ?? 'chromium';
  if (!VALID_BROWSER_TYPES.includes(browserTypeRaw as BrowserType)) {
    throw new Error(
      `BROWSER_TYPE must be one of: ${VALID_BROWSER_TYPES.join(', ')}. Received: "${browserTypeRaw}"`,
    );
  }
  const browserType = browserTypeRaw as BrowserType;

  const headless = parseBool(nodeEnv['BROWSER_HEADLESS'], true);
  const deviceProfile = nodeEnv['BROWSER_DEVICE'] || undefined;

  const screenshotOnFailure = parseBool(nodeEnv['BROWSER_SCREENSHOT_ON_FAILURE'], true);
  const videoEnabled = parseBool(nodeEnv['BROWSER_VIDEO_ENABLED'], false);
  const outputDir = nodeEnv['BROWSER_ARTIFACT_DIR'] ?? './artifacts';

  const maxRetentionRaw = nodeEnv['BROWSER_ARTIFACT_MAX_MB'];
  let maxRetentionMb = 500;
  if (maxRetentionRaw !== undefined && maxRetentionRaw !== '') {
    const parsed = Number(maxRetentionRaw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(
        `BROWSER_ARTIFACT_MAX_MB must be a positive number. Received: "${maxRetentionRaw}"`,
      );
    }
    maxRetentionMb = parsed;
  }

  return {
    browserType,
    headless,
    ...(deviceProfile !== undefined && { deviceProfile }),
    artifacts: {
      screenshotOnFailure,
      videoEnabled,
      outputDir,
      maxRetentionMb,
    },
  };
}
