import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

// Mock react-markdown (ESM module that Jest can't transform)
jest.mock("react-markdown", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => children,
  };
});

global.TextEncoder = TextEncoder;

// Mock EventSource for SSE tests
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  withCredentials: boolean;

  private listeners: Map<string, Array<(event: MessageEvent) => void>> = new Map();

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper method for tests to simulate events
  dispatchEvent(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Polyfill for EventSource
global.EventSource = MockEventSource as any;
// biome-ignore lint/suspicious/noExplicitAny: Polyfill for TextDecoder
global.TextDecoder = TextDecoder as any;

// Polyfill crypto.randomUUID for jsdom environment
Object.defineProperty(global, "crypto", {
  value: {
    subtle: webcrypto.subtle,
    randomUUID: () => webcrypto.randomUUID(),
    getRandomValues: (arr: Uint8Array) => webcrypto.getRandomValues(arr),
  },
});

// Silence console.error output in tests (expected error paths are asserted in tests).
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

// Suppress Node warnings about missing --localstorage-file path in this test env.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning: unknown, ...args: unknown[]) => {
  const message =
    typeof warning === "string"
      ? warning
      : warning && typeof warning === "object" && "message" in warning
        ? String((warning as { message: unknown }).message)
        : "";
  if (message.includes("--localstorage-file")) {
    return;
  }
  return originalEmitWarning.call(process, warning as never, ...(args as never[]));
};
