/**
 * Pure SSE parser for the `/v1/chat/messages` stream.
 *
 * The API streams `text/event-stream` where each event is a single
 * `data: <json>\n\n` line. The JSON is a serialized `ChatChunk`
 * (apps/api/app/schemas/chat.py):
 *   - text:       {"type":"content","content":"…"}
 *   - tool call:  {"type":"tool_call","tool_call":{"id","name","arguments"}}
 *   - terminal:   {"type":"done","thread_id":"…"}
 *
 * The parser is deliberately tolerant so it survives backend shape drift:
 *   - text deltas may arrive under `content` / `text` / `token` / `delta`;
 *   - tool-call names may be nested (`tool_call.name`) or top-level (`name`);
 *   - both a `{"type":"done"}` event and a bare `[DONE]` sentinel are terminal;
 *   - unknown event types and unparseable lines are ignored, never fatal.
 *
 * It is a pure reducer: `parseSseChunk(state, chunk) -> nextState`. The screen
 * feeds it decoded `ReadableStream` chunks (or a single `res.text()` body on
 * platforms without a streaming body) and re-renders from the returned state.
 */

export interface SseState {
  /** Bytes received but not yet terminated by a blank line. */
  buffer: string;
  /** Accumulated assistant text. */
  text: string;
  /** Tool-call names surfaced so far, in arrival order. */
  toolCalls: string[];
  /** True once the stream signals completion. */
  done: boolean;
}

/** A fresh, empty parser state. */
export function initSseState(): SseState {
  return { buffer: '', text: '', toolCalls: [], done: false };
}

type ChunkPayload = {
  type?: string;
  content?: unknown;
  text?: unknown;
  token?: unknown;
  delta?: unknown;
  name?: unknown;
  tool_call?: { name?: unknown } | null;
};

function asText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Fold one raw stream chunk into the parser state, returning a new state.
 *
 * Appends `chunk` to the buffer, splits on the SSE event terminator (`\n\n`),
 * keeps any trailing partial event in the buffer, and applies each complete
 * `data:` event to the accumulators.
 */
export function parseSseChunk(state: SseState, chunk: string): SseState {
  const buffer = state.buffer + chunk;
  const parts = buffer.split('\n\n');
  // The last element is an incomplete event (or '' if the chunk ended on a
  // terminator) — keep it buffered until its terminator arrives.
  const nextBuffer = parts.pop() ?? '';

  let { text, done } = state;
  const toolCalls = [...state.toolCalls];

  for (const rawEvent of parts) {
    // An SSE event may span multiple `data:` lines; concatenate their payloads.
    const data = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('');

    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      continue;
    }

    let payload: ChunkPayload;
    try {
      payload = JSON.parse(data) as ChunkPayload;
    } catch {
      continue; // ignore malformed JSON
    }

    if (payload.type === 'done') {
      done = true;
      continue;
    }

    // Text delta — accept whichever field the backend used.
    const delta =
      asText(payload.content) || asText(payload.text) || asText(payload.token) || asText(payload.delta);
    if (delta) text += delta;

    if (payload.type === 'tool_call') {
      const name = asText(payload.tool_call?.name) || asText(payload.name);
      if (name) toolCalls.push(name);
    }
  }

  return { buffer: nextBuffer, text, toolCalls, done };
}
