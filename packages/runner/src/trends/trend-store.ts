import Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';
import type { RunResult, TrendReport } from '../types.js';

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export class TrendStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db);
  }

  persistRun(result: RunResult): void {
    const insertRun = this.db.prepare(
      'INSERT INTO runs (run_id, started_at, completed_at, total, passed, failed) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const insertResult = this.db.prepare(
      'INSERT INTO test_results (run_id, test_id, test_name, suite, status, duration) VALUES (?, ?, ?, ?, ?, ?)',
    );

    const transaction = this.db.transaction(() => {
      insertRun.run(
        result.runId,
        result.startedAt,
        result.completedAt,
        result.summary.total,
        result.summary.passed,
        result.summary.failed,
      );
      for (const tr of result.results) {
        insertResult.run(result.runId, tr.testId, tr.testName, tr.suite, tr.status, tr.duration);
      }
    });
    transaction();
  }

  getTrends(limit = 10): readonly TrendReport[] {
    const rows = this.db
      .prepare(
        `
      SELECT
        test_id,
        test_name,
        suite,
        COUNT(*) as run_count,
        SUM(CASE WHEN status IN ('passed', 'passed-with-retry') THEN 1 ELSE 0 END) as pass_count,
        AVG(duration) as avg_duration
      FROM test_results tr
      INNER JOIN (
        SELECT run_id FROM runs ORDER BY started_at DESC LIMIT ?
      ) recent ON tr.run_id = recent.run_id
      GROUP BY test_id
    `,
      )
      .all(limit) as Array<{
      test_id: string;
      test_name: string;
      suite: string;
      run_count: number;
      pass_count: number;
      avg_duration: number;
    }>;

    return rows.map((row) => {
      const passRate = row.run_count > 0 ? row.pass_count / row.run_count : 0;
      return {
        testId: row.test_id,
        testName: row.test_name,
        suite: row.suite,
        passRate,
        avgDuration: Math.round(row.avg_duration),
        isFlaky: passRate > 0.2 && passRate < 0.8,
        runCount: row.run_count,
      };
    });
  }

  getTrend(testId: string, limit = 10): TrendReport | undefined {
    const trends = this.getTrends(limit);
    return trends.find((t) => t.testId === testId);
  }

  getRunHistory(limit = 10): ReadonlyArray<{
    runId: string;
    startedAt: number;
    completedAt: number;
    total: number;
    passed: number;
    failed: number;
  }> {
    return this.db
      .prepare(
        'SELECT run_id as runId, started_at as startedAt, completed_at as completedAt, total, passed, failed FROM runs ORDER BY started_at DESC LIMIT ?',
      )
      .all(limit) as Array<{
      runId: string;
      startedAt: number;
      completedAt: number;
      total: number;
      passed: number;
      failed: number;
    }>;
  }

  exportCsv(): string {
    const trends = this.getTrends(100);
    const header = 'test_id,test_name,suite,pass_rate,avg_duration,is_flaky,run_count';
    const rows = trends.map(
      (t) =>
        `${escapeCsv(t.testId)},${escapeCsv(t.testName)},${escapeCsv(t.suite)},${t.passRate.toFixed(2)},${String(t.avgDuration)},${String(t.isFlaky)},${String(t.runCount)}`,
    );
    return [header, ...rows].join('\n');
  }

  close(): void {
    this.db.close();
  }
}
