import { describe, it, expect } from 'vitest';
import type {
  ExplorationResult,
  AppGraph,
  AppNode,
  AppEdge,
  CoverageMetrics,
  CoverageRatio,
  CycleReport,
  UserJourney,
  GraphMetadata,
} from '@sentinel/discovery';
import type {
  StateTransitionGraph,
  FormModel,
  DomNode,
  FormField,
  FieldConstraints,
} from '@sentinel/analysis';
import type { GeneratorConfig, TestCase } from '@sentinel/generator';
import { planTestCases } from '@sentinel/generator';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makeDomNode(overrides: Partial<DomNode> = {}): DomNode {
  return {
    tag: 'div',
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath: '/html/body/div',
    cssSelector: 'div',
    ...overrides,
  };
}

function makeCoverageRatio(overrides: Partial<CoverageRatio> = {}): CoverageRatio {
  return {
    covered: 0,
    total: 0,
    percentage: 0,
    ...overrides,
  };
}

function makeCoverageMetrics(overrides: Partial<CoverageMetrics> = {}): CoverageMetrics {
  return {
    pageCoverage: makeCoverageRatio(),
    elementCoverage: makeCoverageRatio(),
    pathCoverage: makeCoverageRatio(),
    ...overrides,
  };
}

function makeCycleReport(overrides: Partial<CycleReport> = {}): CycleReport {
  return {
    entries: [],
    totalCyclesDetected: 0,
    ...overrides,
  };
}

function makeFieldConstraints(overrides: Partial<FieldConstraints> = {}): FieldConstraints {
  return {
    required: false,
    pattern: null,
    min: null,
    max: null,
    minLength: null,
    maxLength: null,
    ...overrides,
  };
}

function makeFormField(overrides: Partial<FormField> = {}): FormField {
  return {
    node: makeDomNode({ tag: 'input' }),
    inputType: 'text',
    name: 'username',
    label: 'Username',
    placeholder: null,
    constraints: makeFieldConstraints({ required: true }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const loginNode: AppNode = {
  id: 'node-login',
  url: 'https://app.example.com/login',
  title: 'Login Page',
  elementCount: 12,
  discoveryTimestamp: 1000,
  domHash: 'hash-login',
  screenshotPath: null,
};

const dashboardNode: AppNode = {
  id: 'node-dashboard',
  url: 'https://app.example.com/dashboard',
  title: 'Dashboard',
  elementCount: 24,
  discoveryTimestamp: 2000,
  domHash: 'hash-dashboard',
  screenshotPath: null,
};

const settingsNode: AppNode = {
  id: 'node-settings',
  url: 'https://app.example.com/settings',
  title: 'Settings',
  elementCount: 18,
  discoveryTimestamp: 3000,
  domHash: 'hash-settings',
  screenshotPath: null,
};

const edgeLoginToDashboard: AppEdge = {
  sourceId: 'node-login',
  targetId: 'node-dashboard',
  actionType: 'form-submit',
  selector: '#login-form',
  httpStatus: 200,
};

const edgeDashboardToSettings: AppEdge = {
  sourceId: 'node-dashboard',
  targetId: 'node-settings',
  actionType: 'click',
  selector: 'a.settings-link',
  httpStatus: null,
};

const metadata: GraphMetadata = {
  startUrl: 'https://app.example.com/login',
  startedAt: 1000,
  completedAt: 4000,
};

const graph: AppGraph = {
  nodes: [loginNode, dashboardNode, settingsNode],
  edges: [edgeLoginToDashboard, edgeDashboardToSettings],
  metadata,
};

const authJourney: UserJourney = {
  id: 'journey-auth',
  name: 'User Login',
  type: 'authentication',
  steps: [edgeLoginToDashboard],
  entryNodeId: 'node-login',
  exitNodeId: 'node-dashboard',
};

const navJourney: UserJourney = {
  id: 'journey-nav',
  name: 'Navigate to Settings',
  type: 'content-navigation',
  steps: [edgeDashboardToSettings],
  entryNodeId: 'node-dashboard',
  exitNodeId: 'node-settings',
};

const explorationResult: ExplorationResult = {
  graph,
  coverage: makeCoverageMetrics(),
  journeys: [authJourney, navJourney],
  cycleReport: makeCycleReport(),
};

const emptyStateGraph: StateTransitionGraph = {
  states: [],
  transitions: [],
};

const loginForm: FormModel = {
  formElement: makeDomNode({ tag: 'form', id: 'login-form' }),
  action: '/api/login',
  method: 'POST',
  fields: [
    makeFormField({ name: 'username', label: 'Username', inputType: 'text' }),
    makeFormField({
      name: 'password',
      label: 'Password',
      inputType: 'password',
    }),
  ],
  isMultiStep: false,
};

const forms: readonly FormModel[] = [loginForm];

const defaultConfig: GeneratorConfig = {
  assertionDepth: 'standard',
  dataStrategy: 'realistic',
  outputFormat: 'playwright-ts',
  outputDir: './output',
};

// ---------------------------------------------------------------------------
// planTestCases
// ---------------------------------------------------------------------------

describe('planTestCases', () => {
  it('creates one TestCase per UserJourney', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result).toHaveLength(2);
  });

  it('derives TestCase name from UserJourney.name', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.name).toBe('User Login');
    expect(result[1]?.name).toBe('Navigate to Settings');
  });

  it('sets TestCase type to happy-path', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    for (const tc of result) {
      expect(tc.type).toBe('happy-path');
    }
  });

  it('sets TestCase journeyId to the journey id', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.journeyId).toBe('journey-auth');
    expect(result[1]?.journeyId).toBe('journey-nav');
  });

  it('creates steps matching journey steps length', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.steps).toHaveLength(authJourney.steps.length);
    expect(result[1]?.steps).toHaveLength(navJourney.steps.length);
  });

  it('maps each step action from AppEdge.actionType', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.steps[0]?.action).toBe('form-submit');
    expect(result[1]?.steps[0]?.action).toBe('click');
  });

  it('maps each step selector from AppEdge.selector', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.steps[0]?.selector).toBe('#login-form');
    expect(result[1]?.steps[0]?.selector).toBe('a.settings-link');
  });

  it('defaults selectorStrategy to css when no stability analysis available', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    for (const tc of result) {
      for (const step of tc.steps) {
        expect(step.selectorStrategy).toBe('css');
      }
    }
  });

  it('sets assertions to empty array for each step', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    for (const tc of result) {
      for (const step of tc.steps) {
        expect(step.assertions).toEqual([]);
      }
    }
  });

  it('includes navigation setup step when entry node is not the start URL', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    // Journey 2 (navJourney) starts at dashboard, not login (startUrl)
    const navTestCase = result[1] as TestCase;
    expect(navTestCase.setupSteps).toHaveLength(1);
    expect(navTestCase.setupSteps[0]?.action).toBe('navigation');
    expect(navTestCase.setupSteps[0]?.selector).toBe('https://app.example.com/dashboard');
  });

  it('has empty setupSteps when entry node IS the start URL', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    // Journey 1 (authJourney) starts at login which is the startUrl
    const authTestCase = result[0] as TestCase;
    expect(authTestCase.setupSteps).toHaveLength(0);
  });

  it('sets teardownSteps to empty for content-navigation journeys', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    const navTestCase = result[1] as TestCase;
    expect(navTestCase.teardownSteps).toHaveLength(0);
  });

  it('derives suite name as auth for authentication journeys', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.suite).toBe('auth');
  });

  it('derives suite name as slug of entry node title for content-navigation journeys', () => {
    const result = planTestCases(explorationResult, emptyStateGraph, forms, defaultConfig);
    // navJourney entry node is dashboard with title "Dashboard"
    expect(result[1]?.suite).toBe('dashboard');
  });

  it('returns empty array when ExplorationResult.journeys is empty', () => {
    const emptyResult: ExplorationResult = {
      ...explorationResult,
      journeys: [],
    };
    const result = planTestCases(emptyResult, emptyStateGraph, forms, defaultConfig);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('derives suite name as slug of entry node title for form-submission journeys', () => {
    const formJourney: UserJourney = {
      id: 'journey-form',
      name: 'Submit Contact Form',
      type: 'form-submission',
      steps: [edgeLoginToDashboard],
      entryNodeId: 'node-login',
      exitNodeId: 'node-dashboard',
    };
    const resultWithForm: ExplorationResult = {
      ...explorationResult,
      journeys: [formJourney],
    };
    const result = planTestCases(resultWithForm, emptyStateGraph, forms, defaultConfig);
    // entry node is login with title "Login Page" → "login-page"
    expect(result[0]?.suite).toBe('login-page');
  });

  it('derives suite name as slug of entry node title for custom journeys', () => {
    const customJourney: UserJourney = {
      id: 'journey-custom',
      name: 'Custom Flow',
      type: 'custom',
      steps: [edgeDashboardToSettings],
      entryNodeId: 'node-dashboard',
      exitNodeId: 'node-settings',
    };
    const resultWithCustom: ExplorationResult = {
      ...explorationResult,
      journeys: [customJourney],
    };
    const result = planTestCases(resultWithCustom, emptyStateGraph, forms, defaultConfig);
    expect(result[0]?.suite).toBe('dashboard');
  });
});
