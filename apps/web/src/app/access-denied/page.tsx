import Link from "next/link";
import { ShieldX } from "lucide-react";

/**
 * Shown when the OAuth callback rejects a sign-in that isn't on the
 * AUTH_ALLOWED_EMAILS / AUTH_ALLOWED_DOMAINS allowlist. The api redirects here
 * (`{FRONTEND_URL}/access-denied`) instead of creating a session.
 */
export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX size={32} aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="max-w-md text-muted-foreground">
          This Google account isn&apos;t on the allowlist. If you think it should
          be, reach out to the owner.
        </p>
      </div>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </main>
  );
}
