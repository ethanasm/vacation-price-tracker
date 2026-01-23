import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

global.TextEncoder = TextEncoder;
// biome-ignore lint/suspicious/noExplicitAny: Polyfill for TextDecoder
global.TextDecoder = TextDecoder as any;

// Only set up crypto on self if we're in a browser-like environment (jsdom)
// In Node environment (for SSR tests), global.self doesn't exist
if (typeof global.self !== "undefined") {
  Object.defineProperty(global.self, "crypto", {
    value: {
      subtle: webcrypto.subtle,
    },
  });
}

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
