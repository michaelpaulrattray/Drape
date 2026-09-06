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
 * **Named consequence, for the founder rather than for me — and it now depends
 * on her face.** Step 2's expectation is measured, not declared (see
 * `deriveEyeShapeExpectation`), so what `eye.shape` contributes to the delivery
 * denominator depends on the face this run drew:
 *
 *   already upswept   the gate asks, no operation is reserved, and the class
 *                     contributes nothing — the old universal case
 *   not upswept       she is charged for a real edit, and the class DOES enter
 *                     the denominator, on exactly the flat face where the ask
 *                     carries a real delta
 *
 * So a walk costs 100 credits on an upswept face and 125 on a flat one, and the
 * dry run prints which this face is before anything is spent. This paragraph
 * used to state the first row as though it were the only one; it was written
 * when the expectation was a constant.
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
import { formatReport, summarize } from "../server/castingV2/reliabilityReport.js";
import { countRecoveredExclusions, databaseUrl, settleAttemptRows } from "./lib/attemptRows.mjs";
import { createChecks, openDrivenPage } from "./lib/drivePage.mjs";
import {
  createCurrentFaceKey, createLandedImageKey, createTrpcQuery, createViewerOpener,
  locateCandidate as locateOnSheet, refineStep,
} from "./lib/refineDriver.mts";
import { openDatabase } from "./lib/dbConnection.mjs";
import { adjudicateCandidateCarries, formatCarriedVerdict } from "./lib/carriedAdjudicator.mjs";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { spendAuthorized } from "./lib/stopline.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

/*
  THE FREEZE IS ASKED BEFORE THE ARGUMENTS ARE EVEN VALIDATED.

  fable-117, after this driver ran a paid walk inside a founder-ordered
  stop-the-line: the order lived in a mailbox file a shift had to remember to
  re-read, so it moved into one the tooling reads for itself. Dry runs are
  untouched — a frozen shift still plans.

  It sits ABOVE the parse rather than three constants below it (#345): the
  sentence above is what this file promises, and a strict parse that refused a
  mistyped word first would have quietly made it false.
*/
const SPEND = spendAuthorized("spend a walk's credits on the founder's account");

/**
 * THIS FILE'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * The reader here was `process.argv.indexOf("--" + name)`, which cannot fail on
 * a word it was never asked about: `--dry-run`, `--Fresh`, a typo'd `--tokan`
 * were all discarded in silence and the walk went ahead on the defaults. This
 * driver charges 25 credits a step to the founder's own account, and `--fresh`
 * missed is the difference between measuring the product and measuring a chain
 * of edits — a wrong reading nobody could see afterwards.
 *
 * `--spend` is declared even though the freeze above owns the answer: the
 * parser still has to know the word is legal or every real walk would refuse.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["base", "token", "candidate", "out", "fresh", "publicBase"],
  boolean: ["spend"],
});
function arg(name: string, fallback = ""): string {
  return ARGS.value(name) ?? fallback;
}

const BASE = arg("base", "http://localhost:3000");
const TOKEN = arg("token");
const CANDIDATE = arg("candidate");
const OUT = arg("out", `output/walk/${new Date().toISOString().replace(/[:.]/g, "-")}`);
/**
 * `--fresh <rollPublicId>` walks an UNTOUCHED face from that roll instead of a
 * named one. Required for any run that counts toward the two-clean bar: a face
 * this walk has already edited carries those facets into every later render, so
 * a second walk over it measures a chain rather than a product.
 */
const freshFromRoll = arg("fresh");
/*
  THE BUCKET THE KEYS RESOLVE AGAINST — production's, never the one in `.env`.

  A production key fetched from the dev bucket is a 404 dressed up as a bare
  face, and it has cost this campaign a whole court's worth of readings once
  already. It is required rather than defaulted for exactly that reason.
*/
const PUBLIC_BASE = arg("publicBase", process.env.PUBLIC_BASE ?? "");

if (!TOKEN) throw new Error("--token <app_session_id JWT> is required (see mint-production-session.mts)");
if (!CANDIDATE && !freshFromRoll) {
  throw new Error("--candidate <publicId> or --fresh <rollPublicId> is required — never guess which face to spend on");
}
/* Refused BEFORE anything is spent, not at the step that needs it — see the
   note in `deriveEyeShapeExpectation`. Run-11 spent 25 credits on step 1 and
   then booked a false failure on step 2 for want of this line. */
if (!process.env.FAL_KEY) {
  throw new Error(
    "FAL_KEY is required before the first credit is spent: step 2's expectation is measured "
    + "off her face, and a walk that cannot measure it would grade the product against a guess.",
  );
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
    /*
      A MISSING INSTRUMENT IS NOT A NO-READ, and defaulting here booked a
      product failure against a step the product got right.

      The no-read branch below is a real reading — we looked at her face and
      could not tell — and the product's own asymmetry says silence resolves
      toward spending, so expecting the spending branch is correct there. An
      absent key is a different thing entirely: nobody looked. Run-11 was
      launched under `railway run --service MySQL`, which carries the database
      URL and not this key, so the ladder expected `delivered`, the product
      correctly ASKED an already-upswept face, and the walk wrote that down as
      a failure. A harness that cannot measure must refuse, not assume — the
      same rule the product lives under.
    */
    throw new Error(
      "FAL_KEY is required: step 2's expectation is MEASURED off her face, and without it "
      + "the walk would guess. Export it alongside the database URL "
      + "(`FAL_KEY=… railway run --service MySQL -- npx tsx scripts/drive-self-walk.mts …`).",
    );
  }
  const measured = await (async () => {
    try {
      const [{ readCanthalTilt }, { createFalRegionReader }, { wearsGlassesByPixels }] = await Promise.all([
        import("../server/castingV2/eyeShapeRouting.js"),
        import("../server/castingV2/falRegionReader.js"),
        import("../server/castingV2/canthalTilt.js"),
      ]);
      const reader = createFalRegionReader({ apiKey });
      const { bytes } = await fetchImageBytes(imageUrl);
      const reading = await readCanthalTilt({ image: bytes, reader });
      /* Only asked when the tilt FAILED — the same two conditions the product's
         gate uses, in the same order, so the walk's expectation is derived from
         the same facts rather than from a parallel guess about them. */
      if (reading) return { reading, glasses: false };
      const glasses = await reader
        .region({ image: bytes, name: "glasses", absentIsAnswer: true })
        .then(wearsGlassesByPixels)
        .catch(() => false);
      return { reading: null, glasses };
    } catch (error) {
      console.log(`  tilt unreadable (${String(error).slice(0, 90)})`);
      return { reading: null, glasses: false };
    }
  })();
  const reading = measured.reading;

  const { alreadyUpswept } = await import("../server/castingV2/canthalTilt.js");
  if (reading && alreadyUpswept(reading)) {
    return {
      expects: "asked",
      why: `she measures ${reading.meanDeg.toFixed(1)}° — already upswept, so the gate asks instead of spending`,
    };
  }
  /*
    THE THIRD BRANCH — her eyes could not be measured because her frames are
    over them, so the product asks for free instead of charging (2026-08-09).

    Derived, not declared: the walk asks the same two questions the gate asks,
    in the same order, off the same bytes. A harness that guessed this would be
    grading the product against its own opinion.
  */
  if (!reading && measured.glasses) {
    return {
      expects: "asked",
      why: "her tilt did not read and she is wearing glasses, so the gate asks instead of charging",
    };
  }
  return {
    expects: "delivered",
    orHonestly: ["refused"],
    why: reading
      ? `she measures ${reading.meanDeg.toFixed(1)}° — not already upswept, so this is a real edit she pays for`
      : "her tilt did not read and no frames were found, so a no-read spends exactly as before",
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

/*
  THE LANDING CAP LIVES IN `lib/refineDriver` NOW, with the run-6 numbers that
  set it. The wait itself is a separate, real question: the product's own copy
  says "usually about half a minute" against a measured 283s. That is a founder
  matter, not a harness one, and widening the cap does not settle it.
*/
const trpcQuery = createTrpcQuery({ base: BASE, token: TOKEN });

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

console.log(`SELF-DRIVE WALK — ${WALK.length} steps`);
console.log(`base ${BASE}`);
const CANDIDATE_ID = freshFromRoll ? await pickFreshCandidate() : CANDIDATE;
console.log(`candidate ${CANDIDATE_ID}`);
const { sessionId, rollId, rollIndex, rollLabel, indexLabel, imageUrl } =
  await locateOnSheet({ trpcQuery, candidateId: CANDIDATE_ID });
const currentFaceKey = createCurrentFaceKey({ trpcQuery, rollId, rollLabel, candidateId: CANDIDATE_ID });
const landedImageKey = createLandedImageKey(CANDIDATE_ID);
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

/*
  AND A FACE THAT CANNOT SATISFY A DECLARED STEP IS REFUSED BEFORE IT IS PAID
  FOR (2026-08-09).

  `--fresh` picks any untouched candidate, and TWO of the five steps are only
  meaningful on a bespectacled face: "gold hoop earrings" wants her glasses to
  SURVIVE, and "remove her glasses" wants them to GO. Run-13 found a
  bespectacled face by asking the segmenter; the harness itself never checked,
  and run-15's draw was cand-1546 — no glasses anywhere in the frame. It would
  have spent 75 credits and then failed on a step that was impossible from the
  start, and the table would have called it a product failure.

  Same rule the eye-shape ladder already lives under: a harness that cannot
  measure must refuse rather than assume — extended from "cannot measure" to
  "measured, and this face is wrong for the script". Asked of the PIXELS, which
  is the only thing that cannot lie about it (D-206's lesson, one surface over).
*/
async function wearsGlasses(url: string): Promise<boolean | null> {
  try {
    const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
    /* The bytes are proven to be a picture first. This precondition decides
       whether 75 credits are spent, and it used to be answerable by an HTML
       error page: a 200 carrying the app's index would have read as "she is
       not wearing glasses" and refused a face that is wearing them. */
    const { bytes } = await fetchImageBytes(url);
    const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
    /* `absentIsAnswer` so nothing-found comes back as an empty mask rather than
       a throw: here, absent IS the finding and the whole point of asking. */
    const mask = await reader.region({ image: bytes, name: "eyeglasses", absentIsAnswer: true });
    return mask.data.some((value) => value > 0);
  } catch (error) {
    console.log(`  glasses unreadable (${String(error).slice(0, 90)})`);
    return null;
  }
}

const glassesSteps = WALK.filter((step) => /glasses/i.test(step.instruction));
if (glassesSteps.length > 0) {
  const bespectacled = await wearsGlasses(imageUrl);
  if (bespectacled === false) {
    throw new Error(
      `this face is not wearing glasses, and ${glassesSteps.length} of the ${WALK.length} steps are about them `
      + `("${glassesSteps.map((step) => step.instruction).join('", "')}"). `
      + "Walking her would spend on steps that cannot land and then score the product for it. "
      + "Pick a bespectacled face — `--candidate <publicId>` — or roll one.",
    );
  }
  console.log(bespectacled === null
    ? "  glasses: NO READ — proceeding, but the removal step's expectation is unproven"
    : "  glasses: present, so the earrings and removal steps are answerable");
}

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

/*
  THE MECHANICS ARE `lib/refineDriver`'s NOW — every lesson in them was learned
  here, and the finding-replay walk drives the same panel on the same account.
  Two copies of this is the mirror law #4 forbids, and the failure mode is not
  abstract: two harnesses that disagree about whether a step landed produce two
  answers to "does the product work".
*/
const openViewer = createViewerOpener({
  page, base: BASE, sessionId, rollLabel, currentFaceKey, indexLabelForError: indexLabel,
});

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
  /*
    THE ACTUATION IS `lib/refineDriver`'s; THE LAWS BELOW ARE THIS WALK'S.

    Everything the shared driver asserts belongs to the panel itself — reachable,
    priced before the box, live, holding the sentence that is about to be paid
    for, narrating the wait, showing the picture the ROW says was delivered. What
    a step MEANT is decided here, because that is this walk's question and not
    the panel's.
  */
  const seen = await refineStep({
    page,
    base: BASE,
    checks,
    label: `[${position}]`,
    instruction: step.instruction,
    openViewer,
    landedImageKey,
    indexLabel,
    expectsDelivery: step.expects === "delivered",
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
    beforeTyping: step.expectClass !== "eye.shape" ? undefined : async () => {
      const onScreen = await page.evaluate(() =>
        document.querySelector<HTMLImageElement>(".dpc-viewer__plate img")?.src ?? null);
      if (!onScreen || onScreen === imageUrl) return;
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
    },
  });
  const { outcome, shown, collided } = seen;

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
      seen.mineAfter === seen.mineBefore,
      `[${position}] asking costs her nothing`,
      `versions of this ask ${seen.mineBefore} → ${seen.mineAfter}`
      + (seen.stackAfter === seen.stackBefore
        ? ""
        : ` (stack ${seen.stackBefore} → ${seen.stackAfter}, a late lander from an earlier step)`),
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
    seconds: seen.seconds,
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
  /* The walk's own window, counted the same way the on-demand report counts it
     — a paid step whose variant row was never written is absent from the table
     above, and a walk that did not say so would be the flattering read. */
  report = summarize(settled.rows, {
    windowFrom: startedAt,
    windowLabel: "this walk",
    recoveredExclusions: await countRecoveredExclusions({ since: startedAt }),
  });
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

/*
  AND THE CARRIED FACTS, JUDGED BY ARITHMETIC (fable-109).

  The reader cannot adjudicate a carried fact. On walk two it called her
  freckles absent on three consecutive frames that provably contained 20,036 of
  their 24,056 pixels — the delivery sits at the reader's own floor, which is a
  reading problem and not a rendering one. But the rate table drops carried rows
  from its denominator, so those three dissents left no mark at all and the walk
  printed 100%: the flattering bias the design named, arriving exactly where it
  said it would.

  So every carried fact is now adjudicated against the bytes: each pixel the
  segment owns is either byte-identical in the delivered frame or accounted for
  by a recorded intersection. A carried fact that is neither is UNRESOLVED, and
  a walk cannot be clean over one.
*/
let carriedUnresolved = 0;
try {
  const connection = await openDatabase(databaseUrl());
  try {
    const [variantRows] = await connection.query<any[]>(
      `SELECT v.id, v.imageKey, v.requestText, v.internalPrompt, v.createdAt
         FROM casting_candidate_variants v
         JOIN casting_candidates c ON c.id = v.candidateId
        WHERE c.publicId = ? ORDER BY v.id ASC`,
      [CANDIDATE_ID],
    );
    const [segmentRows] = await connection.query<any[]>(
      `SELECT s.* FROM casting_segments s
         JOIN casting_candidates c ON c.id = s.candidateId
        WHERE c.publicId = ? ORDER BY s.id ASC`,
      [CANDIDATE_ID],
    );
    if (!PUBLIC_BASE) throw new Error("--publicBase (or PUBLIC_BASE) is required to read the kept objects back");
    const adjudication = await adjudicateCandidateCarries({
      variants: variantRows,
      segments: segmentRows,
      fetchBytes: async (key: string) => (await fetchImageBytes(`${PUBLIC_BASE}/${key}`)).bytes,
    });
    console.log("\nCARRIED FACTS — judged against the bytes, not the reader");
    if (adjudication.verdicts.length === 0 && adjudication.unadjudicable.length === 0) {
      console.log("  (nothing was carried on this walk)");
    }
    for (const verdict of adjudication.verdicts) {
      console.log(`  v#${verdict.variantId} ${formatCarriedVerdict(verdict)}`);
    }
    for (const entry of adjudication.unadjudicable) {
      console.log(`  v#${entry.variantId} ${entry.facet}: UNADJUDICABLE — ${entry.why}`);
    }
    carriedUnresolved = adjudication.verdicts.filter((verdict) => !verdict.kept).length
      + adjudication.unadjudicable.length;
    checks.check(
      carriedUnresolved === 0,
      "[carried] every kept fact is byte-identical or recorded",
      `${adjudication.verdicts.length} judged, ${carriedUnresolved} unresolved`,
    );
  } finally {
    await connection.end();
  }
} catch (error) {
  /* An adjudicator that could not run has judged nothing, and a walk that
     carried something cannot be clean on its silence. */
  carriedUnresolved += 1;
  checks.neverArmed(
    "[carried] every kept fact is byte-identical or recorded",
    error instanceof Error ? error.message : String(error),
  );
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
  && report.blockers.length === 0
  /* A carried fact the arithmetic could not account for is the one failure the
     rate table structurally cannot show — carried rows are not in it. */
  && carriedUnresolved === 0;

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
/*
  UNEXERCISED CLASSES ARE SAID OUT LOUD EVEN ON A CLEAN RUN.

  A class every attempt refused proves nothing about delivery, and a "WALK
  CLEAN" line with an unexercised class sitting silently underneath it is the
  comfortable half of the truth. It does not fail the run — refusing honestly is
  correct behaviour and must not cost a run (Fable, 2026-08-08) — but it is
  printed beside the verdict rather than left for someone to notice in the
  table.
*/
/*
  EVERY ADVISORY ROW OWES A MANUAL DOUBLE-READ (Fable, fable-030, through the
  end of Tier A — not sampling, every row).

  The bucket exists because the reader quibbles adjectives nobody used. It
  becomes a laundromat the moment one of those quibbles is actually the thing
  she asked for going missing, so the look has teeth: if the frame does not show
  what her words asked for, that row is a FALSE PASS and the classification is
  itself a defect. Printed here so a clean-looking run cannot carry an unread
  advisory row past anyone.
*/
if (report && report.overall.delivered_advisory > 0) {
  console.log(
    `DOUBLE-READ OWED: ${report.overall.delivered_advisory} advisory row(s) — `
    + "open each delivered frame and confirm what HER WORDS asked for is in it. "
    + "If it is not, that row is a false pass, not an advisory one.",
  );
}
if (report && report.unexercised.length > 0) {
  console.log(
    `NOT PROVEN THIS RUN: ${report.unexercised.join(", ")} — every attempt refused, `
    + "so this run says nothing about whether that class delivers.",
  );
}
process.exit(clean ? 0 : 1);
