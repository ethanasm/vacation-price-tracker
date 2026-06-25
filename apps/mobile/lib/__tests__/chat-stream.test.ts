import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseChunk, type SseState } from '../chat-stream';

test('accumulates assistant text across chunks and surfaces tool-call events (real API shape)', () => {
  // The API streams ChatChunk JSON: text is {"type":"content","content":"…"},
  // tool calls are {"type":"tool_call","tool_call":{"name":"…"}}, and the
  // terminal marker is {"type":"done"}.
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"content","content":"Hel"}\n\n');
  state = parseSseChunk(
    state,
    'data: {"type":"content","content":"lo"}\n\ndata: {"type":"tool_call","tool_call":{"id":"1","name":"create_trip","arguments":"{}"}}\n\n',
  );
  assert.equal(state.text, 'Hello');
  assert.deepEqual(state.toolCalls, ['create_trip']);
  state = parseSseChunk(state, 'data: {"type":"done","thread_id":"abc"}\n\n');
  assert.equal(state.done, true);
});

test('keeps a partial trailing event in the buffer until its terminator arrives', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"content","content":"par');
  assert.equal(state.text, ''); // partial — not yet emitted
  state = parseSseChunk(state, 'tial"}\n\n');
  assert.equal(state.text, 'partial');
});

test('tolerates delta / token / text field naming for text deltas', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"text","delta":"a"}\n\n');
  state = parseSseChunk(state, 'data: {"type":"text","token":"b"}\n\n');
  state = parseSseChunk(state, 'data: {"type":"text","text":"c"}\n\n');
  assert.equal(state.text, 'abc');
});

test('treats a bare [DONE] sentinel as terminal', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: [DONE]\n\n');
  assert.equal(state.done, true);
});

test('accepts a top-level name on a tool_call event', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"tool_call","name":"search_flights"}\n\n');
  assert.deepEqual(state.toolCalls, ['search_flights']);
});

test('ignores unknown event types and malformed JSON without throwing', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"rate_limited","rate_limit":{"attempt":1}}\n\n');
  state = parseSseChunk(state, 'data: not-json\n\n');
  state = parseSseChunk(state, ': a comment line\n\n');
  state = parseSseChunk(state, 'data: {"type":"content","content":"ok"}\n\n');
  assert.equal(state.text, 'ok');
  assert.deepEqual(state.toolCalls, []);
  assert.equal(state.done, false);
});
