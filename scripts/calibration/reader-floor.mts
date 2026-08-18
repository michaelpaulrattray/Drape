/**
 * THE READER'S FLOOR — does it see a faint but genuine edit?
 *
 * # Why this has to be asked before the class sweep's numbers are believed
 *
 * The qualifier fix was justified by proving the reader calls faint-but-real
 * freckles ABSENT: the bare clause put them there and the verdict said *"skin
 * appears smooth, no visible freckles"*, twice, on the founder's own walk.
 *
 * That same threshold now cuts the other way. Classes that legitimately render
 * subtle — light makeup, a faint tan, a soft brow — can be **delivered, read as
 * absent, and refused**: the customer got exactly what they asked for, is
 * refunded, and the row lands in the delivery rate as a failure. That is the
 * mirror image of the defect just fixed, and it manufactures FAKE failures in
 * the very table the class sweep exists to produce.
 *
 * # It costs nothing, because the specimens already exist
 *
 * `marks-prose.mts` produced two composites of the same face from the same
 * compositor: a FAINT-but-real freckling (the bare clause, 17.6% of her face
 * skin moved at freckle amplitude) and a DENSE one (26.1%). Both are genuine
 * deliveries of the same ask. The master is the negative control — freckles
 * were never asked of it and it has none.
 *
 * So the question is asked of the product's own reader, the one that decides
 * whether someone is charged, with the same call the render path makes:
 *
 *   master     → "no freckles"    is the reader's TRUE NEGATIVE
 *   faint      → "freckles"       is the floor being low enough
 *   faint      → "no freckles"    is a FALSE REFUSAL waiting to happen
 *   dense      → "freckles"       is the sanity check; if this misses, the
 *                                 reader is broken rather than blunt
 *
 * A control that cannot go red is not a control (law 2), and the master is what
 * makes this one able to: a reader that says "freckles" to everything would be
 * caught by it rather than flattered.
 *
 *   npx tsx scripts/calibration/reader-floor.mts
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";

import { aboutFacet, verifyRender } from "../../server/castingV2/renderVerification";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

const OUT = "output/masked/marks-prose";
const SPECIMENS = [
  { label: "master (never asked)", file: "output/masked/freckles/master.png", expect: false },
  { label: "faint  (bare clause)", file: `${OUT}/shipped-composed.png`, expect: true },
  { label: "dense  (qualified)  ", file: `${OUT}/qualified-composed.png`, expect: true },
] as const;

for (const specimen of SPECIMENS) {
  if (!existsSync(specimen.file)) {
    throw new Error(`${specimen.file} is missing — run marks-prose.mts first`);
  }
}

/*
  TWO ASKS, AND THE SECOND ONE IS THE FOUNDER'S RULING (2026-08-07).

  `ASKED` is the walk's own filed fact, verbatim from a stored verdict, with no
  strength word in it. `ASKED_LIGHT` is the same fact with the user's own
  adjective — and the ruling is that her words are the spec: for *light*
  freckles, faint is the PASS and dense is the MISS.

  Running both against the same three specimens is what separates "the reader
  cannot see faint things" from "the reader ignores the adjective". Those need
  different fixes, and one ask cannot tell them apart.
*/
const ASKED = "a beauty mark, freckles";
const ASKED_LIGHT = "a beauty mark, light freckles";

console.log("THE READER'S FLOOR — asked exactly what the product asks\n");
console.log(`  neutral ask: marks = "${ASKED}"`);
console.log(`  light ask:   marks = "${ASKED_LIGHT}"\n`);

const results: Array<{ label: string; ask: string; verified: boolean; read: boolean; saw: string }> = [];
for (const specimen of SPECIMENS) {
  const bytes = readFileSync(specimen.file);
  /* Three readings per ask, because one reading of a borderline case measures
     the reader's variance rather than its floor — and variance is the thing
     that turns a subtle class into a coin toss in the delivery rate. */
  for (const ask of [ASKED, ASKED_LIGHT]) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const verdict = await verifyRender({
        bytes,
        contentType: "image/png",
        facts: [{ subject: aboutFacet(facetOfSubject("marks")), asked: ask, binding: false }],
      });
      const check = verdict.checks[0];
      if (!check) {
        console.log(`  ${specimen.label}  ${ask === ASKED ? "neutral" : "light  "}  #${attempt}  NO READING`);
        continue;
      }
      results.push({
        label: specimen.label, ask,
        verified: check.verified, read: check.read, saw: check.saw ?? "",
      });
      console.log(
        `  ${specimen.label}  ${ask === ASKED ? "neutral" : "light  "}  #${attempt}  `
        + `${check.read ? (check.verified ? "SEES IT " : "absent  ") : "no-read "}`
        + ` "${(check.saw ?? "").slice(0, 68)}"`,
      );
    }
  }
}

console.log("");
const sawIt = (label: string, ask: string) =>
  results.filter((row) => row.label === label && row.ask === ask && row.read && row.verified).length;

for (const ask of [ASKED, ASKED_LIGHT]) {
  const tag = ask === ASKED ? "neutral ask" : "LIGHT ask  ";
  console.log(
    `${tag}: master ${sawIt(SPECIMENS[0].label, ask)}/3 · `
    + `faint ${sawIt(SPECIMENS[1].label, ask)}/3 · dense ${sawIt(SPECIMENS[2].label, ask)}/3`,
  );
}

const masterSaw = sawIt(SPECIMENS[0].label, ASKED);
const faintNeutral = sawIt(SPECIMENS[1].label, ASKED);
const faintLight = sawIt(SPECIMENS[1].label, ASKED_LIGHT);
const denseSaw = sawIt(SPECIMENS[2].label, ASKED);

console.log("");
const ARROW = "-> ";
if (masterSaw > 0) {
  console.log(ARROW + "THE CONTROL FAILED ITS OWN NEGATIVE. The reader affirms freckles on a face "
    + "that has none, so nothing else here means anything.");
} else if (denseSaw < 2) {
  console.log(ARROW + "THE READER MISSES A DENSE DELIVERY. Not a threshold problem - a broken check.");
} else if (faintNeutral >= 2 && faintLight >= 2) {
  console.log(ARROW + "THE FLOOR IS BELOW A GENUINE FAINT DELIVERY, on both asks, while the "
    + "master still reads absent. Subtle classes can be measured: a light render is credited "
    + "as delivered rather than refunded for being quiet.");
} else if (faintLight >= 2 && faintNeutral === 0) {
  console.log(ARROW + "THE ADJECTIVE IS WHAT WAS MISSING. A genuinely light render reads as ABSENT "
    + "when the ask says nothing about strength, and as PRESENT when the ask says 'light'. The "
    + "reader can see it; it was being asked the wrong question. Her words are the spec, and "
    + "carrying them is the fix.");
} else {
  console.log(ARROW + `MIXED: light ask ${faintLight}/3, neutral ask ${faintNeutral}/3 on the same `
    + "faint render. The floor sits near this amplitude either way, which is noise the bar "
    + "cannot tell from a real defect.");
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
