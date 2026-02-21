import { describe, it, expect } from 'vitest';
import { PlaywrightTsEmitter } from '../emitter/playwright-ts.js';
import type { TestCase, TestSuite, TestStep, TestAssertion } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makeAssertion(overrides: Partial<TestAssertion> = {}): TestAssertion {
  return {
    type: 'url-match',
    selector: 'window.location',
    selectorStrategy: 'css',
    expected: '/dashboard',
    confidence: 1.0,
    description: 'URL changed to /dashboard',
    ...overrides,
  };
}

function makeStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    action: 'click',
    selector: '#submit',
    selectorStrategy: 'css',
    description: 'Click submit',
    assertions: [],
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'test-1',
    name: 'Login flow',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'auth',
    setupSteps: [
      {
        action: 'navigation',
        selector: 'https://example.com/login',
        selectorStrategy: 'css',
        description: 'Navigate to login',
        assertions: [],
      },
    ],
    steps: [
      {
        action: 'click',
        selector: '#submit',
        selectorStrategy: 'css',
        description: 'Click submit',
        assertions: [makeAssertion()],
      },
    ],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

function makeSuite(overrides: Partial<TestSuite> = {}): TestSuite {
  return {
    name: 'Auth',
    fileName: 'auth.spec.ts',
    testCases: [makeTestCase()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PlaywrightTsEmitter
// ---------------------------------------------------------------------------

describe('PlaywrightTsEmitter', () => {
  const emitter = new PlaywrightTsEmitter();

  it('has formatName "playwright-ts"', () => {
    expect(emitter.formatName).toBe('playwright-ts');
  });

  // -------------------------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------------------------

  it('generated code starts with playwright import', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain("import { test, expect } from '@playwright/test';");
  });

  it('contains test.describe block with suite name', async () => {
    const [file] = await emitter.emit([makeSuite({ name: 'Auth' })]);
    expect(file?.content).toContain("test.describe('Auth'");
  });

  it('contains test block with test case name', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain("test('Login flow'");
  });

  it('wraps test cases in async ({ page }) =>', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain('async ({ page })');
  });

  // -------------------------------------------------------------------------
  // Navigation steps
  // -------------------------------------------------------------------------

  it('generates await page.goto for navigation setup steps', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain("await page.goto('https://example.com/login')");
  });

  // -------------------------------------------------------------------------
  // Click steps
  // -------------------------------------------------------------------------

  it('generates await page.click for click actions', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain("await page.click('#submit')");
  });

  // -------------------------------------------------------------------------
  // Form-submit steps
  // -------------------------------------------------------------------------

  it('generates await page.fill for form-submit with inputData', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              action: 'form-submit',
              selector: '#login-form button[type="submit"]',
              inputData: {
                '#username': 'admin',
                '#password': 'secret',
              },
              assertions: [],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("await page.fill('#username', 'admin')");
    expect(file?.content).toContain("await page.fill('#password', 'secret')");
  });

  it('generates click on form selector after fill for form-submit', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              action: 'form-submit',
              selector: '#submit-btn',
              inputData: { '#email': 'user@test.com' },
              assertions: [],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("await page.click('#submit-btn')");
  });

  // -------------------------------------------------------------------------
  // Visibility assertions
  // -------------------------------------------------------------------------

  it('generates toBeVisible for visibility assertion with expected true', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  type: 'visibility',
                  selector: '#welcome',
                  expected: 'true',
                  description: 'Welcome message visible',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("await expect(page.locator('#welcome')).toBeVisible()");
  });

  it('generates not.toBeVisible for visibility assertion with expected false', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  type: 'visibility',
                  selector: '#error',
                  expected: 'false',
                  description: 'Error message hidden',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("await expect(page.locator('#error')).not.toBeVisible()");
  });

  // -------------------------------------------------------------------------
  // Text-content assertions
  // -------------------------------------------------------------------------

  it('generates toHaveText for text-content assertions', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  type: 'text-content',
                  selector: 'h1',
                  expected: 'Welcome',
                  description: 'Heading displays Welcome',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("toHaveText('Welcome')");
  });

  // -------------------------------------------------------------------------
  // URL-match assertions
  // -------------------------------------------------------------------------

  it('generates toHaveURL for url-match assertions', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.content).toContain("toHaveURL('/dashboard')");
  });

  // -------------------------------------------------------------------------
  // Element-count assertions
  // -------------------------------------------------------------------------

  it('generates toHaveCount for element-count assertions', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  type: 'element-count',
                  selector: '.item',
                  expected: '3',
                  description: 'Three items displayed',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain('toHaveCount(3)');
  });

  // -------------------------------------------------------------------------
  // Attribute-value assertions
  // -------------------------------------------------------------------------

  it('generates toHaveAttribute for attribute-value assertions', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  type: 'attribute-value',
                  selector: '#input',
                  expected: 'disabled-state',
                  description: 'Attribute "aria-disabled" changed from "false" to "true"',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    // Prettier may reformat across lines, so check for the key parts
    expect(file?.content).toContain('toHaveAttribute(');
    expect(file?.content).toContain('aria-disabled');
    expect(file?.content).toContain('disabled-state');
  });

  // -------------------------------------------------------------------------
  // Low confidence comments
  // -------------------------------------------------------------------------

  it('adds LOW CONFIDENCE comment for assertions with confidence < 0.5', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  confidence: 0.3,
                  description: 'Uncertain assertion',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain('// LOW CONFIDENCE');
  });

  it('does not add LOW CONFIDENCE comment for assertions with confidence >= 0.5', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  confidence: 0.5,
                  description: 'Normal assertion',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).not.toContain('// LOW CONFIDENCE');
  });

  it('adds description comment before each assertion', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              assertions: [
                makeAssertion({
                  description: 'URL changed to /dashboard',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain('// URL changed to /dashboard');
  });

  // -------------------------------------------------------------------------
  // EmittedFile shape
  // -------------------------------------------------------------------------

  it('returns EmittedFile with fileName matching suite', async () => {
    const [file] = await emitter.emit([makeSuite({ fileName: 'auth.spec.ts' })]);
    expect(file?.fileName).toBe('auth.spec.ts');
  });

  it('checksum is a 64-char hex string (SHA-256)', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    expect(file?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns one EmittedFile per suite', async () => {
    const suites = [
      makeSuite({ name: 'Auth', fileName: 'auth.spec.ts' }),
      makeSuite({ name: 'Checkout', fileName: 'checkout.spec.ts' }),
    ];
    const files = await emitter.emit(suites);
    expect(files).toHaveLength(2);
    expect(files[0]?.fileName).toBe('auth.spec.ts');
    expect(files[1]?.fileName).toBe('checkout.spec.ts');
  });

  // -------------------------------------------------------------------------
  // Prettier formatting
  // -------------------------------------------------------------------------

  it('output is valid TypeScript formatted by Prettier', async () => {
    const [file] = await emitter.emit([makeSuite()]);
    // Prettier-formatted output should end with a newline
    expect(file?.content.endsWith('\n')).toBe(true);
    // Should not contain double blank lines (Prettier normalizes these)
    expect(file?.content).not.toContain('\n\n\n');
  });

  // -------------------------------------------------------------------------
  // Empty cases
  // -------------------------------------------------------------------------

  it('returns empty array for empty suites input', async () => {
    const files = await emitter.emit([]);
    expect(files).toEqual([]);
  });

  it('generates valid output for suite with no test cases', async () => {
    const suite = makeSuite({ testCases: [] });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("test.describe('Auth'");
    expect(file?.content).toContain("import { test, expect } from '@playwright/test';");
  });

  // -------------------------------------------------------------------------
  // Teardown steps
  // -------------------------------------------------------------------------

  it('renders teardown steps after main steps', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({
          steps: [
            makeStep({
              action: 'click',
              selector: '#action-btn',
              assertions: [],
            }),
          ],
          teardownSteps: [
            makeStep({
              action: 'click',
              selector: '#logout',
              description: 'Click logout',
              assertions: [],
            }),
          ],
        }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    const content = file?.content ?? '';
    const actionIdx = content.indexOf("page.click('#action-btn')");
    const logoutIdx = content.indexOf("page.click('#logout')");
    expect(actionIdx).toBeGreaterThan(-1);
    expect(logoutIdx).toBeGreaterThan(actionIdx);
  });

  // -------------------------------------------------------------------------
  // Multiple test cases
  // -------------------------------------------------------------------------

  it('renders multiple test cases within one describe block', async () => {
    const suite = makeSuite({
      testCases: [
        makeTestCase({ name: 'Login flow' }),
        makeTestCase({ id: 'test-2', name: 'Logout flow' }),
      ],
    });
    const [file] = await emitter.emit([suite]);
    expect(file?.content).toContain("test('Login flow'");
    expect(file?.content).toContain("test('Logout flow'");
  });

  // -------------------------------------------------------------------------
  // Escaping
  // -------------------------------------------------------------------------

  it('escapes single quotes in suite name', async () => {
    const suite = makeSuite({ name: "User's Profile" });
    const [file] = await emitter.emit([suite]);
    // Prettier converts escaped single quotes to double-quoted strings
    expect(file?.content).toContain("User's Profile");
  });

  it('escapes single quotes in test case name', async () => {
    const suite = makeSuite({
      testCases: [makeTestCase({ name: "it's a test" })],
    });
    const [file] = await emitter.emit([suite]);
    // Prettier converts escaped single quotes to double-quoted strings
    expect(file?.content).toContain("it's a test");
  });

  // -------------------------------------------------------------------------
  // Checksum consistency
  // -------------------------------------------------------------------------

  it('produces identical checksum for identical input', async () => {
    const suite = makeSuite();
    const [file1] = await emitter.emit([suite]);
    const [file2] = await emitter.emit([suite]);
    expect(file1?.checksum).toBe(file2?.checksum);
  });

  it('produces different checksum for different input', async () => {
    const suite1 = makeSuite({ name: 'Auth' });
    const suite2 = makeSuite({ name: 'Checkout' });
    const [file1] = await emitter.emit([suite1]);
    const [file2] = await emitter.emit([suite2]);
    expect(file1?.checksum).not.toBe(file2?.checksum);
  });
});
