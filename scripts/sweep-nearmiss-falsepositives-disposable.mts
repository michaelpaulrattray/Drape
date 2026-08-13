/**
 * EVERY WORD THE PRODUCT ITSELF WRITES, PUT THROUGH ITS OWN TYPO GATE.
 *
 * # The instance
 *
 * `"shave her head"` never reaches the interpreter. `nearMiss` reads `shave` as
 * one slip from `shape` and returns a free "Did you mean shape?" question — so
 * the founder's own phrasing for a bald edit is answered with a re-ask about
 * shaping her head, and the work stops until he says "No, shave is right".
 *
 * # The class, which is what this sweeps for
 *
 * `VALID_IN_CONTEXT` is a curated list, honest about being one, with a written
 * discipline: *"it was built by walking the one-slip neighbourhood of every
 * known word and writing down the real words found there."* `shave` was missed.
 * Adding `shave` alone would be fixing the instance (law 7).
 *
 * The neighbourhood cannot be walked by hand, so the corpus is DERIVED rather
 * than invented: every word the product itself writes about a face — its roll
 * prompts, its refine prose, its catalogue notes, its own refusal sentences.
 * **A word the product uses is a real word in this domain by construction**, so
 * any one of them that its own typo gate flags is a false positive waiting for
 * a user to type it.
 *
 * That is a different thing from a dictionary and a better one here: it is the
 * exact vocabulary this product speaks.
 *
 * FREE: reads source files, no transport, no database, no credits.
 *
 *   npx tsx scripts/sweep-nearmiss-falsepositives-disposable.mts
 */
import { readFileSync } from "node:fs";

import { nearMiss } from "../server/castingV2/refineReask";

/* The product's own voice: what it says to the engine, what it says to the
   user, and what it writes down about a face. */
const SOURCES = [
  "server/castingV2/cohortPhotorealHuman.ts",
  "server/castingV2/refineService.ts",
  "server/castingV2/refineInterpreter.ts",
  "server/castingV2/refineSubjects.ts",
  "server/castingV2/refineReask.ts",
  "server/castingV2/referenceSlotCatalogue.ts",
  "server/castingV2/castingFrame.ts",
  "server/castingV2/repaintAsks.ts",
  "server/castingV2/faceDescribe.ts",
  "server/castingV2/axisRegistry.ts",
  "server/castingV2/briefCompiler.ts",
];

/*
  ONLY WHAT THE PRODUCT SAYS, not what it is made of. Identifiers, imports and
  types are the machine's vocabulary; string literals and prose comments are the
  product's. A sweep over identifiers would flag `publicId` and teach nothing.
*/
function spokenWords(source: string): string[] {
  const said: string[] = [];
  const strings = source.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? [];
  for (const literal of strings) said.push(literal.slice(1, -1));
  /* Prose comments too: the catalogue's reasons and the prompt's notes are
     written in the same domain vocabulary and are where the rarer words live. */
  const comments = source.match(/\/\*[\s\S]*?\*\//g) ?? [];
  for (const comment of comments) said.push(comment);
  return said;
}

const seen = new Map<string, { word: string; meant: string; where: string; sample: string }>();
let tokensRead = 0;

for (const path of SOURCES) {
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    console.log(`  (skipped, not found: ${path})`);
    continue;
  }
  for (const said of spokenWords(source)) {
    for (const token of said.toLowerCase().split(/[^a-z]+/)) {
      if (token.length <= 3) continue;
      tokensRead += 1;
      if (seen.has(token)) continue;
      /* nearMiss takes a sentence; a bare token is the smallest honest one. */
      const miss = nearMiss(token);
      if (miss) {
        seen.set(token, {
          word: token,
          meant: miss.meant,
          where: path.split("/").pop()!,
          sample: said.replace(/\s+/g, " ").slice(0, 90),
        });
      } else {
        seen.set(token, null as never);
      }
    }
  }
}

const flagged = Array.from(seen.values()).filter(Boolean) as { word: string; meant: string; where: string; sample: string }[];
flagged.sort((a, b) => a.word.localeCompare(b.word));

console.log("=".repeat(90));
console.log(`THE PRODUCT'S OWN VOCABULARY THROUGH ITS OWN TYPO GATE`);
console.log("=".repeat(90));
console.log(`${tokensRead} tokens read · ${seen.size} distinct words longer than three letters`);
console.log(`${flagged.length} of them would be answered with "Did you mean …?"\n`);

for (const hit of flagged) {
  console.log(`  ${hit.word.padEnd(16)} → "${hit.meant}"   [${hit.where}]`);
  console.log(`      said in: ${hit.sample}`);
}

/* CONTROL, POSITIVE — the gate must still catch a real typo, or a short list
   above would mean the gate is simply off. */
console.log("\nCONTROL — a genuine typo still gets its free question:");
for (const typo of ["hiar", "grene", "freckels"]) {
  const miss = nearMiss(typo);
  console.log(`  "${typo}" → ${miss ? `did you mean "${miss.meant}"` : "NOT CAUGHT — the gate is inert"}`);
}
process.exit(0);
