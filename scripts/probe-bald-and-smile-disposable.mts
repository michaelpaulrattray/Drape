/**
 * TWO GAP QUESTIONS THROUGH THE REAL INTERPRETER, FREE — the founder's bald
 * question (fable-399) and the one the teeth bench walked into.
 *
 * # 1. Bald — the founder's own words
 *
 * *"'remove her hair' and 'make her bald' are essentially the same asks — are
 * you saying today i cannot make a model bald?"* fable-399's hypothesis, and it
 * is law 8 in one sentence: **bald is a HAIRCUT in the stylist's ontology** —
 * shaved to the skin is a cut length — so it may file as an ordinary hair edit
 * and render through the front door today with no removal machinery at all.
 * Step 1 of that order is free: put the three phrasings through the interpreter
 * and print what files where.
 *
 * # 2. Smile — the question the teeth bench could not answer with words
 *
 * Every master this product casts has a closed mouth by prompt law
 * (`cohortPhotorealHuman.ts`, twice, in the block appended last with override
 * authority: *"Mouth closed, lips together and relaxed … a broad smile is
 * not"*), and no variant in the world has ever asked about a mouth. So the
 * teeth row's honest answer is null on every frame that exists — and whether
 * that is FOREVER depends on one thing nobody has measured: **can a user ask
 * her to smile?** If the interpreter refuses an expression ask, no product
 * frame can ever show teeth, and the teeth row is provably empty today
 * whatever the describer can do.
 *
 * # The controls stay in
 *
 * Four sentences that must still REFUSE ride with them. A probe that only
 * measures the door opening cannot tell a door from a hole — and this program
 * has shipped a guard that admitted 28 of 28 clothing words while its positive
 * arm looked perfect.
 *
 * FREE: text calls only. No renders, no credits, no writes, no database.
 *
 *   npx tsx scripts/probe-bald-and-smile-disposable.mts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/bald-smile-probe";
mkdirSync(OUT, { recursive: true });

if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
  throw new Error("no text transport configured — the interpreter would refuse and prove nothing");
}

const { interpretRefinement } = await import("../server/castingV2/refineInterpreter.js");

const CURRENT = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "straight",
  currentMakeup: null,
};

const SENTENCES: { text: string; arm: "bald" | "smile" | "control" }[] = [
  /* fable-399's three, verbatim */
  { text: "make her bald", arm: "bald" },
  { text: "shave her head", arm: "bald" },
  { text: "remove her hair", arm: "bald" },
  /* the teeth question's own three */
  { text: "give her a broad smile", arm: "smile" },
  { text: "make her smile showing her teeth", arm: "smile" },
  { text: "have her laughing with her mouth open", arm: "smile" },
  /* ---- controls: these must still refuse ---- */
  { text: "make her look older", arm: "control" },
  { text: "make her korean", arm: "control" },
  { text: "make her a man", arm: "control" },
  { text: "put her on a beach", arm: "control" },
];

/** Every leaf key that carries a value, so a one-facet delta cannot hide in a nest. */
function facetsOf(value: unknown, path: string[] = []): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.length === 0 ? [] : [path.join(".")];
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      facetsOf(child, [...path, key]));
  }
  return [path.join(".")];
}

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

say(`BALD + SMILE PROBE — n=${SAMPLES} per sentence, real interpreter, no renders, no credits.`);
say("bald: does it file as a HAIRCUT today? · smile: can an expression be asked for at all?");
say("controls: four sentences that must still refuse.\n");

const byArm: Record<string, { refused: number; filed: number; other: number; where: Map<string, number> }> = {
  bald: { refused: 0, filed: 0, other: 0, where: new Map() },
  smile: { refused: 0, filed: 0, other: 0, where: new Map() },
  control: { refused: 0, filed: 0, other: 0, where: new Map() },
};

for (const sentence of SENTENCES) {
  say("=".repeat(78));
  say(`[${sentence.arm}] "${sentence.text}"`);
  say("-".repeat(78));
  const tally = byArm[sentence.arm];
  for (let n = 1; n <= SAMPLES; n += 1) {
    let parsed: any;
    try {
      parsed = await interpretRefinement({ instruction: sentence.text, ...CURRENT });
    } catch (error) {
      say(`  #${n}  THREW — ${error instanceof Error ? error.message : String(error)}`);
      tally.other += 1;
      continue;
    }
    if (!parsed.ok) {
      say(`  #${n}  REFUSED — ${parsed.refusal?.reason}${parsed.refusal?.asked ? ` ("${parsed.refusal.asked}")` : ""}`);
      if (parsed.refusal?.message) say(`       says: ${parsed.refusal.message}`);
      tally.refused += 1;
      continue;
    }
    if (parsed.intent && parsed.intent !== "edit") {
      say(`  #${n}  intent=${parsed.intent} — not an edit`);
      tally.other += 1;
      continue;
    }
    const facets = facetsOf(parsed.delta).sort();
    for (const facet of facets) tally.where.set(facet, (tally.where.get(facet) ?? 0) + 1);
    tally.filed += 1;
    say(`  #${n}  FILED into ${facets.join(", ") || "(nothing)"}`);
    say(`       ${JSON.stringify(parsed.delta)}`);
  }
  say();
}

say("=".repeat(78));
for (const [arm, tally] of Object.entries(byArm)) {
  const n = SENTENCES.filter((s) => s.arm === arm).length * SAMPLES;
  say(`${arm.padEnd(8)} ${n} samples: ${tally.refused} refused · ${tally.filed} filed · ${tally.other} other`);
  for (const [facet, count] of [...tally.where].sort((a, b) => b[1] - a[1])) {
    say(`         ${facet.padEnd(28)} ${count}`);
  }
}

say("");
say("READ THE CONTROL ROW FIRST: if the four control sentences did not refuse,");
say("this instrument is a hole and nothing above it is a reading.");

writeFileSync(`${OUT}/probe.txt`, lines.join("\n"), "utf8");
console.log(`\ntranscript → ${OUT}/probe.txt`);
process.exit(0);
