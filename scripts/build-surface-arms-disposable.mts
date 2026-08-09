/**
 * TURNING §5.2's REASONING INTO A READING.
 *
 * `isSurfaceFacet` covers four subjects and only `marks` is measured. The
 * other three are there because they are the same few-levels-over-a-wide-area
 * change, which is honest reasoning and is still not a reading.
 *
 * `skinTone` is the one worth measuring first: it is the founder's own example
 * of the class ("a tan covers all visible skin") and it is the nearest
 * neighbour to marks. Both prompts come out of `composeRenderPrompt` with
 * `EDIT_PROSE`, so the arms are the product's own sentences.
 *
 * NOTE the fixture must be run with the pre-fix composer for the WITH arm to
 * exist at all — which is why the prompts are written to disk here rather than
 * composed at paint time: the fix is already in the tree, and a with-caption
 * arm composed after it would be the without arm twice.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { composeRenderPrompt } from "../server/castingV2/refineDelta";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { facetOfSubject } from "../server/castingV2/refineFacets";

const SUBJECT = "skinTone" as const;
const ASK = "a light golden tan";
const CAPTION = "An even light golden tan across the face and neck, warmest "
  + "across the forehead and cheekbones";

const delta = { free: { [SUBJECT]: ASK } };
const facet = facetOfSubject(SUBJECT);

const without = composeRenderPrompt(delta, EDIT_PROSE, {});

/*
  THE WITH ARM, BUILT BY HAND FROM THE WITHOUT ARM — and it has to be, because
  the composer no longer emits it. The interpolation copied verbatim from
  `refineDelta.ts`'s `withCaption`, which is the shape that was on the paid
  path this morning.
*/
const withCaption = without.full.replace(
  `${ASK}`,
  `${ASK} — rendered exactly as this: ${CAPTION}`,
);
if (withCaption === without.full) throw new Error("the ask was not found in the composed prompt");

writeFileSync("output/marks-court/skin-caption-prompt.txt", withCaption);
writeFileSync("output/marks-court/skin-nocaption-prompt.txt", without.full);

console.log(`facet: ${facet}\n`);
console.log(`WITH CAPTION (${withCaption.length})\n${withCaption}\n`);
console.log(`WITHOUT (${without.full.length})\n${without.full}\n`);
console.log(withCaption.replace(` — rendered exactly as this: ${CAPTION}`, "") === without.full
  ? "→ the two prompts differ by the caption interpolation and NOTHING else"
  : "→ *** NOT A CONTROLLED ARM ***");
