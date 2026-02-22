import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter, RunResult, TestResult } from '../types.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusIcon(status: TestResult['status']): string {
  switch (status) {
    case 'passed':
      return 'PASS';
    case 'failed':
      return 'FAIL';
    case 'skipped':
      return 'SKIP';
    case 'passed-with-retry':
      return 'RETRY';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function renderResultRow(result: TestResult): string {
  const errorDetail =
    result.status === 'failed' && result.error !== undefined
      ? `<div class="error">${escapeHtml(result.error.message)}</div>`
      : '';
  return `<tr class="status-${result.status}">
  <td>${escapeHtml(result.testName)}</td>
  <td>${escapeHtml(result.suite)}</td>
  <td class="status">${statusIcon(result.status)}</td>
  <td>${formatDuration(result.duration)}</td>
  <td>${errorDetail}</td>
</tr>`;
}

export class HtmlReporter implements Reporter {
  readonly format = 'html' as const;

  async write(result: RunResult, outputDir: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, 'sentinel-report.html');
    const { summary } = result;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sentinel Test Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; color: #333; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .summary-item { padding: 12px 20px; border-radius: 6px; font-weight: bold; }
  .summary-passed { background: #d4edda; color: #155724; }
  .summary-failed { background: #f8d7da; color: #721c24; }
  .summary-skipped { background: #fff3cd; color: #856404; }
  .summary-retry { background: #cce5ff; color: #004085; }
  .summary-total { background: #e2e3e5; color: #383d41; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
  th { background: #f8f9fa; }
  .status { font-weight: bold; }
  .status-passed .status { color: #28a745; }
  .status-failed .status { color: #dc3545; }
  .status-skipped .status { color: #ffc107; }
  .status-passed-with-retry .status { color: #007bff; }
  .error { color: #dc3545; font-size: 0.85em; margin-top: 4px; }
  h1 { margin-bottom: 4px; }
  .duration { color: #666; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>Sentinel Test Report</h1>
<p class="duration">Duration: ${formatDuration(summary.duration)}</p>
<div class="summary">
  <div class="summary-item summary-total">Total: ${String(summary.total)}</div>
  <div class="summary-item summary-passed">Passed: ${String(summary.passed)}</div>
  <div class="summary-item summary-failed">Failed: ${String(summary.failed)}</div>
  <div class="summary-item summary-skipped">Skipped: ${String(summary.skipped)}</div>
  <div class="summary-item summary-retry">Retried: ${String(summary.passedWithRetry)}</div>
</div>
<table>
<thead>
<tr><th>Test</th><th>Suite</th><th>Status</th><th>Duration</th><th>Details</th></tr>
</thead>
<tbody>
${result.results.map(renderResultRow).join('\n')}
</tbody>
</table>
</body>
</html>
`;

    await writeFile(filePath, html, 'utf-8');
    return filePath;
  }
}
