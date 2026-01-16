import type { NextRequest } from "next/server";
import crypto from "node:crypto";

// Mock Next.js server modules
const mockRedirect = jest.fn();
const mockNext = jest.fn();
const mockJson = jest.fn();

jest.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => {
      mockRedirect(url.toString());
      return {
        status: 307,
        headers: new Map([["location", url.toString()]]),
      };
    },
    next: () => {
      mockNext();
      return {
        status: 200,
        headers: new Map(),
      };
    },
    json: (body: unknown, init?: { status?: number }) => {
      mockJson(body, init);
      return {
        status: init?.status ?? 200,
        headers: new Map(),
        json: async () => body,
      };
    },
  },
}));

// Import middleware after mocking
import { middleware } from "../middleware";

/**
 * Helper to create a mock NextRequest.
 */
function createMockRequest(
  pathname: string,
  cookies: Record<string, string> = {},
  options: { method?: string; headers?: Record<string, string> } = {},
): Partial<NextRequest> {
  const headerMap = new Map(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    nextUrl: new URL(pathname, "http://localhost:3000") as unknown as NextRequest["nextUrl"],
    url: `http://localhost:3000${pathname}`,
    method: options.method ?? "GET",
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    } as NextRequest["headers"],
    cookies: {
      get: (name: string) =>
        cookies[name] ? { name, value: cookies[name] } : undefined,
    } as NextRequest["cookies"],
  };
}

describe("Auth Middleware", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockNext.mockClear();
    mockJson.mockClear();
    process.env.SECRET_KEY = secret;
  });

  const secret = "test-secret";

  const buildToken = (
    payload: Record<string, unknown>,
    key = secret,
    headerOverrides: Record<string, unknown> = {},
  ) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT", ...headerOverrides }),
    ).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = `${header}.${body}`;
    const signature = crypto.createHmac("sha256", key).update(data).digest("base64url");
    return `${data}.${signature}`;
  };

  it("redirects to / when no access_token_cookie on /trips", async () => {
    const request = createMockRequest("/trips");

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("allows access when access_token_cookie exists", async () => {
    const token = buildToken({
      type: "access",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("redirects to / when access_token_cookie is expired", async () => {
    const token = buildToken({
      type: "access",
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when access_token_cookie has an invalid signature", async () => {
    const token = buildToken(
      {
        type: "access",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      "wrong-secret",
    );
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when token is malformed", async () => {
    const request = createMockRequest("/trips", {
      access_token_cookie: "not-a-jwt",
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when token header is not HS256", async () => {
    const token = buildToken(
      {
        type: "access",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      secret,
      { alg: "none" },
    );
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when token type is not access", async () => {
    const token = buildToken({
      type: "refresh",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when token expiration is missing", async () => {
    const token = buildToken({
      type: "access",
    });
    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when secret is missing", async () => {
    const token = buildToken({
      type: "access",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    process.env.SECRET_KEY = "";

    const request = createMockRequest("/trips", {
      access_token_cookie: token,
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("redirects to / when token payload is not valid json", async () => {
    const request = createMockRequest("/trips", {
      access_token_cookie: "%%%.%%%.signature",
    });

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("does not affect non-protected routes", async () => {
    const request = createMockRequest("/");

    const response = await middleware(request as NextRequest);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("matches /trips/settings and other subpaths", async () => {
    const request = createMockRequest("/trips/settings");

    const response = await middleware(request as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/");
    expect(response.status).toBe(307);
  });

  it("blocks POST requests without idempotency key", async () => {
    const request = createMockRequest(
      "/trips",
      {},
      { method: "POST" },
    );

    const response = await middleware(request as NextRequest);

    expect(mockJson).toHaveBeenCalledWith(
      { detail: "X-Idempotency-Key header required" },
      { status: 400 },
    );
    expect(response.status).toBe(400);
  });

  it("allows POST requests with idempotency key", async () => {
    const token = buildToken({
      type: "access",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const request = createMockRequest(
      "/trips",
      { access_token_cookie: token },
      { method: "POST", headers: { "x-idempotency-key": "request-1" } },
    );

    const response = await middleware(request as NextRequest);

    expect(mockNext).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
