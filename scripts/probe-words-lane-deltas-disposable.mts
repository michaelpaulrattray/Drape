/**
 * WHAT DOES THE INTERPRETER ACTUALLY FILE when somebody points at a picture
 * instead of typing a value — the reading the WORDS LANE's discriminator has to
 * be built on (ruled fable-1103 §1).
 *
 * # Why this runs before the branch is written
 *
 * The lane's rule is *a words take is answered with a sentence to adopt, free,
 * before the claim* — and the one thing it must NOT do is intercept an ask that
 * would have rendered. So the branch needs a discriminator, and the candidate
 * discriminator is "did her own sentence already carry the value": `delta.free
 * .hairShade` for a colour, `delta.makeup` for a look.
 *
 * That is a CLAIM about what the interpreter files, and I have not read it. If
 * *"take the hair colour from this picture"* files `hairShade: "from this
 * picture"`, the discriminator is inverted and the lane would never fire on the
 * exact sentence it exists for.
 *
 * # Money
 *
 * Four interpreter calls on the OpenRouter balance, house money, dev only.
 * Nothing written, nothing kept, no credits move.
 *
 *   npx tsx scripts/probe-words-lane-deltas-disposable.mts
 */
import "dotenv/config";

import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const SENTENCES = [
  "copy this hair",
  "give her the hairstyle from this picture",
  "give her hair like this",
  "give her this hair",
];

const before = await readOpenRouterBalance().catch(() => null);

for (const instruction of SENTENCES) {
  const parse = await interpretRefinement({
    instruction,
    openLane: false,
    prior: {},
    lastColourFacet: null,
    currentEyeColour: null,
    currentEyeShape: null,
    currentHairStyle: null,
    currentHairColour: null,
    currentHairTexture: null,
    currentMakeup: null,
  });
  console.log("\n──", JSON.stringify(instruction));
  console.log(JSON.stringify(parse, null, 2));
}

const after = await readOpenRouterBalance().catch(() => null);
console.log("\nbalance", before, "→", after);

process.exit(0);
