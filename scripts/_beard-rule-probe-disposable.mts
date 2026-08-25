/**
 * DISPOSABLE — **WHEN DOES THE BEARD RULE ACTUALLY FIRE?**
 *
 * The grading harness's replica arm matched the real `applySheetTaste` on 0 of
 * 2000 sheets, with the RE-PICK modelled correctly (positions 4-6 landed on
 * exactly the right values) and the firing CONDITION wrong. Three suspects were
 * eliminated by reading — `sameNeighbourhood("", "")`, `authorsCut`, and
 * `beardBucket` itself.
 *
 * ⚠ **So this stops reasoning about it and drives it**, which is this campaign's
 * own rule and is what should have been reached for one step sooner. It hands
 * the REAL function hand-built sheets where every input is controlled and reports
 * what came back, one variable at a time.
 *
 * Free: pure functions, no network, no database, no spend.
 */
import "dotenv/config";

import { applySheetTaste } from "../server/castingV2/realizedAxes";

/*
  A MINIMAL SHEET CANDIDATE. Only the fields `applySheetTaste` reads are set, so
  anything that changes the answer is visible in this literal rather than hidden
  in a resolver.
*/
function candidate(facialHair: string, heritage: string, styleName: string) {
  return {
    heritage: heritage === "" ? [] : [{ heritage, share: 1 }],
    ageBand: "40s",
    sex: "male",
    hair: null,
    realized: {
      eyeColour: "brown", eyeShape: null, makeup: null, statedDetails: null,
      hairStyle: { name: styleName, family: styleName, statement: false, texture: null },
      hairModifiers: null, wornState: null,
      facialHair, beardGrey: null, browStyle: null, skinCharacter: "plain",
    },
  } as never;
}

const run = (label: string, values: readonly string[], opts: Record<string, unknown>, heritage = "", styles?: readonly string[]) => {
  const sheet = values.map((v, i) => candidate(v, heritage, styles?.[i] ?? `family${i}`));
  const out = applySheetTaste(sheet, "probe-seed", opts as never) as any[];
  const after = out.map((c) => String(c.realized?.facialHair ?? "null"));
  const moved = after.map((v, i) => (v === values[i] ? "." : "*")).join("");
  console.log(`  ${label.padEnd(46)} ${moved}`);
  console.log(`  ${"".padEnd(46)} ${after.join(", ")}`);
  return after;
};

console.log("THE BEARD-RULE PROBE — the REAL applySheetTaste, hand-built sheets\n");
console.log("  `*` marks a position the pass CHANGED.\n");

const ALL_BARE = ["clean-shaven", "clean-shaven", "clean-shaven", "clean-shaven"];
const ALL_BEARDED = ["short beard", "short beard", "short beard", "short beard"];
const MIXED = ["clean-shaven", "clean-shaven", "heavy stubble", "light stubble",
  "heavy stubble", "light stubble", "full beard", "short beard"];

console.log("A — four identical BARE values, nothing else varying:");
run("authoredParts EMPTY (a stated-hair brief)", ALL_BARE, { statedFacialHair: false, authoredParts: new Set() });
run("authoredParts FULL (an ordinary brief)", ALL_BARE, { statedFacialHair: false, authoredParts: undefined });
run("statedFacialHair TRUE (the brief named a beard)", ALL_BARE, { statedFacialHair: true, authoredParts: new Set() });

console.log("\nB — four identical BEARDED values:");
run("authoredParts EMPTY", ALL_BEARDED, { statedFacialHair: false, authoredParts: new Set() });

console.log("\nC — the eight-value sheet the replica arm failed on:");
run("authoredParts EMPTY", MIXED, { statedFacialHair: false, authoredParts: new Set() });

console.log("\nD — the same eight, with a NAMED heritage instead of an empty one:");
run("heritage 'european'", MIXED, { statedFacialHair: false, authoredParts: new Set() }, "european");

console.log("\nE — the same eight, every candidate sharing ONE hair family:");
run("one family for all eight", MIXED, { statedFacialHair: false, authoredParts: new Set() }, "",
  Array.from({ length: 8 }, () => "sameFamily"));

console.log("\n⚠ Read A first. If four identical bare values come back unchanged, the rule does");
console.log("  NOT fire on a bucket clash alone and the whole model has to be re-read at the");
console.log("  code rather than patched.");

process.exit(0);
