import { describe, expect, it } from 'vitest';
import { getDeviceProfile, listDeviceProfiles } from '../devices.js';

describe('getDeviceProfile', () => {
  it('returns iPhone 14 profile with correct values', () => {
    const profile = getDeviceProfile('iPhone 14');
    expect(profile.name).toBe('iPhone 14');
    expect(profile.viewport.width).toBe(390);
    expect(profile.viewport.height).toBe(844);
    expect(profile.isMobile).toBe(true);
    expect(profile.hasTouch).toBe(true);
    expect(profile.deviceScaleFactor).toBe(3);
  });

  it('returns Pixel 7 profile with correct values', () => {
    const profile = getDeviceProfile('Pixel 7');
    expect(profile.isMobile).toBe(true);
    expect(profile.hasTouch).toBe(true);
  });

  it('returns Desktop 1920x1080 profile with correct values', () => {
    const profile = getDeviceProfile('Desktop 1920x1080');
    expect(profile.viewport.width).toBe(1920);
    expect(profile.viewport.height).toBe(1080);
    expect(profile.isMobile).toBe(false);
    expect(profile.hasTouch).toBe(false);
  });

  it('lookup is case-insensitive', () => {
    const profile = getDeviceProfile('iphone 14');
    expect(profile.name).toBe('iPhone 14');
  });

  it('throws for unknown device profile', () => {
    expect(() => getDeviceProfile('Nokia 3310')).toThrowError(
      'Unknown device profile: "Nokia 3310"',
    );
  });
});

describe('listDeviceProfiles', () => {
  it('returns at least 10 profiles', () => {
    const profiles = listDeviceProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(10);
  });

  it('all profiles have required fields', () => {
    const profiles = listDeviceProfiles();
    for (const profile of profiles) {
      expect(profile.name).toBeTruthy();
      expect(profile.viewport.width).toBeGreaterThan(0);
      expect(profile.viewport.height).toBeGreaterThan(0);
      expect(profile.userAgent).toBeTruthy();
      expect(profile.deviceScaleFactor).toBeGreaterThan(0);
      expect(typeof profile.isMobile).toBe('boolean');
      expect(typeof profile.hasTouch).toBe('boolean');
    }
  });

  it('each profile has a unique name', () => {
    const profiles = listDeviceProfiles();
    const names = profiles.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
