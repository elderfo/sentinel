import type {
  CoverageRatio,
  CoverageMetrics,
  CoverageThresholds,
  ThresholdResult,
} from '../types.js';

function ratio(covered: number, total: number): CoverageRatio {
  return {
    covered,
    total,
    percentage: total === 0 ? 0 : (covered / total) * 100,
  };
}

export function calculateCoverage(
  pagesVisited: number,
  pagesDiscovered: number,
  elementsActivated: number,
  elementsFound: number,
  edgesTraversed: number,
  edgesDiscovered: number,
): CoverageMetrics {
  return {
    pageCoverage: ratio(pagesVisited, pagesDiscovered),
    elementCoverage: ratio(elementsActivated, elementsFound),
    pathCoverage: ratio(edgesTraversed, edgesDiscovered),
  };
}

export function checkThresholds(
  metrics: CoverageMetrics,
  thresholds: CoverageThresholds,
): ThresholdResult {
  const details: string[] = [];
  let met = true;

  if (
    thresholds.minPageCoverage !== undefined &&
    metrics.pageCoverage.percentage < thresholds.minPageCoverage
  ) {
    met = false;
    details.push(
      `Page coverage ${metrics.pageCoverage.percentage.toFixed(1)}% below ${String(thresholds.minPageCoverage)}% threshold`,
    );
  }

  if (
    thresholds.minElementCoverage !== undefined &&
    metrics.elementCoverage.percentage < thresholds.minElementCoverage
  ) {
    met = false;
    details.push(
      `Element coverage ${metrics.elementCoverage.percentage.toFixed(1)}% below ${String(thresholds.minElementCoverage)}% threshold`,
    );
  }

  if (
    thresholds.minPathCoverage !== undefined &&
    metrics.pathCoverage.percentage < thresholds.minPathCoverage
  ) {
    met = false;
    details.push(
      `Path coverage ${metrics.pathCoverage.percentage.toFixed(1)}% below ${String(thresholds.minPathCoverage)}% threshold`,
    );
  }

  return { met, details };
}
