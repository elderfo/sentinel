import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkLog } from '../playwright/network.js';
import type { NetworkRequest, NetworkResponse } from '../types.js';

const makeRequest = (url = 'https://example.com/api'): NetworkRequest => ({
  url,
  method: 'GET',
  headers: { accept: 'application/json' },
  resourceType: 'fetch',
});

const makeResponse = (url = 'https://example.com/api', status = 200): NetworkResponse => ({
  url,
  status,
  headers: { 'content-type': 'application/json' },
  body: '{"ok":true}',
});

describe('NetworkLog', () => {
  let log: NetworkLog;

  beforeEach(() => {
    log = new NetworkLog();
  });

  it('starts empty — entries() returns an empty array', () => {
    expect(log.entries()).toHaveLength(0);
  });

  it('records a request-response pair with correct url, status, and duration', () => {
    const request = makeRequest();
    const response = makeResponse();

    log.record(request, response, 123);

    const entries = log.entries();
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry?.request.url).toBe('https://example.com/api');
    expect(entry?.response.status).toBe(200);
    expect(entry?.time).toBe(123);
  });

  it('records multiple entries in insertion order', () => {
    log.record(
      makeRequest('https://example.com/one'),
      makeResponse('https://example.com/one', 200),
      10,
    );
    log.record(
      makeRequest('https://example.com/two'),
      makeResponse('https://example.com/two', 404),
      20,
    );
    log.record(
      makeRequest('https://example.com/three'),
      makeResponse('https://example.com/three', 500),
      30,
    );

    const entries = log.entries();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.request.url).toBe('https://example.com/one');
    expect(entries[1]?.request.url).toBe('https://example.com/two');
    expect(entries[2]?.request.url).toBe('https://example.com/three');
  });

  it('exportHar() returns a HarArchive containing all recorded entries', () => {
    log.record(
      makeRequest('https://example.com/a'),
      makeResponse('https://example.com/a', 200),
      50,
    );
    log.record(
      makeRequest('https://example.com/b'),
      makeResponse('https://example.com/b', 201),
      75,
    );

    const har = log.exportHar();

    expect(har.log.version).toBe('1.2');
    expect(har.log.creator.name).toBe('@sentinel/browser');
    expect(har.log.entries).toHaveLength(2);
    expect(har.log.entries[0]?.request.url).toBe('https://example.com/a');
    expect(har.log.entries[1]?.request.url).toBe('https://example.com/b');
  });

  it('clear() removes all entries', () => {
    log.record(makeRequest(), makeResponse(), 10);
    log.record(makeRequest(), makeResponse(), 20);
    expect(log.entries()).toHaveLength(2);

    log.clear();

    expect(log.entries()).toHaveLength(0);
  });

  it('entries() returns a snapshot — mutations to the returned array do not affect the log', () => {
    log.record(makeRequest(), makeResponse(), 10);

    const snapshot = log.entries() as HarEntry[];
    // Casting to mutable array to attempt mutation
    (snapshot as unknown as { push: (v: unknown) => void }).push({});

    expect(log.entries()).toHaveLength(1);
  });

  it('exportHar() entries snapshot does not share the internal array', () => {
    log.record(makeRequest(), makeResponse(), 10);

    const har = log.exportHar();
    log.clear();

    // The exported snapshot is independent of subsequent clear()
    expect(har.log.entries).toHaveLength(1);
    expect(log.entries()).toHaveLength(0);
  });
});

// Bring HarEntry into scope for the type assertion in the mutation test
type HarEntry = ReturnType<NetworkLog['entries']>[number];
