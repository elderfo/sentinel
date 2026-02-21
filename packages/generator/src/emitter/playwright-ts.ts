import { createHash } from 'node:crypto';
import { format } from 'prettier';
import type {
  TestSuite,
  EmittedFile,
  TestEmitter,
  OutputFormat,
  TestCase,
  TestStep,
  TestAssertion,
} from '../types.js';

export class PlaywrightTsEmitter implements TestEmitter {
  readonly formatName: OutputFormat = 'playwright-ts';

  async emit(suites: readonly TestSuite[]): Promise<readonly EmittedFile[]> {
    const files: EmittedFile[] = [];
    for (const suite of suites) {
      const raw = this.renderSuite(suite);
      let content: string;
      try {
        content = await format(raw, {
          parser: 'typescript',
          singleQuote: true,
          semi: true,
          tabWidth: 2,
          trailingComma: 'all',
        });
      } catch {
        content = raw;
      }
      const checksum = createHash('sha256').update(content).digest('hex');
      files.push({ fileName: suite.fileName, content, checksum });
    }
    return files;
  }

  private renderSuite(suite: TestSuite): string {
    const lines: string[] = [];
    lines.push("import { test, expect } from '@playwright/test';");
    lines.push('');
    lines.push(`test.describe('${this.escapeQuotes(suite.name)}', () => {`);
    for (const tc of suite.testCases) {
      lines.push(this.renderTestCase(tc));
    }
    lines.push('});');
    lines.push('');
    return lines.join('\n');
  }

  private renderTestCase(tc: TestCase): string {
    const lines: string[] = [];
    lines.push(`  test('${this.escapeQuotes(tc.name)}', async ({ page }) => {`);

    for (const step of tc.setupSteps) {
      lines.push(this.renderStep(step));
    }

    for (const step of tc.steps) {
      lines.push(this.renderStep(step));
    }

    for (const step of tc.teardownSteps) {
      lines.push(this.renderStep(step));
    }

    lines.push('  });');
    return lines.join('\n');
  }

  private renderStep(step: TestStep): string {
    const lines: string[] = [];

    switch (step.action) {
      case 'navigation':
        lines.push(`    await page.goto('${this.escapeQuotes(step.selector)}');`);
        break;
      case 'click':
        lines.push(`    await page.click('${this.escapeQuotes(step.selector)}');`);
        break;
      case 'form-submit':
        if (step.inputData !== undefined) {
          for (const [field, value] of Object.entries(step.inputData)) {
            lines.push(
              `    await page.fill('${this.escapeQuotes(field)}', '${this.escapeQuotes(value)}');`,
            );
          }
        }
        lines.push(`    await page.click('${this.escapeQuotes(step.selector)}');`);
        break;
      default:
        lines.push(`    // Unsupported action: ${String(step.action)}`);
        break;
    }

    lines.push(this.renderAssertions(step.assertions));

    return lines.join('\n');
  }

  private renderAssertions(assertions: readonly TestAssertion[]): string {
    const lines: string[] = [];

    for (const assertion of assertions) {
      if (assertion.confidence < 0.5) {
        lines.push('    // LOW CONFIDENCE');
      }
      lines.push(`    // ${assertion.description}`);

      switch (assertion.type) {
        case 'visibility':
          if (assertion.expected === 'true') {
            lines.push(
              `    await expect(page.locator('${this.escapeQuotes(assertion.selector)}')).toBeVisible();`,
            );
          } else {
            lines.push(
              `    await expect(page.locator('${this.escapeQuotes(assertion.selector)}')).not.toBeVisible();`,
            );
          }
          break;
        case 'text-content':
          lines.push(
            `    await expect(page.locator('${this.escapeQuotes(assertion.selector)}')).toHaveText('${this.escapeQuotes(assertion.expected)}');`,
          );
          break;
        case 'url-match':
          lines.push(
            `    await expect(page).toHaveURL('${this.escapeQuotes(assertion.expected)}');`,
          );
          break;
        case 'element-count':
          lines.push(
            `    await expect(page.locator('${this.escapeQuotes(assertion.selector)}')).toHaveCount(${String(Number(assertion.expected))});`,
          );
          break;
        case 'attribute-value': {
          const attrName = this.extractAttributeName(assertion.description);
          lines.push(
            `    await expect(page.locator('${this.escapeQuotes(assertion.selector)}')).toHaveAttribute('${this.escapeQuotes(attrName)}', '${this.escapeQuotes(assertion.expected)}');`,
          );
          break;
        }
        default:
          lines.push(`    // Unsupported assertion type: ${String(assertion.type)}`);
          break;
      }
    }

    return lines.join('\n');
  }

  private extractAttributeName(description: string): string {
    const match = /Attribute "([^"]+)"/.exec(description);
    return match?.[1] ?? 'unknown';
  }

  private escapeQuotes(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
