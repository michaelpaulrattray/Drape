/**
 * THE READER-ASK COURT — #1123, on his word *"1123) run the court"*.
 *
 * Every roll makes one text call to the brief reader (`interpretBrief`), and
 * that ask names four fields the author road then throws away. The card asks a
 * question nobody may answer by assumption, because this programme has MEASURED
 * that context is not additive — a SUBSET of prompt context once raised the
 * stage wall twice as often as its superset:
 *
 *   **if the ask is TRIMMED of those four, do the KEPT facts change?**
 *
 * Same briefs, the same entrance, the same transport, the same model, the same
 * temperature and the same token ceiling. The arms differ by the bytes of the
 * system prompt and by nothing else.
 *
 * # The four arms, and why there are four rather than two
 *
 *   full     the ask production sends TODAY, composed by the product's own
 *            `interpreterSystemPrompt` and asserted at the wire to be exactly
 *            that. It is also the NEGATIVE CONTROL: three repeats of one ask on
 *            one brief is the run-to-run noise floor every other number is read
 *            against (`carry-noise-floor`: the same recipe twice drifts).
 *   dead3    minus `reads`, `composedDirection`, `poolTendencies` — the three
 *            the #180 ghost audit found dead on the author road and which a
 *            HEAD-dated re-audit confirms have no reader at all.
 *   card4    minus those three AND `variationAxis`, which is the trim the card
 *            proposes. ⚠ `variationAxis` is NOT dead — `promoteStatedRole`
 *            (`heritagePromotion.ts:126`, called on both roads at
 *            `briefCompiler.ts:1268`) turns it into the `role` the brief echo
 *            shows, and `axisTwin` (`briefEcho.ts:316-318`) reads it to decide
 *            which open axis the "left to the roll" sentence omits. Measuring
 *            both trims is what lets the answer be actionable instead of
 *            all-or-nothing.
 *   control  the POSITIVE CONTROL: the full ask minus `sex` AND `heritage`, two
 *            facts the author road keeps and the customer reads back on her own
 *            sheet. An instrument that cannot see THAT removal cannot be
 *            believed when it reports seeing nothing.
 *
 * # What it may not do
 *
 * No credits, no renders, no images, no writes: text calls on the founder's
 * OpenRouter key and a JSON file of results. It refuses to spend without
 * `--run`, and `--dry-run` prints the plan and the cost estimate.
 *
 * # Re-running it
 *
 *   npx tsx scripts/court-reader-ask-1123.mts --dry-run
 *   npx tsx scripts/court-reader-ask-1123.mts --run [--repeats=3] [--arms=full,dead3,card4,control]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import "dotenv/config";

import {
  NOTES_MAX_FIDELITY,
  parseCastingIntent,
  type CastingIntent,
} from "../server/castingV2/castingIntent";
import { GOLDEN_BRIEFS } from "../server/castingV2/goldenBriefs";
import {
  interpretBrief,
  interpreterEngine,
  interpreterSystemPrompt,
} from "../server/castingV2/interpreter";
import type { TextEngine, TextRequest, TextResult } from "../server/providers/types";
import { CARD_FIELDS, CONTROL_FIELDS, DEAD_FIELDS, trimAsk } from "./lib/readerAskTrim.mts";

/* ------------------------------------------------------------------ the ask */

/**
 * The ask production sends today, READ FROM THE COMPOSER rather than quoted.
 *
 * All three scope flags the reader's options hang off stand at `all`
 * (`scripts/lib/productionFlagPositions.mts`: `CASTING_CREATIVE_REGISTER_SCOPE`
 * #201, `CASTING_BRIEF_FIDELITY_SCOPE` #203, `CASTING_BORN_INK_SCOPE` #215, all
 * widened 2026-09-24), and the compiler hands `wardrobe` a literal `false`
 * (`briefCompiler.ts:1136`). So this object IS every account's roll.
 */
const READER_OPTIONS = {
  wardrobe: false,
  ink: true,
  fidelity: true,
  author: true,
  statedWardrobe: true,
} as const;

const PRODUCTION_ASK = interpreterSystemPrompt(READER_OPTIONS);

const ARMS = {
  full: { ask: PRODUCTION_ASK, dropped: [] as readonly string[] },
  dead3: { ask: trimAsk(PRODUCTION_ASK, DEAD_FIELDS), dropped: DEAD_FIELDS },
  card4: { ask: trimAsk(PRODUCTION_ASK, CARD_FIELDS), dropped: CARD_FIELDS },
  control: { ask: trimAsk(PRODUCTION_ASK, CONTROL_FIELDS), dropped: CONTROL_FIELDS },
} as const;

type ArmName = keyof typeof ARMS;
const ALL_ARMS: readonly ArmName[] = ["full", "dead3", "card4", "control"];

/* -------------------------------------------------------------- the fixtures */

type Fixture = {
  id: string;
  brief: string;
  /** Where this sentence came from. Never "made up for the court". */
  provenance: string;
};

/**
 * THE FOUNDER'S OWN BRIEFS, from two records and no invention.
 *
 *   golden-NN   `server/castingV2/goldenBriefs.ts` — "every entry is a brief a
 *               founder actually typed … each one is here because it failed
 *               once, in production, on a real roll".
 *   devroll-NN  `casting_rolls.briefText` on the development database, read
 *               2026-09-26: the long, fact-dense sentences this programme's
 *               own courts have been driven on (the 1,137-character editorial
 *               brief, his 553-character cybernetics brief, the prehistoric
 *               man, the bank manager, the gold-hoop brief).
 *
 * ⚠ **THE PRODUCTION ROLL TABLE WAS THE FIRST CHOICE AND IS NOT IN HERE.** The
 * read was refused by this machine's permission classifier (`[Production
 * Reads]`), so the long tail of his real briefs — roll 219's 1,494 characters
 * among them — is absent and the length distribution is thinner at the top than
 * it should be. That is a stated limit of this court, not a design.
 */
const DEV_ROLL_BRIEFS: readonly Fixture[] = [
  {
    id: "devroll-81",
    provenance: "dev casting_rolls roll 81 (user 1) — 1,137 chars, the longest brief either database holds",
    brief:
      "Editorial fashion portrait of an ethnically ambiguous adult male model, approximately 23–28 years old, with an exceptionally pale, cool-toned complexion and a lean, muscular upper body. He has a long angular face, prominent cheekbones, a sharply defined jawline, straight narrow nose, subtly full lips, and pale blue-grey eyes with an intense, slightly hooded gaze. His eyebrows and eyelashes are extremely light, almost colourless.  His hair is icy platinum-white, tightly braided into neat scalp cornrows, transitioning into multiple long, thin braids that fall around his face and behind his shoulders. Several front braids hang past his chest and end in small loose tassels. The sides of his head are closely shaved. He wears a small dark silver hoop earring.  Bare-chested, displaying extensive black-and-grey ornamental tattoos covering most of his chest, shoulders, upper arms, and lower neck. The tattoos feature dense geometric patterns, circular motifs, intricate linework, and large symmetrical areas of dark ink. Athletic physique with defined collarbones, shoulders, neck tendons, and upper chest, but not bodybuilder-heavy.",
  },
  {
    id: "devroll-92",
    provenance: "dev casting_rolls roll 92 — his 553-char cybernetics brief, the specimen the cohort-wall and budget courts both ran on",
    brief:
      "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone structure: pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense unsmiling expression. Cybernetic augmentation as part of his body: matte-black implant ports embedded in his skull above the right temple, fine metal seams running across his scalp like plate joins, a dark mechanical plate along his jawline, a small black implant stud below each ear, and his right eye glowing faint amber-red. The augmentations are surgically integrated into his skin, not worn.",
  },
  {
    id: "devroll-86",
    provenance: "dev casting_rolls roll 86 — 307 chars, the prehistoric-man brief",
    brief:
      "A powerfully built prehistoric man, late 30s, weathered sun-darkened skin, heavy brow, broad flat nose, deep-set dark eyes, long matted dark hair and a thick unkempt beard, old pale scars across one cheek and across the collarbone. Heavy shoulders and a thick neck. Direct, wary gaze straight into the lens.",
  },
  {
    id: "devroll-87",
    provenance: "dev casting_rolls roll 87 — 179 chars, every fact stated and no category named",
    brief:
      "A woman in her mid thirties, shoulder-length dark brown hair worn loose, warm mid-tone skin, brown eyes, natural brows, relaxed neutral expression, looking straight into the lens.",
  },
  {
    id: "devroll-93",
    provenance: "dev casting_rolls roll 93 — 179 chars, a stated occupation plus greying hair",
    brief:
      "A retail bank manager in his forties, close-cropped greying hair, clean-shaven, lined forehead, brown eyes, a tired but courteous set to the mouth, looking straight into the lens.",
  },
  {
    id: "devroll-83",
    provenance: "dev casting_rolls roll 83 (user 1) — 163 chars, a brief whose facts are ABSENCES (no tattoos, no jewellery)",
    brief:
      "A man in his early thirties with short brown hair, clean-shaven, no tattoos anywhere, no jewellery, a plain grey t-shirt, photographed against a plain studio wall.",
  },
  {
    id: "devroll-55",
    provenance: "dev casting_rolls roll 55 — 49 chars, a stated heritage and nothing else physical",
    brief: "a West African man in his 30s, close-cropped hair",
  },
  {
    id: "devroll-56",
    provenance: "dev casting_rolls roll 56 — 29 chars, a heritage plus a category with a hard pool",
    brief: "an East Asian idol, early 20s",
  },
  {
    id: "devroll-38",
    provenance: "dev casting_rolls roll 38 — 40 chars, a stated heritage with no sex and no hair",
    brief: "a Middle Eastern street casting, mid 20s",
  },
  {
    id: "devroll-65",
    provenance: "dev casting_rolls roll 65 (user 1) — 135 chars, stated accessories and no category",
    brief:
      "A woman in her forties who wears small gold hoop earrings, one at each ear, and no other jewellery, with dark hair worn simply.",
  },
];

const FIXTURES: readonly Fixture[] = [
  ...GOLDEN_BRIEFS.map((golden, index) => ({
    id: `golden-${String(index + 1).padStart(2, "0")}`,
    brief: golden.brief,
    provenance: `goldenBriefs.ts[${index}] — ${golden.because.slice(0, 96)}`,
  })),
  ...DEV_ROLL_BRIEFS,
];

/**
 * THE BRIEFS THE POSITIVE CONTROL RUNS ON — the ones whose sentence states a
 * sex or a heritage, so that removing those two fields has something to lose.
 *
 * Derived from the sentences rather than listed by hand, capped so the control
 * stays cheap, and PROVEN LIVE at analysis time rather than assumed: the reading
 * below refuses to report a control verdict unless the FULL arm actually filled
 * one of the two fields on most of this population. A control whose population
 * is empty — or whose population the full arm answers null on anyway — passes by
 * having nothing to check (`guard-whose-population-is-everyone`'s mirror).
 *
 * ⚠ "ethnically ambiguous" is deliberately NOT a heritage word here: the ask
 * itself says bare "mixed" or "ambiguous" is not a heritage and must be left
 * empty, so a brief saying only that belongs OUT of a population defined by
 * having a heritage to lose.
 */
const CONTROL_WORDS = [
  " man", " male", " woman", " female", " his ", " her ", "she ", "he ",
  "east asian", "west african", "mediterranean", "nordic", "british isles",
  "middle eastern", "south asian", "korean", "nigerian",
];
const CONTROL_LIMIT = 10;
/* Taken on a STRIDE across the matching set rather than off the front: the front
   is all golden briefs, so a `slice` would run the control entirely on the short
   ones and say nothing about the long, fact-dense sentences that are the whole
   worry here. */
const CONTROL_MATCHES = FIXTURES
  .filter((fixture) => CONTROL_WORDS.some((word) => ` ${fixture.brief.toLowerCase()} `.includes(word)));
const CONTROL_STRIDE = Math.max(1, Math.floor(CONTROL_MATCHES.length / CONTROL_LIMIT));
const CONTROL_FIXTURES = CONTROL_MATCHES
  .filter((_, index) => index % CONTROL_STRIDE === 0)
  .slice(0, CONTROL_LIMIT);

/* ------------------------------------------------------------------- pricing */

/**
 * `anthropic/claude-sonnet-5` list price — $2.00 / $10.00 per million tokens
 * in and out (Anthropic first-party rates, which OpenRouter passes through for
 * this model). The ESTIMATE uses them; the SPENT figure uses the token counts
 * the provider itself reported on every call, so the number in the record is
 * measured rather than modelled.
 */
const USD_PER_M_IN = 2.0;
const USD_PER_M_OUT = 10.0;

/** Characters per token, the conservative end for English prose plus JSON. */
const CHARS_PER_TOKEN = 3.4;

/**
 * Assumed reply size for the ESTIMATE only. Sonnet 5 thinks by default and the
 * reader does not turn it off, so an assumption that counts only the JSON would
 * under-price the run — this is the ceiling the plan is quoted at.
 */
const ASSUMED_OUT_TOKENS = 2_400;

/** Entrance calls per run, allowing for the re-asks `interpretBrief` may fire. */
const ASSUMED_CALLS_PER_RUN = 1.4;

/* ----------------------------------------------------------------- the wire */

type CallRecord = {
  arm: ArmName;
  fixtureId: string;
  repeat: number;
  callIndex: number;
  latencyMs: number;
  truncated: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  replyChars: number;
  parsed: boolean;
  parseReason: string | null;
  systemChars: number;
};

/**
 * The arm's engine: the REAL transport with the system prompt swapped for this
 * arm's, recording what came back.
 *
 * ⚠ It asserts at the wire (working law 5) that what the product composed is
 * the ask this court believes production sends. A court measuring a trim of a
 * prompt that is not the live one measures nothing, and the check is one line.
 */
function armEngine(
  real: TextEngine,
  arm: ArmName,
  fixture: Fixture,
  repeat: number,
  sink: CallRecord[],
): TextEngine {
  let callIndex = 0;
  return {
    id: real.id,
    async complete(request: TextRequest): Promise<TextResult> {
      /*
        THE SECOND SYSTEM PROMPT ON THIS ENGINE IS NOT THE READER'S ASK.

        `interpretBrief` also calls `compressCharacterNotes`, which sends its own
        short prompt on the same engine — and the long, fact-dense briefs in this
        corpus are exactly the ones that overflow the notes bound and reach it.
        That call is passed through UNTOUCHED (it is not the ask under test), and
        it is recognised by being short rather than by being anything else: an
        unrecognised LONG prompt means the product's composer changed and no arm
        here can be believed, so it throws.
      */
      if (request.system !== PRODUCTION_ASK) {
        if (request.system.length > 2_000) {
          throw new Error(
            "[court-1123] the product composed a long system prompt this court does not recognise — "
            + `${request.system.length} chars against the expected ${PRODUCTION_ASK.length}. `
            + "Re-read the flag positions before believing any arm.",
          );
        }
        return real.complete(request);
      }
      const system = ARMS[arm].ask;
      const result = await real.complete({ ...request, system });
      callIndex += 1;
      const parsed = parseCastingIntent(result.text, fixture.brief, NOTES_MAX_FIDELITY, { author: true });
      sink.push({
        arm,
        fixtureId: fixture.id,
        repeat,
        callIndex,
        latencyMs: result.latencyMs,
        truncated: result.truncated === true,
        tokensIn: result.tokens?.in ?? null,
        tokensOut: result.tokens?.out ?? null,
        replyChars: result.text.length,
        parsed: parsed.ok,
        parseReason: parsed.ok ? null : parsed.reason,
        systemChars: system.length,
      });
      return result;
    },
  };
}

/* ------------------------------------------------------- the fields compared */

/**
 * WHAT THE AUTHOR ROAD KEEPS, audited at HEAD 2026-09-26 with the read site
 * quoted for each. These are the fields the court's verdict is about; the rest
 * are reported beside them but decide nothing, because nothing reads them.
 */
const KEPT_FIELDS: ReadonlyArray<{ field: string; where: string; read: (intent: CastingIntent) => string }> = [
  { field: "cohort", where: "briefCompiler.ts:1514 → rollService.ts:774 (casting_rolls.cohortKey)", read: (i) => i.cohort },
  { field: "role", where: "rollProjection.ts:311-315 → briefEcho.ts:242 (the \"cast as\" clause)", read: (i) => i.role ?? "" },
  { field: "sex", where: "lockFactsOf → lockContract → briefEcho.ts:126", read: (i) => i.sex ?? "" },
  { field: "ageBand", where: "lockFactsOf → lockContract → briefEcho.ts:126", read: (i) => i.ageBand ?? "" },
  { field: "agePhase", where: "lockFactsOf → rollProjection.ts:255 → briefEcho.ts:126", read: (i) => i.agePhase ?? "" },
  { field: "heritage", where: "lockFactsOf → rollProjection.ts:279-286 → briefEcho.ts:245", read: (i) => i.heritage.map((h) => `${h.heritage}:${h.pct}`).sort().join("+") },
  { field: "build", where: "lockFactsOf → briefEcho.ts:126", read: (i) => i.build ?? "" },
  { field: "energy", where: "lockFactsOf → briefEcho.ts:249-251", read: (i) => i.energy ?? "" },
  { field: "look", where: "lockFactsOf → briefEcho.ts:254-256; statedAnchorFrom briefCompiler.ts:646", read: (i) => i.look ?? "" },
  { field: "variationAxis", where: "heritagePromotion.ts:126 (promoteStatedRole) and briefEcho.ts:316-318 (axisTwin)", read: (i) => i.variationAxis ?? "" },
  { field: "statedAccessories", where: "rollProjection.ts:329-344 → briefEcho.ts:271-280", read: (i) => [...i.statedAccessories].sort().join(" | ") },
  { field: "statedInk", where: "briefCompiler.ts:1525 → rollService.ts:1642-1648 (bornInk rows)", read: (i) => (i.statedInk === null ? "" : JSON.stringify(i.statedInk)) },
  { field: "statedWardrobe", where: "briefCompiler.ts:1545 → casting_rolls.wardrobeLine → the five Cast views", read: (i) => i.statedWardrobe ?? "" },
];

/** Parsed, persisted in `compiledBrief.intent`, and read by nothing on this road. */
const DISCARDED_FIELDS: ReadonlyArray<{ field: string; read: (intent: CastingIntent) => string }> = [
  { field: "characterNotes", read: (i) => i.characterNotes ?? "" },
  { field: "archetype", read: (i) => i.archetype ?? "" },
  { field: "statedHair", read: (i) => JSON.stringify(i.statedHair) },
  { field: "statedSkin", read: (i) => JSON.stringify(i.statedSkin) },
  { field: "reads", read: (i) => String(i.reads.length) },
  { field: "composedDirection", read: (i) => (i.composedDirection === null ? "" : "composed") },
  { field: "poolTendencies", read: (i) => JSON.stringify(i.poolTendencies) },
];

/* ---------------------------------------------------------------- the runner */

type Run = {
  arm: ArmName;
  fixtureId: string;
  repeat: number;
  ok: boolean;
  reason: string | null;
  wallMs: number;
  calls: number;
  values: Record<string, string> | null;
};

const flag = (name: string): string | null => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? null : hit.slice(name.length + 3);
};

const HELP = `court-reader-ask-1123 — does trimming the reader's ask move the facts we keep? (#1123)

  --help                 this
  --dry-run              print the plan, the fixtures and the cost estimate; spend nothing
  --run                  REQUIRED to make a paid text call
  --repeats=N            samples per brief per arm (default 3 — the reader is a coin per call)
  --arms=a,b,c           subset of full,dead3,card4,control (default all four)
  --concurrency=N        in-flight entrance calls (default 4, the reader's own queue width)
  --out=DIR              where the JSON record lands (default court-1123/)
  --limit=N              first N briefs only — for a smoke test before the full run
  --only=id,id           these fixture ids only — for a deep re-read of one finding at high n

Text calls only. No credits, no renders, no images, no database writes.`;

async function pool<T>(items: readonly T[], width: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await work(items[index]!, index);
    }
  });
  await Promise.all(workers);
}

const modal = (values: readonly string[]): string => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
};
const unanimous = (values: readonly string[]): boolean => values.length > 0 && new Set(values).size === 1;
const pct = (part: number, whole: number): string => (whole === 0 ? "n/a" : `${((100 * part) / whole).toFixed(0)}%`);

async function main(): Promise<number> {
  if (process.argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const repeats = Number(flag("repeats") ?? 3);
  const concurrency = Number(flag("concurrency") ?? 4);
  const outDir = flag("out") ?? "court-1123";
  const armNames = (flag("arms")?.split(",") ?? [...ALL_ARMS]) as ArmName[];
  for (const arm of armNames) {
    if (!(arm in ARMS)) throw new Error(`[court-1123] unknown arm "${arm}"`);
  }
  if (CONTROL_FIXTURES.length < 6) {
    throw new Error(
      `[court-1123] the positive control has only ${CONTROL_FIXTURES.length} briefs stating a sex or a heritage `
      + "— too few for its verdict to mean anything",
    );
  }

  /* The plan, and it is the same object the run walks — a dry run that prints a
     different plan from the one that fires is not a dry run. */
  const limit = Number(flag("limit") ?? FIXTURES.length);
  const only = flag("only")?.split(",").map((id) => id.trim()).filter((id) => id.length > 0) ?? null;
  const briefs = only === null
    ? FIXTURES.slice(0, limit)
    : FIXTURES.filter((fixture) => only.includes(fixture.id));
  if (briefs.length === 0) throw new Error(`[court-1123] --only matched no fixture (${only?.join(",")})`);
  const cells: Array<{ arm: ArmName; fixture: Fixture; repeat: number }> = [];
  for (const fixture of briefs) {
    for (const arm of armNames) {
      if (arm === "control" && !CONTROL_FIXTURES.includes(fixture)) continue;
      for (let repeat = 1; repeat <= repeats; repeat += 1) cells.push({ arm, fixture, repeat });
    }
  }

  const estimateIn = cells.reduce(
    (total, cell) => total + (ARMS[cell.arm].ask.length + cell.fixture.brief.length) / CHARS_PER_TOKEN,
    0,
  ) * ASSUMED_CALLS_PER_RUN;
  const estimateOut = cells.length * ASSUMED_CALLS_PER_RUN * ASSUMED_OUT_TOKENS;
  const estimateUsd = (estimateIn / 1e6) * USD_PER_M_IN + (estimateOut / 1e6) * USD_PER_M_OUT;

  console.log("court-reader-ask-1123 — the reader's ask, trimmed of the four fields the author road discards");
  console.log(`  model            anthropic/claude-sonnet-5 (the reader's own, DEFAULT_INTERPRETER_MODEL)`);
  console.log(`  ask (production) ${PRODUCTION_ASK.length} chars`);
  for (const arm of armNames) {
    const ask = ARMS[arm].ask;
    console.log(
      `  arm ${arm.padEnd(8)} ${String(ask.length).padStart(6)} chars `
      + `(${ask.length - PRODUCTION_ASK.length} vs production)`
      + `${ARMS[arm].dropped.length > 0 ? ` — dropped ${ARMS[arm].dropped.join(", ")}` : " — byte-identical to production"}`,
    );
  }
  console.log(`  fixtures         ${FIXTURES.length} briefs (${GOLDEN_BRIEFS.length} golden, ${DEV_ROLL_BRIEFS.length} dev rolls)`);
  console.log(`                   lengths ${Math.min(...FIXTURES.map((f) => f.brief.length))}–${Math.max(...FIXTURES.map((f) => f.brief.length))} chars`);
  console.log(`  control briefs   ${CONTROL_FIXTURES.length} (state a sex or a heritage): ${CONTROL_FIXTURES.map((f) => f.id).join(", ")}`);
  console.log(`  repeats          ${repeats} per brief per arm`);
  console.log(`  entrance runs    ${cells.length}`);
  console.log(`  ESTIMATE         ~${Math.round(estimateIn / 1000)}k in + ~${Math.round(estimateOut / 1000)}k out tokens`);
  console.log(`                   ~$${estimateUsd.toFixed(2)} at $${USD_PER_M_IN}/$${USD_PER_M_OUT} per Mtok, assuming ${ASSUMED_CALLS_PER_RUN} calls/run and ${ASSUMED_OUT_TOKENS} out/call`);
  console.log("  spends           text calls only. No credits, no renders, no images, no writes.");

  if (!process.argv.includes("--run")) {
    console.log("\nDRY RUN — nothing was sent. Add --run to fire the arms.");
    return 0;
  }

  const real = interpreterEngine();
  if (real === null) throw new Error("[court-1123] no OPENROUTER_API_KEY — the reader cannot be driven");

  const calls: CallRecord[] = [];
  const runs: Run[] = [];
  const startedAt = Date.now();
  let done = 0;

  await pool(cells, concurrency, async (cell) => {
    const t0 = Date.now();
    const sink: CallRecord[] = [];
    const engine = armEngine(real, cell.arm, cell.fixture, cell.repeat, sink);
    let run: Run;
    try {
      const outcome = await interpretBrief({ briefText: cell.fixture.brief, engine, ...READER_OPTIONS });
      run = outcome.ok
        ? {
          arm: cell.arm,
          fixtureId: cell.fixture.id,
          repeat: cell.repeat,
          ok: true,
          reason: null,
          wallMs: Date.now() - t0,
          calls: sink.length,
          values: Object.fromEntries([
            ...KEPT_FIELDS.map((spec) => [spec.field, spec.read(outcome.intent)] as const),
            ...DISCARDED_FIELDS.map((spec) => [spec.field, spec.read(outcome.intent)] as const),
            ["subject", outcome.subject],
          ]),
        }
        : {
          arm: cell.arm,
          fixtureId: cell.fixture.id,
          repeat: cell.repeat,
          ok: false,
          reason: outcome.reason === "unavailable" ? `unavailable:${outcome.cause}` : outcome.reason,
          wallMs: Date.now() - t0,
          calls: sink.length,
          values: null,
        };
    } catch (error) {
      run = {
        arm: cell.arm,
        fixtureId: cell.fixture.id,
        repeat: cell.repeat,
        ok: false,
        reason: `threw:${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
        wallMs: Date.now() - t0,
        calls: sink.length,
        values: null,
      };
    }
    calls.push(...sink);
    runs.push(run);
    done += 1;
    if (done % 10 === 0 || done === cells.length) {
      console.log(`  … ${done}/${cells.length} runs, ${calls.length} calls, ${Math.round((Date.now() - startedAt) / 1000)}s`);
    }
  });

  /* ------------------------------------------------------------- the reading */

  const spentIn = calls.reduce((total, call) => total + (call.tokensIn ?? 0), 0);
  const spentOut = calls.reduce((total, call) => total + (call.tokensOut ?? 0), 0);
  const spentUsd = (spentIn / 1e6) * USD_PER_M_IN + (spentOut / 1e6) * USD_PER_M_OUT;
  const unpriced = calls.filter((call) => call.tokensIn === null).length;

  const valuesOf = (arm: ArmName, fixtureId: string, field: string): string[] => runs
    .filter((run) => run.arm === arm && run.fixtureId === fixtureId && run.values !== null)
    .map((run) => run.values![field] ?? "");

  const lines: string[] = [];
  const say = (text: string): void => { console.log(text); lines.push(text); };

  say("");
  say(`SPENT  ${calls.length} calls · ${spentIn} in + ${spentOut} out tokens · $${spentUsd.toFixed(4)}`
    + `${unpriced > 0 ? ` · ${unpriced} calls reported no usage` : ""}`);

  say("");
  say("PER ARM");
  say("  arm      runs  ok  unavail  calls  calls/run  p50 wall  p95 wall  tok in/call  tok out/call  reply chars  truncated  parse fails  $ per run");
  for (const arm of armNames) {
    const armRuns = runs.filter((run) => run.arm === arm);
    const armCalls = calls.filter((call) => call.arm === arm);
    const walls = armRuns.map((run) => run.wallMs).sort((a, b) => a - b);
    const p = (q: number): number => walls[Math.min(walls.length - 1, Math.floor(q * walls.length))] ?? 0;
    const replies = armCalls.map((call) => call.replyChars).sort((a, b) => a - b);
    say(
      `  ${arm.padEnd(8)} ${String(armRuns.length).padStart(4)} `
      + `${String(armRuns.filter((r) => r.ok).length).padStart(3)} `
      + `${String(armRuns.filter((r) => !r.ok).length).padStart(8)} `
      + `${String(armCalls.length).padStart(6)} `
      + `${(armCalls.length / Math.max(1, armRuns.length)).toFixed(2).padStart(10)} `
      + `${`${Math.round(p(0.5) / 100) / 10}s`.padStart(9)} `
      + `${`${Math.round(p(0.95) / 100) / 10}s`.padStart(9)} `
      + `${String(Math.round(armCalls.reduce((t, c) => t + (c.tokensIn ?? 0), 0) / Math.max(1, armCalls.length))).padStart(12)} `
      + `${String(Math.round(armCalls.reduce((t, c) => t + (c.tokensOut ?? 0), 0) / Math.max(1, armCalls.length))).padStart(13)} `
      + `${String(replies[Math.floor(replies.length / 2)] ?? 0).padStart(12)} `
      + `${String(armCalls.filter((c) => c.truncated).length).padStart(10)} `
      + `${String(armCalls.filter((c) => !c.parsed).length).padStart(12)} `
      + `${(((armCalls.reduce((t, c) => t + (c.tokensIn ?? 0), 0) / 1e6) * USD_PER_M_IN
        + (armCalls.reduce((t, c) => t + (c.tokensOut ?? 0), 0) / 1e6) * USD_PER_M_OUT)
        / Math.max(1, armRuns.length)).toFixed(5).padStart(9)}`,
    );
  }

  const comparable = briefs.map((f) => f.id);
  say("");
  say("KEPT FIELDS — within-arm unanimity (the noise floor) and agreement with the full arm's modal value");
  say("  field                 full/full  dead3 unan  dead3 agree  card4 unan  card4 agree  control agree");
  const fieldTable: Array<Record<string, string | number>> = [];
  for (const spec of KEPT_FIELDS) {
    const row: Record<string, string | number> = { field: spec.field, where: spec.where };
    const fullUnan = comparable.filter((id) => unanimous(valuesOf("full", id, spec.field))).length;
    row.fullUnanimous = `${fullUnan}/${comparable.length}`;
    const cells2: string[] = [`${pct(fullUnan, comparable.length)}`.padStart(9)];
    for (const arm of ["dead3", "card4"] as const) {
      if (!armNames.includes(arm)) { cells2.push("—".padStart(11), "—".padStart(12)); continue; }
      const unan = comparable.filter((id) => unanimous(valuesOf(arm, id, spec.field))).length;
      const agree = comparable.filter((id) => modal(valuesOf(arm, id, spec.field)) === modal(valuesOf("full", id, spec.field))).length;
      row[`${arm}Unanimous`] = `${unan}/${comparable.length}`;
      row[`${arm}Agree`] = `${agree}/${comparable.length}`;
      cells2.push(pct(unan, comparable.length).padStart(11), `${agree}/${comparable.length}`.padStart(12));
    }
    if (armNames.includes("control")) {
      const ids = CONTROL_FIXTURES.map((f) => f.id).filter((id) => comparable.includes(id));
      const agree = ids.filter((id) => modal(valuesOf("control", id, spec.field)) === modal(valuesOf("full", id, spec.field))).length;
      row.controlAgree = `${agree}/${ids.length}`;
      cells2.push(`${agree}/${ids.length}`.padStart(13));
    }
    say(`  ${spec.field.padEnd(20)} ${cells2.join(" ")}`);
    fieldTable.push(row);
  }

  say("");
  say("STATED FACTS LOST OR GAINED — a fact is STATED when any repeat of any arm returned it.");
  say("  COLLATERAL is the number that decides this court: a field the arm still ASKS FOR that came back");
  say("  empty where the full ask filled it. A loss in a field the arm REMOVED is by construction.");
  const losses: Array<Record<string, string>> = [];
  for (const arm of armNames) {
    const ids = (arm === "control" ? CONTROL_FIXTURES.map((f) => f.id) : comparable)
      .filter((id) => comparable.includes(id));
    let lost = 0;
    let gained = 0;
    let collateral = 0;
    /* Widened once: the four arms' `dropped` tuples have different literal
       element types, so `ARMS[arm].dropped` narrows `.includes`'s parameter to
       `never` across the union. */
    const dropped: readonly string[] = ARMS[arm].dropped;
    for (const spec of KEPT_FIELDS) {
      const byConstruction = dropped.includes(spec.field);
      for (const id of ids) {
        const anywhere = armNames.flatMap((other) => valuesOf(other, id, spec.field));
        if (!anywhere.some((value) => value !== "")) continue;
        const here = modal(valuesOf(arm, id, spec.field));
        const there = modal(valuesOf("full", id, spec.field));
        if (arm === "full") continue;
        if (here === "" && there !== "") {
          lost += 1;
          if (!byConstruction) collateral += 1;
          losses.push({ arm, field: spec.field, brief: id, full: there, trimmed: "(null)", kind: byConstruction ? "by-construction" : "COLLATERAL" });
        }
        if (here !== "" && there === "") {
          gained += 1;
          if (!byConstruction) collateral += 1;
          losses.push({ arm, field: spec.field, brief: id, full: "(null)", trimmed: here, kind: byConstruction ? "by-construction" : "COLLATERAL" });
        }
      }
    }
    if (arm !== "full") {
      say(
        `  ${arm.padEnd(8)} COLLATERAL ${collateral} · lost ${lost}, gained ${gained} `
        + `(against the full arm's modal answer, ${ids.length} briefs x ${KEPT_FIELDS.length} fields; `
        + `${dropped.filter((f) => KEPT_FIELDS.some((s2) => s2.field === f)).length} of those fields this arm removed)`,
      );
    }
  }
  for (const row of losses) {
    say(`    ${row.arm.padEnd(8)} ${(row.kind ?? "").padEnd(15)} ${row.field.padEnd(18)} ${row.brief.padEnd(12)} full=${row.full.slice(0, 40)} trimmed=${row.trimmed.slice(0, 40)}`);
  }

  say("");
  if (armNames.includes("control")) {
    /*
      THE CONTROL IS READ BEFORE ANY VERDICT, and its population is proven live
      rather than assumed: the full arm must actually have filled `sex` or
      `heritage` on these briefs, or "the control showed a difference" would be
      a statement about briefs that had nothing to lose.
    */
    const ids = CONTROL_FIXTURES.map((f) => f.id).filter((id) => comparable.includes(id));
    if (ids.length === 0) {
      say("POSITIVE CONTROL — no control brief was in this run's brief set; no control verdict");
    } else {
    const liveSex = ids.filter((id) => modal(valuesOf("full", id, "sex")) !== "").length;
    const liveHeritage = ids.filter((id) => modal(valuesOf("full", id, "heritage")) !== "").length;
    const zeroedSex = ids.filter((id) => modal(valuesOf("full", id, "sex")) !== "" && modal(valuesOf("control", id, "sex")) === "").length;
    const zeroedHeritage = ids.filter((id) => modal(valuesOf("full", id, "heritage")) !== "" && modal(valuesOf("control", id, "heritage")) === "").length;
    say("POSITIVE CONTROL — the full ask minus sex and heritage");
    say(`  population       ${ids.length} briefs: ${ids.join(", ")}`);
    say(`  live in full     sex ${liveSex}/${ids.length}, heritage ${liveHeritage}/${ids.length}`);
    say(`  lost in control  sex ${zeroedSex}/${liveSex}, heritage ${zeroedHeritage}/${liveHeritage}`);
    const verdict = liveSex + liveHeritage === 0
      ? "INERT — the full arm filled neither field on this population, so the control checks nothing"
      : (zeroedSex + zeroedHeritage) >= Math.ceil(0.8 * (liveSex + liveHeritage))
        ? "PASSES — removing two kept fields from the ask is visible to this instrument"
        : "FAILS — a removal of two kept fields was NOT visible, so no null result below may be believed";
    say(`  verdict          ${verdict}`);
    }
  }

  say("");
  say("PARSED-BUT-DISCARDED FIELDS — reported, decide nothing (no author-road reader)");
  say("  field                 full unan   dead3 agree  card4 agree");
  for (const spec of DISCARDED_FIELDS) {
    const fullUnan = comparable.filter((id) => unanimous(valuesOf("full", id, spec.field))).length;
    const cells3 = (["dead3", "card4"] as const).map((arm) => {
      if (!armNames.includes(arm)) return "—".padStart(12);
      const agree = comparable.filter((id) => modal(valuesOf(arm, id, spec.field)) === modal(valuesOf("full", id, spec.field))).length;
      return `${agree}/${comparable.length}`.padStart(12);
    });
    say(`  ${spec.field.padEnd(20)} ${pct(fullUnan, comparable.length).padStart(9)} ${cells3.join(" ")}`);
  }

  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const record = {
    card: 1123,
    ranAt: new Date().toISOString(),
    model: "anthropic/claude-sonnet-5",
    readerOptions: READER_OPTIONS,
    productionAskChars: PRODUCTION_ASK.length,
    arms: Object.fromEntries(armNames.map((arm) => [arm, { chars: ARMS[arm].ask.length, dropped: ARMS[arm].dropped }])),
    repeats,
    fixtures: FIXTURES.map((f) => ({ id: f.id, chars: f.brief.length, provenance: f.provenance, brief: f.brief })),
    controlFixtures: CONTROL_FIXTURES.map((f) => f.id),
    spend: { calls: calls.length, tokensIn: spentIn, tokensOut: spentOut, usd: spentUsd, unpricedCalls: unpriced },
    keptFieldTable: fieldTable,
    statedFactMoves: losses,
    runs,
    calls,
    summary: lines,
  };
  const file = path.join(outDir, `reader-ask-court-${stamp}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
  console.log(`\nrecord ${file}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
