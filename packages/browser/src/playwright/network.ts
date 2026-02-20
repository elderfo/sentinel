import type { NetworkRequest, NetworkResponse, HarEntry, HarArchive } from '../types.js';

const HAR_VERSION = '1.2';
const CREATOR_NAME = '@sentinel/browser';
const CREATOR_VERSION = '0.1.0';

/**
 * Converts a Record<string, string> headers map into the HAR name/value array
 * format required by HarEntry.
 */
function toHarHeaders(
  headers: Record<string, string>,
): ReadonlyArray<{ readonly name: string; readonly value: string }> {
  return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

/**
 * Builds a HarEntry from a captured request/response pair and the elapsed time
 * in milliseconds.
 */
function buildHarEntry(
  request: NetworkRequest,
  response: NetworkResponse,
  duration: number,
): HarEntry {
  const startedDateTime = new Date().toISOString();
  const requestBodySize = request.body !== undefined ? Buffer.byteLength(request.body, 'utf8') : 0;
  const responseBodySize =
    response.body !== undefined ? Buffer.byteLength(response.body, 'utf8') : 0;

  return {
    startedDateTime,
    time: duration,
    request: {
      method: request.method,
      url: request.url,
      headers: toHarHeaders(request.headers),
      bodySize: requestBodySize,
      ...(request.body !== undefined
        ? { postData: { mimeType: 'application/octet-stream', text: request.body } }
        : {}),
    },
    response: {
      status: response.status,
      statusText: String(response.status),
      headers: toHarHeaders(response.headers),
      bodySize: responseBodySize,
      content: {
        mimeType: response.headers['content-type'] ?? 'application/octet-stream',
        ...(response.body !== undefined ? { text: response.body } : {}),
      },
    },
    timings: {
      send: 0,
      wait: duration,
      receive: 0,
    },
  };
}

/** Accumulates HAR-format network entries recorded during a browser session. */
export class NetworkLog {
  private readonly log: HarEntry[] = [];

  /** Records a request-response pair with its round-trip duration in milliseconds. */
  record(request: NetworkRequest, response: NetworkResponse, duration: number): void {
    this.log.push(buildHarEntry(request, response, duration));
  }

  /** Returns a snapshot of all recorded entries in insertion order. */
  entries(): readonly HarEntry[] {
    return [...this.log];
  }

  /** Exports all recorded entries as a HAR archive. */
  exportHar(): HarArchive {
    return {
      log: {
        version: HAR_VERSION,
        creator: { name: CREATOR_NAME, version: CREATOR_VERSION },
        entries: [...this.log],
      },
    };
  }

  /** Clears all recorded entries. */
  clear(): void {
    this.log.length = 0;
  }
}
