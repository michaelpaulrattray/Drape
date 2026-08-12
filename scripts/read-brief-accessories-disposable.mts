/**
 * WHERE THE EARRINGS FELL OUT OF THE BRIEF — the compiled brief itself, and
 * every filter `readBriefFacts` puts between it and the gate.
 *
 * A roll cast from *"A woman in her forties who wears small gold hoop earrings,
 * one at each ear …"* produced eight faces wearing hoops and a
 * `statedAccessories` list of `[]`, which is why "take her earrings off" was
 * refused with "her brief didn't ask for earrings". There are three places the
 * accessory can be lost between the sentence and the gate, and this prints all
 * three rather than guessing which:
 *
 *   1. the INTERPRETER never put it in `compiledBrief.intent.statedAccessories`
 *   2. it is there and `tokensComeFromBrief` rejects it against the brief text
 *   3. it is there, survives, and the gate's own `textMentions` misses it
 *
 * Read-only. No credits.
 *
 *   npx tsx scripts/read-brief-accessories-disposable.mts <candidatePublicId>
 */
import "dotenv/config";

import { getBriefForOwnedCandidate } from "../server/db/castingV2";
import { readBriefFacts } from "../server/castingV2/rollProjection";
import { textMentions } from "../server/castingV2/refineRemoval";
import { assertOneWorld } from "./lib/worldGuard.mts";

const FACE = process.argv[2] ?? "40279ed9-3e55-416e-859b-3c3b6d53f93b";
const USER = Number(process.env.USER_ID ?? 1);

assertOneWorld([process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL"]);

const brief = await getBriefForOwnedCandidate(USER, FACE);
if (!brief) throw new Error(`no brief for ${FACE}`);

console.log(`briefText:\n  "${brief.briefText}"\n`);

const compiled = brief.compiledBrief as any;
console.log(`compiledBrief.intent keys: ${Object.keys(compiled?.intent ?? {}).join(", ") || "(none)"}`);
console.log(`compiledBrief.intent.statedAccessories: ${JSON.stringify(compiled?.intent?.statedAccessories ?? null)}`);
console.log(`lockContract keys: ${Object.keys((brief.lockContract ?? {}) as object).join(", ") || "(none)"}`);

/* Where a value that IS present would be dropped. */
const raw: unknown[] = Array.isArray(compiled?.intent?.statedAccessories)
  ? compiled.intent.statedAccessories : [];
for (const entry of raw) {
  console.log(`  candidate accessory "${entry}"`);
}

const facts = readBriefFacts(brief.lockContract, brief.compiledBrief, brief.briefText);
console.log(`\nreadBriefFacts.statedAccessories: ${JSON.stringify(facts.statedAccessories)}`);
for (const noun of ["earrings", "earring", "hoops", "glasses"]) {
  const named = (facts.statedAccessories ?? []).some((worn: string) => textMentions(worn, noun));
  console.log(`  the gate would say briefNamesIt("${noun}") = ${named}`);
}

/* The whole compiled brief, last, so the shape is on the record if the fields
   above turn out to be the wrong ones to have read. */
console.log(`\ncompiledBrief:\n${JSON.stringify(compiled, null, 2).slice(0, 2400)}`);

process.exit(0);
