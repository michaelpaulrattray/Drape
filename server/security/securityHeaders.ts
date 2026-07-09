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
// In dev: allow unsafe-inline/eval for Vite HMR + React Fast Refresh preamble
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
  : "script-src 'self' https://js.stripe.com";

// In dev: allow WebSocket connections for Vite HMR
const connectSrc = isDev
  ? "connect-src 'self' https://api.stripe.com ws://localhost:* ws://127.0.0.1:*"
  : "connect-src 'self' https://api.stripe.com";

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
