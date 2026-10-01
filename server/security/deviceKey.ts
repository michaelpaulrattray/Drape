/**
 * WHICH BROWSER IS ASKING FOR A FREE ACCOUNT (#1603, P1-4).
 *
 * A free signup now hands out 13,500 credits on an email or a Google sign-in
 * with **no card and no phone** (his ruling). The cap that stands behind that
 * needs something to count against, and an IP alone is the wrong thing: a
 * household, an office or a campus is one address, so an IP-only cap either
 * refuses honest people or is set so loose it refuses nobody. This is the other
 * half of the key — the browser.
 *
 * # What it is, in two confidences, and the value says which
 *
 *   `cookie:<uuid>`   the browser carried our own first-party cookie. This is
 *                     the reliable half: a value we minted, that nothing else
 *                     can guess, that survives a network change.
 *   `derived:<hash>`  it did not, so the key is a hash of the network address
 *                     and the user-agent string. Headers we are already sent;
 *                     no script runs in the browser, no canvas is read, no
 *                     font list is collected, nothing new is stored about
 *                     anybody.
 *
 * ⚠ **THE PREFIX IS PART OF THE VALUE ON PURPOSE.** A staff member reading a
 * refusal row has to be able to tell a browser that identified itself from one
 * that was inferred, and two very different confidences wearing one opaque
 * column would be unreadable. It also means the two can never collide.
 *
 * # What this CANNOT catch — stated rather than implied, because the card asks
 *
 * It is a speed bump, not an identity. It makes farming cost effort; it does
 * not make it impossible, and nothing in this file should be read as if it did.
 *
 *   - **A fresh browser profile on a different network** reads as a new device,
 *     every time. Incognito plus a phone's data connection defeats both halves.
 *   - **A cleared cookie jar** falls back to the derived key, which still
 *     catches the same browser on the same network and misses it the moment
 *     either changes.
 *   - **A VPN or a mobile-data hop** changes the address, so the derived key
 *     changes with it. The cookie half is unaffected, which is exactly why the
 *     cookie half exists.
 *   - **Two honest people on one shared machine** — a library, a shared
 *     laptop — share a cookie and therefore a device key. This is why the
 *     device cap is 3 and not 1: the first reading of this file's own numbers
 *     should be that they are deliberately loose.
 *   - **A browser that refuses cookies** is permanently on the derived key.
 *
 * # Why it is `httpOnly` and carries nothing
 *
 * The value is a random v4 UUID and means nothing anywhere else. It is not a
 * session, it grants nothing, and it is never read by client code — so
 * `httpOnly` costs nothing and keeps it out of reach of any script. `sameSite`
 * is `lax` for the same reason the session cookie is (#1653): `none` would
 * attach it to other sites' requests, and nothing here ever wants that.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";

import { getSessionCookieOptions } from "../_core/cookies";

/** First-party, meaningless outside this file, and never read by the client. */
export const DEVICE_COOKIE_NAME = "drape_device";

/**
 * 400 days. Chrome caps a cookie's life at 400 days and silently shortens
 * anything longer, so asking for more would be asking for a number that is not
 * what we get. The grant window is a week; this only has to outlive it by
 * enough that a returning customer is still the same device.
 */
export const DEVICE_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/** The shape `randomUUID` produces, and the only shape accepted back. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 40 hex characters of a sha256. The column is `varchar(64)` and the prefix
 * spends 8 of it; 40 leaves room and is far past any collision that matters for
 * counting signups.
 */
const DERIVED_HASH_LENGTH = 40;

/**
 * Read the cookie off the request WITHOUT depending on `cookie-parser` having
 * run on this router.
 *
 * ⚠ This is not defensive decoration. `req.cookies` is populated by middleware,
 * and a router that is mounted without it hands you `undefined` — which reads
 * exactly like a browser that carried no cookie, so every request would take
 * the derived road and the cookie half of this control would be silently dead
 * (invariant 7's shape). Reading the header is the one road that cannot be
 * un-wired by a mounting order.
 */
function readDeviceCookie(req: Request): string | null {
  const parsed = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[
    DEVICE_COOKIE_NAME
  ];
  if (typeof parsed === "string" && UUID_PATTERN.test(parsed)) return parsed;

  const header = req.headers.cookie;
  if (typeof header !== "string" || header.length === 0) return null;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() !== DEVICE_COOKIE_NAME) continue;
    const value = decodeURIComponent(pair.slice(eq + 1).trim());
    return UUID_PATTERN.test(value) ? value : null;
  }
  return null;
}

/**
 * The derived key: the network address and the user-agent, hashed.
 *
 * Hashed rather than stored plainly because the user-agent is a long string we
 * have no reason to keep a second copy of, and because a fixed-width value fits
 * the column whatever a browser sends. An absent user-agent is its own bucket
 * rather than being folded in with every other absent one — a caller that sends
 * none is a script, and a script sharing one bucket with every other script is
 * the right answer for a cap.
 */
function derivedKey(ipAddress: string, userAgent: string | null): string {
  const digest = createHash("sha256")
    .update(`${ipAddress}\n${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, DERIVED_HASH_LENGTH);
  return `derived:${digest}`;
}

export type DeviceIdentity = {
  /** Goes in `free_grant_claims.deviceKey`. */
  readonly deviceKey: string;
  /** True when the browser carried our cookie — the reliable half. */
  readonly fromCookie: boolean;
};

/**
 * Identify the browser, and mint the cookie when it has none.
 *
 * ⚠ **THE COOKIE IS SET ON THE WAY IN, NOT AFTER THE DECISION.** A key minted
 * only on success would mean a refused attempt still looked like a brand-new
 * browser on its next try, so a farmer would simply retry and the cap would
 * never bite. Setting it first is also why the FIRST request from a clean
 * browser is always `derived:` and the second is `cookie:` — the response
 * carrying the new cookie is the one being decided.
 *
 * It is safe to call more than once per request: a browser that already has a
 * valid cookie is handed the same value back and the header is not re-sent.
 */
export function identifyDevice(
  req: Request,
  res: Response,
  ipAddress: string,
): DeviceIdentity {
  const existing = readDeviceCookie(req);
  if (existing) return { deviceKey: `cookie:${existing}`, fromCookie: true };

  const minted = randomUUID();
  res.cookie(DEVICE_COOKIE_NAME, minted, {
    ...getSessionCookieOptions(req),
    maxAge: DEVICE_COOKIE_MAX_AGE_MS,
  });

  const userAgent = req.headers["user-agent"];
  return {
    deviceKey: derivedKey(ipAddress, typeof userAgent === "string" ? userAgent : null),
    fromCookie: false,
  };
}

/** Exported for the suite: the derived half, with no request and no response. */
export const __test = { derivedKey, readDeviceCookie };
