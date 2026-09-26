/**
 * Security Headers Middleware
 * 
 * Sets HTTP security headers on all responses to mitigate
 * XSS, clickjacking, MIME-sniffing, and protocol downgrade attacks.
 * 
 * In development mode, CSP is relaxed to allow Vite's HMR and
 * JSX transform inline scripts. Production uses strict CSP.
 */
import type { Request, Response, NextFunction } from "express";

const isDev = process.env.NODE_ENV === "development";

// Public origin of the R2 storage bucket (e.g. https://pub-<hash>.r2.dev or a
// custom domain). Derived from env so dev/prod buckets don't need code changes.
const r2PublicOrigin = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

/**
 * Content Security Policy directives.
 * 
 * Allows:
 * - Self-hosted resources
 * - Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
 * - R2 public bucket for images (R2_PUBLIC_URL)
 * - S3/CDN for images and media (*.amazonaws.com, files.manuscdn.com,
 *   *.cloudfront.net) — old DB records still reference these; drop at final
 *   storage cutover (scripts/migrate-storage-urls.ts)
 * - Stripe.js for payment processing (js.stripe.com, *.stripe.com)
 * - Inline styles (required by Tailwind CSS and style attributes)
 * - Data URIs for images (used by some components)
 * - Blob URLs for media playback
 */
/**
 * The one inline script the app ships: the theme first-paint script in
 * `client/index.html` (plan §D.8). Production CSP has no 'unsafe-inline', so
 * without this hash the script is blocked and every cold load flashes the
 * wrong theme. `client/src/foundation/theme.test.ts` recomputes the hash from
 * `client/index.html` and fails if the script and this constant drift apart.
 */
const THEME_BOOT_SCRIPT_HASH = "sha256-KdZpGeeTOvpFqttmTc1kHMnndUDN1NdkXX4dV0tlJXQ=";

// In dev: allow unsafe-inline/eval for Vite HMR + React Fast Refresh preamble
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
  : `script-src 'self' '${THEME_BOOT_SCRIPT_HASH}' https://js.stripe.com`;

/**
 * THE ERROR TRACKER'S INGEST HOST, DERIVED FROM THE DSN ITSELF (#509 part 1b).
 *
 * The browser SDK posts its envelopes to the origin inside `VITE_SENTRY_DSN`
 * (`https://<key>@o123.ingest.de.sentry.io/456` → `https://o123.ingest.de.sentry.io`),
 * and with no `connect-src` entry for it the browser blocks every send — an
 * error tracker that reports nothing, with the only evidence a CSP violation in
 * a console nobody is reading.
 *
 * ⚠ **DERIVED, NEVER HARD-CODED, AND THE REASON IS NOT TIDINESS.** A Sentry DSN
 * names an organisation- and region-specific host; writing one in here would be
 * a second declaration of the same fact (working law 4) that goes wrong silently
 * the day the founder's project moves region — the CSP would keep allowing a
 * host nothing posts to, and block the one that matters.
 *
 * ⚠ **WITH NO DSN IT ADDS NOTHING, AND A MALFORMED ONE ALSO ADDS NOTHING.** The
 * policy must not widen on a typo: `new URL()` throwing is the only honest
 * answer to a value nobody can parse, and the reporter will not have started
 * either, because it reads the same variable.
 */
export function sentryIngestOrigin(dsn: string | undefined): string | null {
  const raw = (dsn ?? "").trim();
  if (raw.length === 0) return null;
  try {
    const { origin, protocol } = new URL(raw);
    /* `https:` only. A DSN is attacker-visible in the bundle, and a `data:` or
       `javascript:` value must never reach a CSP directive. */
    return protocol === "https:" ? origin : null;
  } catch {
    return null;
  }
}

/**
 * `connect-src`, built where a test can read it (invariant 5). The middleware
 * below captures the result once at module load, so this is the only shape in
 * which the two regimes and the DSN can actually be driven.
 */
export function buildConnectSrc(dev: boolean, sentryDsn: string | undefined): string {
  const hosts = ["'self'", "https://api.stripe.com"];
  const ingest = sentryIngestOrigin(sentryDsn);
  if (ingest) hosts.push(ingest);
  if (dev) hosts.push("ws://localhost:*", "ws://127.0.0.1:*");
  return `connect-src ${hosts.join(" ")}`;
}

const connectSrc = buildConnectSrc(isDev, process.env.VITE_SENTRY_DSN);

const CSP_DIRECTIVES = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${r2PublicOrigin} https://*.amazonaws.com https://images.unsplash.com https://files.manuscdn.com https://*.cloudfront.net`.replace(/\s{2,}/g, " "),
  "media-src 'self' blob: https://*.amazonaws.com https://commondatastorage.googleapis.com",
  connectSrc,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  isDev ? "frame-ancestors *" : "frame-ancestors 'none'",
].join("; ");

/**
 * Permissions-Policy: restrict access to sensitive browser APIs.
 * Disables camera, microphone, geolocation, payment, USB, etc.
 * Only allow features explicitly needed by the application.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  // Allow payment for Stripe checkout
  "payment=(self)",
].join(", ");

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // HSTS: Force HTTPS for 1 year, including subdomains
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // CSP: Restrict resource loading to trusted origins
  res.setHeader("Content-Security-Policy", CSP_DIRECTIVES);

  // Prevent clickjacking by disallowing framing (skipped in dev)
  if (!isDev) {
    res.setHeader("X-Frame-Options", "DENY");
  }

  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Limit referrer information sent to external origins
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Legacy XSS protection header (still useful for older browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevent DNS prefetching to avoid leaking visited domains
  res.setHeader("X-DNS-Prefetch-Control", "off");

  // Prevent Adobe Flash/Acrobat cross-domain policy loading
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Restrict access to sensitive browser APIs
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);

  next();
}
