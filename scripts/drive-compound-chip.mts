/**
 * DOES OUR OWN BUTTON WRITE A SENTENCE THE PARSER CAN READ?
 *
 * The glasses-hide-eyes reask offers *"Take them off first"*, and that chip
 * submits a COMPOUND instruction on the customer's behalf:
 *
 *     remove her glasses, then fox eyes
 *
 * Two facts in one sentence — a departure and an eye edit — and the walk has
 * never exercised that shape. If the parser carries only one half, the chip
 * hand-delivers the absorbed-ask defect: she presses a button that promises two
 * things and pays for one. So the chip's own sentence is driven through the
 * LIVE interpreter before the gate that offers it ships.
 *
 * Each half is driven alone as a control, because "the compound failed" and
 * "the parser cannot read 'fox eyes' at all" are different findings with
 * different repairs, and a run without controls cannot tell them apart.
 *
 * Text calls only — no images, no credits.
 *
 *   npx tsx scripts/drive-compound-chip.mts
 *   RUNS=5 npx tsx scripts/drive-compound-chip.mts
 */
import "dotenv/config";

/* §5e: the reask questions and the vacancy phrases are a function of the
   Cast's own pronouns now — a bench supplies one Cast. */
const HER_PRONOUNS = { subject: "she", object: "her", possessive: "her", plural: false } as const;

import { glassesHideEyesReask } from "../server/castingV2/refineReask";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";

const RUNS = Number(process.env.RUNS ?? 5);

/* The sentence is TAKEN FROM THE CHIP, never retyped here. A driver that
   quotes its subject can pass while the shipped string drifts away from it. */
const reask = glassesHideEyesReask("fox eyes", HER_PRONOUNS);
const COMPOUND = reask.options[0]!.resolves;
const EYES_ONLY = reask.options[1]!.resolves;
const REMOVAL_ONLY = "remove her glasses";

console.log(`the chip submits: "${COMPOUND}"\n`);

type Half = "removal" | "eyes";

/**
 * ONE READING, REDUCED TO THE TWO FACTS THE CHIP PROMISES.
 *
 * `RefineParse` is a UNION, and that is the finding this driver was written to
 * look for: an edit carries a `delta`, a removal carries `intent: "remove"`
 * with the subject and the user's own words, and **no variant carries both**.
 * So the halves are read off whichever variant came back, and a sentence that
 * files as a removal has dropped its eye ask before any service sees it.
 */
async function read(instruction: string): Promise<{ halves: Set<Half>; note: string }> {
  const parsed = await interpretRefinement({
    instruction,
    /* Her face as run-15 found her: flat-eyed, and nothing in the recipe about
       glasses — the base-worn road, which is the only road this chip is on. */
    currentEyeColour: "brown",
    currentEyeShape: null,
    prior: {},
  });
  if (!parsed.ok) return { halves: new Set(), note: `refused: ${parsed.refusal.reason}` };

  const halves = new Set<Half>();
  if (parsed.intent === "remove") {
    const named = [parsed.match, ...(parsed.items ?? [])].filter(Boolean).join("/");
    if (/glass|spec/i.test(named) || /glass|spec/i.test(parsed.subject ?? "")) halves.add("removal");
    return { halves, note: `intent=remove subject=${parsed.subject ?? "—"} match=${named || "—"}` };
  }
  if (parsed.intent === "navigate") return { halves, note: "intent=navigate" };
  if (parsed.delta.eyeShape) halves.add("eyes");
  return { halves, note: `intent=edit eyeShape=${parsed.delta.eyeShape ?? "—"}` };
}

type Row = { label: string; instruction: string; expect: Half[] };
const ROWS: Row[] = [
  { label: "COMPOUND — the chip's own sentence", instruction: COMPOUND, expect: ["removal", "eyes"] },
  { label: "control: the removal alone", instruction: REMOVAL_ONLY, expect: ["removal"] },
  { label: "control: the eye ask alone", instruction: EYES_ONLY, expect: ["eyes"] },
];

let failed = 0;
for (const row of ROWS) {
  let carried = 0;
  const notes: string[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const result = await read(row.instruction);
    const whole = row.expect.every((half) => result.halves.has(half));
    if (whole) carried += 1;
    notes.push(`${whole ? "✓" : "✗"} ${result.note}`);
  }
  if (carried < RUNS) failed += 1;
  console.log(`${row.label.padEnd(38)} ${carried}/${RUNS} carried every half`);
  for (const note of Array.from(new Set(notes))) console.log(`    ${note}`);
}

console.log("");
if (failed === 0) {
  console.log("EVERY READING CARRIED BOTH HALVES — the chip may submit the compound sentence.");
} else {
  console.log(`${failed} row(s) dropped a half. The chip must submit the removal alone and `
    + "queue the eye ask as a second sentence; the label stays honest either way.");
}
process.exit(failed === 0 ? 0 : 1);
