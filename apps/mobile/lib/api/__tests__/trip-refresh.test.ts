import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollRefreshStatus, type RefreshOutcome } from '../trip-refresh';
import { ApiError } from '../errors';
import type { RefreshStatusResponse } from '../client';

function statusOf(status: string, error: string | null = null): RefreshStatusResponse {
  return {
    refresh_group_id: 'rg-1',
    status,
    total: 1,
    completed: status === 'completed' ? 1 : 0,
    failed: status === 'failed' ? 1 : 0,
    in_progress: status === 'running' ? 1 : 0,
    error,
  };
}

/** A fake clock where every sleep(ms) advances now() by ms — no real timers. */
function fakeTime(): { sleep: (ms: number) => Promise<void>; now: () => number; slept: number[] } {
  let t = 0;
  const slept: number[] = [];
  return {
    slept,
    now: () => t,
    sleep: (ms) => {
      slept.push(ms);
      t += ms;
      return Promise.resolve();
    },
  };
}

test('resolves completed as soon as the workflow finishes', async () => {
  const time = fakeTime();
  const seen: string[] = [];
  const results = [statusOf('running'), statusOf('completed')];
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async (gid) => {
      seen.push(gid);
      return results.shift() as RefreshStatusResponse;
    },
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'completed' } satisfies RefreshOutcome);
  assert.deepEqual(seen, ['rg-1', 'rg-1']);
  // First wait is the short initial delay, then the regular interval.
  assert.deepEqual(time.slept, [500, 2000]);
});

test('surfaces a failed workflow with its error message', async () => {
  const time = fakeTime();
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => statusOf('failed', 'Skiplagged returned 429'),
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'failed', error: 'Skiplagged returned 429' });
});

test('failed with no error detail yields error: null', async () => {
  const time = fakeTime();
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => statusOf('failed'),
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'failed', error: null });
});

test('tolerates transient 404s while Temporal registers the workflow', async () => {
  const time = fakeTime();
  let calls = 0;
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => {
      calls += 1;
      if (calls <= 2) throw new ApiError(404, 'Not found');
      return statusOf('completed');
    },
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'completed' });
  assert.equal(calls, 3);
});

test('a persistent 404 resolves not_found instead of polling to the deadline', async () => {
  const time = fakeTime();
  let calls = 0;
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => {
      calls += 1;
      throw new ApiError(404, 'Not found');
    },
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'not_found' });
  assert.equal(calls, 3); // REFRESH_MAX_NOT_FOUND
});

test('non-404 errors keep polling until the deadline, then time out', async () => {
  const time = fakeTime();
  let calls = 0;
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => {
      calls += 1;
      throw new ApiError(500, 'Internal error');
    },
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'timeout' });
  // 500ms initial delay + 2s intervals within the 60s window.
  assert.ok(calls > 25);
});

test('a still-running workflow times out at the deadline', async () => {
  const time = fakeTime();
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => statusOf('running'),
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'timeout' });
});

test('stops immediately when the caller aborts (screen unmount)', async () => {
  const time = fakeTime();
  let aborted = false;
  let calls = 0;
  const outcome = await pollRefreshStatus('rg-1', {
    getStatus: async () => {
      calls += 1;
      aborted = true; // unmount happens after the first response
      return statusOf('running');
    },
    isAborted: () => aborted,
    sleep: time.sleep,
    now: time.now,
  });
  assert.deepEqual(outcome, { kind: 'aborted' });
  assert.equal(calls, 1);
});
