import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import {
  extractDom,
  classifyInteractiveElements,
  detectForms,
  hashDomContent,
} from '@sentinel/analysis';
import type {
  ExplorationConfig,
  ExplorationResult,
  ExplorationState,
  ProgressCallback,
  AppNode,
  CycleEntry,
} from '../types.js';
import { createGraph, addNode, addEdge, completeGraph } from '../graph/graph.js';
import { normalizeUrl } from '../cycle/url-normalizer.js';
import {
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from '../cycle/cycle-detector.js';
import { isUrlAllowed } from '../scope/scope-filter.js';
import { calculateCoverage, checkThresholds } from '../coverage/coverage-calculator.js';
import { waitForPageReady } from '../spa/page-readiness.js';
import { identifyJourneys } from '../journey/journey-detector.js';

export async function explore(
  engine: BrowserEngine,
  page: PageHandle,
  config: ExplorationConfig,
  callbacks?: { readonly onProgress?: ProgressCallback },
): Promise<ExplorationResult> {
  let graph = createGraph(config.startUrl);
  const visited = new Set<string>();
  const paramUrlCounts = new Map<string, number>();
  const queue: string[] = [config.startUrl];
  const cycleEntries: CycleEntry[] = [];
  const activatedElementIds = new Set<string>();
  let totalElementsFound = 0;
  const startTime = Date.now();
  const baseDomain = new URL(config.startUrl).hostname;

  while (queue.length > 0) {
    if (graph.nodes.length >= config.maxPages) break;
    if (Date.now() - startTime >= config.timeoutMs) break;

    const url = config.strategy === 'breadth-first' ? (queue.shift() ?? '') : (queue.pop() ?? '');
    if (url === '') continue;

    const scopeDecision = isUrlAllowed(url, config.scope, baseDomain);
    if (!scopeDecision.allowed) continue;

    try {
      await engine.navigate(page, url);
    } catch {
      continue;
    }

    await waitForPageReady(engine, page, config.spaOptions);

    const currentUrl = engine.currentUrl(page);

    let dom;
    try {
      dom = await extractDom(engine, page);
    } catch {
      continue;
    }

    const domHash = hashDomContent(dom);
    const normalized = normalizeUrl(currentUrl);
    const fp = computeFingerprint(normalized, domHash);
    const cycleDecision = detectCycle(fp, visited, paramUrlCounts, config.cycleConfig);

    if (cycleDecision.isCycle) {
      if (cycleDecision.entry) cycleEntries.push(cycleDecision.entry);
      continue;
    }

    visited.add(fingerprintKey(fp));
    paramUrlCounts.set(normalized, (paramUrlCounts.get(normalized) ?? 0) + 1);

    const elements = classifyInteractiveElements(dom);
    detectForms(dom);
    totalElementsFound += elements.length;

    let title = '';
    try {
      const evaluated = await engine.evaluate<string>(page, '(() => document.title)()');
      title = typeof evaluated === 'string' ? evaluated : '';
    } catch {
      // title stays empty
    }

    const node: AppNode = {
      id: `node-${String(graph.nodes.length)}`,
      url: currentUrl,
      title,
      elementCount: elements.length,
      discoveryTimestamp: Date.now(),
      domHash,
      screenshotPath: null,
    };
    graph = addNode(graph, node);

    // Extract links and queue them
    for (const el of elements) {
      if (el.category === 'navigation-link') {
        const href = el.node.attributes['href'];
        if (href) {
          try {
            const fullUrl = new URL(href, currentUrl).href;
            const linkScope = isUrlAllowed(fullUrl, config.scope, baseDomain);
            if (linkScope.allowed) {
              queue.push(fullUrl);
              graph = addEdge(graph, {
                sourceId: node.id,
                targetId: '',
                actionType: 'navigation',
                selector: el.node.cssSelector,
                httpStatus: null,
              });
            }
          } catch {
            // Skip invalid URLs
          }
        }
      }
    }

    callbacks?.onProgress?.({
      pagesDiscovered: graph.nodes.length + queue.length,
      pagesVisited: graph.nodes.length,
      pagesRemaining: queue.length,
      elementsActivated: activatedElementIds.size,
      elapsedMs: Date.now() - startTime,
    });

    if (config.coverageThresholds) {
      const coverage = calculateCoverage(
        graph.nodes.length,
        graph.nodes.length + queue.length,
        activatedElementIds.size,
        totalElementsFound,
        graph.edges.length,
        graph.edges.length,
      );
      if (checkThresholds(coverage, config.coverageThresholds).met) break;
    }
  }

  const finalCoverage = calculateCoverage(
    graph.nodes.length,
    graph.nodes.length + queue.length,
    activatedElementIds.size,
    totalElementsFound,
    graph.edges.length,
    graph.edges.length,
  );

  return {
    graph: completeGraph(graph),
    coverage: finalCoverage,
    journeys: identifyJourneys(graph),
    cycleReport: createCycleReport(cycleEntries),
  };
}

export function serializeExplorationState(state: ExplorationState): string {
  return JSON.stringify(state);
}

export function deserializeExplorationState(json: string): ExplorationState {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('queue' in parsed) ||
    !('visitedFingerprints' in parsed) ||
    !('graph' in parsed)
  ) {
    throw new Error('Invalid exploration state JSON: missing required fields');
  }
  return parsed as ExplorationState;
}
