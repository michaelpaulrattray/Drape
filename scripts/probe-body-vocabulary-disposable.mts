/**
 * WHAT HAPPENS TODAY TO A BODY ASK — the input the body-row design note needs.
 * (fable-360 ruling 3: "We need body shape/build — larger bust, smaller waist,
 * bigger arms, bigger chest etc — this would need a row.")
 *
 * # Why this is measured rather than read off the code
 *
 * `FREE_SUBJECTS` has no bust, no waist, no build, no figure, no shoulders — so
 * reading the file says "a body ask has nowhere to land". That is a CLAIM about
 * a stochastic model's behaviour, and this program's own record says a claim
 * about the interpreter is worth what a probe of it is worth and no more. What
 * actually happens to "give her a larger bust" could be any of four things, and
 * they want four different fixes:
 *
 *   refused at a wall        the customer is told no, for free
 *   filed into a NEAR slot   e.g. skinCharacter or marks — a body ask painted as
 *                            a skin fact, which would render something wrong and
 *                            charge for it
 *   filed as an accessory    the garment wall's neighbour, same charge risk
 *   unfileable / unreadable  "that didn't come through clearly"
 *
 * Only the first is safe. So the probe prints the FACET SET of every sample,
 * verbatim, and the design note is written against what came back.
 *
 * The founder's own four nouns are the corpus, plus two the stylist's vocabulary
 * would reach for next (shoulders, build) — because a row named "body shape /
 * build" has to hold more than the four he happened to type.
 *
 * FREE: text calls only. No renders, no credits, no writes, no database.
 *
 *   npx tsx scripts/probe-body-vocabulary-disposable.mts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/body-probe";
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

/*
  RUN 2 (shift 71), AFTER THE SENTENCE AMENDMENT — the same six, plus the
  controls the amendment must NOT have opened.

  Run 1 measured 18/18 refused with `build` named in the interpreter's
  casting-decision sentence. The amendment takes that one word out
  (fable-381 §A.2). Measured both ways like the colouring carve-out: the six
  body sentences must FILE, and age / heritage / sex / scene must still REFUSE —
  a scope change nobody asked for, on a door that charges, is exactly what the
  control arm exists to catch.
*/
const SENTENCES = [
  "give her a larger bust",
  "make her waist smaller",
  "give her bigger arms",
  "a bigger chest",
  "broader shoulders",
  "a more athletic build",
  /* ---- controls: these must still refuse ---- */
  "make her look older",
  "make her korean",
  "make her a man",
  "put her on a beach",
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

say(`BODY VOCABULARY PROBE — n=${SAMPLES} per sentence, real interpreter, no renders.`);
say("the question of each: is it REFUSED (safe), or FILED somewhere (a charge risk)?\n");

const tally = { refused: 0, filed: 0, other: 0 };
const landedIn = new Map<string, number>();

for (const text of SENTENCES) {
  say("=".repeat(78));
  say(`"${text}"`);
  say("-".repeat(78));
  for (let n = 1; n <= SAMPLES; n += 1) {
    let parsed: any;
    try {
      parsed = await interpretRefinement({ instruction: text, ...CURRENT });
    } catch (error) {
      say(`  #${n}  THREW — ${error instanceof Error ? error.message : String(error)}`);
      tally.other += 1;
      continue;
    }
    if (!parsed.ok) {
      say(`  #${n}  REFUSED — ${parsed.refusal?.reason}${parsed.refusal?.asked ? ` ("${parsed.refusal.asked}")` : ""}`);
      tally.refused += 1;
      continue;
    }
    if (parsed.intent && parsed.intent !== "edit") {
      say(`  #${n}  intent=${parsed.intent} — not an edit`);
      tally.other += 1;
      continue;
    }
    const facets = facetsOf(parsed.delta).sort();
    for (const facet of facets) landedIn.set(facet, (landedIn.get(facet) ?? 0) + 1);
    tally.filed += 1;
    say(`  #${n}  FILED into ${facets.join(", ") || "(nothing)"}`);
    say(`       ${JSON.stringify(parsed.delta)}`);
  }
  say();
}

say("=".repeat(78));
const total = SENTENCES.length * SAMPLES;
say(`${total} samples: ${tally.refused} refused · ${tally.filed} filed · ${tally.other} other`);
if (landedIn.size > 0) {
  say("\nWHERE A BODY ASK LANDS TODAY — every slot it reached, and how often:");
  for (const [facet, count] of [...landedIn].sort((a, b) => b[1] - a[1])) {
    say(`  ${facet.padEnd(28)} ${count}`);
  }
  say("\nEvery one of these is a facet about a FACE. A body ask filing into one is");
  say("an ask rendered as something else — and a render that happens is a render");
  say("that charges.");
} else {
  say("\nNothing filed. A body ask is refused today, which costs the customer nothing");
  say("but means the row fable-360 asks for is entirely new road.");
}

writeFileSync(`${OUT}/probe.txt`, lines.join("\n"));
console.log(`\ntranscript → ${OUT}/probe.txt`);
process.exit(0);
