/**
 * THE COLOURING CARVE-OUT — measured before it is ruled, not after.
 *
 * # Why this probe exists
 *
 * fable-363 ruling 1 set a bar the shipped backstop does not meet: *"make her
 * albino" files 5/5 after the fix*. Driven twice on the real transport, it files
 * **0/5**, and the re-look's own reply says why — it comes back
 * `asked: "her albinism"` / `asked: "her age"`, which is the base prompt's OWN
 * ruled sentence: *"Casting decisions are NOT refinements: age, heritage, sex
 * and build are who was cast rather than how they look today."* The model is not
 * flipping a coin there. It is obeying an instruction, and it reads albinism as
 * heritage.
 *
 * The founder called *"make her albino"* a genuine ask (fable-361 §2). So the
 * sentence over-captures — but narrowing it is a PRODUCT POSITION, and this
 * probe exists so the ruling arrives with a measurement instead of a hypothesis.
 *
 * # The controls are the whole point
 *
 * A narrowing that also opens age, heritage, sex or build would be a scope
 * change nobody asked for, on a door that charges. Two of those four words the
 * founder has since re-opened in principle (build → the body row, fable-360;
 * "older" → words, fable-361 §3) and two he has not — and NONE of the four has a
 * build behind it yet. So all four must still refuse, and the scene arms must be
 * untouched.
 *
 *   MUST FILE     "make her albino", "give her vitiligo on her hands",
 *                 "let her hair go grey"
 *   MUST REFUSE   "make her look older" (age) · "make her korean" (heritage)
 *                 "make her a man" (sex) · "make her more muscular" (build)
 *                 "put her on a beach" (the unbacked scene control)
 *
 * FREE: text calls only. No renders, no credits, no writes, no database.
 *
 *   npx tsx scripts/probe-casting-decision-carveout-disposable.mts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";

const SAMPLES = Number(process.env.SAMPLES ?? 5);
const OUT = "output/carveout-probe";
mkdirSync(OUT, { recursive: true });

if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
  throw new Error("no text transport configured — the interpreter would refuse and prove nothing");
}

const { interpretRefinement } = await import("../server/castingV2/refineInterpreter.js");

const FACE = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "straight",
  currentMakeup: null,
};

const ARMS = [
  {
    name: "MUST FILE — colouring conditions the founder called genuine asks",
    want: "file" as const,
    sentences: ["make her albino", "give her vitiligo on her hands", "let her hair go grey"],
  },
  {
    name: "MUST REFUSE — the four casting words, none of which this may open",
    want: "refuse" as const,
    sentences: [
      "make her look older",      // age
      "make her korean",          // heritage
      "make her a man",           // sex
      "make her more muscular",   // build
    ],
  },
  {
    name: "MUST REFUSE — the scene control, unbacked by the lexicon",
    want: "refuse" as const,
    sentences: ["put her on a beach"],
  },
];

function facetsOf(value: unknown, path: string[] = []): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.length === 0 ? [] : [path.join(".")];
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      facetsOf(child, [...path, key]),
    );
  }
  return [path.join(".")];
}

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

say(`THE COLOURING CARVE-OUT — n=${SAMPLES} per sentence, real interpreter, no renders.`);
say("the face as filed: dark brown hair, brown eyes — so a skin-only albino filing is visible.\n");

const summary: string[] = [];

for (const arm of ARMS) {
  say("=".repeat(78));
  say(arm.name);
  say("=".repeat(78));
  for (const text of arm.sentences) {
    say(`\n"${text}"`);
    let filed = 0;
    let decomposed = 0;
    for (let n = 1; n <= SAMPLES; n += 1) {
      let parsed: Awaited<ReturnType<typeof interpretRefinement>>;
      try {
        parsed = await interpretRefinement({ instruction: text, ...FACE });
      } catch (error) {
        say(`  #${n}  THREW — ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      if (!parsed.ok) {
        const refusal = parsed.refusal as { reason?: string; asked?: string };
        say(`  #${n}  refused — ${refusal.reason}${refusal.asked ? ` ("${refusal.asked}")` : ""}`);
        continue;
      }
      /* Navigation carries no delta and is not a filing — the union has that
         member, so it is named rather than read as an empty edit. */
      if (!("delta" in parsed)) {
        say(`  #${n}  read as NAVIGATION — no delta`);
        continue;
      }
      filed += 1;
      const facets = facetsOf(parsed.delta).sort();
      /* Albinism is the whole person's colouring — a skin-only filing paints a
         pale face under this face's dark hair, which is the defect law 8 named. */
      if (facets.some((f) => /hair|brow|lash|eye/i.test(f))) decomposed += 1;
      say(`  #${n}  FILED ${facets.join(", ")}`);
      say(`       ${JSON.stringify(parsed.delta)}`);
    }
    const met = arm.want === "file" ? filed === SAMPLES : filed === 0;
    const line = `${filed}/${SAMPLES} filed — ${met ? "MEETS" : "DOES NOT meet"} the bar (wants ${arm.want})`;
    say(`  → ${line}`);
    if (text === "make her albino") say(`  → decomposed beyond skin on ${decomposed}/${SAMPLES}`);
    summary.push(`  ${met ? "OK  " : "FAIL"} "${text}" → ${line}`);
  }
  say("");
}

say("=".repeat(78));
say("SUMMARY");
summary.forEach((line) => say(line));

writeFileSync(`${OUT}/probe.txt`, lines.join("\n"));
console.log(`\ntranscript → ${OUT}/probe.txt`);
process.exit(0);
