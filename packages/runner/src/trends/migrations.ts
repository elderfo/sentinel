import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      failed INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(run_id),
      test_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      suite TEXT NOT NULL,
      status TEXT NOT NULL,
      duration INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
  `);
}
