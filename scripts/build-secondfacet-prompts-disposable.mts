/**
 * THE SWEEP ARM, COMPOSED BY THE PRODUCT RATHER THAN BY ME.
 *
 * The marks wall has a site: caption absent 11/16, caption present 0/16. The
 * open question is the CLASS — does a realization caption suppress delivery on
 * every facet, or only on a low-amplitude surface one like `marks` where "it
 * already looks like this" is believable of a face that genuinely still looks
 * like that?
 *
 * So this builds the same two-arm test on a SECOND facet, `hair.colour`, and
 * it builds both prompts through `composeRenderPrompt` with `EDIT_PROSE` — the
 * real composer and the real prose. A hand-written approximation would be
 * measuring my transcription of the product.
 *
 * The two arms differ by exactly one thing: whether a caption for the asked
 * facet exists. Everything else — the delta, the prose, the preservation tail —
 * comes out of the same call.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { composeRenderPrompt } from "../server/castingV2/refineDelta";
import { EDIT_PROSE } from "../server/castingV2/refineService";

const delta = { hairColour: "copper" as const };

/*
  A caption in the shape the product actually writes: what the facet looked
  like when it rendered, in the reader's own voice. Taken to the same length
  and specificity as run-15's marks caption so the arms differ in FACET, not in
  how much text the painter is handed.
*/
const CAPTION = "Warm coppery red through the whole length, brightest at the "
  + "mid-lengths and a little deeper at the roots";

const withCaption = composeRenderPrompt(delta, EDIT_PROSE, { "hair.colour": CAPTION });
const without = composeRenderPrompt(delta, EDIT_PROSE, {});

writeFileSync("output/marks-court/hair-caption-prompt.txt", withCaption.full);
writeFileSync("output/marks-court/hair-nocaption-prompt.txt", without.full);

console.log(`captioned facets (with):    ${withCaption.captionedFacets.join(", ") || "(none — adopted into the ask)"}`);
console.log(`captioned facets (without): ${without.captionedFacets.join(", ") || "(none)"}\n`);
console.log(`WITH CAPTION (${withCaption.full.length} chars)\n${withCaption.full}\n`);
console.log(`WITHOUT (${without.full.length} chars)\n${without.full}\n`);

/* The difference has to be the caption and nothing else, or the arm is not an
   arm. Printed so the next reader sees it rather than trusts it. */
const strippedOfCaption = withCaption.full.replace(`, rendered exactly as this: ${CAPTION}`, "")
  .replace(` — rendered exactly as this: ${CAPTION}`, "");
console.log(strippedOfCaption === without.full
  ? "→ the two prompts differ by the caption interpolation and NOTHING else"
  : `→ *** THEY DIFFER BY MORE THAN THE CAPTION — this is not a controlled arm ***\n${strippedOfCaption}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
