import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cookie name for access token (must match backend).
 */
const ACCESS_TOKEN_COOKIE = "access_token_cookie";
const ACCESS_TOKEN_TYPE = "access";
const JWT_ALG = "HS256";
const IDEMPOTENCY_HEADER = "x-idempotency-key";
const IDEMPOTENT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes that require authentication.
 */
const PROTECTED_ROUTES = ["/trips"];

/**
 * Decode a base64url string into a binary string.
 */
function decodeBase64UrlString(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return atob(padded);
}

/**
 * Decode a base64url string into bytes.
 */
function decodeBase64UrlBytes(value: string): Uint8Array {
  const binary = decodeBase64UrlString(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes;
}

/**
 * Parse a base64url JSON payload.
 */
function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(decodeBase64UrlString(value)) as T;
  } catch {
    return null;
  }
}

/**
 * Verify JWT signature using HS256.
 */
async function verifyJwtSignature(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  secret: string,
): Promise<boolean> {
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = decodeBase64UrlBytes(signatureB64);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("HMAC", key, signature, data);
}

/**
 * Validate an access token (type, exp, signature when possible).
 */
async function isAccessTokenValid(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string }>(headerB64);
  const payload = decodeBase64UrlJson<{ exp?: number; type?: string }>(payloadB64);

  if (header?.alg !== JWT_ALG) {
    return false;
  }

  if (payload?.type !== ACCESS_TOKEN_TYPE) {
    return false;
  }

  const exp = payload?.exp;
  if (typeof exp !== "number" || Date.now() >= exp * 1000) {
    return false;
  }

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    return false;
  }

  return verifyJwtSignature(headerB64, payloadB64, signatureB64, secret);
}

/**
 * Check if the path matches a protected route.
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Middleware that protects routes requiring authentication.
 * Redirects to home page if access token cookie is missing.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only check protected routes
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  if (IDEMPOTENT_METHODS.has(request.method)) {
    const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
    if (!idempotencyKey) {
      return NextResponse.json(
        { detail: "X-Idempotency-Key header required" },
        { status: 400 },
      );
    }
  }

  // Check for access token cookie
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken || !(await isAccessTokenValid(accessToken))) {
    // Redirect to home page
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  // Token exists, allow access
  return NextResponse.next();
}

/**
 * Configure which routes the middleware applies to.
 */
export const config = {
  matcher: ["/trips/:path*"],
};
