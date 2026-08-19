/**
 * THE HONEST-PARAPHRASE CORPUS — does rephrasing get an honest ask EATEN?
 *
 * # The mirror of drive-walls, and the polarity that has actually hurt
 *
 * `drive-walls.mts` asks whether rephrasing gets AROUND a guard. Every real
 * dogfood wound so far has been the other direction: a legitimate instruction,
 * phrased slightly oddly, refused or misfiled. `tie` versus `tied`. The
 * cupid's-bow apostrophe. "Pastel pink hair color" landing in makeup. "Hair
 * color pink" refused outright while the longer phrasing worked.
 *
 * Each of those got a point-fix and a driver for that exact string. Nothing
 * hunted the NEXT one. This does: a set of legitimate asks, each phrased many
 * odd-but-honest ways, asserting they all land in the same drawer.
 *
 * **Text stage only — no renders.** It asserts on the parsed delta, so it is
 * safe to run on a schedule and it is the other half of what the standing
 * dogfood bot inherits: walls hold, honest asks land.
 *
 *   npx tsx scripts/drive-paraphrase.mts             — everything
 *   npx tsx scripts/drive-paraphrase.mts order       — one class
 */
import "dotenv/config";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { itemsOf, type RefineDelta } from "../server/castingV2/refineDelta";
import { pendingReaskFor, resolveAnswer } from "../server/castingV2/refineReask";

type Expect = {
  /** Which drawer it must land in — a delta key, or `free.<subject>`. */
  drawer: string;
  /** A word the filed value must contain, stemmed loosely. */
  holds?: string;
  /** Words that must NOT appear anywhere in the delta. */
  forbid?: string[];
  /** Current-state overrides, for relative asks. */
  current?: Partial<Record<"eyeColour" | "hairColour" | "hairStyle" | "makeup", string>>;
  /** A second drawer that must ALSO be filled — multi-facet sentences. */
  also?: string;
  /** An equally correct drawer — the ruling names an outcome, not a slot. */
  orDrawer?: string;
};

type Klass = {
  name: string;
  why: string;
  expect: Expect;
  asks: string[];
  /**
   * A question the product has not answered yet.
   *
   * Reported loudly and NOT counted as a failure. A permanently red fixture
   * gets ignored, and a green one hiding a real question is the
   * detected-but-never-fixed trap — this is the third option: visible, and
   * honest about being undecided.
   */
  open?: string;
  /**
   * The facet the last colour edit touched (D-178).
   *
   * History answers an unqualified colour silently, so the classes that test
   * that behaviour have to supply the history — a relative ask with none is a
   * different case, and it is asserted as a QUESTION below rather than a parse.
   */
  lastColour?: string;
  /**
   * This class never reaches the model at all (D-178, D-179).
   *
   * The question fires before the parse and costs nothing, so the assertion is
   * on the question and on the answer resolving — not on a delta.
   */
  reask?: { kind: "which-facet" | "did-you-mean"; answer: string; resolvesTo: string };
};

const CLASSES: Klass[] = [
  {
    name: "order",
    why: "word order and ellipsis — a casual user drops words, and fewer words "
      + "must never fail where more words succeed",
    expect: { drawer: "free.hairShade", holds: "pink" },
    asks: ["pink hair", "hair pink", "make hair pink", "go pink with the hair", "hair colour pink"],
  },
  {
    name: "casual",
    why: "the register people actually type in — lowercase, no punctuation, "
      + "please and thanks, abbreviations",
    expect: { drawer: "free.hairShade", holds: "pink" },
    asks: ["can u do the hair pink", "pink hair pls", "hair pink thanks", "make her hair pink"],
  },
  {
    name: "verbs",
    why: "verb variety and morphology — the tie/tied class. A different tense "
      + "of the user's own word must never read as an invention",
    expect: { drawer: "free.hairShade", holds: "pink" },
    asks: ["dye it pink", "colour her hair pink", "turn the hair pink"],
  },
  {
    name: "dye-owns-hair",
    why: "ASSERTED as of D-177 — the annotation was open and is now a law. A dye "
      + "word owns the HAIR drawer, because dyeing is a thing done to hair, so "
      + "the dye word is the owner declaration exactly as \"hair\" is (D-176). "
      + "D-89's older reading, that a stated dye files as makeup/styling, is "
      + "superseded now that hair has a drawer of its own to be declared for",
    expect: { drawer: "free.hairShade" },
    asks: ["dyed pink", "bleached blonde", "box colour red"],
  },
  {
    name: "dye-carve-out",
    why: "and the carve-out the ROLL side already paid sixteen tiles for: a dye "
      + "word names the ACT, a named feature names what it was done to, and the "
      + "feature wins. Bleached brows are makeup",
    /*
      The ruling says these "stay makeup", and its INTENT is that they never
      become hair. "Bleached brows" actually lands in the BROWS drawer, which
      serves that intent better than makeup does — brows have a subject of
      their own, so filing there is more specific, not less. Both are accepted;
      hair is not.
    */
    expect: { drawer: "makeup", orDrawer: "free.brows" },
    asks: ["bleached brows", "tinted moisturizer", "tinted lip"],
  },
  {
    name: "typos",
    why: "typos a real person makes — ASSERTED as of D-179. Neither answer the "
      + "annotation weighed up survived: filing verbatim buys a render nobody "
      + "asked for, and refusing politely is a wall where a question belongs. "
      + "It asks, for free, and THEY choose the word",
    /*
      The bar is NOT that the typo gets corrected — D-172 says only the user's
      words are filed, so inventing "pink" out of "piink" would be the model
      authoring the record. The bar is that THEIR token files and nothing is
      invented around it.
    */
    expect: { drawer: "free.hairShade", forbid: ["blonde", "brown", "black", "auburn"] },
    asks: ["pinl hair", "piink hair", "pink hiar"],
    /* ANSWERED (D-179): neither file-and-charge nor refuse — ask, for free, and
       let THEM choose the word. The confirmation is what keeps D-172 intact. */
    reask: { kind: "did-you-mean", answer: "yes", resolvesTo: "pink" },
  },
  {
    name: "relative",
    why: "relative asks resolve against the CURRENT value, not the original — "
      + "and must not silently become an absolute somebody never said",
    expect: {
      drawer: "free.hairShade",
      current: { hairColour: "copper" },
      forbid: ["copper"],
    },
    asks: ["lighter", "less copper", "softer colour"],
    /* ANSWERED (D-178): the last colour-bearing edit is handed to the parser as
       context, so a relative ask has something to be relative TO. */
    lastColour: "the hair",
  },
  {
    name: "unqualified-colour",
    why: "a colour ask with NO noun attached — the mirror of D-176, where the "
      + "word 'hair' was there to name the drawer and here nothing is",
    expect: { drawer: "free.hairShade", current: { hairColour: "copper" } },
    asks: ["a bit more pink", "more pink", "pinker"],
    lastColour: "the hair",
  },
  {
    name: "cold-colour",
    why: "the SAME asks with no colour history — nothing to be relative to, so "
      + "the product asks instead of guessing, and the answer runs as an edit",
    expect: { drawer: "free.hairShade" },
    asks: ["a bit more pink", "more pink", "pinker"],
    /* ANSWERED (D-178/D-180): a cold start is the one case that earns a
       question, and typing the answer must resolve it — the box is the
       interface. */
    reask: { kind: "which-facet", answer: "the hair", resolvesTo: "the hair" },
  },
  {
    name: "multi",
    why: "two facets in one sentence — both file, neither bleeds into the other",
    expect: { drawer: "free.hairShade", holds: "pink", also: "eyeColour" },
    asks: ["pink hair and green eyes", "green eyes, pink hair", "make her hair pink with green eyes"],
  },
];

function drawerValue(delta: RefineDelta, drawer: string): string | null {
  if (drawer.startsWith("free.")) {
    const value = delta.free?.[drawer.slice(5) as keyof NonNullable<RefineDelta["free"]>];
    const items = itemsOf(value);
    return items.length > 0 ? items.join(" ") : null;
  }
  const value = (delta as Record<string, unknown>)[drawer];
  return typeof value === "string" ? value : null;
}

/** Loose enough that "pinker" finds "pink" — the tolerance the guards learned. */
function holds(value: string, word: string): boolean {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(word.toLowerCase());
}

const only = process.argv[2];
let failures = 0;
const findings: string[] = [];
const open: string[] = [];

for (const klass of CLASSES) {
  if (only && only !== klass.name) continue;
  console.log(`\n=== ${klass.name} — ${klass.why} ===`);
  for (const ask of klass.asks) {
    /*
      THE QUESTION CLASSES NEVER REACH THE MODEL.

      Both fire before the parse and cost nothing, so asserting them through the
      interpreter would be asserting the wrong thing entirely.
    */
    if (klass.reask) {
      /* No picture is attached on any ask this driver carries — every class here
         is a question about the WORDS. Said explicitly rather than defaulted,
         because the fact is what the answer path rebuilds the question from. */
      const question = pendingReaskFor(ask, false, false);
      const resolved = question ? resolveAnswer(question, klass.reask.answer) : null;
      const problems: string[] = [];
      if (!question) problems.push("no question was raised");
      else if (question.kind !== klass.reask.kind) problems.push(`asked ${question.kind}`);
      if (!resolved) problems.push(`"${klass.reask.answer}" did not resolve — a dead end`);
      else if (!holds(resolved, klass.reask.resolvesTo)) {
        problems.push(`resolved to "${resolved}"`);
      }
      const wellAsked = problems.length === 0;
      if (!wellAsked) {
        failures += 1;
        findings.push(`${klass.name}: "${ask}" -> ${problems.join("; ")}`);
      }
      console.log(`  ${wellAsked ? "PASS" : "FAIL"}  ${(question?.question ?? "no question").slice(0, 70).padEnd(72)} "${ask}"`);
      if (!wellAsked) console.log(`        ${problems.join(" | ")}`);
      continue;
    }
    const parsed = await interpretRefinement({
      instruction: ask,
      lastColourFacet: klass.lastColour ?? null,
      currentEyeColour: klass.expect.current?.eyeColour ?? "brown",
      currentEyeShape: "almond",
      currentHairStyle: klass.expect.current?.hairStyle ?? "a blunt bob",
      currentHairColour: klass.expect.current?.hairColour ?? "black",
      currentHairTexture: "straight",
      currentMakeup: klass.expect.current?.makeup ?? null,
    });
    if (!parsed.ok || !("delta" in parsed)) {
      const why = parsed.ok ? `intent:${parsed.intent}` : parsed.refusal.reason;
      /* A typo may refuse politely; anything else refusing is a finding. */
      const tolerated = klass.name === "typos";
      if (!tolerated && !klass.open) {
        failures += 1;
        findings.push(`${klass.name}: "${ask}" -> ${why}`);
      } else if (klass.open) open.push(`${klass.name}: "${ask}" -> ${why}`);
      console.log(`  ${tolerated ? "OK  " : "FAIL"}  ${why.padEnd(22)} "${ask}"`);
      continue;
    }
    const delta = parsed.delta;
    const value = drawerValue(delta, klass.expect.drawer)
      ?? (klass.expect.orDrawer ? drawerValue(delta, klass.expect.orDrawer) : null)
      /* A colour the closed vocabulary CAN hold is promoted, and that is the
         same drawer by another name — the facet is the unit (D-159). */
      ?? (klass.expect.drawer === "free.hairShade" ? drawerValue(delta, "hairColour") : null);
    const text = JSON.stringify(delta).toLowerCase();
    const problems: string[] = [];
    if (!value) problems.push(`wrong drawer: ${JSON.stringify(delta)}`);
    if (value && klass.expect.holds && !holds(value, klass.expect.holds)) {
      problems.push(`value lost "${klass.expect.holds}": ${value}`);
    }
    for (const word of klass.expect.forbid ?? []) {
      if (text.includes(word.toLowerCase())) problems.push(`invented/echoed "${word}"`);
    }
    if (klass.expect.also && !drawerValue(delta, klass.expect.also)) {
      problems.push(`second facet ${klass.expect.also} did not file`);
    }
    const ok = problems.length === 0;
    if (!ok && !klass.open) {
      failures += 1;
      findings.push(`${klass.name}: "${ask}" -> ${problems.join("; ")}`);
    } else if (!ok) open.push(`${klass.name}: "${ask}" -> ${problems.join("; ")}`);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${JSON.stringify(delta).slice(0, 70).padEnd(72)} "${ask}"`);
    if (!ok) console.log(`        ${problems.join(" | ")}`);
  }
}

console.log(failures === 0
  ? "\nEVERY HONEST PHRASING LANDED."
  : `\n${failures} FINDING(S):\n  ${findings.join("\n  ")}`);
if (open.length > 0) {
  console.log(`\nOPEN QUESTIONS (not failures — awaiting a ruling):\n  ${open.join("\n  ")}`);
  for (const klass of CLASSES) {
    if (klass.open && open.some((line) => line.startsWith(`${klass.name}:`))) {
      console.log(`\n  ${klass.name}: ${klass.open}`);
    }
  }
}
process.exit(failures === 0 ? 0 : 1);
