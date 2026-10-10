/**
 * THE GATE'S HALF OF #1330 — ARE THIS EDITION'S EYE FRAMES IN THE BUCKET HIS
 * BROWSER WILL ASK?
 *
 * The judge is `lib/eyeFramePresence.mts` (#320) and it is unchanged; the base's
 * confirmation and the diff filter are `lib/eyeFrameGate.mts`, and the fetch
 * policy is `lib/eyeFrameHead.mts` (#2232). This file is their I/O, and it exists because that judge had **one
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
 * off. The timeout and the pause-retry are `lib/eyeFrameHead.mts`'s, shared with
 * the rite (#2232); the judge owns no fetch policy of its own.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { eyeFrameKeysOf, eyeFrameRefusalRepair, judgeEyeFramePresence } from "./lib/eyeFramePresence.mts";
import {
  eyeFrameGateShouldRun,
  judgeBucketBaseAgainstCsp,
  PRODUCTION_ORIGIN,
  PRODUCTION_PUBLIC_BUCKET_BASE,
} from "./lib/eyeFrameGate.mts";
import { BRIEFING_PATH } from "./lib/quietEdition.mts";
import { fetchWithClearedTimeout, settleSockets } from "./lib/exitSafeFetch.mts";
import { createEyeFrameHead } from "./lib/eyeFrameHead.mts";

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

/**
 * ⚠ **ONE ASK IS NOT AN ANSWER — AND THE PAUSE-RETRY THAT SAYS SO LIVES IN
 * `lib/eyeFrameHead.mts` NOW, NOT HERE (#2232).**
 *
 * #1177 measured it on this script: the judge's own serial retry fires
 * immediately, while the burst it is recovering from is still draining, and
 * four clean-tree runs went `ok · UNREAD 2 · ok · UNREAD 1`. One re-ask after a
 * real 400 ms gap cleared it — **9 runs of 9 green after, against 2 refusals in
 * 4 before**, every failure UNREAD and never missing. The policy was written
 * HERE, and the rite — the other caller, and the one that blocks a push — never
 * got it, so a two-second blip refused 365 of 365 frames there. One module owns
 * it now and both callers build their head from it; the measurement and the
 * wall-clock reading moved with it.
 */
const eyeFrameHead = createEyeFrameHead();

/**
 * ⚠ **EXITING STRAIGHT OUT OF A FETCH CRASHES NODE ON WINDOWS, AND THE NUMBER
 * BELOW IS MEASURED RATHER THAN CHOSEN.**
 *
 * `process.exit()` while undici's socket is still tearing down trips
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c,
 * line 94` and the process leaves **127**, not the code it was given. Driven on
 * node 24.18.0, this machine, 2026-09-26, three runs per arm after one fetch:
 *
 *     no settle            127 127 127
 *     setTimeout(0)        127 127 127
 *     setTimeout(1)        127 127 127
 *     setTimeout(50)         1   1   1
 *     setTimeout(200)        1   1   1
 *
 * ⚠ **And the tempting explanation is wrong, which is why it is written down**:
 * cancelling the body, sending `Connection: close`, using GET and consuming it,
 * and `controller.abort()` after the read were each driven and each still left
 * 127. `abort()` plus a 50 ms settle passes and `abort()` plus 1 ms does not —
 * so it is the WINDOW that matters and nothing else. 250 ms is 5x the shortest
 * window measured clean.
 *
 * It fails SAFE, which is the part that makes a timing constant acceptable here:
 * a settle too short turns a refusal's exit 1 into an exit 127, which is still
 * nonzero, so the gate step still reddens. It can make a refusal noisier. It
 * cannot make one pass.
 *
 * The success path has always looked fine — 321 requests leave the pool settled
 * by the time it exits — but that is luck rather than design, so both roads take
 * the same door.
 *
 * ⚠ **AND THE NUMBER LIVES IN ONE PLACE NOW, NOT THREE (#1517).** This script,
 * `crew-upload-eye-frame.mts` and `deploy-rite.mts` are one class — a fetch, then
 * a prompt exit — and each had arrived at 250 independently, with its own
 * measurement table beside it. Three copies of a measured constant on three error
 * paths nobody exercises is working law 4, and the copy that drifts is the one
 * nobody runs. `scripts/lib/exitSafeFetch.mts` owns the duration and carries all
 * three tables; the PLACEMENT stays this script's own call, for the reason in the
 * paragraph above (both roads, one terminal door).
 *
 * ⚠ **The wrong exit code is not always the same number**, which is worth
 * knowing before believing a reading: this script measured **127** on 2026-09-26
 * and #1509 measured **3221226505** on 2026-09-29, both on node 24 on this
 * machine. What is stable is that it is not the code the script asked for.
 */
const settle = async (): Promise<void> => {
  await settleSockets("every HEAD this run made");
};

/*
  THE BUCKET IS CONFIRMED AT PRODUCTION BEFORE A SINGLE KEY IS ASKED FOR.

  `server/security/securityHeaders.ts:57` builds the CSP `img-src` from the
  service's own `R2_PUBLIC_URL`, so the bucket his browser is permitted to load
  images from is readable without a credential. A declared constant that has gone
  stale would otherwise send every HEAD at a bucket nobody serves from and report
  323 missing frames, which is a false alarm indistinguishable from the real one.
*/
const csp = await fetchWithClearedTimeout(PRODUCTION_ORIGIN, { method: "HEAD" }, 10_000)
  .then((response) => response.headers.get("content-security-policy"))
  .catch(() => null);
const agreement = judgeBucketBaseAgainstCsp(PRODUCTION_PUBLIC_BUCKET_BASE, csp);

/*
  ONE TERMINAL EXIT FROM HERE DOWN, so every road that has touched the network
  goes through the settle above. The early exits further up are before any fetch,
  where a bare exit was measured clean.
*/
let code = 0;
if (!agreement.ok) {
  console.log(`REFUSED: ${agreement.why}`);
  code = 1;
} else {
  console.log(`  bucket: ${agreement.why}`);
  const verdict = await judgeEyeFramePresence(keys, PRODUCTION_PUBLIC_BUCKET_BASE, eyeFrameHead.head);
  const retried = eyeFrameHead.retried();
  const asked = retried === 0 ? "every key answered first time" : `${retried} key(s) needed a second ask`;
  if (verdict.ok) {
    console.log(`eye frames: ok — ${verdict.why} (${asked})`);
  } else {
    console.log(`  network: ${asked}`);
    /* THE REPAIR IS READ OFF THE VERDICT (#2232): an UNREAD says re-run, and
       only a MISSING says re-upload. */
    const repair = eyeFrameRefusalRepair(verdict, `re-upload the frame(s) under the PRODUCTION R2 variables, naming that bucket —
    railway.cmd run --service Drape -- npx tsx scripts/crew-upload-eye-frame.mts <path> --bucket <name>
  then put the new key(s) in ${BRIEFING_PATH} and push`);
    console.log(`REFUSED: an eye frame this edition names is not confirmed in the production bucket — the founder's card could draw broken images (#320, #1330).
    ${verdict.why}
${repair.map((line) => `  repair: ${line}`).join("\n")}`);
    code = 1;
  }
}

await settle();
process.exit(code);
