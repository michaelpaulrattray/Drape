/**
 * ONE PAID RENDER, TO TURN AN ARGUMENT INTO A MEASUREMENT (approved, fable-048).
 *
 * The lane fix is argued from run-12's stored prompt: her freckles were named
 * twice, in two lanes, meaning opposite things, and the precise caption sat in
 * the lane that only asserts. That is a good argument and arguments have died
 * four times this week.
 *
 * So: one more step on run-12's own chain — a `statedAccessories` addition, the
 * SAME class as step 4, the step that lost the freckles — with `marks` carried
 * rather than written. Under the fix the painter is now asked for the caption's
 * density inside the instruction. Then count, with the repaired counter, against
 * HER OWN floor.
 *
 *   her master (the floor)          3.84
 *   01 "give her freckles"          4.28
 *   04 hoop earrings, BEFORE the fix 3.49   <- below the floor: nothing there
 *   05 the removal                  5.03
 *
 * A result at ~3.8 means the fix did not save it. A result at 4.3 or above means
 * the caption governed a carried facet through a step that was not about it.
 *
 * # What this is NOT
 *
 * Not a walk, not a delivery-rate sample, and it must never be quoted as one.
 * The walk is browser-driven on purpose (the founder's fifteen minutes are in a
 * viewer, and HTTP cannot see a ghost chip). This is a physics experiment about
 * pixels, so it actuates over HTTP and scores nothing.
 *
 * ONE render only. A bare result gets the ONE retry the product itself would
 * run, and both are reported (fable-048).
 *
 *   railway.cmd run --service Drape -- npx tsx scripts/prove-caption-governs-disposable.mts \
 *     --token <jwt> --spend
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { spendAuthorized } from "./lib/stopline.mts";

const BASE = "https://drape-production-0232.up.railway.app";
const CANDIDATE = "8154ac6d-64ee-45ad-834b-fcbabca0f3ef";
/*
  A carried-marks step of the same class as the one that failed. Deliberately
  NOT one of the chain's existing asks: a delta that only repeats what she
  already is is refused pre-charge by `saysNothingNew`, which would spend
  nothing and prove nothing.
*/
const INSTRUCTION = "a thin gold chain necklace";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}
const TOKEN = arg("token");
if (!TOKEN) throw new Error("--token <jwt> required — mint with scripts/mint-production-session.mts");
if (!spendAuthorized("charge a refine on the founder's account")) {
  throw new Error("refusing to charge without --spend. This costs the founder real credits.");
}

const OUT = "output/caption-governs";
mkdirSync(OUT, { recursive: true });

async function trpc(path: string, input: unknown): Promise<any> {
  const response = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `app_session_id=${TOKEN}` },
    body: JSON.stringify({ json: input }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text);
  if (parsed.error) throw new Error(`${path}: ${JSON.stringify(parsed.error).slice(0, 300)}`);
  return parsed.result?.data?.json ?? parsed.result?.data;
}

/* The uptime is recorded so the frame can never be attributed to the wrong
   build — this shift has already been bitten by a deploy that never happened. */
const health = await (await fetch(`${BASE}/api/health`)).json();
console.log(`production uptime ${Math.round(health.uptime)}s — the fix deployed at 13:38 UTC`);

console.log(`asking for "${INSTRUCTION}" on ${CANDIDATE} …`);
const started = Date.now();
const result = await trpc("castingV2.refine", {
  clientRequestId: randomUUID(),
  candidateId: CANDIDATE,
  instruction: INSTRUCTION,
});
console.log(`returned after ${Math.round((Date.now() - started) / 1000)}s`);
console.log(JSON.stringify(result, null, 2).slice(0, 1200));

writeFileSync(`${OUT}/refine-result.json`, `${JSON.stringify(result, null, 2)}\n`);

const url: string | undefined = result?.imageUrl ?? result?.variant?.imageUrl;
if (url) {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(`${OUT}/delivered.png`, bytes);
  console.log(`\nframe saved: ${OUT}/delivered.png (${bytes.length} bytes)`);
  console.log("now count it: add it to freckle-density.mts's FRAMES against her floor");
} else {
  console.log("\nno image URL in the response — read the stored row for the outcome");
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
