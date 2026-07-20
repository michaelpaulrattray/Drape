/**
 * URL Validation for SSRF Protection
 * 
 * Validates URLs against an allowlist of trusted domains and blocks
 * requests to private/internal IP ranges to prevent Server-Side
 * Request Forgery (SSRF) attacks.
 */

/**
 * Trusted domains that the server is allowed to fetch from.
 * Only S3 and CDN domains used by the application.
 */
// .manuscdn.com / .cloudfront.net: old DB records still reference these hosts;
// remove at final storage cutover (scripts/migrate-storage-urls.ts).
const ALLOWED_DOMAINS = [
  ".amazonaws.com",
  ".manuscdn.com",
  ".cloudfront.net",
];

/**
 * Exact hostnames that are also allowed. The R2 public bucket host is matched
 * exactly (not as a `.r2.dev` suffix) so the proxy cannot be pointed at
 * arbitrary third-party R2 buckets.
 */
function getR2PublicHost(): string | null {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return null;
  try {
    return new URL(publicUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * RFC 1918 / RFC 5735 private and reserved IP ranges.
 * These must never be fetched by the proxy to prevent SSRF.
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // RFC 1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918 Class B
  /^192\.168\./,               // RFC 1918 Class C
  /^169\.254\./,               // Link-local (AWS metadata endpoint)
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
  /^fd/i,                      // IPv6 unique local
];

/**
 * Blocked hostnames that resolve to internal services.
 */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "metadata",
];

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a URL for safe server-side fetching.
 * 
 * Checks:
 * 1. URL is well-formed with https protocol
 * 2. Hostname is on the allowed domain list
 * 3. Hostname is not a blocked internal name
 * 4. Hostname does not resolve to a private IP range
 */
export function validateProxyUrl(urlString: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  // Only allow HTTPS
  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Only HTTPS URLs are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: "Blocked hostname" };
  }

  // Block IP addresses used as hostnames (prevents direct IP SSRF)
  if (isIpAddress(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, reason: "Private IP addresses are not allowed" };
    }
    // Even public IPs are not allowed — must use domain names
    return { valid: false, reason: "Direct IP addresses are not allowed" };
  }

  // Check against allowed domain list
  const r2PublicHost = getR2PublicHost();
  const isAllowed =
    hostname === r2PublicHost ||
    ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain));

  if (!isAllowed) {
    return {
      valid: false,
      reason: `Domain not in allowlist. Allowed: ${ALLOWED_DOMAINS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Check if a string looks like an IP address (v4 or v6).
 */
function isIpAddress(hostname: string): boolean {
  // IPv4: digits and dots
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  // IPv6: contains colons
  if (hostname.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Check if an IP address falls within private/reserved ranges.
 */
function isPrivateIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(ip));
}
