/**
 * The interpreter (plan §E, Path A).
 *
 * One text call turns a sentence into a `CastingIntent`. It runs before the
 * claim, so it is free to fail, and it is never trusted: the response goes
 * through `parseCastingIntent`, which keeps what is in the allowlist and drops
 * everything else.
 *
 * The system prompt below is the restraint doctrine (catalog H7), and the
 * reason it is written this way is worth stating plainly, because the opposite
 * instruction is the one that failed. M3's interpreter was asked for "one
 * vivid, concrete description" and produced a rich, specific character —
 * complete with a plaid shirt and a captioned mug that every candidate then
 * inherited. Rich output from this stage is not a feature. Legacy learned the
 * same lesson the same way: *"If you fill them with plausible defaults, you
 * constrain the engine and produce a generic Brazilian cast every time. Empty
 * fields become creative opportunities for the engine; wrong fields become
 * user-trust violations."*
 */
import { createModuleLogger } from "../logging/logger";
import { createOpenRouterTextEngine } from "../providers/openrouterText";
import type { TextEngine } from "../providers/types";
import {
  AGE_BANDS,
  ARCHETYPE_KEYS,
  LOOK_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  SEXES,
  parseCastingIntent,
  type CastingIntent,
} from "./castingIntent";

const log = createModuleLogger("castingV2/interpreter");

const SYSTEM_PROMPT = `You read a casting brief and extract only what it actually says about WHO to cast.

Reply with a single JSON object and nothing else:

{
  "cohort": "photoreal_human" | "other",
  "role": string | null,
  "characterNotes": string | null,
  "sex": ${SEXES.map((value) => `"${value}"`).join(" | ")} | null,
  "ageBand": ${AGE_BANDS.map((value) => `"${value}"`).join(" | ")} | null,
  "agePhase": "early" | "mid" | "late" | null,
  "heritage": [{ "heritage": one of ${HERITAGES.join(", ")}, "pct": number }] (0, 1 or 2 entries),
  "build": ${BUILDS.map((value) => `"${value}"`).join(" | ")} | null,
  "energy": ${ENERGY_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "archetype": ${ARCHETYPE_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "variationAxis": "look" | "disposition" | null,
  "look": ${LOOK_KEYS.map((value) => `"${value}"`).join(" | ")} | null
}

THE ONE RULE THAT MATTERS: null means the brief did not say. Leave every field
null unless the brief states it or unmistakably implies it. Do not fill fields
with plausible defaults. A field you guess wrong is a broken promise to the
user; a field you leave null is creative room for the casting engine, which
will vary it across the eight candidates. Under-filling is always the safer
error.

WHAT TO EXTRACT
- "role": the archetype in the user's own words, under 12 words — "a dad in his
  30s", "punk drummer", "wiry cyclist", "corporate lawyer". Keep the specific
  social or cultural archetype. Never replace it with a generic fashion type: if
  the brief would produce the same casting after deleting this phrase, it is not
  specific enough.
- "characterNotes": short character-side detail the brief gave — bearing,
  demeanour, hair, distinguishing features. Under 25 words.
- "sex": only from an explicit word or pronoun. "her", "she", "woman", "guy",
  "man" decide it. Never infer sex from a hairstyle, a colour, or an occupation.
  Never output "nonbinary" unless the brief says so explicitly.
- "ageBand": from a stated age or an age idiom ("in her 20s", "mid-forties" →
  "40s", "late teens" → "teens", "older" → null unless a decade is implied).
- "agePhase": set it ONLY when the brief pins where in the decade. "early 20s"
  → "early"; "mid-forties" → "mid"; "late teens" → "late"; a bare "in her 20s"
  → null. This is a second, separate lock: filling it wrongly narrows the
  casting pool, and leaving it null when the user said "early" lets the sheet
  drift a decade older than they asked for.
- "heritage": only when stated. A nationality maps to the nearest listed
  heritage. Bare "mixed" or "ambiguous" is not a heritage — leave it empty.
  A hyphenated or dual heritage gives TWO entries, not one: "Nigerian-British"
  is West African + British Isles, "Korean-American" is East Asian alone
  unless the brief says more. Dropping half of a stated dual heritage loses a
  fact the user pinned, so return both and let the percentages split.
- "energy": only when the brief describes how the person carries themselves.
- "archetype": only when the brief clearly points at one of the listed
  directions. Otherwise null.
- "variationAxis": what should differ between the eight candidates.
  Use "look" when the brief asks for a KIND OF FACE — a model, editorial,
  fashion, runway, beauty or campaign casting. Eight models differ by the sort
  of face a house casts, not by mood; varying mood there returns one look
  wearing eight expressions.
  Use "disposition" when the brief asks for a KIND OF PERSON — a character, an
  occupation, a UGC creator, anyone you would meet. There, eight different
  temperaments is exactly the right difference.
  Null if you genuinely cannot tell.
- "look": only when the brief names a specific casting look. A stated look
  locks across all eight; leave it null and the eight will each take a
  different one.
- "cohort": "photoreal_human" for any real-looking human. Use "other" for
  anime, illustration, animals, robots, fantasy creatures, or any brief that is
  not a photograph of a person.

WHAT TO IGNORE COMPLETELY — the engine owns these, and anything you say about
them is discarded before it reaches the image model:
- The photograph: camera, lens, lighting, background, crop, pose, composition.
- The setting: locations, rooms, weather, activities, times of day. "In a
  cluttered garage" tells you this person works with their hands; it does not
  put a garage in the picture.
- Wardrobe, props, objects held, accessories, or anything with writing on it.
- Mood words that are not castable ("magnetic", "stunning", "iconic").
- Celebrity likeness. "Looks like Zendaya" gives you sex and maybe age. Stop
  there.

Never invent a detail the brief did not contain. Never write prose outside the
JSON.`;

export type InterpretOutcome =
  | { ok: true; intent: CastingIntent; latencyMs: number; model: string }
  | { ok: false; reason: "unsupported_cohort" }
  | { ok: false; reason: "unavailable"; latencyMs: number };

let engine: TextEngine | null = null;

function interpreterEngine(): TextEngine | null {
  if (engine) return engine;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  engine = createOpenRouterTextEngine({ apiKey });
  return engine;
}

/** Test seam: drops the memoized engine so config changes take effect. */
export function resetInterpreterForTests(): void {
  engine = null;
}

/**
 * Read one brief.
 *
 * Three outcomes, and the difference between the last two is the difference
 * between a product decision and an outage:
 *
 *   - an intent;
 *   - `unsupported_cohort` — a real answer. The brief asks for something no
 *     certified adapter can cast, so the caller refuses for free rather than
 *     producing a photograph of someone vaguely anime-adjacent;
 *   - `unavailable` — the transport failed, or the reply was unreadable. Not
 *     the user's problem and not a reason to lose their roll: the caller falls
 *     back to compiling from the sentence itself. This is the house's
 *     fail-open policy for checkers (catalog H30) — an interpreter outage must
 *     never block a paid run.
 */
export async function interpretBrief(input: {
  briefText: string;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<InterpretOutcome> {
  const textEngine = input.engine ?? interpreterEngine();
  if (!textEngine) {
    log.warn({}, "[interpreter] no OPENROUTER_API_KEY — compiling without interpretation");
    return { ok: false, reason: "unavailable", latencyMs: 0 };
  }

  const startedAt = Date.now();
  try {
    const result = await textEngine.complete({
      system: SYSTEM_PROMPT,
      user: input.briefText,
      json: true,
      // Low, because this is extraction. Creativity belongs downstream, in the
      // adapter's variation axes and in the image model itself.
      temperature: 0.2,
      maxOutputTokens: 500,
      signal: input.signal,
    });

    const parsed = parseCastingIntent(result.text);
    if (!parsed.ok) {
      if (parsed.reason === "unsupported_cohort") return { ok: false, reason: "unsupported_cohort" };
      log.warn(
        { latencyMs: result.latencyMs },
        "[interpreter] reply could not be read as an intent — falling back",
      );
      return { ok: false, reason: "unavailable", latencyMs: result.latencyMs };
    }

    /*
      M3 condition 4 closed. The report could not evaluate §E.1's "+5s median"
      budget because the harness recorded image latency only, and said so:
      "Recording per-call text latency is a one-line harness change for the
      next run." This is that line, in the product rather than the harness, so
      the treatment stage's cost is measurable the day it lands.
    */
    log.info(
      { stage: "interpreter", latencyMs: result.latencyMs, model: result.provenance.servedModel },
      "[interpreter] brief interpreted",
    );

    return {
      ok: true,
      intent: parsed.intent,
      latencyMs: result.latencyMs,
      model: result.provenance.servedModel ?? result.provenance.model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    log.warn({ err: error, latencyMs }, "[interpreter] unavailable — compiling without it");
    return { ok: false, reason: "unavailable", latencyMs };
  }
}

export { SYSTEM_PROMPT as INTERPRETER_SYSTEM_PROMPT };
