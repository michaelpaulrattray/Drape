/**
 * CAN AN OPEN-VOCABULARY ASK HAVE A STABLE KEY? — the input the open-lane
 * design note needs (fable-364: "the open lane records the normalized ASK KIND
 * (the noun — 'horns')").
 *
 * # Why this is measured rather than reasoned about
 *
 * The closed subject list exists for ONE reason, and `refineSubjects.ts` states
 * it in its own words: *"The tempting shape is a model-authored `{ axis, text }`,
 * and it is wrong for D-89's reason: it hands the composition key to the model.
 * 'Her brows' comes back as `brows` one time, `brow shape` the next and
 * `eyebrows` the third, so last-writer-wins silently becomes accumulation and
 * 'thin' and 'thick' end up in one prompt arguing with each other."*
 *
 * The open lane hands the composition key to the model. That is not a detail of
 * it — it IS it. So the whole architecture rests on one empirical question the
 * ruling presupposes and nobody has measured: **can a model produce the same
 * noun twice for the same thing?**
 *
 * # Two parts, and the second one has the bar that matters
 *
 * PART A — what happens to an out-of-vocabulary ask TODAY, through the real
 * `interpretRefinement`. Four outcomes, and only some are safe:
 *
 *   refused at a wall        the customer is told no, for free
 *   filed into a NEAR slot   e.g. "scales" landing in skinCharacter — an ask
 *                            rendered as something else, and charged for
 *   unfileable               `readDelta` returns null on an unknown subject
 *   filed cleanly            impossible today; there is no slot to file into
 *
 * PART B — the normalizer, prototyped. **Declared: this mechanism does not
 * exist.** The prompt below is a candidate, not a reading of shipped code, and
 * its numbers describe what the open lane WOULD get, not what anything does.
 *
 * # The bar, written before the first call
 *
 *   1. WITHIN-SENTENCE   the same sentence gives the same noun 3/3, every
 *                        sentence. A key that is not a function of its input
 *                        makes every downstream question moot.
 *   2. ACROSS-PARAPHRASE three ways of asking for one thing converge on one
 *                        noun, on at least 4 of 5 concepts. This is the one
 *                        last-writer-wins depends on: if "give her horns" keys
 *                        `horns` and "the horns should be bigger" keys `horn`,
 *                        the second ask does not supersede the first, it
 *                        ACCUMULATES — D-142's mullet defect rebuilt in a new
 *                        place, on vocabulary nobody has a table for.
 *   3. DISCRIMINATION    distinct concepts get distinct nouns. **This is the
 *                        control without which bars 1 and 2 are vacuous**: a
 *                        normalizer that answers "feature" to everything scores
 *                        a perfect 3/3 and 5/5 above. (The shape fable-378 §3
 *                        flagged on the earring reader, one surface along: a
 *                        reader that answers something on every face can never
 *                        say absent.)
 *
 * A near pair (horns/antlers) is included on purpose. Collapsing it is not
 * automatically wrong — it is a product question the note has to answer — but
 * it must be VISIBLE rather than discovered later in a stack that superseded
 * something it should not have.
 *
 * FREE: text calls only. No renders, no credits, no writes, no database.
 *
 *   npx tsx scripts/probe-open-lane-normalization-disposable.mts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/open-lane-probe";
mkdirSync(OUT, { recursive: true });

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("no OPENROUTER_API_KEY — the interpreter would refuse and the probe would prove nothing");
}

const { interpretRefinement } = await import("../server/castingV2/refineInterpreter.js");
const { interpreterEngine } = await import("../server/castingV2/interpreter.js");

const CURRENT = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "straight",
  currentMakeup: null,
};

/**
 * Five concepts the catalogue has never heard of, each said three ways.
 *
 * Chosen so that none of them is a paraphrase of an existing free subject —
 * "pointed elf ears" was dropped for exactly that reason (`ears` is a subject,
 * so it would measure the closed lane wearing an open-lane label).
 */
const CONCEPTS: Array<{ concept: string; sentences: string[] }> = [
  { concept: "horns", sentences: [
    "give her horns",
    "add horns to her head",
    "I want her to have horns coming out of her forehead",
  ] },
  { concept: "antlers", sentences: [
    "give her antlers",
    "add antlers growing from her head",
    "she should have antlers like a deer",
  ] },
  { concept: "wings", sentences: [
    "give her wings",
    "add feathered wings behind her shoulders",
    "she should have wings",
  ] },
  { concept: "a tail", sentences: [
    "give her a tail",
    "add a long tail",
    "she should have a tail",
  ] },
  { concept: "scales", sentences: [
    "give her scales on her cheeks",
    "add reptile scales across her face",
    "her cheeks should be covered in scales",
  ] },
];

/**
 * The candidate normalizer. **Not shipped code.**
 *
 * Deliberately given no list to choose from — that is the whole point of an
 * open lane, and a probe that supplied one would be measuring a closed lane
 * with extra steps.
 */
const NORMALIZER_SYSTEM = [
  "You name the ONE THING a photo-editing instruction is about, as a key.",
  "",
  "Reply with JSON only: {\"kind\": \"<noun>\"}",
  "",
  "RULES:",
  "  - a single lowercase noun, singular or plural as the thing naturally is",
  "  - the THING, never the change: \"make the horns bigger\" is \"horns\", not \"bigger\"",
  "  - never an adjective, never a verb, never a sentence",
  "  - two instructions about the same thing MUST give the same key, whatever",
  "    words they use for it",
  "  - two instructions about DIFFERENT things must give different keys; never",
  "    reach for a general word like \"feature\" or \"detail\" to cover both",
].join("\n");

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

say(`OPEN-LANE NORMALIZATION PROBE — n=${SAMPLES} per sentence.`);
say("Part A: the real interpreter, today. Part B: a PROTOTYPE normalizer that does not exist.");
say("");

/* ────────────────────────── PART A ────────────────────────── */

say("=".repeat(78));
say("PART A — what an out-of-vocabulary ask does TODAY (real `interpretRefinement`)");
say("=".repeat(78));

/** Every leaf key carrying a value, so a one-facet delta cannot hide in a nest. */
function facetsOf(value: unknown, path: string[] = []): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.length === 0 ? [] : [path.join(".")];
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      facetsOf(child, [...path, key]));
  }
  return [path.join(".")];
}

const tallyA = { refused: 0, filed: 0, other: 0 };
const landedIn = new Map<string, number>();

for (const { concept, sentences } of CONCEPTS) {
  say("-".repeat(78));
  say(`${concept}`);
  for (const text of sentences) {
    for (let n = 1; n <= SAMPLES; n += 1) {
      let parsed: any;
      try {
        parsed = await interpretRefinement({ instruction: text, ...CURRENT });
      } catch (error) {
        say(`  "${text}" #${n}  THREW — ${error instanceof Error ? error.message : String(error)}`);
        tallyA.other += 1;
        continue;
      }
      if (!parsed.ok) {
        say(`  "${text}" #${n}  REFUSED — ${parsed.refusal?.reason}`
          + `${parsed.refusal?.asked ? ` ("${parsed.refusal.asked}")` : ""}`);
        tallyA.refused += 1;
        continue;
      }
      if (parsed.intent && parsed.intent !== "edit") {
        say(`  "${text}" #${n}  intent=${parsed.intent} — not an edit`);
        tallyA.other += 1;
        continue;
      }
      const facets = facetsOf(parsed.delta).sort();
      for (const facet of facets) landedIn.set(facet, (landedIn.get(facet) ?? 0) + 1);
      tallyA.filed += 1;
      say(`  "${text}" #${n}  FILED into ${facets.join(", ") || "(nothing)"}`);
      say(`       ${JSON.stringify(parsed.delta)}`);
    }
  }
}

say();
const totalA = CONCEPTS.reduce((sum, c) => sum + c.sentences.length, 0) * SAMPLES;
say(`PART A: ${totalA} samples — ${tallyA.refused} refused · ${tallyA.filed} filed · ${tallyA.other} other`);
if (landedIn.size > 0) {
  say("WHERE AN OPEN ASK LANDS TODAY — every slot it reached, and how often:");
  for (const [facet, count] of [...landedIn].sort((a, b) => b[1] - a[1])) {
    say(`  ${facet.padEnd(28)} ${count}`);
  }
  say("Each of these is an ask rendered as something else. A render that happens is");
  say("a render that charges.");
}
say();

/* ────────────────────────── PART B ────────────────────────── */

say("=".repeat(78));
say("PART B — the PROTOTYPE normalizer (declared: this mechanism does not exist)");
say("=".repeat(78));

const engine = interpreterEngine();
if (!engine) throw new Error("no text engine — cannot run part B");

async function normalize(text: string): Promise<string | null> {
  const result = await engine!.complete({
    system: NORMALIZER_SYSTEM,
    user: text,
    json: true,
  });
  const raw = (result as any)?.text ?? (result as any)?.content ?? "";
  const match = String(raw).match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const kind = parsed?.kind;
    return typeof kind === "string" && kind.trim() !== "" ? kind.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/** concept → sentence → the nouns its samples produced */
const keysByConcept = new Map<string, Map<string, string[]>>();

for (const { concept, sentences } of CONCEPTS) {
  const perSentence = new Map<string, string[]>();
  say("-".repeat(78));
  say(`${concept}`);
  for (const text of sentences) {
    const got: string[] = [];
    for (let n = 1; n <= SAMPLES; n += 1) {
      got.push((await normalize(text)) ?? "(unreadable)");
    }
    perSentence.set(text, got);
    const stable = new Set(got).size === 1;
    say(`  ${stable ? "  " : "!!"} "${text}"`);
    say(`       → ${got.join(" · ")}${stable ? "" : "   ← NOT STABLE"}`);
  }
  keysByConcept.set(concept, perSentence);
}

say();
say("=".repeat(78));
say("THE THREE BARS, against what came back");
say("=".repeat(78));

/* Bar 1 — within-sentence stability. */
let sentencesTotal = 0;
let sentencesStable = 0;
for (const perSentence of keysByConcept.values()) {
  for (const got of perSentence.values()) {
    sentencesTotal += 1;
    if (new Set(got).size === 1 && !got.includes("(unreadable)")) sentencesStable += 1;
  }
}
const bar1 = sentencesStable === sentencesTotal;
say(`1. WITHIN-SENTENCE   ${sentencesStable}/${sentencesTotal} sentences gave one noun ${SAMPLES}/${SAMPLES}`);
say(`   ${bar1 ? "PASS" : "FAIL"} — bar was: every sentence`);

/* Bar 2 — across-paraphrase convergence. */
const conceptKey = new Map<string, string | null>();
let converged = 0;
for (const [concept, perSentence] of keysByConcept) {
  const all = [...perSentence.values()].flat();
  const distinct = new Set(all);
  const one = distinct.size === 1 ? [...distinct][0]! : null;
  conceptKey.set(concept, one);
  if (one !== null && one !== "(unreadable)") converged += 1;
  say(`   ${concept.padEnd(10)} → ${one ?? `${distinct.size} distinct: ${[...distinct].join(", ")}`}`);
}
const bar2 = converged >= 4;
say(`2. ACROSS-PARAPHRASE ${converged}/${CONCEPTS.length} concepts converged on ONE noun`);
say(`   ${bar2 ? "PASS" : "FAIL"} — bar was: at least 4 of 5`);

/* Bar 3 — discrimination. THE CONTROL. Without it 1 and 2 are vacuous. */
const collisions: string[] = [];
const seenKeys = new Map<string, string>();
for (const [concept, key] of conceptKey) {
  if (key === null) continue;
  const already = seenKeys.get(key);
  if (already !== undefined) collisions.push(`${already} and ${concept} BOTH key "${key}"`);
  else seenKeys.set(key, concept);
}
const bar3 = collisions.length === 0;
say(`3. DISCRIMINATION    ${seenKeys.size} distinct keys across ${conceptKey.size} concepts`);
for (const collision of collisions) say(`   COLLISION: ${collision}`);
say(`   ${bar3 ? "PASS" : "FAIL"} — bar was: no two concepts sharing a key`);
say();
say(`VERDICT: ${bar1 && bar2 && bar3 ? "all three bars met" : "NOT MET — see above"}`);
say();
say("Read bar 3 first. If it had failed, bars 1 and 2 would be the signature of a");
say("normalizer answering one word to everything, which is perfectly stable and");
say("perfectly useless.");

writeFileSync(`${OUT}/probe.txt`, lines.join("\n"));
console.log(`\ntranscript → ${OUT}/probe.txt`);
process.exit(0);
