/**
 * THE CENSUS OF DEPARTURES — every branch fact the anchor can contradict, and
 * what the repaint can say about each one TODAY (fable-327 ruling 3).
 *
 * The one-frame removal is being fixed by giving the library a way to hold an
 * absence. Before deciding how wide that fix goes, the surface has to be counted
 * rather than assumed: the fidelity law's silent ceiling is exactly a fix quietly
 * scoped to the three kinds that happen to have a sentence today.
 *
 * DERIVED, not listed (working law 4, and `derive-the-scope-not-the-list`): the
 * subjects come from `DEPARTABLE_SUBJECTS`, the kinds from
 * `LANDMARK_OF_ACCESSORY`, and every verdict below is what `repaintAsksFor`
 * actually returns when handed that departure — not what this file believes it
 * would return. A new kind or subject appears here the day it is added.
 *
 * No database, no vision call, no paint, no credits.
 *
 *   npx tsx scripts/census-departures-disposable.mts
 */
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { DEPARTABLE_SUBJECTS } from "../server/castingV2/refineSubjects";
import { LANDMARK_OF_ACCESSORY, accessoryKindOf } from "../server/castingV2/accessoryKinds";
import { vacantPhraseFor } from "../server/castingV2/vacancyPhrases";
import { BORN_WORN_CLASSES } from "../server/castingV2/bornWornDetector";

/**
 * What a person might ask to have taken off, per subject.
 *
 * The accessory nouns are the catalogue's own first word for each kind plus two
 * things the catalogue cannot name — a census that only asked about things we
 * support would report full coverage of itself.
 */
const NOUNS: Record<string, string[]> = {
  statedAccessories: [
    ...LANDMARK_OF_ACCESSORY.map((entry) => entry.words[0]),
    "necklace", "watch",
  ],
  ink: ["tattoo", "sleeve tattoo"],
  marks: ["freckles", "a scar on her cheek"],
  facialHair: ["beard", "moustache"],
};

console.log("=".repeat(100));
console.log("DEPARTURE CENSUS — what the repaint can say when something LEAVES");
console.log("=".repeat(100));

let sayable = 0;
let refused = 0;

for (const subject of DEPARTABLE_SUBJECTS) {
  console.log(`\n${subject}`);
  for (const noun of NOUNS[subject] ?? ["it"]) {
    const asks = repaintAsksFor({
      delta: { absent: { [subject]: [noun] }, free: { [subject]: [] } } as any,
      prose: EDIT_PROSE,
    });
    if (asks.ok) {
      sayable += 1;
      const said = asks.asks.map((ask) => `${ask.slot}: ${(ask as any).vacate?.says ?? "(no sentence!)"}`);
      console.log(`  ${noun.padEnd(18)} SAYABLE  ${asks.asks.length} slot(s)`);
      for (const line of said) console.log(`  ${" ".repeat(18)}   ${line}`);
    } else {
      refused += 1;
      console.log(`  ${noun.padEnd(18)} REFUSES  ${asks.reason} — ${asks.detail}`);
    }
  }
}

console.log(`\n${"-".repeat(100)}`);
console.log(`${sayable} departures the recipe can state · ${refused} it refuses`);

console.log(`\nKINDS WITH A VACANT PHRASE (the only things an EMPTY row could say today):`);
for (const entry of LANDMARK_OF_ACCESSORY) {
  console.log(`  ${entry.region.padEnd(12)} "${vacantPhraseFor(entry.region)}"`);
}

/*
  AND WHAT THE MASTER IS EVEN LOOKED AT FOR.

  A fact the anchor contradicts is only a problem where something knows the
  anchor has it. The born-worn detector's classes are derived from the same
  accessory table, and only the ARMED ones have a measured floor — an unarmed
  class is a question nobody is asking of the master yet.
*/
console.log(`\nBORN-WORN CLASSES THE MASTER IS SCANNED FOR:`);
for (const entry of BORN_WORN_CLASSES) {
  console.log(`  ${entry.id.padEnd(12)} ${entry.armed ? `ARMED, floor ${entry.floor}` : "not armed"} — ${entry.measurement}`);
}

console.log(`\nNOTE: a subject that REFUSES above is not a silent failure — the render`);
console.log(`refuses and the money goes back. The one-frame defect is only reachable`);
console.log(`through the SAYABLE rows, which is the whole of what the fix must cover.`);
console.log("=".repeat(100));
process.exit(0);
