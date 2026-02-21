import { describe, it, expect } from 'vitest';
import { generate } from '../orchestrator/generate.js';
import type {
  GenerationResult,
  GeneratorError,
  GeneratorConfig,
  AiProvider,
  AiProviderResponse,
} from '../types.js';
import type {
  ExplorationResult,
  UserJourney,
  AppNode,
  AppEdge,
  CoverageMetrics,
  CoverageRatio,
  CycleReport,
  GraphMetadata,
} from '@sentinel/discovery';
import type {
  StateTransitionGraph,
  FormModel,
  DomNode,
  PageState,
  FieldConstraints,
  FormField,
} from '@sentinel/analysis';

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isError(result: GenerationResult | GeneratorError): result is GeneratorError {
  return 'code' in result;
}

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

function makePageState(overrides: Partial<PageState> = {}): PageState {
  return {
    id: 'state-1',
    url: 'https://example.com',
    domHash: 'abc123',
    modalIndicators: [],
    timestamp: Date.now(),
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

const homeNode: AppNode = {
  id: 'n1',
  url: 'https://example.com',
  title: 'Home',
  elementCount: 10,
  discoveryTimestamp: Date.now(),
  domHash: 'hash1',
  screenshotPath: null,
};

const dashboardNode: AppNode = {
  id: 'n2',
  url: 'https://example.com/dashboard',
  title: 'Dashboard',
  elementCount: 20,
  discoveryTimestamp: Date.now(),
  domHash: 'hash2',
  screenshotPath: null,
};

const loginEdge: AppEdge = {
  sourceId: 'n1',
  targetId: 'n2',
  actionType: 'click',
  selector: '#login-btn',
  httpStatus: 200,
};

const metadata: GraphMetadata = {
  startUrl: 'https://example.com',
  startedAt: Date.now(),
  completedAt: Date.now(),
};

const authJourney: UserJourney = {
  id: 'j1',
  name: 'Login to dashboard',
  type: 'authentication',
  entryNodeId: 'n1',
  exitNodeId: 'n2',
  steps: [loginEdge],
};

function makeExplorationResult(overrides: Partial<ExplorationResult> = {}): ExplorationResult {
  return {
    graph: {
      nodes: [homeNode, dashboardNode],
      edges: [loginEdge],
      metadata,
    },
    journeys: [authJourney],
    coverage: makeCoverageMetrics({
      pageCoverage: makeCoverageRatio({ covered: 2, total: 2, percentage: 100 }),
      elementCoverage: makeCoverageRatio({ covered: 30, total: 30, percentage: 100 }),
      pathCoverage: makeCoverageRatio({ covered: 1, total: 1, percentage: 100 }),
    }),
    cycleReport: makeCycleReport(),
    ...overrides,
  };
}

function makeStateGraph(): StateTransitionGraph {
  const successMessage = makeDomNode({
    tag: 'span',
    textContent: 'Welcome!',
    cssSelector: '.welcome',
  });
  return {
    states: [
      makePageState({ id: 's1', url: 'https://example.com' }),
      makePageState({ id: 's2', url: 'https://example.com/dashboard' }),
    ],
    transitions: [
      {
        action: 'click',
        preState: makePageState({ id: 's1', url: 'https://example.com' }),
        postState: makePageState({ id: 's2', url: 'https://example.com/dashboard' }),
        domDiff: { added: [successMessage], removed: [], modified: [] },
      },
    ],
  };
}

const emptyStateGraph: StateTransitionGraph = { states: [], transitions: [] };

const defaultConfig: GeneratorConfig = {
  assertionDepth: 'standard',
  dataStrategy: 'realistic',
  outputFormat: 'playwright-ts',
  outputDir: './sentinel-tests',
};

const loginForm: FormModel = {
  formElement: makeDomNode({ tag: 'form', id: 'login-form' }),
  action: '/api/login',
  method: 'POST',
  fields: [
    makeFormField({ name: 'username', label: 'Username', inputType: 'text' }),
    makeFormField({ name: 'password', label: 'Password', inputType: 'password' }),
  ],
  isMultiStep: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generate', () => {
  it('returns GenerationResult with suites, manifest, and stats', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result).toHaveProperty('suites');
    expect(result).toHaveProperty('manifest');
    expect(result).toHaveProperty('stats');
  });

  it('produces at least 1 test (the happy path)', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.stats.totalTests).toBeGreaterThanOrEqual(1);
  });

  it('produces happyPathTests equal to number of journeys', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.stats.happyPathTests).toBe(1);
  });

  it('manifest.generatedAt is a positive number', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.manifest.generatedAt).toBeGreaterThan(0);
  });

  it('manifest.files has at least 1 entry', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.manifest.files.length).toBeGreaterThanOrEqual(1);
  });

  it('each ManifestEntry has fileName, journeyIds, testCount, checksum', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    for (const entry of result.manifest.files) {
      expect(entry).toHaveProperty('fileName');
      expect(typeof entry.fileName).toBe('string');
      expect(entry).toHaveProperty('journeyIds');
      expect(Array.isArray(entry.journeyIds)).toBe(true);
      expect(entry).toHaveProperty('testCount');
      expect(typeof entry.testCount).toBe('number');
      expect(entry).toHaveProperty('checksum');
      expect(typeof entry.checksum).toBe('string');
      expect(entry.checksum.length).toBeGreaterThan(0);
    }
  });

  it('works with outputFormat playwright-ts', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], {
      ...defaultConfig,
      outputFormat: 'playwright-ts',
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.suites.length).toBeGreaterThanOrEqual(1);
  });

  it('works with outputFormat json', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], {
      ...defaultConfig,
      outputFormat: 'json',
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.suites.length).toBeGreaterThanOrEqual(1);
  });

  it('returns EMPTY_EXPLORATION error when journeys array is empty', async () => {
    const result = await generate(
      makeExplorationResult({ journeys: [] }),
      emptyStateGraph,
      [],
      [],
      defaultConfig,
    );
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.code).toBe('EMPTY_EXPLORATION');
  });

  it('returns INVALID_CONFIG error for bad assertionDepth', async () => {
    const badConfig = {
      ...defaultConfig,
      assertionDepth: 'ultra' as GeneratorConfig['assertionDepth'],
    };
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], badConfig);
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.code).toBe('INVALID_CONFIG');
  });

  it('works without AI provider (no edge cases added)', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.stats.edgeCaseTests).toBe(0);
  });

  it('works with a no-op AI provider when ai.enabled is false', async () => {
    const noOpProvider: AiProvider = {
      name: 'no-op',
      complete: (): Promise<AiProviderResponse> =>
        Promise.resolve({ content: '[]', tokensUsed: 0 }),
    };
    // ai is undefined in config, so generateEdgeCases returns original test cases
    const result = await generate(
      makeExplorationResult(),
      emptyStateGraph,
      [],
      [],
      defaultConfig,
      noOpProvider,
    );
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    // No edge cases because config.ai?.enabled is not true
    expect(result.stats.edgeCaseTests).toBe(0);
  });

  it('produces totalAssertions > 0 when state graph has transitions with diffs', async () => {
    const stateGraph = makeStateGraph();
    const result = await generate(makeExplorationResult(), stateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.stats.totalAssertions).toBeGreaterThan(0);
  });

  it('suites contain test cases with assertions attached', async () => {
    const stateGraph = makeStateGraph();
    const result = await generate(makeExplorationResult(), stateGraph, [], [], defaultConfig);
    expect(isError(result)).toBe(false);
    if (isError(result)) return;

    const allTestCases = result.suites.flatMap((s) => s.testCases);
    const allAssertions = allTestCases.flatMap((tc) => tc.steps.flatMap((step) => step.assertions));
    expect(allAssertions.length).toBeGreaterThan(0);
  });

  it('json output produces a single manifest entry for all suites', async () => {
    const result = await generate(makeExplorationResult(), emptyStateGraph, [], [], {
      ...defaultConfig,
      outputFormat: 'json',
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    // JsonEmitter produces one file for all suites
    expect(result.manifest.files.length).toBe(1);
    expect(result.manifest.files[0]?.fileName).toBe('sentinel-tests.json');
  });

  it('generates error-path tests when forms are provided', async () => {
    const result = await generate(
      makeExplorationResult(),
      emptyStateGraph,
      [loginForm],
      [],
      defaultConfig,
    );
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.stats.errorPathTests).toBeGreaterThan(0);
    expect(result.stats.totalTests).toBeGreaterThan(result.stats.happyPathTests);
  });
});
