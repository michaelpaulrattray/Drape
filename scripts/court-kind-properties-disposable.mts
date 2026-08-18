/**
 * THE COURT — can a reader answer *what shape is this kind* and *where* about a
 * bare noun?
 *
 * # RE-ARMED FOR THE LOCALITY CLASS ON 2026-08-18, AND NOT YET RE-RUN
 *
 * The founder's fangs ruling (fable-951) replaced P1's question: not HOW MANY
 * but whether ONE CROP CAN HOLD THE SET. The nine bars below are re-registered
 * in the new vocabulary — **pre-registered and unspent**, which is the right
 * order and is said out loud so nobody reads a bar as a result. What HAS been
 * run is fable-951 §3's three-arm control
 * (`kind-locality-controls-disposable.mts`): fangs -> coLocated, wings ->
 * distributed, halo -> single, 3/3 on prompt `kp-2`.
 *
 * The row this ruling overturns is `fangs`. It was a P1 POSITIVE — several, so
 * no crop — and under the locality class it is `coLocated`, which mints.
 *
 * One question, no callers, no importers. House money only: eight text calls at
 * roughly $0.0148 each, so **≈$0.12 and not one credit**. Declared and authorized
 * before the first call (opus-658 §2, fable-896 §1, carried by fable-897 §4).
 *
 * # THE BARS ARE HERE, ABOVE THE SPEND, AND THEY DECIDE WHETHER 5b CONTINUES
 *
 * The whole of Stage C rests on this reader being able to tell a pair from a
 * single. So the stop-condition was written into the plan before any of it was
 * built, and it is mechanical here:
 *
 *   SINGLE        tail · halo · beak · crest     must ALL come back `single`
 *   DISTRIBUTED   wings · horn                   must ALL come back `distributed`
 *   CO-LOCATED    fangs · scales                 must ALL come back `coLocated`
 *   P2 PLACES     nails → hands, tail → belowWaist
 *
 * Three groups that DISAGREE with each other, which is what a constant cannot
 * pass: a reader answering `distributed` to everything fails the co-located
 * group, and one answering `coLocated` to everything opens the crop road to
 * wings and fails the distributed group.
 *
 * # ONE BAR WAS CORRECTED AFTER THE FIRST RUN, and here is the audit trail
 *
 * `horn` was written as a P1 NEGATIVE and the reader answered PAIRED. The bar was
 * wrong, and what settles it is an artifact that predates this court rather than
 * anything in its own data: **the product's own catalogue holds `horns@left` and
 * `horns@right`** — `referenceSlotCatalogue.ts`, `instances: { of: "perSide",
 * pairNoun: "horns" }`, with `noun: "horn"` singular beside it — declared by
 * founder ruling on 2026-08-15 and minted from real renders on his own cast. The
 * product's lived answer to *how many horns does someone who has them have* is
 * two. The reader agreed with the product and the bar did not.
 *
 * Corrected on that ground and on that ground only (ruled fable-898 §2a).
 * Re-arguing a bar from the court's OWN data would be optional stopping; moving
 * one against independent prior evidence, with the evidence named, is not. `crest`
 * replaces it as the fourth negative: unambiguously one thing, absent from the
 * prompt, and the catalogue holds no crest.
 *
 * **A failed negative stops 5b at Stage A.** A reader that pairs everything is the
 * earring reader's vacuous shape (fable-378 §3): perfectly stable, perfectly
 * useless, and a gate built on it would refuse every crop while looking
 * configured. **A failed positive stops it too, and is worse** — a pair read as a
 * single mints half a picture under the whole picture's name, which is the exact
 * thing fable-872 §2 forbids.
 *
 * Both directions are required because either alone is passable by a constant.
 *
 * # WHY THE PROMPT DOES NOT CONTAIN THESE WORDS
 *
 * Every specimen here is absent from `KIND_PROPERTY_SYSTEM`, asserted mechanically
 * in `openKindProperties.test.ts`. A control whose answer is written into the
 * instruction is not a control — and this campaign has committed that defect in
 * both directions already (`specimen-joins-the-vocabulary`).
 *
 * `--dry` runs the whole court against a canned transport, which proves the
 * SCORING can fail before any money is spent on the reader.
 */
import "dotenv/config";

import { createOpenRouterTextEngine } from "../server/providers/openrouterText";
import { readKindProperties } from "../server/castingV2/openKindProperties";
import type { BodyAnchorRegion } from "../shared/bodyAnchorRegions";
import type { KindLocality } from "../shared/kindLocality";
import type { TextEngine } from "../server/providers/types";

const DRY = process.argv.includes("--dry");

type Arm = {
  noun: string;
  role: string;
  /** The bar. `null` means informational — recorded, never scored. */
  locality: KindLocality | null;
  anchorRegion: BodyAnchorRegion | null;
};

/** THE BARS, above the spend. */
const ARMS: readonly Arm[] = [
  { noun: "tail", role: "single · P2 positive", locality: "single", anchorRegion: "belowWaist" },
  { noun: "halo", role: "single", locality: "single", anchorRegion: null },
  { noun: "beak", role: "single", locality: "single", anchorRegion: null },
  { noun: "crest", role: "single (replaced `horn` here, fable-898 §2a)", locality: "single", anchorRegion: null },
  { noun: "wings", role: "distributed — the case the gate was built for", locality: "distributed", anchorRegion: null },
  { noun: "horn", role: "distributed — the catalogue's own horns@left/right", locality: "distributed", anchorRegion: null },
  { noun: "fangs", role: "co-located — THE ROW fable-951 OVERTURNS", locality: "coLocated", anchorRegion: null },
  { noun: "scales", role: "co-located — many, spread but never opposite", locality: "coLocated", anchorRegion: null },
  { noun: "nails", role: "P2 negative — the design's own control", locality: null, anchorRegion: "hands" },
];

/**
 * The canned transport for `--dry`.
 *
 * It answers each specimen the way the bars expect EXCEPT `beak`, which it pairs
 * on purpose. So a dry run must print one failure — that is the positive control
 * on the scoring itself, and a dry run that came out clean would mean the
 * comparison below cannot fail.
 */
const DRY_ANSWERS: Record<string, string> = {
  tail: '{"locality":"single","anchor":"belowWaist"}',
  halo: '{"locality":"single","anchor":"head"}',
  beak: '{"locality":"distributed","anchor":"head"}',
  crest: '{"locality":"single","anchor":"head"}',
  horn: '{"locality":"distributed","anchor":"head"}',
  wings: '{"locality":"distributed","anchor":"torso"}',
  fangs: '{"locality":"coLocated","anchor":"head"}',
  nails: '{"locality":"coLocated","anchor":"hands"}',
  scales: '{"locality":"coLocated","anchor":"wholeBody"}',
};

const dryEngine: TextEngine = {
  id: "dry",
  complete: async (request) => ({
    text: DRY_ANSWERS[request.user.trim()] ?? "{}",
    provenance: { provider: "openrouter" as const, model: "dry-run" },
    latencyMs: 0,
  }),
};

const apiKey = process.env.OPENROUTER_API_KEY;
if (!DRY && !apiKey) {
  console.error("REFUSING: OPENROUTER_API_KEY is not set, and a court with no reader has measured nothing.");
  process.exit(1);
}
const engine = DRY ? dryEngine : createOpenRouterTextEngine({ apiKey: apiKey! });

/*
  THE STABILITY PASS — pre-registered in fable-898 §2b BEFORE it was bought, and
  it is a check on the READER rather than on either answer.

  `horn` three times and `crest` once. The dispositions were fixed in advance and
  they do not depend on which way the majority falls:

    3/3 the same     a considered answer about the word, and the property is
                     stable enough for a gate to key on
    MIXED            a STOP on P1 regardless of which answer is right — a gate on
                     a property that wobbles per call is the unowned-axis
                     collapse with a coin flip inside it

  Run with `--stability` so the nine-call court is not re-bought to ask one
  question. Four calls, ≈$0.06.
*/
const STABILITY: readonly Arm[] = [
  ...Array.from({ length: 3 }, () => ARMS.find((arm) => arm.noun === "horn")!),
  ARMS.find((arm) => arm.noun === "crest")!,
];
const running = process.argv.includes("--stability") ? STABILITY : ARMS;

const label = process.argv.includes("--stability") ? "STABILITY pass" : "full court";
console.log(`court: kind properties · ${label} · ${running.length} calls · ${DRY ? "DRY (no spend)" : "LIVE, house money"}`);
console.log("");

const rows: Array<{ arm: Arm; got: Awaited<ReturnType<typeof readKindProperties>>; verdict: string }> = [];
for (const arm of running) {
  const got = await readKindProperties(arm.noun, { engine });
  const problems: string[] = [];
  if (got === null) {
    problems.push("NO READING");
  } else {
    if (arm.locality !== null && got.locality !== arm.locality) {
      problems.push(`locality ${got.locality}, bar ${arm.locality}`);
    }
    if (arm.anchorRegion !== null && got.anchorRegion !== arm.anchorRegion) {
      problems.push(`anchor ${got.anchorRegion}, bar ${arm.anchorRegion}`);
    }
  }
  const verdict = problems.length === 0 ? "HELD" : `**FAILED** — ${problems.join("; ")}`;
  rows.push({ arm, got, verdict });
  console.log(
    `${arm.noun.padEnd(8)} ${(got === null ? "—" : `${got.locality.padEnd(12)} ${got.anchorRegion}`).padEnd(26)}`
    + ` ${verdict.padEnd(40)} ${arm.role}`,
  );
}

console.log("");
const failed = rows.filter((row) => row.verdict !== "HELD");
for (const group of ["single", "coLocated", "distributed"] as const) {
  const arms = rows.filter((row) => row.arm.locality === group);
  if (arms.length === 0) continue;
  console.log(`${group.padEnd(12)}  ${arms.filter((r) => r.verdict === "HELD").length}/${arms.length} held`);
}
console.log(`models        ${Array.from(new Set(rows.map((r) => r.got?.model ?? "none"))).join(", ")}`);
console.log("");

/* The stability pass's own reading, printed whatever the bars said: the question
   is whether the answers AGREE with each other, not whether they match a bar. */
if (process.argv.includes("--stability")) {
  const horns = rows.filter((row) => row.arm.noun === "horn").map((row) => row.got?.locality ?? null);
  const agree = new Set(horns.map(String)).size === 1;
  console.log(`horn ×${horns.length}: ${horns.map((p) => p ?? "—").join(", ")}`);
  console.log(agree
    ? "STABLE — one answer three times. A gate may key on this property."
    : "**MIXED — a STOP on P1**, whichever answer is right: the property wobbles per call.");
}

if (failed.length === 0) {
  console.log("COURT HELD — the property is measurable in BOTH directions. Stage C may gate on it.");
  process.exit(0);
}
console.log(`COURT FAILED on ${failed.length} of ${rows.length}: ${failed.map((r) => r.arm.noun).join(", ")}`);
console.log("Per the declared stop-condition, a failed NEGATIVE stops 5b at Stage A; a failed POSITIVE stops it too.");
process.exit(1);
