/**
 * THE CROSS-SITE REFUSAL FOR THE PLAIN EXPRESS AUTH ROUTES — #1659, the half
 * #1653 could not close.
 *
 * # What a customer could be hit by
 *
 * A page on another site POSTs a form to our sign-in route carrying **the
 * attacker's** email and password. The server signs that account in and hands
 * the customer's browser a session cookie for it. She carries on using Klieg,
 * looking signed in, and everything she then makes — a brief, a roll, a signed
 * cast — lands in the attacker's account, where he can read it.
 *
 * It is the quieter cousin of #1653. **#1653 let a stranger act AS HER; this
 * lets a stranger make her act AS HIM.**
 *
 * # Why the two repairs #1653 shipped do not reach it, and neither does obvious
 *
 *  1. ⚠ **`SameSite` decides when a cookie is SENT. It says nothing about
 *     whether a `Set-Cookie` coming back from a cross-site request is STORED —
 *     it is.** So `sameSite: "lax"` is the right fix for #1653 and is simply
 *     about a different direction of the same journey. This attack needs no
 *     cookie on the way IN; it installs one on the way OUT.
 *  2. ⚠ **The tRPC guard cannot see these routes.** `refuseCrossSiteMutation`
 *     sits on `baseProcedure` in `server/_core/trpc.ts`, and every procedure in
 *     the product derives from it — but the sign-in routes are **plain Express**
 *     (`server/routes/emailAuth.ts`), mounted at `/api/auth` and never passing
 *     through a tRPC middleware chain at all.
 *  3. ⚠ **And there is no preflight to fail.** `server/_core/index.ts` registers
 *     `express.json()` AND `express.urlencoded()` globally, before the auth
 *     router mounts. A cross-site HTML form POST is
 *     `application/x-www-form-urlencoded`, which is a CORS **simple** content
 *     type — the browser sends it with no `OPTIONS` ahead of it, and `req.body`
 *     is populated. Nothing about the request is unusual by the time a handler
 *     sees it.
 *
 * # THE JUDGEMENT IS NOT RE-IMPLEMENTED HERE, AND THAT IS THE WHOLE POINT
 *
 * `judgeRequestOrigin` is pure, takes headers, has no configuration and no
 * allowlist to keep in step (`crossSiteGuard.ts` carries the full reading: why
 * neither signal is typed, why a missing header means ALLOW, why a sibling
 * subdomain is a real vector). **A second origin reader on a second road into
 * the auth surface is working law 4 in the one place this repository's own card
 * says a mistake locks every customer out of the product**, so this module is an
 * ADAPTER: express in, the shared verdict out, and nothing decided here.
 *
 * # WHY IT IS MOUNTED ON THE ROUTER RATHER THAN ON TWO HANDLERS
 *
 * Invariant 7's lesson, applied before it can be paid for: a check that has to
 * be remembered per route is a check the next route forgets. Mounted with
 * `router.use()` ahead of the declarations, **every state-changing method on
 * that router is covered by construction**, including one added next year.
 *
 * # WHAT IT DELIBERATELY DOES NOT JUDGE, AND WHY EACH ONE IS SAFE
 *
 *  - **`GET` and `HEAD` are never judged.** Invariant 9's other three mint sites
 *    are GET — `googleAuth.ts`'s `/google` and `/google/callback`, and
 *    `emailVerification.ts`'s `/verify-email` — so **a form cannot carry them**,
 *    which is why this card's population is the `emailAuth.ts` pair. And judging
 *    them would break the product: a *Sign in with Google* link clicked from
 *    anywhere is a top-level navigation the browser reports as `cross-site`, and
 *    that is a customer arriving, not an attack.
 *  - **`/api/auth/resend-verification`** (`emailVerification.ts`) IS covered —
 *    this guard is mounted on `emailVerificationRouter` ahead of its declarations,
 *    exactly as on the email-auth pair — even though it mints no session and so
 *    is not login-CSRF: a cross-site POST to it would trigger a rate-limited email
 *    to an address the sender already had, and refusing that costs nothing. (This
 *    bullet said *not covered — a declared remainder* until the relay's review of
 *    PR #1677 read it against the mount; the mount was right and the prose was
 *    not.) The verify-email GET link is never judged.
 *  - **No CSRF token, no double-submit cookie, no session-fixation rotation.**
 *    The card says so in as many words: those are a design decision, and this is
 *    the check `docs/specs/SECURITY_AUDIT_2026-07-25.md`'s M1 asked for in July.
 */
import type { NextFunction, Request, Response } from "express";

import { createModuleLogger } from "../logging/logger";
import { judgeRequestOrigin } from "./crossSiteGuard";

const log = createModuleLogger("security/crossSiteExpressGuard");

/**
 * The methods a browser form can drive, and therefore the ones judged.
 *
 * Stated as the set that IS judged rather than as the set that is skipped: a
 * method nobody listed must not slip through because it was not thought of, and
 * a form can only ever send `GET` or `POST` anyway. `PUT`, `PATCH` and `DELETE`
 * are here because a future route using one would want this, and a `fetch` from
 * our own page satisfies the check for free.
 */
const JUDGED_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * ⚠ **THE SENTENCE A PERSON READS, AND IT IS #1653's, WORD FOR WORD.**
 *
 * Shared rather than re-authored: the two guards refuse the same thing for the
 * same reason, and a customer who somehow meets both should not be told two
 * different stories. It says what was refused and what to do, names no header,
 * no engine and no pipeline term, and the REASON goes to the log — never onto
 * her screen (the disappearing-technology law's wording clause).
 */
export const CROSS_SITE_REFUSAL_MESSAGE =
  "This request did not come from Klieg, so it was not carried out. "
  + "Open Klieg in your own tab and try again there.";

/**
 * Refuse a state-changing request that came from another site, before the route
 * does any work on its behalf.
 *
 * ⚠ **IT ANSWERS 403 AND NOT 401, AND THE ORDER IS THE CONTROL.** Mounted ahead
 * of the handlers, it refuses before the password is checked, before the rate
 * limiter is consulted, before an audit row is written and above all before a
 * session is minted. The problem is not who is asking — it is where from — and
 * on a login route "before the password is checked" is also what keeps this from
 * becoming a cross-site oracle for whether a password is right.
 */
export function refuseCrossSiteAuthRequest(req: Request, res: Response, next: NextFunction): void {
  if (!JUDGED_METHODS.includes(req.method.toUpperCase())) {
    next();
    return;
  }

  const verdict = judgeRequestOrigin(req.headers);
  if (verdict.allowed) {
    next();
    return;
  }

  log.warn(
    { path: req.path, method: req.method, reason: verdict.reason },
    "[crossSiteExpressGuard] REFUSED a cross-site request to an auth route — no session was minted",
  );
  res.status(403).json({ error: CROSS_SITE_REFUSAL_MESSAGE });
}
