/**
 * THE PRESENCE JUDGE, PUT BACK ON THE ROAD AN EDITION ACTUALLY TAKES (#1330).
 *
 * `eyeFramePresence.mts` answers *are the frames this edition names in the
 * bucket his browser will ask?*, and it is a good judge: driven, fail-closed,
 * and it refuses to read the dev bucket by accident. It had **exactly one
 * caller — `scripts/deploy-rite.mts:821`** — and since #1249 an edition does not
 * take the rite. Editions 536 through 541 all shipped as pull requests
 * (`git log server/crew/crew-briefing.json` carries a `(#NNNN)` suffix on every
 * one of them), so **not one of them met the check.**
 *
 * That is the path-three death `CLAUDE.md` names: written, wired, live — then
 * orphaned by a change aimed at something else entirely. No test went red, no
 * error was printed, and the only thing that would ever have said so is the
 * founder opening his page and finding broken-image glyphs under the captions,
 * which is what happened twice before the guard existed (#320, #265).
 *
 * This module is the judgements the GATE needs on top of that judge, and
 * `scripts/check-eye-frames.mts` is its I/O. Nothing here fetches.
 *
 * # ⚠ THE HARD PART IS THE BASE, NOT THE HEAD REQUEST
 *
 * The rite reads `R2_PUBLIC_URL` off the Railway service by name. CI has no
 * Railway credential, and the one thing this check must never do is fall back to
 * the ambient `.env` — that names the DEV bucket, and a frame uploaded to dev is
 * precisely the defect, so a dev-bucket read would PASS the broken case. The
 * judge already refuses an absent base for that reason.
 *
 * So the base is declared here, once, and then **held against production's own
 * answer on every run.** `server/security/securityHeaders.ts:57` builds the CSP
 * `img-src` out of `R2_PUBLIC_URL`, and that header rides every unauthenticated
 * response — so the bucket the founder's browser is *permitted* to load images
 * from is readable, credential-free, from the service itself. Read live
 * 2026-09-26:
 *
 *     img-src 'self' data: blob: https://pub-990e39d8d995468eb61aced83162123a.r2.dev …
 *
 * A declared constant that can go stale in silence is a thing this repository
 * has been bitten by often enough to distrust, which is why the constant is not
 * trusted alone: if production stops naming it, the check REFUSES rather than
 * asking a bucket nobody serves from.
 *
 * # WHY THE BASE MAY BE COMMITTED AT ALL, read rather than assumed
 *
 * It is not a secret and it is not being published here first. It is on every
 * production response in the clear (the header above), and it is already
 * hand-written into **fourteen** files in this tree — four of them tracked and
 * not disposable (`scripts/build-cprime-pack.mts:255`,
 * `scripts/calibration/edit-law-cell.mts:275`,
 * `scripts/calibration/mask-url-probe.mts:52`,
 * `scripts/drive-finding-replay.mts:67`). ⚠ **That is a working-law-4 finding of
 * its own and it is NOT fixed here** — fourteen copies of one fact, free to
 * drift — but it does settle the question this file had to answer: the decision
 * to commit this string was made long ago and repeatedly. The remainder is
 * named on #1330 as a floor, with the grep that produced it.
 *
 * What is NOT here, deliberately: the bucket's CREDENTIALS. `crew-eye/` objects
 * live in the public bucket (`server/storage.ts` — served URLs are public bucket
 * URLs, never presigned), so presence is a credential-free `HEAD` and the gate
 * never handles an R2 secret.
 */

import { BRIEFING_PATH } from "./quietEdition.mts";

/**
 * Production's public bucket, and the production app that must still agree it
 * is the one.
 *
 * `PROD_BASE_URL` overrides the origin in the same shape `deploy-rite.mts:174`
 * and `park-state.mts:55` already use, so a drill against a staging service does
 * not need a code change. The BUCKET has no override on purpose: its whole job
 * is to be the value production independently confirms, and a variable that
 * could set both sides of that comparison would be a check agreeing with
 * itself.
 */
export const PRODUCTION_PUBLIC_BUCKET_BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
export const PRODUCTION_ORIGIN = process.env.PROD_BASE_URL ?? "https://drape-production-0232.up.railway.app";

/**
 * The `img-src` tokens of a Content-Security-Policy header, or `null` when the
 * header holds no such directive at all.
 *
 * `null` and `[]` are different facts and the caller treats them differently: no
 * directive means the response was not the one we think we are reading (a CDN
 * error page, a redirect body, a service that has stopped sending CSP), while an
 * empty token list is a directive that genuinely allows nothing.
 */
export const cspImgSrcTokens = (header: string | null | undefined): string[] | null => {
  if (typeof header !== "string" || header.trim() === "") return null;
  for (const directive of header.split(";")) {
    const parts = directive.trim().split(/\s+/);
    if (parts[0]?.toLowerCase() !== "img-src") continue;
    return parts.slice(1);
  }
  return null;
};

export type BucketAgreement = { ok: boolean; why: string };

/**
 * Does production still say this is the bucket his browser may load from?
 *
 * ⚠ **Unread is a REFUSAL, not a pass** — the same rule
 * `judgeEyeFramePresence` applies to a key it could not ask about, and for the
 * same reason: a check that cannot see the bucket has proven nothing, and a
 * green verdict over an unanswered question is invariant 7.
 *
 * The comparison is on the origin-with-path as written, trailing slashes
 * stripped, because that is how the header carries it and how a key is appended.
 */
export const judgeBucketBaseAgainstCsp = (base: string, header: string | null | undefined): BucketAgreement => {
  const tokens = cspImgSrcTokens(header);
  if (tokens === null) {
    return {
      ok: false,
      why:
        `${PRODUCTION_ORIGIN} sent no Content-Security-Policy img-src, so the production bucket could not be `
        + "confirmed — REFUSING rather than asking a bucket nobody has confirmed serves his page. "
        + "This check must never fall back to the ambient .env, which names the dev bucket and would pass.",
    };
  }
  const trimmed = base.replace(/\/+$/, "");
  const named = tokens.some((token) => token.replace(/\/+$/, "") === trimmed);
  if (!named) {
    return {
      ok: false,
      why:
        `production's CSP img-src does not name ${trimmed} — it names ${tokens.join(" ") || "nothing"}. `
        + "Either the service's R2_PUBLIC_URL moved (update PRODUCTION_PUBLIC_BUCKET_BASE in "
        + "scripts/lib/eyeFrameGate.mts) or this run is reading the wrong service.",
    };
  }
  return { ok: true, why: `production's CSP img-src names ${trimmed}` };
};

export type GateRunDecision = { run: boolean; why: string };

/**
 * Does this diff need the frames read?
 *
 * Only a briefing-touching diff does. The alternative — every PR — makes an
 * unrelated change red when the bucket has a bad minute, and worse: `main` may
 * already name a frame somebody removed, which would redden a PR that did not
 * touch it and cannot fix it.
 *
 * ⚠ **AN UNREADABLE DIFF RUNS THE CHECK.** `null` is not "nothing changed": a
 * failed `git diff` that read as a skip would be the same class of silence this
 * whole card is about, one layer up. Failing toward the check costs a few
 * seconds; failing toward the skip costs him a broken card.
 *
 * The path is IMPORTED from `quietEdition.mts` rather than spelled again, so a
 * briefing that ever moves takes this filter with it (working law 4).
 */
export const eyeFrameGateShouldRun = (changedPaths: readonly string[] | null): GateRunDecision => {
  if (changedPaths === null) {
    return { run: true, why: "the changed-file list could not be read — checking rather than skipping" };
  }
  const touched = changedPaths.some((path) => path.replace(/\\/g, "/") === BRIEFING_PATH);
  return touched
    ? { run: true, why: `${BRIEFING_PATH} is in this diff` }
    : { run: false, why: `${BRIEFING_PATH} is not in this diff — the frames it names are already on main` };
};
