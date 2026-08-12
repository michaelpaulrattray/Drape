/**
 * DOES THE INTERPRETER KEEP EARRINGS AT ALL? — the same question the glasses
 * control already answers yes to, asked of the kind that lost them.
 *
 * Tonight's roll came from a brief that plainly states hoops and produced
 * `statedAccessories: []`, while the founder's *"a woman in her 40s wearing
 * chunky glasses"* produced `["chunky glasses"]`. Two briefs differ in more
 * than one way, so this varies them one at a time: same kind, different
 * wording; same wording, different kind.
 *
 * No credits and no rows: the text interpreter only.
 *
 *   npx tsx scripts/read-brief-accessory-extraction-disposable.mts
 */
import "dotenv/config";

import { interpretBrief } from "../server/castingV2/interpreter";

const BRIEFS = [
  /* The control that works, verbatim from the founder's own candidate. */
  "a woman in her 40s wearing chunky glasses",
  /* Same shape, different kind — does the KIND matter? */
  "a woman in her 40s wearing small gold hoop earrings",
  /* Tonight's brief, verbatim — does the extra clause matter? */
  "A woman in her forties who wears small gold hoop earrings, one at each ear, "
    + "warm and unfussy, for an independent bookshop's about page.",
  /* Tonight's brief with the pair clause removed. */
  "A woman in her forties who wears small gold hoop earrings, warm and unfussy, "
    + "for an independent bookshop's about page.",
  /* And the same long shape carrying GLASSES instead — the crossed cell. */
  "A woman in her forties who wears chunky glasses, warm and unfussy, "
    + "for an independent bookshop's about page.",
  /*
    fable-335's discriminating question for the wider defect: does ANY kind
    besides glasses survive? One short brief per kind, all in the same frame as
    the control, including the two the interpreter's own prompt gives as
    examples ("a nose stud", "a wedding ring", "a red lip").
  */
  "a woman in her 40s wearing a nose stud",
  "a woman in her 40s wearing a wedding ring",
  "a woman in her 40s wearing a red lip",
  "a woman in her 40s wearing a silk headscarf",
  "a woman in her 40s wearing a gold chain necklace",
];

for (const briefText of BRIEFS) {
  const outcome = await interpretBrief({ briefText });
  const stated = outcome.ok
    ? (outcome as any).intent?.statedAccessories ?? null
    : `(not interpreted: ${(outcome as any).reason})`;
  console.log(`\n"${briefText.slice(0, 96)}${briefText.length > 96 ? "…" : ""}"`);
  console.log(`  statedAccessories: ${JSON.stringify(stated)}`);
}

process.exit(0);
