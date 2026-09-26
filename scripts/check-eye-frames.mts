/**
 * THE GATE'S HALF OF #1330 — ARE THIS EDITION'S EYE FRAMES IN THE BUCKET HIS
 * BROWSER WILL ASK?
 *
 * The judge is `lib/eyeFramePresence.mts` (#320) and it is unchanged; the base's
 * confirmation and the diff filter are `lib/eyeFrameGate.mts`. This file is
 * their I/O and the fetch policy, and it exists because that judge had **one
 * caller, the deploy rite** — a road editions stopped taking at #1249.
 *
 *   npx tsx scripts/check-eye-frames.mts                      # check the tree's briefing
 *   npx tsx scripts/check-eye-frames.mts --base-ref origin/main   # …only if this diff touches it
 *
 * `--base-ref` is the whole vocabulary: an unknown word is REFUSED rather than
 * discarded (#345), so a flag missing from here cannot be discovered.
 *
 * ⚠ **IT REFUSES WHEN IT CANNOT READ**, never passes for being unable to look —
 * an unconfirmable bucket, an unreadable briefing and an unanswered HEAD are all
 * exit 1. The one thing that is a genuine pass with no network at all is an
 * edition naming no frames.
 *
 * ⚠ **THE TIMEOUT IS NOT A NICETY.** A bare HEAD against a host that accepts the
 * connection and never answers takes 306.6s to reject (measured, node 24,
 * undici's `headersTimeout` — `eyeFramePresence.mts` carries the reading). Ten
 * seconds is ~100x a live HEAD against this bucket, so a real answer is never cut
 * off, and the judge owns no fetch policy of its own.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { eyeFrameKeysOf, judgeEyeFramePresence } from "./lib/eyeFramePresence.mts";
import {
  eyeFrameGateShouldRun,
  judgeBucketBaseAgainstCsp,
  PRODUCTION_ORIGIN,
  PRODUCTION_PUBLIC_BUCKET_BASE,
} from "./lib/eyeFrameGate.mts";
import { BRIEFING_PATH } from "./lib/quietEdition.mts";

const args = process.argv.slice(2);
const KNOWN = ["--base-ref"];
const valueOf = (flag: string): string | null => {
  const at = args.indexOf(flag);
  return at >= 0 && at + 1 < args.length ? args[at + 1]! : null;
};
const unknown = args.filter((arg, at) =>
  arg.startsWith("--") && !KNOWN.includes(arg) && !(at > 0 && KNOWN.includes(args[at - 1]!)));
if (unknown.length > 0) {
  console.log(`REFUSED: unknown flag(s) ${unknown.join(", ")} — this tool takes --base-ref <ref>.`);
  process.exit(1);
}

const baseRef = valueOf("--base-ref");

/* The diff, read here so the decision above it stays pure and drivable. A git
   failure hands in `null`, which the decision treats as "check anyway". */
const changedPaths = baseRef === null ? null : (() => {
  try {
    return execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], { encoding: "utf8" })
      .split("\n").map((line) => line.trim()).filter((line) => line !== "");
  } catch (error) {
    console.log(`  (could not read the diff against ${baseRef} — ${(error as Error).message})`);
    return null;
  }
})();

if (baseRef !== null) {
  const decision = eyeFrameGateShouldRun(changedPaths);
  if (!decision.run) {
    console.log(`eye frames: not checked — ${decision.why}`);
    process.exit(0);
  }
  console.log(`eye frames: checking — ${decision.why}`);
}

let briefing: string;
try {
  briefing = readFileSync(BRIEFING_PATH, "utf8");
} catch (error) {
  console.log(`REFUSED: could not read ${BRIEFING_PATH} — ${(error as Error).message}`);
  console.log("  The check has proven nothing; it does not pass by being unable to look.");
  process.exit(1);
}

const keys = eyeFrameKeysOf(briefing);

/* An edition naming no frames is answered with no network at all — and the
   judge's own no-frames arm says the same thing, so this is a shortcut rather
   than a second opinion. It matters because the bucket confirmation below is a
   request, and a briefing with nothing to check should not be able to fail on
   somebody else's outage. */
if (keys !== null && keys.length === 0) {
  console.log("eye frames: ok — the edition names no eye frames");
  process.exit(0);
}

const head = async (url: string): Promise<number | null> =>
  await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) })
    .then((response) => response.status)
    .catch(() => null);

/*
  THE BUCKET IS CONFIRMED AT PRODUCTION BEFORE A SINGLE KEY IS ASKED FOR.

  `server/security/securityHeaders.ts:57` builds the CSP `img-src` from the
  service's own `R2_PUBLIC_URL`, so the bucket his browser is permitted to load
  images from is readable without a credential. A declared constant that has gone
  stale would otherwise send every HEAD at a bucket nobody serves from and report
  323 missing frames, which is a false alarm indistinguishable from the real one.
*/
const csp = await fetch(PRODUCTION_ORIGIN, { method: "HEAD", signal: AbortSignal.timeout(10_000) })
  .then((response) => response.headers.get("content-security-policy"))
  .catch(() => null);
const agreement = judgeBucketBaseAgainstCsp(PRODUCTION_PUBLIC_BUCKET_BASE, csp);
if (!agreement.ok) {
  console.log(`REFUSED: ${agreement.why}`);
  process.exit(1);
}
console.log(`  bucket: ${agreement.why}`);

const verdict = await judgeEyeFramePresence(keys, PRODUCTION_PUBLIC_BUCKET_BASE, head);
if (!verdict.ok) {
  console.log(`REFUSED: an eye frame this edition names is not in the production bucket — his card would draw broken images (#320, #1330).
    ${verdict.why}
  repair: re-upload the frame(s) under the PRODUCTION R2 variables, naming that bucket —
    railway.cmd run --service Drape -- npx tsx scripts/crew-upload-eye-frame.mts <path> --bucket <name>
  then put the new key(s) in ${BRIEFING_PATH} and push`);
  process.exit(1);
}

console.log(`eye frames: ok — ${verdict.why}`);
process.exit(0);
