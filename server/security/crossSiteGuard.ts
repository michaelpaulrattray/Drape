/**
 * THE CROSS-SITE REFUSAL FOR STATE-CHANGING CALLS — #1653, found by the
 * founder's engineering agent in the monthly audit and verified at the code.
 *
 * # What it is for, in one sentence
 *
 * A signed-in customer visits a page an attacker controls; that page POSTs to
 * `https://<our host>/api/trpc/billing.cancelSubscription`, the browser attaches
 * her session cookie because it was issued `SameSite=None`, and the server does
 * what she never asked for. `createPortalSession`, `cancelSubscription` and
 * `auth.logout` take **no input at all**, so the forged request needs no body —
 * and a request with no body and no `Content-Type` is a CORS *simple* request,
 * which means there is no preflight to fail. Reading the response is blocked
 * from the attacker's page; the side effect is not, and the side effect is the
 * whole attack.
 *
 * # WHY THIS EXISTS BESIDE THE COOKIE FIX RATHER THAN INSTEAD OF IT
 *
 * `server/_core/cookies.ts` moves to `sameSite: "lax"` in the same change, and
 * that is the primary repair. ⚠ **It does not cover the sessions that already
 * exist.** A cookie's `SameSite` lives in the browser's jar exactly as it was
 * written, so every customer already signed in keeps `None` until something
 * re-issues her cookie — for a long-lived session, that is days of exposure
 * after the deploy. This check protects those sessions on the day it ships, and
 * it keeps protecting every session if a later change reaches for `None` again,
 * which is invariant 7's sibling: a protection resting on a cookie attribute
 * nobody re-reads is a protection with a silent off switch.
 *
 * # THE TWO SIGNALS, AND NEITHER IS CONFIGURED
 *
 * ⚠ **AN ALLOWLIST BUILT FROM `PRODUCTION_APP_ORIGIN` WOULD HAVE REFUSED EVERY
 * REAL MUTATION IN PRODUCTION, AND THAT IS NOT HYPOTHETICAL.** That constant
 * names the marketing domain (read it at `server/_core/appOrigin.ts`, which is
 * the only file allowed to spell it — `server/productionBaseUrl.test.ts` holds
 * it to one on the founder's order); the service customers actually reach is
 * the Railway host, and CLAUDE.md's deploy section records that the marketing
 * domain answers nothing today and reads as an outage that does not exist. A
 * typed allowlist here would have been a self-inflicted outage on every
 * mutation in the product. So neither signal is typed and neither needs a
 * variable:
 *
 *  1. **`Sec-Fetch-Site`** — set by the browser, on the forbidden-header list so
 *     no page can forge it, and it answers the question directly without this
 *     module knowing a single hostname. `cross-site` is refused.
 *  2. **`Origin` against the request's OWN host** — the fallback for a browser
 *     that sends no `Sec-Fetch-Site`. "Ours" means *the host this request was
 *     addressed to*, which is correct by construction on localhost, on the
 *     Railway domain, on `klieglabs.com` and on any custom domain added later,
 *     with nothing to keep in step.
 *
 * **Both run; it is not an `else`.** A sibling subdomain is `same-site` to
 * signal 1 and a foreign origin to signal 2 — and it is a real vector, because
 * a cookie is attached by DESTINATION, never by the origin doing the asking.
 * The host-only session cookie means `evil.klieglabs.com` cannot read our jar,
 * but a request it makes TO our host still carries our cookie.
 *
 * ⚠ **NO HEADER MEANS ALLOW, DELIBERATELY.** A browser always sends `Origin` on
 * a cross-origin request; a caller that sends neither header is not a browser,
 * has no ambient cookie to borrow, and still has to authenticate like anything
 * else. Refusing the headerless case would break every non-browser caller and
 * every HTTP test in the tree to buy nothing — CSRF is a browser-only attack.
 *
 * # WHAT IT DOES NOT TOUCH
 *
 * **Queries are not refused.** CORS already stops an attacker reading a
 * response, so a forged query changes nothing and leaks nothing, and refusing
 * reads would be a behaviour change with no finding behind it. Only
 * state-changing calls are judged, which is #1653's own wording. The access
 * grid is untouched: this changes *where* a caller may call from, never *who*
 * may call what.
 */

/** The headers this judgement reads, and nothing else. */
export interface OriginHeaders {
  readonly origin?: string | string[];
  readonly host?: string | string[];
  readonly "x-forwarded-host"?: string | string[];
  readonly "sec-fetch-site"?: string | string[];
}

export type OriginVerdict =
  /** Nothing in the request marks it as coming from another site. */
  | { readonly allowed: true; readonly reason: string }
  /** The browser said so, or the headers show it, or they cannot be matched. */
  | { readonly allowed: false; readonly reason: string };

/**
 * The first value of a header. A repeated header arrives as an array, and a
 * check that reads `headers.origin` as a string compares against `undefined` on
 * exactly the request shaped to confuse it.
 */
function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim();
  return value?.trim();
}

/**
 * The host part of an origin, lowercased, port included — `https://a.com:8443`
 * is `a.com:8443`. `undefined` for anything that is not a parseable absolute
 * URL, and the caller refuses on that rather than letting a parse failure read
 * as a match.
 */
function hostOf(origin: string): string | undefined {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Every host this request can honestly call its own: the `Host` it was
 * addressed to, and `X-Forwarded-Host` when a proxy rewrote it (Railway does —
 * `configureTrustedProxy` is why express trusts one hop).
 *
 * ⚠ Both are settable by hand with curl, and that is harmless HERE: the only
 * thing an attacker gains by sending `Host: evil.com` beside
 * `Origin: https://evil.com` is a request with **nobody's cookie on it**. A
 * browser cannot lie about either header, and a browser is the only thing that
 * carries somebody else's session.
 */
function ownHosts(headers: OriginHeaders): string[] {
  const hosts: string[] = [];
  for (const raw of [first(headers.host), first(headers["x-forwarded-host"])]) {
    if (raw === undefined || raw.length === 0) continue;
    /* A forwarded list ("a.com, b.com") takes its first hop, the same way
       `cookies.ts`'s `isSecureRequest` reads `x-forwarded-proto`. */
    const host = raw.split(",")[0]?.trim().toLowerCase();
    if (host !== undefined && host.length > 0) hosts.push(host);
  }
  return hosts;
}

/**
 * Is this request coming from somewhere that is not us?
 *
 * The verdict carries its REASON rather than being a bare boolean, because the
 * refusal is logged and a reader at three in the morning needs to know which of
 * the two signals fired.
 */
export function judgeRequestOrigin(headers: OriginHeaders): OriginVerdict {
  const fetchSite = first(headers["sec-fetch-site"])?.toLowerCase();
  if (fetchSite === "cross-site") {
    return { allowed: false, reason: "the browser reported Sec-Fetch-Site: cross-site" };
  }

  const origin = first(headers.origin);

  /* `null` is the literal string a sandboxed iframe, a `data:` document or a
     redirected cross-origin POST sends as its Origin. It is not our host, and
     it is named before the URL parse so it refuses for the right reason. */
  if (origin === "null") {
    return { allowed: false, reason: "the request carries an opaque Origin (null)" };
  }

  if (origin !== undefined && origin.length > 0) {
    const requestOrigin = hostOf(origin);
    if (requestOrigin === undefined) {
      return { allowed: false, reason: `the Origin header is not a URL: ${origin}` };
    }
    const hosts = ownHosts(headers);
    /* No Host at all is a malformed HTTP/1.1 request. It cannot be matched, so
       it is refused rather than allowed by the absence of the thing to compare
       against — the fail-open shape this repository has paid for before. */
    if (hosts.length === 0) {
      return {
        allowed: false,
        reason: "an Origin was sent and the request carries no Host to match it against",
      };
    }
    if (!hosts.includes(requestOrigin)) {
      return {
        allowed: false,
        reason: `the Origin ${requestOrigin} is not this request's own host (${hosts.join(", ")})`,
      };
    }
    return { allowed: true, reason: `the Origin ${requestOrigin} is this request's own host` };
  }

  return {
    allowed: true,
    reason: "no Origin and no cross-site Sec-Fetch-Site — not a browser's cross-site request",
  };
}
