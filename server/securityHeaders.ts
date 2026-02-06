/**
 * Security Headers Middleware
 * 
 * Sets HTTP security headers on all responses to mitigate
 * XSS, clickjacking, MIME-sniffing, and protocol downgrade attacks.
 */
import type { Request, Response, NextFunction } from "express";

/**
 * Content Security Policy directives.
 * 
 * Allows:
 * - Self-hosted resources
 * - Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
 * - S3/CDN for images and media (*.amazonaws.com, *.manus.storage)
 * - Stripe.js for payment processing (js.stripe.com, *.stripe.com)
 * - Inline styles (required by Tailwind CSS and style attributes)
 * - Data URIs for images (used by some components)
 * - Blob URLs for media playback
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.amazonaws.com https://*.manus.storage https://api.manus.im",
  "media-src 'self' blob: https://*.amazonaws.com https://*.manus.storage",
  "connect-src 'self' https://api.stripe.com https://api.manus.im https://*.manus.storage",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // HSTS: Force HTTPS for 1 year, including subdomains
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // CSP: Restrict resource loading to trusted origins
  res.setHeader("Content-Security-Policy", CSP_DIRECTIVES);

  // Prevent clickjacking by disallowing framing
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Limit referrer information sent to external origins
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
}
