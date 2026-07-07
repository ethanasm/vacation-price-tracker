/**
 * Poll loop for a manual price refresh, mirroring the web trip-detail page
 * (apps/web/src/app/trips/[tripId]/page.tsx pollRefreshStatus). The workflow
 * raises on Skiplagged errors (and does NOT save a snapshot), so this status
 * poll is the only channel that distinguishes "the fetch failed" from "the
 * fetch found nothing". Pure + injectable (no React/RN imports) so node:test
 * covers it directly — this file counts toward the mobile lib/** gate.
 */
import { ApiError } from './errors';
import type { RefreshStatusResponse } from './client';

export const REFRESH_POLL_INTERVAL_MS = 2_000;
export const REFRESH_INITIAL_DELAY_MS = 500;
export const REFRESH_MAX_POLL_MS = 60_000;
export const REFRESH_MAX_NOT_FOUND = 3;

export type RefreshOutcome =
  | { kind: 'completed' }
  | { kind: 'failed'; error: string | null }
  /** Deadline passed while the workflow was still running — refetch anyway. */
  | { kind: 'timeout' }
  /** Persistent 404: the workflow doesn't exist (e.g. history purged). */
  | { kind: 'not_found' }
  /** The caller's isAborted() flipped (screen unmounted) — do nothing. */
  | { kind: 'aborted' };

export interface PollRefreshOptions {
  getStatus: (refreshGroupId: string) => Promise<RefreshStatusResponse>;
  /** Checked after every sleep; lets an unmounting screen stop the loop. */
  isAborted?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  initialDelayMs?: number;
  maxPollMs?: number;
  maxNotFound?: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollRefreshStatus(
  refreshGroupId: string,
  opts: PollRefreshOptions,
): Promise<RefreshOutcome> {
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const isAborted = opts.isAborted ?? (() => false);
  const interval = opts.pollIntervalMs ?? REFRESH_POLL_INTERVAL_MS;
  const initialDelay = opts.initialDelayMs ?? REFRESH_INITIAL_DELAY_MS;
  const maxPollMs = opts.maxPollMs ?? REFRESH_MAX_POLL_MS;
  const maxNotFound = opts.maxNotFound ?? REFRESH_MAX_NOT_FOUND;

  const deadline = now() + maxPollMs;
  let first = true;
  let notFoundCount = 0;

  while (now() < deadline) {
    await sleep(first ? initialDelay : interval);
    if (isAborted()) return { kind: 'aborted' };
    first = false;
    try {
      const status = await opts.getStatus(refreshGroupId);
      notFoundCount = 0;
      if (status.status === 'completed') return { kind: 'completed' };
      if (status.status === 'failed') return { kind: 'failed', error: status.error ?? null };
      // "running" / "pending" — keep polling.
    } catch (err) {
      // The endpoint may briefly 404 while Temporal registers the workflow —
      // tolerate a few, but a persistent 404 means the workflow doesn't exist.
      // Other transient failures: keep polling until the deadline.
      if (err instanceof ApiError && err.status === 404) {
        notFoundCount += 1;
        if (notFoundCount >= maxNotFound) return { kind: 'not_found' };
      }
    }
  }
  return { kind: 'timeout' };
}
