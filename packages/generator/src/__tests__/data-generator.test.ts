import { describe, it, expect } from 'vitest';
import type { FormField, FormModel, DomNode } from '@sentinel/analysis';
import type { TestCase, TestStep, GeneratorConfig } from '@sentinel/generator';
import { RealisticDataStrategy, BoundaryDataStrategy } from '../data/strategies.js';
import { generateTestData } from '../data/data-generator.js';

// ---------------------------------------------------------------------------
// Minimal DomNode fixture
// ---------------------------------------------------------------------------

function createMinimalDomNode(overrides: Partial<DomNode> = {}): DomNode {
  return {
    tag: 'input',
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath: '/html/body/form/input',
    cssSelector: 'form > input',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FormField fixtures
// ---------------------------------------------------------------------------

function createFormField(overrides: Partial<FormField> = {}): FormField {
  return {
    node: createMinimalDomNode(),
    inputType: 'text',
    name: null,
    label: null,
    placeholder: null,
    constraints: {
      required: false,
      pattern: null,
      min: null,
      max: null,
      minLength: null,
      maxLength: null,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FormModel fixture
// ---------------------------------------------------------------------------

function createFormModel(fields: readonly FormField[]): FormModel {
  return {
    formElement: createMinimalDomNode({ tag: 'form' }),
    action: '/submit',
    method: 'POST',
    fields,
    isMultiStep: false,
  };
}

// ---------------------------------------------------------------------------
// TestCase fixture helpers
// ---------------------------------------------------------------------------

function createTestStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    action: 'click',
    selector: '#btn',
    selectorStrategy: 'id',
    description: 'Click button',
    assertions: [],
    ...overrides,
  };
}

function createTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Test case',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'suite-1',
    setupSteps: [],
    steps: [
      createTestStep({
        action: 'form-submit',
        selector: '#form',
        selectorStrategy: 'css',
        description: 'Submit form',
      }),
    ],
    teardownSteps: [],
    tags: ['smoke'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Default GeneratorConfig
// ---------------------------------------------------------------------------

const realisticConfig: GeneratorConfig = {
  assertionDepth: 'standard',
  dataStrategy: 'realistic',
  outputFormat: 'playwright-ts',
  outputDir: './output',
};

const boundaryConfig: GeneratorConfig = {
  assertionDepth: 'standard',
  dataStrategy: 'boundary',
  outputFormat: 'playwright-ts',
  outputDir: './output',
};

// ===========================================================================
// RealisticDataStrategy
// ===========================================================================

describe('RealisticDataStrategy', () => {
  // -----------------------------------------------------------------------
  // generateValid()
  // -----------------------------------------------------------------------

  describe('generateValid()', () => {
    it('returns valid email for inputType "email"', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({ inputType: 'email', name: 'email' });
      const result = strategy.generateValid(field);
      expect(result).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });

    it('returns valid phone for inputType "tel"', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({ inputType: 'tel', name: 'phone' });
      const result = strategy.generateValid(field);
      expect(result).toMatch(/^\+?\d[\d\s-]+$/);
    });

    it('returns valid date in ISO format for inputType "date"', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({ inputType: 'date', name: 'dob' });
      const result = strategy.generateValid(field);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns number within min/max for inputType "number"', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'number',
        name: 'age',
        constraints: {
          required: false,
          pattern: null,
          min: '10',
          max: '100',
          minLength: null,
          maxLength: null,
        },
      });
      const result = strategy.generateValid(field);
      const num = Number(result);
      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(100);
    });

    it('returns string within minLength/maxLength bounds', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: null,
          minLength: 3,
          maxLength: 10,
        },
      });
      const result = strategy.generateValid(field);
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('returns generic text for inputType "text" with no constraints', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({ inputType: 'text', name: 'note' });
      const result = strategy.generateValid(field);
      expect(result).toBe('Test Value');
    });

    it('returns password for inputType "password"', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({ inputType: 'password', name: 'password' });
      const result = strategy.generateValid(field);
      expect(result).toBe('P@ssw0rd123!');
    });
  });

  // -----------------------------------------------------------------------
  // generateInvalid()
  // -----------------------------------------------------------------------

  describe('generateInvalid()', () => {
    it('returns empty string violation for required: true', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: true,
          pattern: null,
          min: null,
          max: null,
          minLength: null,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const requiredViolation = invalids.find((i) => i.violatedConstraint === 'required');
      expect(requiredViolation).toBeDefined();
      expect(requiredViolation?.value).toBe('');
    });

    it('returns short string for minLength constraint', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: null,
          minLength: 5,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const minLengthViolation = invalids.find((i) => i.violatedConstraint === 'minLength');
      expect(minLengthViolation).toBeDefined();
      expect(minLengthViolation?.value.length).toBe(4);
    });

    it('returns long string for maxLength constraint', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: null,
          minLength: null,
          maxLength: 10,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const maxLengthViolation = invalids.find((i) => i.violatedConstraint === 'maxLength');
      expect(maxLengthViolation).toBeDefined();
      expect(maxLengthViolation?.value.length).toBe(11);
    });

    it('returns value below min for number constraints', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'number',
        name: 'age',
        constraints: {
          required: false,
          pattern: null,
          min: '10',
          max: null,
          minLength: null,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const minViolation = invalids.find((i) => i.violatedConstraint === 'min');
      expect(minViolation).toBeDefined();
      expect(Number(minViolation?.value)).toBeLessThan(10);
    });

    it('returns value above max for number constraints', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'number',
        name: 'age',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: '100',
          minLength: null,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const maxViolation = invalids.find((i) => i.violatedConstraint === 'max');
      expect(maxViolation).toBeDefined();
      expect(Number(maxViolation?.value)).toBeGreaterThan(100);
    });

    it('returns empty array when field has no constraints', () => {
      const strategy = new RealisticDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'note',
      });
      const invalids = strategy.generateInvalid(field);
      expect(invalids).toHaveLength(0);
    });
  });
});

// ===========================================================================
// BoundaryDataStrategy
// ===========================================================================

describe('BoundaryDataStrategy', () => {
  // -----------------------------------------------------------------------
  // generateValid()
  // -----------------------------------------------------------------------

  describe('generateValid()', () => {
    it('returns exact minLength chars for text fields', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: null,
          minLength: 5,
          maxLength: 20,
        },
      });
      const result = strategy.generateValid(field);
      expect(result.length).toBe(5);
    });

    it('returns exact min value for number fields', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({
        inputType: 'number',
        name: 'age',
        constraints: {
          required: false,
          pattern: null,
          min: '18',
          max: '100',
          minLength: null,
          maxLength: null,
        },
      });
      const result = strategy.generateValid(field);
      expect(Number(result)).toBe(18);
    });

    it('returns shortest valid email for email fields', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({ inputType: 'email', name: 'email' });
      const result = strategy.generateValid(field);
      expect(result).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
      // Should be shorter than or equal to the realistic strategy's email
      expect(result.length).toBeLessThanOrEqual('user@example.com'.length);
    });
  });

  // -----------------------------------------------------------------------
  // generateInvalid()
  // -----------------------------------------------------------------------

  describe('generateInvalid()', () => {
    it('has same constraint violations as realistic for required', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: true,
          pattern: null,
          min: null,
          max: null,
          minLength: null,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const requiredViolation = invalids.find((i) => i.violatedConstraint === 'required');
      expect(requiredViolation).toBeDefined();
      expect(requiredViolation?.value).toBe('');
    });

    it('has same constraint violations as realistic for minLength', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({
        inputType: 'text',
        name: 'username',
        constraints: {
          required: false,
          pattern: null,
          min: null,
          max: null,
          minLength: 5,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      const minLengthViolation = invalids.find((i) => i.violatedConstraint === 'minLength');
      expect(minLengthViolation).toBeDefined();
      expect(minLengthViolation?.value.length).toBe(4);
    });

    it('has same constraint violations as realistic for min/max numbers', () => {
      const strategy = new BoundaryDataStrategy();
      const field = createFormField({
        inputType: 'number',
        name: 'age',
        constraints: {
          required: false,
          pattern: null,
          min: '10',
          max: '100',
          minLength: null,
          maxLength: null,
        },
      });
      const invalids = strategy.generateInvalid(field);
      expect(invalids.find((i) => i.violatedConstraint === 'min')).toBeDefined();
      expect(invalids.find((i) => i.violatedConstraint === 'max')).toBeDefined();
    });
  });
});

// ===========================================================================
// generateTestData()
// ===========================================================================

describe('generateTestData()', () => {
  it('populates inputData on form-submit steps matching form fields', () => {
    const emailField = createFormField({ inputType: 'email', name: 'email' });
    const passwordField = createFormField({ inputType: 'password', name: 'password' });
    const form = createFormModel([emailField, passwordField]);

    const tc = createTestCase({
      steps: [
        createTestStep({
          action: 'form-submit',
          selector: '#login-form',
          selectorStrategy: 'css',
          description: 'Submit login form',
        }),
      ],
    });

    const result = generateTestData([tc], [form], realisticConfig);
    const happyPath = result.find((r) => r.type === 'happy-path');
    expect(happyPath).toBeDefined();

    const formStep = happyPath?.steps.find((s) => s.action === 'form-submit');
    expect(formStep).toBeDefined();
    expect(formStep?.inputData).toBeDefined();
    expect(formStep?.inputData?.['email']).toBeDefined();
    expect(formStep?.inputData?.['password']).toBeDefined();
  });

  it('creates error-path test case clones with one invalid field each', () => {
    const field = createFormField({
      inputType: 'text',
      name: 'username',
      constraints: {
        required: true,
        pattern: null,
        min: null,
        max: null,
        minLength: 3,
        maxLength: null,
      },
    });
    const form = createFormModel([field]);

    const tc = createTestCase({
      steps: [
        createTestStep({
          action: 'form-submit',
          selector: '#form',
          selectorStrategy: 'css',
          description: 'Submit form',
        }),
      ],
    });

    const result = generateTestData([tc], [form], realisticConfig);
    const errorPaths = result.filter((r) => r.type === 'error-path');
    // required + minLength = 2 violations
    expect(errorPaths.length).toBe(2);

    for (const ep of errorPaths) {
      expect(ep.tags).toContain('error-path');
      expect(ep.id).toContain('error');
    }
  });

  it('leaves non-form steps unchanged', () => {
    const form = createFormModel([createFormField({ inputType: 'text', name: 'q' })]);

    const clickStep = createTestStep({
      action: 'click',
      selector: '#btn',
      selectorStrategy: 'id',
      description: 'Click button',
    });

    const tc = createTestCase({
      steps: [
        clickStep,
        createTestStep({
          action: 'form-submit',
          selector: '#form',
          selectorStrategy: 'css',
          description: 'Submit form',
        }),
      ],
    });

    const result = generateTestData([tc], [form], realisticConfig);
    const happyPath = result.find((r) => r.type === 'happy-path');
    expect(happyPath).toBeDefined();

    // The click step should not have inputData added
    const nonFormStep = happyPath?.steps.find((s) => s.action === 'click');
    expect(nonFormStep).toBeDefined();
    expect(nonFormStep?.inputData).toBeUndefined();
  });

  it('returns original test cases with inputData for happy paths plus new error-path test cases', () => {
    const field = createFormField({
      inputType: 'email',
      name: 'email',
      constraints: {
        required: true,
        pattern: null,
        min: null,
        max: null,
        minLength: null,
        maxLength: null,
      },
    });
    const form = createFormModel([field]);

    const tc = createTestCase({
      type: 'happy-path',
      steps: [
        createTestStep({
          action: 'form-submit',
          selector: '#form',
          selectorStrategy: 'css',
          description: 'Submit form',
        }),
      ],
    });

    const result = generateTestData([tc], [form], realisticConfig);

    // Should have original happy-path plus error-path variants
    const happyPaths = result.filter((r) => r.type === 'happy-path');
    const errorPaths = result.filter((r) => r.type === 'error-path');

    expect(happyPaths.length).toBe(1);
    expect(errorPaths.length).toBeGreaterThan(0);

    // Happy path should have inputData populated
    const happyFormStep = happyPaths[0]?.steps.find((s) => s.action === 'form-submit');
    expect(happyFormStep?.inputData).toBeDefined();
    expect(happyFormStep?.inputData?.['email']).toBeDefined();
  });

  it('uses boundary strategy when configured', () => {
    const field = createFormField({
      inputType: 'number',
      name: 'age',
      constraints: {
        required: false,
        pattern: null,
        min: '18',
        max: '100',
        minLength: null,
        maxLength: null,
      },
    });
    const form = createFormModel([field]);

    const tc = createTestCase({
      steps: [
        createTestStep({
          action: 'form-submit',
          selector: '#form',
          selectorStrategy: 'css',
          description: 'Submit form',
        }),
      ],
    });

    const result = generateTestData([tc], [form], boundaryConfig);
    const happyPath = result.find((r) => r.type === 'happy-path');
    const formStep = happyPath?.steps.find((s) => s.action === 'form-submit');
    // Boundary strategy returns exact min value
    expect(Number(formStep?.inputData?.['age'])).toBe(18);
  });
});
