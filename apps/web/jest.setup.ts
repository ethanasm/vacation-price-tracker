import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

global.TextEncoder = TextEncoder;
// biome-ignore lint/suspicious/noExplicitAny: Polyfill for TextDecoder
global.TextDecoder = TextDecoder as any;

Object.defineProperty(global.self, "crypto", {
  value: {
    subtle: webcrypto.subtle,
  },
});
