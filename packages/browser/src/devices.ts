import type { DeviceProfile } from '@sentinel/shared';

export const BUILT_IN_DEVICES: readonly DeviceProfile[] = [
  {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPhone 14 Pro Max',
    viewport: { width: 430, height: 932 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPad Pro 12.9',
    viewport: { width: 1024, height: 1366 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },
  {
    name: 'iPad Mini',
    viewport: { width: 768, height: 1024 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },
  {
    name: 'Pixel 7',
    viewport: { width: 412, height: 915 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Pixel 7 Pro',
    viewport: { width: 412, height: 892 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Samsung Galaxy S23',
    viewport: { width: 360, height: 780 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Galaxy Tab S8',
    viewport: { width: 800, height: 1280 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; SM-X706B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },
  {
    name: 'Desktop 1920x1080',
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

/** Case-insensitive lookup map keyed by lowercase device name. */
const deviceMap: ReadonlyMap<string, DeviceProfile> = new Map(
  BUILT_IN_DEVICES.map((profile) => [profile.name.toLowerCase(), profile]),
);

/**
 * Returns the DeviceProfile for the given name.
 * Lookup is case-insensitive. Throws if the name is not recognized.
 */
export function getDeviceProfile(name: string): DeviceProfile {
  const profile = deviceMap.get(name.toLowerCase());
  if (profile === undefined) {
    throw new Error(`Unknown device profile: "${name}"`);
  }
  return profile;
}

/** Returns all built-in device profiles. */
export function listDeviceProfiles(): readonly DeviceProfile[] {
  return BUILT_IN_DEVICES;
}
