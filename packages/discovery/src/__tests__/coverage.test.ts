import { describe, it, expect } from 'vitest';
import { calculateCoverage, checkThresholds } from '../coverage/index.js';
import type { CoverageThresholds } from '../types.js';

describe('coverage-calculator', () => {
  describe('calculateCoverage', () => {
    it('calculates correct percentages', () => {
      const metrics = calculateCoverage(5, 10, 20, 100, 8, 15);

      expect(metrics.pageCoverage.covered).toBe(5);
      expect(metrics.pageCoverage.total).toBe(10);
      expect(metrics.pageCoverage.percentage).toBe(50);

      expect(metrics.elementCoverage.covered).toBe(20);
      expect(metrics.elementCoverage.total).toBe(100);
      expect(metrics.elementCoverage.percentage).toBe(20);

      expect(metrics.pathCoverage.covered).toBe(8);
      expect(metrics.pathCoverage.total).toBe(15);
      expect(metrics.pathCoverage.percentage).toBeCloseTo(53.33, 1);
    });

    it('handles zero totals without division errors', () => {
      const metrics = calculateCoverage(0, 0, 0, 0, 0, 0);

      expect(metrics.pageCoverage.percentage).toBe(0);
      expect(metrics.elementCoverage.percentage).toBe(0);
      expect(metrics.pathCoverage.percentage).toBe(0);
    });

    it('returns 100% when covered equals total', () => {
      const metrics = calculateCoverage(10, 10, 50, 50, 20, 20);
      expect(metrics.pageCoverage.percentage).toBe(100);
      expect(metrics.elementCoverage.percentage).toBe(100);
      expect(metrics.pathCoverage.percentage).toBe(100);
    });
  });

  describe('checkThresholds', () => {
    it('returns met when all percentages are above thresholds', () => {
      const metrics = calculateCoverage(8, 10, 80, 100, 15, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 70,
        minElementCoverage: 70,
        minPathCoverage: 70,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
      expect(result.details).toEqual([]);
    });

    it('returns not-met with details when below thresholds', () => {
      const metrics = calculateCoverage(3, 10, 20, 100, 5, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 50,
        minElementCoverage: 50,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(false);
      expect(result.details.length).toBe(2);
    });

    it('checks only specified thresholds', () => {
      const metrics = calculateCoverage(3, 10, 20, 100, 5, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 20,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
    });

    it('returns met when no thresholds are specified', () => {
      const metrics = calculateCoverage(1, 10, 1, 100, 1, 20);
      const thresholds: CoverageThresholds = {};

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
    });
  });
});
