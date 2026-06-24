import { logClientEvent, errorMessage } from "../../lib/telemetry";

describe("logClientEvent", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn(() => Promise.resolve({ ok: true } as Response));
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs a keepalive telemetry event to the API", () => {
    logClientEvent("trip.load.failed", {
      message: "boom",
      level: "error",
      context: { status: 500 },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/telemetry/client");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("include");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      event: "trip.load.failed",
      message: "boom",
      level: "error",
      context: { status: 500 },
    });
  });

  it("defaults level to error", () => {
    logClientEvent("x", { message: "m" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.level).toBe("error");
  });

  it("swallows fetch rejections (best-effort)", () => {
    mockFetch.mockReturnValue(Promise.reject(new Error("network")));
    expect(() => logClientEvent("x", { message: "m" })).not.toThrow();
  });

  it("never throws even if fetch throws synchronously", () => {
    global.fetch = (() => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    expect(() => logClientEvent("x", { message: "m" })).not.toThrow();
  });
});

describe("errorMessage", () => {
  it("extracts message from Error", () => {
    expect(errorMessage(new Error("oops"))).toBe("oops");
  });

  it("passes through strings", () => {
    expect(errorMessage("plain")).toBe("plain");
  });

  it("serializes objects", () => {
    expect(errorMessage({ a: 1 })).toBe('{"a":1}');
  });

  it("falls back to String() for non-serializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(typeof errorMessage(circular)).toBe("string");
  });
});
