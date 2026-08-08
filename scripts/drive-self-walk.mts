/**
 * THE SELF-DRIVE WALK — the founder is the taste gate, not the smoke test.
 *
 * Founder directive, 2026-08-06: no more "retry it and see". The walk is driven
 * here, and the founder is called only when it passes **clean, twice in a row**,
 * with screenshots, stored verdicts and ledger rows as proof — twice, so a lucky
 * roll cannot summon them.
 *
 * # It drives the BROWSER, because that is where the product is
 *
 * The first version of this driver posted to `castingV2.refine` over HTTP. That
 * reached the whole server stack and could not see the product: the click path
 * to the panel, the ghost chip, the picture narrating its own wait, the outcome
 * sentence, the answer chips. Those are not decoration — the founder's walk is
 * fifteen minutes in a viewer, and every one of them is a thing that has broken.
 *
 * So actuation is browser-only. There is no `--http` mode, because a mode
 * nobody runs is the invoked-but-inert class, and two actuation paths producing
 * "the same" number is how the founder gets summoned off the wrong one. HTTP
 * survives here for exactly two jobs that are not actuation: finding which
 * sheet the candidate lives on, and nothing else.
 *
 * # The number comes from the STORED ROW, not from the screen and not from the
 * response
 *
 * `castingV2.refine` does not return the verdict — it persists it onto the
 * variant's `internalPrompt`. The previous driver read `data.verification`,
 * which is always `undefined`, so every step classified `delivered_unverified`
 * and the delivery rate it printed was **structurally 0%** whatever the product
 * did. D-236 makes this walk the sole source of that number, so the instrument
 * was fixed before a credit was spent (law 2: verify the instrument before
 * believing its finding). Rows come back through `lib/attemptRows`, the same
 * module `scripts/reliability-report.mts` uses, so the two cannot disagree.
 *
 * The screen and the row are TWO instruments and both must agree. A delivered
 * picture the DOM never showed is a projection defect only this layer can see,
 * and it counts as a failure of the run rather than a reclassification.
 *
 * # Every step declares what it EXPECTS, and an ask is not a delivery
 *
 * Step two asks for fox eyes on a face that measures 7.2 degrees of canthal
 * tilt, so the already-true gate fires and she is ASKED rather than charged.
 * That is the founder's ratified behaviour, and it must be a pass — but it must
 * never be able to flatter the delivery rate, because a class that always asks
 * would otherwise read as perfect while delivering nothing.
 *
 * It cannot, and not by an exclusion someone has to remember: a free question
 * never reserves an operation, so it writes no row with `pointsCost > 0` and is
 * not in the rate's population at all. What the walk checks is that each step
 * landed on the outcome it declared — an ask where a delivery was expected is a
 * failure, and so is a delivery where an ask was expected (the gate did not
 * fire, and 25 credits went on measuring nothing).
 *
 * **Named consequence, for the founder rather than for me:** because the walk
 * stops at the ask, `eye.shape` contributes nothing to the delivery
 * denominator. Its delivery sample belongs to the class sweep, on a face
 * measured FLAT — which is the only kind of face on which the ask carries a
 * real delta (see the tilt pool). The walk keeps the founder's five steps.
 *
 * # It cannot spend by accident
 *
 * Every delivering step is a real 25-credit refine on a real account. `--spend`
 * is required; without it the script prints the plan and exits.
 *
 *   JWT_SECRET=… APP_ID=… OPEN_ID=… npx tsx scripts/mint-production-session.mts
 *   railway.cmd run --service MySQL npx tsx scripts/drive-self-walk.mts \
 *     --base https://… --token <jwt> --candidate <publicId> --spend
 *
 * (`railway run` is what supplies the production database for the verdict
 * readback. Without it the walk drives fine and cannot score itself, and it
 * says so rather than printing a zero.)
 *
 * Exits non-zero unless every step landed where it said it would and the rate
 * table clears D-236's bar, so two consecutive green runs are a fact rather
 * than a recollection.
 *
 * # THE CLASS SWEEP — this driver's second campaign (founder, 2026-08-07)
 *
 * Ordered as the walk's immediate successor, and the standing bot's first real
 * campaign rather than someday. The SAME harness runs one canonical ask per
 * routable facet class into the same per-class table, inside a renewed ceiling:
 *
 *   deliverable   hair colour · hair cut · hair worn · lips · brows ·
 *                 makeup variants · nose piercing (the anchor exists) ·
 *                 glasses-add · eye shape (on a flat face — see above)
 *   refusals      skin tone and body ink, verified as REFUSING CORRECTLY —
 *                 a class that routes honestly is a pass, not an omission
 *
 * The two gates are different and must not be confused: **the founder's walk
 * gates the founder's moment; the class sweep gates any scope beyond the
 * founder.** No account past `users:1` moves until the sweep's table clears the
 * bar per class, or the class is honestly routed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "puppeteer-core";

import { formatReport, summarize } from "../server/castingV2/reliabilityReport.js";
import { databaseUrl, settleAttemptRows } from "./lib/attemptRows.mjs";
import { createChecks, openDrivenPage } from "./lib/drivePage.mjs";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3000");
const TOKEN = arg("token");
const CANDIDATE = arg("candidate");
const SPEND = process.argv.includes("--spend");
const OUT = arg("out", `output/walk/${new Date().toISOString().replace(/[:.]/g, "-")}`);
/**
 * `--fresh <rollPublicId>` walks an UNTOUCHED face from that roll instead of a
 * named one. Required for any run that counts toward the two-clean bar: a face
 * this walk has already edited carries those facets into every later render, so
 * a second walk over it measures a chain rather than a product.
 */
const freshFromRoll = arg("fresh");

if (!TOKEN) throw new Error("--token <app_session_id JWT> is required (see mint-production-session.mts)");
if (!CANDIDATE && !freshFromRoll) {
  throw new Error("--candidate <publicId> or --fresh <rollPublicId> is required — never guess which face to spend on");
}

/**
 * THE WALK, in the founder's own order.
 *
 * `expectClass` is the reviewer's expectation of which edit class the step
 * exercises — recorded so a step that lands under a different facet than
 * intended is visible rather than silently reclassified.
 *
 * `expects` is the outcome the product should reach. It is declared here rather
 * than inferred from what happened, because inferring it is exactly how an ask
 * would come to look like a pass on a step that should have delivered.
 */
type WalkStep = {
  instruction: string;
  expectClass: string;
  expects: "delivered" | "asked";
  /**
   * Outcomes that are ALSO correct for this step, and why.
   *
   * Only ever used where the product has two honest answers and which one it
   * gives depends on the face — never as a way to make a step easier to pass.
   * The forbidden outcomes are unchanged and enforced elsewhere: a charged
   * non-compliant (`delivered_noncompliant`) and a false pass fail the run on
   * either branch.
   */
  orHonestly?: readonly StepResult["outcome"][];
  /** Printed beside the step so the derivation is visible in the log. */
  why?: string;
};

/**
 * STEP 2's EXPECTATION IS MEASURED OFF HER FACE, not declared against one.
 *
 * It used to read `expects: "asked"` with the comment *"she measures 7.2
 * degrees"* — a constant that assumed a specific specimen, sitting inside the
 * `--fresh` feature built to stop reusing specimens. On run-7's face, whose
 * eyes were not already upswept, the product did the right thing (rendered,
 * came back without fox eyes twice, refunded honestly) and the walk scored it
 * a failure. The twice-clean bar was unreachable on any fresh face.
 *
 * So the ladder measures her before the walk starts, using the same instrument
 * and the same threshold the gate itself uses — not a second copy of either:
 *
 *   already upswept   the gate fires and she is ASKED, free
 *   not, or no read   the gate stays silent and she is SPENT on — which lands
 *                     `delivered`, or an honest refusal-and-refund when the
 *                     painter cannot do it (run-7's fox eyes, twice)
 *
 * The no-read case follows the product's own asymmetry: *silence resolves
 * toward spending*, so an unreadable face expects the spending branch. Reading
 * it the other way would have the walk expect a gate the product will not fire.
 */
async function deriveEyeShapeExpectation(imageUrl: string): Promise<Pick<WalkStep, "expects" | "orHonestly" | "why">> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return {
      expects: "delivered",
      orHonestly: ["refused"],
      why: "no FAL_KEY to measure her tilt — the gate cannot fire for the walk either",
    };
  }
  const reading = await (async () => {
    try {
      const [{ readCanthalTilt }, { createFalRegionReader }] = await Promise.all([
        import("../server/castingV2/eyeShapeRouting.js"),
        import("../server/castingV2/falRegionReader.js"),
      ]);
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`her picture answered ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      return await readCanthalTilt({ image: bytes, reader: createFalRegionReader({ apiKey }) });
    } catch (error) {
      console.log(`  tilt unreadable (${String(error).slice(0, 90)})`);
      return null;
    }
  })();

  const { alreadyUpswept } = await import("../server/castingV2/canthalTilt.js");
  if (reading && alreadyUpswept(reading)) {
    return {
      expects: "asked",
      why: `she measures ${reading.meanDeg.toFixed(1)}° — already upswept, so the gate asks instead of spending`,
    };
  }
  return {
    expects: "delivered",
    orHonestly: ["refused"],
    why: reading
      ? `she measures ${reading.meanDeg.toFixed(1)}° — not already upswept, so this is a real edit she pays for`
      : "her tilt did not read, and a no-read never fires the gate — so this spends",
  };
}

const WALK: WalkStep[] = [
  { instruction: "give her freckles", expectClass: "marks", expects: "delivered" },
  /* Replaced before the walk runs, by the measurement above. */
  { instruction: "fox eyes", expectClass: "eye.shape", expects: "asked" },
  { instruction: "add nude lip gloss", expectClass: "makeup", expects: "delivered" },
  { instruction: "gold hoop earrings", expectClass: "statedAccessories", expects: "delivered" },
  { instruction: "remove her glasses", expectClass: "statedAccessories", expects: "delivered" },
];

/**
 * Did this step land where it said it would?
 *
 * One predicate, used by the per-step check AND by the final gate — they read
 * the same rule or they can disagree, and a run that prints "landed" per step
 * and "not clean" overall would be unreadable.
 */
const landedAsDeclared = (
  step: Pick<WalkStep, "expects" | "orHonestly">,
  outcome: StepResult["outcome"],
): boolean => outcome === step.expects || (step.orHonestly?.includes(outcome) ?? false);

const COOKIE = `app_session_id=${TOKEN}`;
/**
 * How long the walk waits for a render to reach her screen.
 *
 * WAS four minutes, and run-6 scored two honest deliveries as timeouts because
 * of it. The operation rows: "give her freckles" completed in **283s** and
 * "remove her glasses" in **276s**, against a cap that gave up at 240. The
 * walk was measuring its own patience and calling it delivery, and a window
 * that scores honest deliveries as failures poisons every rate it touches.
 *
 * Eight minutes is comfortably past the slowest render measured, and the step
 * still records the seconds it actually took — so a genuinely slow product is
 * visible as a number rather than hidden behind a verdict.
 *
 * The wait itself is a separate, real question: the product's own copy says
 * "usually about half a minute" against a measured 283s. That is a founder
 * matter, not a harness one, and widening this does not settle it.
 */
const LANDING_TIMEOUT_MS = 8 * 60 * 1000;

/* ---------------------------------------------------------------------------
   Finding the sheet. Navigation, not verdict — so HTTP is the honest tool.
   Derived by walking the owner's own projections rather than being passed in,
   because a hardcoded session id is a second copy of a fact the server owns.

   It runs BEFORE the spend gate on purpose: a dry run that proves the session
   is live and the face is where it is said to be is the only pre-flight this
   driver can have, and one that can only be checked by spending is not a
   pre-flight at all.
--------------------------------------------------------------------------- */

/**
 * AN UNTOUCHED FACE FROM THE SAME ROLL — because two runs on one face are not
 * two samples.
 *
 * Edits are base-anchored and `composed` carries every facet the chain ever
 * wrote, so a second walk over a face the first walk edited starts from a
 * different identity than the first did: run two of this walk rendered earrings
 * nobody had asked for, inherited from run one. Selecting the original changes
 * the base PICTURE and not the accumulated record, which is why "reset to the
 * original" was not enough.
 *
 * "Untouched" is asked of the database rather than remembered between runs —
 * a face with no variant rows has never been refined, and that is a fact the
 * driver can check rather than a note it has to keep. Signed candidates are
 * excluded by name: position 0 of this roll is the founder's Cast.
 */
async function pickFreshCandidate(): Promise<string> {
  const { openDatabase } = await import("./lib/dbConnection.mjs");
  const conn = await openDatabase(databaseUrl());
  try {
    const [rows] = await conn.query<any[]>(
      `SELECT c.publicId, c.position
         FROM casting_candidates c
         JOIN casting_rolls r ON r.id = c.rollId
        WHERE r.publicId = ? AND c.status = 'ready' AND c.signedCastId IS NULL
          AND NOT EXISTS (SELECT 1 FROM casting_candidate_variants v WHERE v.candidateId = c.id)
        ORDER BY c.position ASC
        LIMIT 1`,
      [freshFromRoll],
    );
    if (rows.length === 0) {
      throw new Error(
        `no untouched face left on roll ${freshFromRoll} — every candidate has been refined. `
        + "Roll a fresh one rather than walking a face with a history.",
      );
    }
    console.log(`--fresh: position ${rows[0].position} of roll ${freshFromRoll}, no prior variants`);
    return String(rows[0].publicId);
  } finally {
    await conn.end();
  }
}

async function trpcQuery(path: string, input: unknown): Promise<any> {
  const url = `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url, { headers: { cookie: COOKIE } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body?.result?.data?.json;
}

type Located = {
  sessionId: string;
  /** Kept so her CURRENT face can be re-asked for before every step. */
  rollId: string;
  /** The rail pill to press. A sheet shows its ACTIVE roll, not every roll. */
  rollIndex: number;
  rollLabel: string;
  indexLabel: string;
  /**
   * Her own picture — the only thing on the sheet that identifies HER.
   *
   * The first version of this walked to `View candidate 08 larger` and clicked
   * whatever wore that label. Every roll has an eighth face, the sheet was
   * showing a different roll, and so all nine paid renders landed on a
   * different woman at the same position — a face nobody had asked for, with
   * its own history, on which "no freckles" and "glasses still on" were then
   * recorded as findings about the walk candidate.
   *
   * A label is a coordinate; an image key is an identity. Matching on the
   * coordinate is the same mistake as scoping a write by id and checking the
   * owner separately, and it deserves the same fix: ask the question about the
   * thing itself.
   */
  imageUrl: string;
};

async function locateCandidate(): Promise<Located> {
  const sessions = await trpcQuery("castingV2.openSessions", {});
  for (const session of sessions ?? []) {
    const detail = await trpcQuery("castingV2.getSession", { sessionId: session.sessionId });
    for (const roll of detail?.rolls ?? []) {
      const projection = await trpcQuery("castingV2.getRoll", { rollId: roll.rollId });
      const found = (projection?.candidates ?? []).find(
        (candidate: any) => candidate.candidateId === CANDIDATE_ID,
      );
      if (!found) continue;
      if (!found.imageUrl) {
        throw new Error(`candidate ${CANDIDATE_ID} has no image — there is nothing to identify her by`);
      }
      return {
        sessionId: session.sessionId,
        rollId: roll.rollId,
        rollIndex: roll.rollIndex,
        rollLabel: String(roll.rollIndex).padStart(2, "0"),
        indexLabel: found.indexLabel,
        imageUrl: found.imageUrl,
      };
    }
  }
  throw new Error(
    `candidate ${CANDIDATE_ID} is not on any open sheet for this session — `
    + "refusing to walk a face I cannot find rather than guessing at one",
  );
}

console.log(`SELF-DRIVE WALK — ${WALK.length} steps`);
console.log(`base ${BASE}`);
const CANDIDATE_ID = freshFromRoll ? await pickFreshCandidate() : CANDIDATE;
console.log(`candidate ${CANDIDATE_ID}`);
const { sessionId, rollId, rollIndex, rollLabel, indexLabel, imageUrl } = await locateCandidate();

/**
 * The picture her TILE is wearing right now.
 *
 * A tile shows the candidate's currently selected face, so it changes the
 * moment this walk selects a new version — pinning the identity to the picture
 * found at startup would work for step one and silently miss her from step two
 * onward, which is the same coordinate-versus-identity error one layer along.
 * So it is re-asked, from the server, immediately before each open.
 */
async function currentFaceKey(): Promise<string> {
  const projection = await trpcQuery("castingV2.getRoll", { rollId });
  const found = (projection?.candidates ?? []).find((c: any) => c.candidateId === CANDIDATE_ID);
  const url: string | null = found?.imageUrl ?? null;
  if (!url) throw new Error(`candidate ${CANDIDATE_ID} no longer has a face on roll ${rollLabel}`);
  return url.slice(url.lastIndexOf("/") + 1);
}
console.log(
  `sheet ${sessionId} · roll ${rollLabel} (index ${rollIndex}) · candidate ${indexLabel}`
  + `
identified by her own picture: ${imageUrl.slice(imageUrl.lastIndexOf("/") + 1)}`,
);
/*
  MEASURE HER BEFORE COSTING THE WALK, not after.

  It runs here, ahead of the `--spend` gate, for the same reason the sheet
  lookup does: a dry run must print the plan this walk would actually execute,
  and step 2's price depends on her face. A derivation the dry run cannot show
  is a derivation nobody reviews.
*/
const eyeShape = await deriveEyeShapeExpectation(imageUrl);
const eyeShapeStep = WALK.find((step) => step.expectClass === "eye.shape");
if (!eyeShapeStep) throw new Error("the eye.shape step is gone — its expectation is derived and has nowhere to land");
Object.assign(eyeShapeStep, eyeShape);

const paidSteps = WALK.filter((step) => step.expects === "delivered").length;
console.log(`cost if it runs: ${paidSteps * 25} credits (${paidSteps} paid, ${WALK.length - paidSteps} free)\n`);
for (const [index, step] of WALK.entries()) {
  console.log(
    `  ${index + 1}. "${step.instruction}"  → expects ${step.expects}`
    + (step.orHonestly?.length ? ` (or ${step.orHonestly.join("/")})` : "")
    + ` · ${step.expectClass}`
    + (step.why ? `\n       ${step.why}` : ""),
  );
}
if (!SPEND) {
  console.log("\nDRY RUN — pass --spend to actually drive it. Nothing was charged.");
  process.exit(0);
}

const startedAt = new Date();
mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------------------
   The drive.
--------------------------------------------------------------------------- */

const checks = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token: TOKEN, height: 1100 });

type StepResult = {
  instruction: string;
  expectClass: string;
  expects: "delivered" | "asked";
  /** The other honest outcome for this step, if its expectation was derived. */
  orHonestly?: readonly StepResult["outcome"][];
  /** How the expectation was arrived at, in words, for the evidence pack. */
  why?: string;
  /** `collided` — the server restarted under this step, so it measured nothing. */
  outcome: "delivered" | "asked" | "refused" | "errored" | "timeout" | "collided";
  /** The sentence the panel showed, verbatim — a refusal nobody can read is a
      refusal nobody can act on, so it is captured rather than summarised. */
  said: string | null;
  answers: string[];
  imageUrl: string | null;
  seconds: number;
};

const results: StepResult[] = [];
/** Every picture this walk has been shown, so "it changed" is a real claim. */
const shownSoFar = new Set<string>();

/** How many real (non-ghost) versions the stack is showing. */
const stackSize = (page: Page) =>
  page.$$eval(".dpc-refine__pick:not(.dpc-refine__pick--ghost)", (nodes) => nodes.length);

async function openViewer(): Promise<void> {
  await page.goto(`${BASE}/casting/s/${sessionId}`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".dpc-card", { timeout: 60_000 });

  /*
    HER ROLL FIRST. The sheet opens on the ACTIVE roll and the rail is how every
    earlier one stays reachable — free navigation, no server call.
  */
  const railed = await page.evaluate((wanted) => {
    const rail = Array.from(document.querySelectorAll<HTMLElement>(".dpc-rollrail__item"));
    if (rail.length === 0) return "no rail — this sheet has one roll";
    const pill = rail.find((node) => node.innerText.trim().startsWith(wanted));
    if (!pill) return `no rail pill for roll ${wanted}`;
    if (pill.getAttribute("aria-selected") === "true") return "already showing her roll";
    pill.click();
    return "switched to her roll";
  }, rollLabel);
  await page.waitForSelector(".dpc-card", { timeout: 30_000 });

  /*
    AND THEN HER, BY HER OWN PICTURE.

    `View candidate 08 larger` is a coordinate, not a name — every roll has an
    eighth face, and clicking that label on the wrong roll is how nine paid
    renders were made of a woman nobody had asked for. The tile carrying HER
    image is the only tile that is her.
  */
  const key = await currentFaceKey();
  const opened = await page.evaluate((wantedKey) => {
    for (const card of Array.from(document.querySelectorAll<HTMLElement>(".dpc-card"))) {
      const img = card.querySelector<HTMLImageElement>("img");
      if (!img || !img.src.includes(wantedKey)) continue;
      const button = card.classList.contains("dpc-card__open")
        ? card
        : card.querySelector<HTMLElement>(".dpc-card__open");
      if (!button) return "her tile has no open control";
      button.click();
      return "opened";
    }
    return "not on this sheet";
  }, key);
  if (opened !== "opened") {
    throw new Error(
      `could not open the walk candidate by her own picture (${opened}; rail: ${railed}). `
      + "Refusing to spend on whoever happens to be at the same position.",
    );
  }
  await page.waitForSelector(".dpc-viewer", { timeout: 20_000 });

  /*
    AND WAIT FOR THE PANEL'S OWN DATA, which is a separate query.

    Run one read the stack the instant the viewer opened, got 0 because
    `variants` had not resolved, and then every landing check — "is the stack
    bigger than it was" — fired the moment the real stack rendered. Four steps
    were scored `delivered` that had refused or never run. Reading a projection
    before its query settles is the vacuous-pass hazard this harness keeps
    meeting; a settled read is two identical counts a second apart, not a
    hopeful sleep.
  */
  /* First that it has rendered at all — two equal reads of nothing is a settled
     read of an unsettled query, which is the same false zero one rung up. */
  await page.waitForSelector(".dpc-refine__pick", { timeout: 25_000 }).catch(() => undefined);
  await page.waitForFunction(
    () => {
      const stack = document.querySelectorAll(".dpc-refine__pick").length;
      const previous = (window as any).__walkStack;
      (window as any).__walkStack = stack;
      return previous !== undefined && previous === stack;
    },
    { timeout: 30_000, polling: 1000 },
  ).catch(() => undefined);
}

/**
 * Nothing of this face's is still running.
 *
 * `busy` disables the box while ANY refine on the sheet is in flight, so a step
 * that starts while the last one is still out cannot type at all — and a step
 * that starts while it is *becoming* busy types half a sentence. Waiting for
 * quiet is what the founder does without noticing.
 */
/**
 * HOW LONG THE SERVER HAS BEEN UP — the only way to tell OUR fault from ITS.
 *
 * Every push to `main` deploys, and a deploy kills the process holding a
 * refinement. That is a known and accepted collision class (founder ruling,
 * 2026-08-01): per-slice billing plus the recovery sweep is the designed answer,
 * and the money is right — charged 25, swept, refunded 25.
 *
 * But a step killed by a deploy is not a product signal, and it looks exactly
 * like one from the browser: the panel shows a transport error because the
 * connection died mid-request. Runs three and four both failed step one that
 * way, both within a minute of a push of mine, and both were about to be
 * written down as defects.
 *
 * Uptime going BACKWARDS across a step is proof the process restarted under it.
 * A step that collided is void — not a pass, not a failure, and never a row in
 * the delivery rate.
 */
async function serverUptime(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json() as { uptime?: number };
    return typeof body.uptime === "number" ? body.uptime : null;
  } catch {
    return null;
  }
}

async function waitUntilIdle(): Promise<string> {
  const settled = await page
    .waitForFunction(
      () => {
        const field = document.querySelector<HTMLInputElement>(".dpc-refine__field");
        return field !== null && !field.disabled;
      },
      { timeout: LANDING_TIMEOUT_MS, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  return settled ? "box is live" : "box still disabled — something is still running";
}

/*
  BACK TO THE ORIGINAL BEFORE ANYTHING IS TYPED — and it is free.

  The walk candidate already carries a chain from the founder's own attempt
  ("icy blue eyes", "tie her hair up"), and edits are base-anchored, so without
  this every step would compose those two facets in alongside its own. Two
  costs, both fatal to the exercise: the per-class table would carry `hairWorn`
  readings the walk is not testing, and — decisively — RUN TWO WOULD START FROM
  A DIFFERENT FACE THAN RUN ONE, which makes "clean twice in a row" a sentence
  about two different experiments.

  Selecting a version is navigation between pictures that already exist, so it
  costs nothing (D-121).
*/
console.log("\n── reset: selecting the original");
await openViewer();
const reset = await page.evaluate(() => {
  const button = document.querySelector<HTMLElement>('.dpc-refine__pick[aria-label="The original"]');
  if (!button) return null;
  const wasPressed = button.getAttribute("aria-pressed") === "true";
  button.click();
  return { wasPressed };
});
if (reset === null) {
  /*
    A FRESH FACE HAS NO STACK, and that is the point of walking one.

    The panel renders its version stack only once a candidate HAS versions, so
    a candidate with no variants has no "Original" pick to press — and
    `--fresh` guarantees exactly that candidate. Scoring it as a failed control
    made every fresh-face walk unclean before its first step, which would have
    made the twice-clean bar unreachable by construction.

    The distinction that matters: no stack at all is legitimately absent; a
    stack that exists WITHOUT an Original is a real defect, and that is what
    the query below separates.
  */
  const hasStack = await page.$(".dpc-refine__stack");
  if (hasStack) {
    checks.neverArmed("[reset] the original is addressable", "a version stack with no Original in it");
  } else {
    checks.absent("[reset] the walk starts from the original face", "she has no versions yet — she IS the original");
  }
} else {
  await page.waitForFunction(
    () => document.querySelector('.dpc-refine__pick[aria-label="The original"]')
      ?.getAttribute("aria-pressed") === "true",
    { timeout: 30_000 },
  ).catch(() => undefined);
  const pressed = await page.evaluate(() =>
    document.querySelector('.dpc-refine__pick[aria-label="The original"]')?.getAttribute("aria-pressed"));
  checks.check(
    pressed === "true",
    "[reset] the walk starts from the original face",
    `Original aria-pressed="${pressed}" (was ${reset.wasPressed ? "already" : "not"} selected)`,
  );
}

for (const [index, step] of WALK.entries()) {
  const position = `${index + 1}/${WALK.length}`;
  console.log(`\n── ${position} "${step.instruction}"  (expects ${step.expects})`);
  const began = Date.now();

  const uptimeBefore = await serverUptime();

  /* Re-opened per step. Closing and reopening between edits is what the founder
     actually does, and it is the path that has broken before (D-161: a running
     refinement that vanished with the component and got bought twice). */
  await openViewer();

  const before = await stackSize(page);
  /*
    HOW MANY VERSIONS ALREADY CARRY THIS SENTENCE.

    Landing was "a pick labelled with my instruction exists", which any EARLIER
    version wearing the same words satisfies — and the big walk asks some
    classes more than once. A stale match would score a step delivered with
    nothing landed, which is the coordinate-versus-identity class again, now
    inside the check written to fix its previous instance. Counted before, so
    landing is an INCREASE rather than a presence.
  */
  const mineBefore = await page.$$eval(
    ".dpc-refine__pick:not(.dpc-refine__pick--ghost)",
    (nodes, wanted) => nodes.filter((node) => node.getAttribute("aria-label") === wanted).length,
    step.instruction,
  );
  const panel = await page.$(".dpc-refine");
  checks.check(
    panel !== null,
    `[${position}] the refine panel is reachable from the tile`,
    panel ? `.dpc-refine present after opening candidate ${indexLabel}` : "no panel under the picture",
  );
  if (!panel) break;

  /* The price is stated where the money moves — D-15, and it is the one law
     that has cost the founder credits by being absent. */
  const priceNote = await page.$$eval(".dpc-refine__note", (nodes) =>
    nodes.map((node) => node.textContent ?? "").find((text) => /\d+\s*credits each/.test(text)) ?? "");
  checks.check(
    priceNote.length > 0,
    `[${position}] the panel states the price before the box`,
    priceNote || "no note carrying a per-edit price",
  );

  const idle = await waitUntilIdle();
  checks.check(idle === "box is live", `[${position}] the box is ready to take a sentence`, idle);
  if (idle !== "box is live") {
    /*
      AND THEN STOP, rather than typing into a box that will not take it.

      Run three found a step still running four minutes later, typed into the
      disabled field anyway, and died on the next selector — so the walk ended
      at step two with three steps never attempted and no report at all. A
      driver that crashes has measured nothing; a driver that records "this step
      never got a turn" has measured exactly that.
    */
    results.push({
      instruction: step.instruction,
      expectClass: step.expectClass,
      expects: step.expects,
      outcome: "timeout",
      said: idle,
      answers: [],
      imageUrl: null,
      seconds: Math.round((Date.now() - began) / 100) / 10,
    });
    console.log(`   → skipped — ${idle}`);
    continue;
  }

  /* The panel can re-render between the idle check and the keystroke — the
     viewer remounts on a variants refetch. Re-open once rather than dying on a
     missing selector, which is how two runs ended with three steps unattempted. */
  if (!(await page.$(".dpc-refine__field"))) {
    await openViewer();
    await waitUntilIdle();
  }
  if (!(await page.$(".dpc-refine__field"))) {
    checks.neverArmed(`[${position}] the box survives to be typed into`, "the panel went away");
    results.push({
      instruction: step.instruction, expectClass: step.expectClass, expects: step.expects,
      outcome: "timeout", said: "the refine panel went away before the sentence could be typed",
      answers: [], imageUrl: null, seconds: Math.round((Date.now() - began) / 100) / 10,
    });
    continue;
  }

  /*
    RE-DERIVE AGAINST THE FACE SHE IS ACTUALLY ON.

    The pre-walk reading measures her BASE, which is what a dry run can show
    and what prices the walk. But the gate reads `source.imageKey ?? …` — the
    SELECTED face — and by step 2 that is step 1's render, not her original.
    Freckles should not move a canthal tilt, but "should not" is a claim about
    a re-render and this program does not score 25-credit outcomes against
    those. Measuring the same frame the gate will measure is the whole point of
    deriving rather than declaring.

    Her base reading stays in the record beside it: if the two disagree, a
    re-render moved a measurement nobody asked it to move, and that is a
    finding rather than a nuisance.
  */
  if (step.expectClass === "eye.shape") {
    const onScreen = await page.evaluate(() =>
      document.querySelector<HTMLImageElement>(".dpc-viewer__plate img")?.src ?? null);
    if (onScreen && onScreen !== imageUrl) {
      const rederived = await deriveEyeShapeExpectation(onScreen);
      const moved = rederived.expects !== step.expects;
      console.log(
        `   re-derived on the face she is on: ${rederived.expects}`
        + `${moved ? ` — MOVED from ${step.expects} (base said: ${step.why ?? "-"})` : " (unchanged)"}`,
      );
      /*
        A MOVE IS RECORDED, NOT FAILED. The forbidden outcomes on this step are
        a charged non-compliant and a false pass (Fable, 2026-08-08); a tilt
        that crossed the threshold under an earlier render is an honest fact
        about the product, and failing the walk for it would be scoring the
        run against a frame nobody promised would hold still. The expectation
        follows the face; the observation goes in the record either way.
      */
      if (moved) {
        checks.absent(
          `[${position}] the expectation holds on the face she is actually on`,
          `her base derived ${step.expects} and the rendered face she is on derives `
          + `${rederived.expects} — an earlier render moved her across the threshold`,
        );
      } else {
        checks.check(
          true,
          `[${position}] the expectation holds on the face she is actually on`,
          `base and current face agree — ${rederived.why ?? rederived.expects}`,
        );
      }
      Object.assign(step, rederived, { why: `${rederived.why} (re-read on the face she is on)` });
    }
  }

  await page.type(".dpc-refine__field", step.instruction, { delay: 12 });

  /*
    WHAT IS ACTUALLY IN THE BOX, BEFORE THE MONEY MOVES.

    Run one typed into a field that went `disabled` mid-keystroke because a
    previous refinement's `pending` arrived on the poll, and dispatched a paid
    render of **"gold hoop ear"**. Twenty-five credits on a sentence nobody
    typed, and the only reason it was ever noticed is that the wait overlay
    read the truncation back. Asserting at the wire is exactly this: the
    contract is about what gets SENT, so it is proved on the outgoing value and
    not on the constant beside it (invariant 5).
  */
  const inBox = await page.$eval(".dpc-refine__field", (node) => (node as HTMLInputElement).value);
  const intact = inBox === step.instruction;
  checks.check(
    intact,
    `[${position}] the box holds the sentence that is about to be paid for`,
    `field reads "${inBox}"`,
  );
  if (!intact) {
    /* Refusing to spend beats spending on the wrong thing and measuring it. */
    results.push({
      instruction: step.instruction,
      expectClass: step.expectClass,
      expects: step.expects,
      outcome: "timeout",
      said: `the box held "${inBox}" — not submitted`,
      answers: [],
      imageUrl: null,
      seconds: Math.round((Date.now() - began) / 100) / 10,
    });
    continue;
  }

  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(".dpc-refine__ask");
    form?.requestSubmit();
  });

  /*
    THE CLICK'S OWN FRAME. Read back with no wait at all: a sleep here would let
    the poll arrive and the check would pass on the server's work rather than on
    the client's, which is the vacuous pass this harness has been caught by
    twice already.
  */
  const busyLabel = await page.evaluate(
    () => new Promise<string>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() =>
        resolve(
          document.querySelector<HTMLElement>(".dpc-refine__ask button[type=submit]")?.innerText?.trim()
          ?? "",
        )))),
  );
  checks.check(
    /refining/i.test(busyLabel),
    `[${position}] the box says it is working in the click's own frame`,
    `submit button read "${busyLabel}"`,
  );

  /*
    LANDING, AND THE NARRATION ALONG THE WAY — one loop, not two windows.

    Run one watched for narration in its own 30-second window and then waited
    separately for the landing, so a render that took 32 seconds was recorded as
    "never narrated". Worse, a step that REFUSED for free was judged against a
    narration it was right not to have. The wait is the same wait: poll it once,
    keep the best narration seen, and stop when the outcome arrives.
  */
  let narrated: { said: string | null; stage: string | null; ghost: string | null } | null = null;
  let landed = false;
  const deadline = Date.now() + LANDING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    /*
      THE LANDING IS ATTRIBUTED, not counted.

      "Is the stack bigger than it was" is satisfied by ANY arrival, and edits
      here run about 160 seconds while the founder types the next one — so a
      late lander from two steps ago closed the wrong step's wait. The product
      says so itself in the panel ("the edit you started earlier just arrived"),
      which is the guard printing its own firing, and I was counting beside it.
      Each version's pick is labelled with its own last instruction, so the
      right question is whether THIS sentence is now in the stack.
    */
    const now = await page.evaluate((wanted) => ({
      mineCount: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"))
        .filter((node) => node.getAttribute("aria-label") === wanted).length,
      outcome: document.querySelector(".dpc-refine__outcome") !== null,
      said: document.querySelector<HTMLElement>(".dpc-viewer__waitSaid")?.innerText?.trim() ?? null,
      stage: document.querySelector<HTMLElement>(".dpc-viewer__waitMeta")?.innerText?.trim() ?? null,
      ghost: document.querySelector<HTMLElement>(".dpc-refine__pick--ghost")?.innerText?.trim() ?? null,
    }), step.instruction);
    if (now.said === step.instruction || now.ghost === step.instruction) {
      narrated = { said: now.said, stage: now.stage, ghost: now.ghost };
    }
    if (now.mineCount > mineBefore || now.outcome) { landed = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  if (narrated !== null) {
    checks.check(
      true,
      `[${position}] the wait says HER OWN sentence back`,
      `overlay "${narrated.said ?? "-"}" · ghost "${narrated.ghost ?? "-"}" · stage "${(narrated.stage ?? "-").replace(/\n/g, " · ")}"`,
    );
  } else if (step.expects === "delivered") {
    /* A step that spends should have narrated; whether it is a defect or simply
       a step that refused instead is decided by the outcome check below, so
       this records the observation rather than pre-judging it. */
    checks.absent(
      `[${position}] the picture narrates the wait`,
      "this step's own sentence was never in flight on screen",
    );
  } else {
    checks.absent(`[${position}] the picture narrates the wait`, "a free question never renders");
  }

  const seen = await page.evaluate((wanted) => ({
    stack: document.querySelectorAll(".dpc-refine__pick:not(.dpc-refine__pick--ghost)").length,
    mineCount: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"))
      .filter((node) => node.getAttribute("aria-label") === wanted).length,
    said: document.querySelector<HTMLElement>(".dpc-refine__outcome")?.innerText?.replace(/\s*×\s*$/, "").trim()
      ?? null,
    answers: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__answer"))
      .map((node) => node.innerText.trim()),
  }), step.instruction);

  /*
    A SENTENCE SHOWN TO A CUSTOMER IS WRITTEN FOR THEM.

    Run three's first step put **"Unable to transform response from server"** in
    the panel — the tRPC client failing to deserialize a response, rendered
    verbatim where the product's own refusal copy goes. Every refusal in this
    program is a carefully written sentence that names its wall and says nothing
    was charged; a transport string in that frame is not a refusal at all, and
    lumping it in with the honest ones is how a real defect gets counted as
    correct behaviour.

    So it is its own outcome. The markers are the vocabulary of machines, not of
    the stylist this panel speaks as.
  */
  const MACHINE_WORDS = /transform response|undefined|\[object |TypeError|NetworkError|ECONN|fetch failed|<html|status code|JSON/i;
  const machineSaid = Boolean(seen.said && MACHINE_WORDS.test(seen.said));

  /*
    DID THE PROCESS SURVIVE THIS STEP? Asked before anything is concluded from
    it, because a deploy landing mid-refine produces exactly the picture a
    broken product would.
  */
  const uptimeAfter = await serverUptime();
  const collided = uptimeBefore !== null && uptimeAfter !== null && uptimeAfter < uptimeBefore;

  const outcome: StepResult["outcome"] = collided
    ? "collided"
    : !landed
      ? "timeout"
      : seen.mineCount > mineBefore
        ? "delivered"
        : seen.answers.length > 0
          ? "asked"
          : machineSaid
            ? "errored"
            : "refused";

  if (collided) {
    checks.absent(
      `[${position}] measured anything at all`,
      `the server restarted under this step (uptime ${Math.round(uptimeBefore!)}s → `
      + `${Math.round(uptimeAfter!)}s) — a deploy collision, void, re-run needed`,
    );
  }

  if (seen.said && !collided) {
    checks.check(
      !machineSaid,
      `[${position}] the panel speaks to her, not about the transport`,
      `panel said "${seen.said.slice(0, 120)}"`,
    );
  }

  /*
    AND NOW LOOK AT WHAT SHE WOULD BE LOOKING AT.

    The old check read `.dpc-viewer__plate img` straight after landing and
    passed — on the SELECTED face, which the walk had pinned to the original at
    reset and which never changes when a version arrives. Step five's "delivered
    picture" came back byte-identical to step one's, and the check said ok both
    times: a false pass in the harness built to catch false passes.

    So the new version is SELECTED first (free — choosing between pictures that
    already exist is navigation, D-121) and the viewer is then asked what it is
    showing. That is the projection the founder actually judges.
  */
  let shown: string | null = null;
  if (outcome === "delivered") {
    await page.evaluate((wanted) => {
      /* The LAST match: new versions append, so the first one wearing these
         words is the oldest and selecting it would show a picture from an
         earlier step. */
      const matches = Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick"))
        .filter((node) => node.getAttribute("aria-label") === wanted);
      matches[matches.length - 1]?.click();
    }, step.instruction);
    await page.waitForFunction(
      (wanted) => {
        const matches = Array.from(
          document.querySelectorAll<HTMLElement>(".dpc-refine__pick"),
        ).filter((node) => node.getAttribute("aria-label") === wanted);
        return matches[matches.length - 1]?.getAttribute("aria-pressed") === "true";
      },
      { timeout: 30_000, polling: 500 },
      step.instruction,
    ).catch(() => undefined);
    shown = await page.evaluate(() =>
      document.querySelector<HTMLImageElement>(".dpc-viewer__plate img")?.src ?? null);
  }

  await page.screenshot({
    path: `${OUT}/${String(index + 1).padStart(2, "0")}-${step.instruction.replace(/\W+/g, "-")}.png`,
  });

  if (collided) {
    checks.absent(`[${position}] lands where it said it would`, "void — the deploy took it");
  } else checks.check(
    landedAsDeclared(step, outcome),
    `[${position}] lands where it said it would`,
    `expected ${step.expects}${step.orHonestly?.length ? ` (or ${step.orHonestly.join("/")})` : ""}, got ${outcome}`
    + (step.why ? ` — ${step.why}` : "")
    + (seen.said ? ` — panel said "${seen.said.slice(0, 110)}"` : ""),
  );

  if (step.expects === "asked") {
    /*
      A QUESTION THAT CANNOT BE ANSWERED IS A DEAD END, and this gate shipped as
      one: the sentence arrived through the refusal channel with no chips and
      nothing on the server able to receive a reply. The chips are what say it
      has a way through.
    */
    checks.check(
      seen.answers.length >= 2,
      `[${position}] the question has answers, not just a sentence`,
      `chips: ${seen.answers.length ? seen.answers.join(" / ") : "none"}`,
    );
    /*
      HER OWN STEP'S COUNT, not the whole stack.
      
      This compared TOTAL stack size, so run-6's step 1 — which landed LATE,
      after its window closed — made step 2's free question look as though it
      had charged. That is the late-lander attribution bug I had already fixed
      for the landing poll and did not sweep to its neighbour: law 7 on my own
      fix, missed once. A free ask creates no version bearing THIS instruction,
      whatever else lands meanwhile.
    */
    checks.check(
      seen.mineCount === mineBefore,
      `[${position}] asking costs her nothing`,
      `versions of this ask ${mineBefore} → ${seen.mineCount}`
      + (seen.stack === before ? "" : ` (stack ${before} → ${seen.stack}, a late lander from an earlier step)`),
    );
  }

  if (outcome === "delivered") {
    /*
      A DIFFERENT PICTURE THAN THE ONE BEFORE IT, which is the whole claim.

      Compared against every picture this walk has already been shown rather
      than merely against "not empty": run two returned the SAME url on five
      consecutive steps and the old check passed each time.
    */
    const fresh = Boolean(shown) && !shownSoFar.has(shown!);
    checks.check(
      fresh,
      `[${position}] selecting the new version changes the picture on screen`,
      shown
        ? `${fresh ? "new" : "SAME AS AN EARLIER STEP"} — ${shown.slice(shown.lastIndexOf("/") + 1)}`
        : "the viewer is showing nothing",
    );
    if (shown) {
      shownSoFar.add(shown);
      try {
        const image = await fetch(shown);
        const bytes = Buffer.from(await image.arrayBuffer());
        writeFileSync(`${OUT}/${String(index + 1).padStart(2, "0")}-delivered.png`, bytes);
      } catch (error) {
        console.log(`     (could not fetch the delivered image: ${String(error).slice(0, 80)})`);
      }
    }
  }

  results.push({
    instruction: step.instruction,
    expectClass: step.expectClass,
    expects: step.expects,
    /* Recorded, not recomputed: a derived expectation that only exists in the
       console is one nobody can audit after the run. */
    orHonestly: step.orHonestly,
    why: step.why,
    outcome,
    said: seen.said,
    answers: seen.answers,
    imageUrl: shown,
    seconds: Math.round((Date.now() - began) / 100) / 10,
  });
  console.log(`   → ${outcome} in ${results.at(-1)!.seconds}s`);

  /* The dock is a whole-page law and it is cheap to re-check per surface. */
  const dock = await page.evaluate(() => {
    const node = document.querySelector(".dp-dock");
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { onScreen: box.top < window.innerHeight && box.bottom > 0, top: Math.round(box.top) };
  });
  if (dock === null) checks.absent(`[${position}] the dock is on screen`, "no dock on the sheet");
  else checks.check(dock.onScreen, `[${position}] the dock is on screen`, `dock top at ${dock.top}px`);
}

await browser.close();

/* ---------------------------------------------------------------------------
   The rate sample. Read from the rows the product wrote, not from the screen.
--------------------------------------------------------------------------- */

let report: ReturnType<typeof summarize> | null = null;
let readbackError: string | null = null;
let unsettled = 0;
try {
  /*
    ONCE THE ROWS HAVE STOPPED MOVING (run-6). The walk read its table 31
    seconds before its last operation settled and printed `unclassified` with
    `credits refunded: 0` about a row that became `refused_honest` with 25
    refunded. The browser gives up before the server does — that is the normal
    case whenever a step outlives the landing cap, not a rare race.
  */
  const settled = await settleAttemptRows({ since: startedAt });
  unsettled = settled.unsettled;
  if (unsettled > 0) {
    console.log(
      `\n${unsettled} attempt row(s) NEVER SETTLED after ${Math.round(settled.waitedMs / 1000)}s `
      + "— the table below is missing them, and this run does not count.",
    );
  }
  report = summarize(settled.rows, { windowFrom: startedAt, windowLabel: "this walk" });
  console.log(`\n${formatReport(report)}`);
} catch (error) {
  /*
    A walk that cannot read its own verdicts has not measured anything. It says
    so and fails, rather than printing a zero that would look like a finding —
    the difference between a no-read and an absence (D-235's asymmetry).
  */
  readbackError = error instanceof Error ? error.message : String(error);
  console.log(`\nVERDICTS UNREADABLE — ${readbackError}`);
}

console.log("");
checks.print();

const collisions = results.filter((step) => step.outcome === "collided").length;
const landedRight = results.length === WALK.length
  && collisions === 0
  && results.every((step) => landedAsDeclared(step, step.outcome));
const clean = landedRight
  && checks.failures().length === 0
  && report !== null
  /* A run whose rows never settled has measured a subset it did not choose,
     and the ones it dropped are the SLOWEST — where the failures live. */
  && unsettled === 0
  && report.overall.delivered_noncompliant === 0
  && report.blockers.length === 0;

writeFileSync(
  `${OUT}/walk.json`,
  JSON.stringify({ startedAt, sessionId, candidate: CANDIDATE_ID, results, checks: checks.records, report, unsettled, readbackError }, null, 2),
);
console.log(`\nevidence written to ${OUT}`);
console.log(
  clean
    ? `WALK CLEAN — ${results.length}/${WALK.length} steps landed where they said they would, `
      + `${report!.overall.delivered_compliant} delivered compliant, 0 false passes.`
    : "WALK NOT CLEAN — the founder is not called."
      + (collisions > 0 ? ` ${collisions} step(s) VOID — the server redeployed under them; re-run, do not diagnose.` : "")
      + (landedRight || collisions > 0 ? "" : " Steps did not land as declared.")
      + (checks.failures().length ? ` ${checks.failures().length} browser check(s) failed.` : "")
      + (unsettled > 0 ? ` ${unsettled} attempt row(s) never settled — the sample is incomplete.` : "")
      + (report === null ? " No verdicts were read." : report.blockers.length ? ` Classes below the bar: ${report.blockers.join(", ")}.` : ""),
);
process.exit(clean ? 0 : 1);
