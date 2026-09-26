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

/**
 * ⚠ **ONE ASK IS NOT AN ANSWER, AND THE JUDGE'S OWN RETRY IS NOT ENOUGH ON ITS
 * OWN — MEASURED BEFORE THIS WAS WRITTEN, NOT AFTER.**
 *
 * `judgeEyeFramePresence` launches every key at once (#1177 measured that a
 * bounded pool prevents no drops, costs a second, and makes a dead host twenty
 * times worse) and then re-asks the unread ones serially. With 321 keys off a
 * home connection that was **not enough**: four consecutive runs on a clean tree
 * gave `ok · UNREAD 2 · ok · UNREAD 1`, so **the check refused on half of them
 * with nothing wrong**. Every failure was UNREAD, never missing.
 *
 * A guard that reddens a correct PR every other run is worse than the guard
 * being absent — it gets ignored, then removed, and the third broken card
 * reaches him anyway. And the fix does not belong in the judge: its docblock says
 * it owns no fetch policy, and a pause between attempts is exactly that. So the
 * retry lives HERE, where the policy already is.
 *
 * ⚠ **The pause is the whole medicine.** The judge's serial retry fires
 * immediately, while the burst it is recovering from is still draining. One
 * re-ask after a real gap clears it: **9 runs of 9 green after this, against 2
 * refusals in 4 before.**
 *
 * ⚠ **AND IT COSTS WALL CLOCK, WHICH THE RUN NOW SAYS OUT LOUD RATHER THAN
 * LEAVING TO BE GUESSED.** A stalled ask is not refused quickly — it burns the
 * whole 10 s abort window before the retry starts, so the run's length IS the
 * drop count: measured on this machine, `1 retry → 13.8 s · 16 → 26.0 s · 26 →
 * 34.0 s`, against 5.6 s for a run that needed none. That is why the verdict line
 * carries the number: a 34-second run and a 6-second run are the same verdict
 * about the frames and different facts about the network, and a future reader
 * staring at a slow step should not have to re-derive that. CI's network is not
 * this one and the figure there will be its own; the step sits in a 30-minute
 * job, and the bound per key is one timeout plus one retry.
 */
const HEAD_RETRY_PAUSE_MS = 400;
/* WHAT IT SAW, not just what it concluded (D-235). A run that quietly needed 40
   re-asks and a run that needed none are different facts about the network, and
   only one of them explains a wall-clock reading to whoever reads this log next. */
let retried = 0;
const head = async (url: string): Promise<number | null> => {
  const ask = async (): Promise<number | null> =>
    await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) })
      .then((response) => response.status)
      .catch(() => null);
  const first = await ask();
  /* A STATUS is an answer, whatever it says — a 404 is the finding, not a
     failure, and re-asking it would only make an absent frame cost twice as long
     to report. Only an unmade request is retried. */
  if (first !== null) return first;
  retried += 1;
  await new Promise((resolve) => setTimeout(resolve, HEAD_RETRY_PAUSE_MS));
  return await ask();
};

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
 */
const EXIT_SETTLE_MS = 250;
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, EXIT_SETTLE_MS));
};

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
  const verdict = await judgeEyeFramePresence(keys, PRODUCTION_PUBLIC_BUCKET_BASE, head);
  const asked = retried === 0 ? "every key answered first time" : `${retried} key(s) needed a second ask`;
  if (verdict.ok) {
    console.log(`eye frames: ok — ${verdict.why} (${asked})`);
  } else {
    console.log(`  network: ${asked}`);
    console.log(`REFUSED: an eye frame this edition names is not in the production bucket — his card would draw broken images (#320, #1330).
    ${verdict.why}
  repair: re-upload the frame(s) under the PRODUCTION R2 variables, naming that bucket —
    railway.cmd run --service Drape -- npx tsx scripts/crew-upload-eye-frame.mts <path> --bucket <name>
  then put the new key(s) in ${BRIEFING_PATH} and push`);
    code = 1;
  }
}

await settle();
process.exit(code);
