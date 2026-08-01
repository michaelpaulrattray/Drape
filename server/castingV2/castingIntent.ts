/**
 * The CastingIntent: what a sentence means, in a shape code can reason about.
 *
 * This module exists because of one measured defect. In M3's A/B the
 * interpreter was asked for "one vivid, concrete description" and obliged —
 * inventing a plaid shirt and a mug captioned *"World's Okayest Handyman"*.
 * Every candidate inherited both, and the mug's text overrode the framing
 * block's "no text, no logos" rule. Free prose from a language model was being
 * concatenated into an image prompt, so whatever it said outranked whatever we
 * said (M3 report §4.2).
 *
 * The fix is structural, not a better prompt:
 *
 *   1. The interpreter returns **this type**, not prose. Identity facts are
 *      closed vocabularies — an enum cannot smuggle a mug.
 *   2. The two free-text fields are capped, labelled, and carry the character,
 *      never the photograph. They are the honest weak point, and the guarantee
 *      that covers them is positional: the cohort's framing block is appended
 *      *last*, with explicit override authority over anything above it.
 *   3. Anything the model returns that is not in the allowlist is dropped —
 *      not warned about, not passed through.
 *
 * WHAT THIS IS NOT. It is not a security boundary. A hostile brief sabotages
 * the author's own paid roll and nobody else's; there is no other user's data
 * on the other side of it. This is a quality control, and it is built to the
 * standard a quality control deserves rather than the standard an auth check
 * would.
 *
 * Craft consulted (plan §I craft-reference law, obligatory for
 * compiler-touching milestones): H7 restraint doctrine, H10 nationality
 * mapping, H11 gender inference, H12 age idioms, H13 vibe ceiling, H14
 * critical don'ts, H15 precedence, H16 allowlist + clamps, H17 engine's-choice
 * sentinels, D14 weighted randomizer, C5 signal priority, C6 archetype
 * fidelity. Adoption is per-item judgment; what was taken and why is noted at
 * each site.
 */

import {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
  HAIR_COLOURS,
  HAIR_FAMILIES,
  VARIATION_AXES,
  type AgeBand,
  type AgePhase,
  type Build,
  type EnergyKey,
  type Heritage,
  type LookKey,
  type Hair,
  type HairColour,
  type HairFamily,
  type Sex,
  type VariationAxis,
} from "../../shared/castingVocabularies";
import type { RealizedAxes, SkinFinish } from "../../shared/castingRealization";
export type { RealizedAxes };

/*
  Re-exported so every existing import of these from `castingIntent` keeps
  working. The values themselves now live in `shared/` because the brief echo's
  popover offers them to the user: a hand-copied client list had already drifted
  three values before anyone picked one.
*/
export {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  HAIR_COLOURS,
  HAIR_FAMILIES,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
  VARIATION_AXES,
};
export type {
  AgeBand,
  AgePhase,
  Build,
  EnergyKey,
  Hair,
  HairColour,
  HairFamily,
  Heritage,
  LookKey,
  Sex,
  VariationAxis,
};

import { z } from "zod";
import {
  FACIAL_HAIR_LEANS,
  NO_TENDENCIES,
  type FacialHairLean,
  type PoolTendencies,
} from "./poolTendencies";
export { FACIAL_HAIR_LEANS, NO_TENDENCIES };
export type { FacialHairLean, PoolTendencies };
import { mentionsGarments, scrubBrands } from "./brandScrub";

/* ------------------------------------------------------------ vocabularies */

/**
 * Age as a band, never a number. Legacy's H12 mapped idioms onto exact ages
 * ("Mid-forties" → 45), which reads as precision the brief never had. A band
 * is what "in her 20s" actually says, and the adapter varies *within* it so
 * eight candidates are not eight thirty-year-olds.
 */

/**
 * Where in the decade — and it is a separate lock from the band.
 *
 * "Early 20s" says two things, and the first version of this only heard one:
 * the band was captured and the phase was thrown away, so the adapter then
 * re-rolled early/mid/late across the eight and the founder's "early 20s"
 * came back reading 28–35. A stated fact that the compiler re-randomises is a
 * lock violation, not a variation axis.
 *
 * Null still means the brief only named the decade, in which case the phase is
 * genuine latitude — "in her 30s" should not all be 31.
 */

/**
 * H11, kept whole: nothing infers non-binary, an explicit word always wins,
 * and absence is absence. The interpreter is told the same in prose; this list
 * is what makes it true regardless.
 */

/**
 * Heritage, ported from the legacy blend system as the founder ruling requires
 * (plan line 209) — including Mediterranean, which exists because
 * Italian/Spanish/Greek briefs had nowhere else to land (H10). Structured, so
 * it can be locked when stated and *varied* when it isn't.
 *
 * **Extended 2026-08-01 (founder ruling).** The ported ten had no value that
 * "British" could map to, so a brief saying "Nigerian-British" silently lost
 * half of what the user asked for. The founder's call: hyphenated and dual
 * heritage is exactly what real briefs contain, and heritage-blend is named
 * ported craft — dropping half a stated heritage is a lock violation, not a
 * vocabulary gap. Two values close the gap for the British Isles and Northern
 * Europe, which the legacy list covered only via "Nordic" and "Slavic".
 *
 * The blend machinery already carried two components; what was missing was
 * somewhere for the second one to land.
 */


/**
 * Presence — how this person occupies the frame. Stated energy locks across
 * the sheet; unstated energy is a prime variation axis (plan line 205).
 *
 * These are written as castable direction rather than mood words, because the
 * image model is literal (A14): "still, composed, minimal movement" renders,
 * "enigmatic" does not.
 *
 * **Presence, never performance** (founder ruling at the M5 gate, 2026-07-31).
 * Each axis names what the face DOES AT REST — eyes, brow, jaw, the set of a
 * closed mouth — because an energy written as behaviour ("bright and quick",
 * "fast talker") is read by the image model as an instruction to act it out,
 * and a sheet of eight people mid-laugh is a sheet you cannot cast from. The
 * adapter's expression clause enforces the same rule from the other side.
 */
export const ENERGIES = {
  warm: "warm and unhurried — soft engaged eyes, relaxed brow, the corners of a closed mouth just lifted. Genuinely friendly, not posed",
  dry: "dry and deadpan — level brow, unimpressed but switched on. Clearly thinking, not empty",
  bright: "bright and awake — lively direct eyes, brow slightly raised, an amused closed-mouth lightness",
  grave: "still and serious — steady, intelligent gaze, composed. Grounded, never sullen",
  open: "open and unguarded — soft warm eyes, an easy closed-mouth half-smile, nothing held back",
  guarded: "watchful and self-possessed — reading the room, alert, chin fractionally lowered",
  wry: "wry — one brow marginally higher, a knowing asymmetry at a closed mouth, quietly entertained",
  plain: "plain and direct — unperformed and straight to the lens, present and unbothered",
} as const;
/*
  Pinned to the shared list rather than derived loosely: `ENERGIES` holds the
  prose (which stays server-side, it is prompt craft) while the shared module
  holds the keys the client offers. Typing the object as Record<EnergyKey, …>
  means adding an energy in one place and not the other fails the build.
*/

/**
 * LOOKS — the casting-house shelf, and the variation axis for model briefs.
 *
 * The eight fixed reads the sheet used to caption ("Warm, unhurried", "Dry and
 * flat") were the prototype's placeholder captions, never a ruling — and for a
 * modelling brief they vary the wrong thing entirely. Eight editorial models
 * do not differ by mood; they differ by the *kind of face* a house casts.
 * Varying disposition there produces one look wearing eight expressions.
 *
 * This is legacy's `BRAND_PROFILES` finished properly (catalog C1 + C3): each
 * entry pairs a casting thesis with its anti-pattern — the anti-pattern is
 * what stops every entry converging — and a quiet expression whisper, because
 * legacy kept those separate on purpose. The descriptor is dramatic prose for
 * *who to cast*; the whisper is what the face actually does in the frame.
 *
 * **Descriptive names, never house names.** The archetype ruling is explicit
 * that real brand names stay internal vocabulary, and these keys are projected
 * — a `personaLine` is client-visible. The lineage is recorded in comments
 * where it is useful to a reader and nowhere the customer can see.
 */
export const LOOKS = {
  "commanding glamour": {
    thesis:
      "Classically gorgeous and symmetrical. Unapologetic supermodel beauty — strong bones, striking proportions, nothing apologetic about it.",
    avoid: "Do not render as soft or girl-next-door.",
    whisper: "Chin fractionally lifted, eyes locked on the lens with full confidence.",
  },
  "severe minimal": {
    thesis:
      "Intellectual and precise. Sharp, expensive-looking bone structure where the severity reads refined rather than brutal.",
    avoid: "Do not render as warm, cute or approachable.",
    whisper: "Flat, unreadable gaze. Cool and measured, no warmth.",
  },
  "off-kilter charm": {
    thesis:
      "Interesting asymmetry and unusual proportions. Personality over perfection — a face with something that makes you look twice. Pick two or three features and make them bold and specific; let the rest be natural.",
    avoid: "Do not default to severe or angular, and do not render as conventionally perfect.",
    whisper: "Deadpan and quietly observing, unbothered. Calm, still, intelligent eyes.",
  },
  "angular and unslept": {
    thesis:
      "Gaunt, angular and effortlessly cool. Bones that suggest late nights — sharp, slightly wasted, zero effort.",
    avoid: "Do not render as healthy-glowing or gym-fit.",
    whisper: "Heavy-lidded and bored, sleepy-eyed. Post-party calm.",
  },
  "raw street-cast": {
    thesis:
      "Brutally honest and unconventional. Bone structure pushed toward the extreme; found rather than groomed.",
    avoid: "Do not render as polished, and do not render as a costume of a subculture.",
    whisper: "Blank and confrontational, direct at the lens. No performance.",
  },
  "clean commercial": {
    thesis:
      "Attractive and balanced without extremes. Immediately likeable, versatile, the face a brand can put anywhere.",
    avoid: "Do not render as bland — pick two features and make them specific.",
    whisper: "Approachable and relaxed, a natural pleasant gaze. Friendly without being eager.",
  },
  "quiet luxury": {
    thesis:
      "Understated, expensive-looking structure. Groomed but not styled — money that does not need to announce itself.",
    avoid: "Do not render as glossy, tanned or overtly glamorous.",
    whisper: "Steady and self-assured, lips together and relaxed.",
  },
  "authentic creator": {
    thesis:
      "Natural and unmanufactured. Attractive but trustworthy rather than extreme — real skin texture and character welcome.",
    avoid: "Do not render as an agency model dressed down.",
    whisper: "Warm and genuine, eyes that connect directly.",
  },
} as const;

/**
 * Which axis the eight candidates differ along.
 *
 * `look` for casting categories where the job is a *type of face* — models,
 * editorial, beauty, runway. `disposition` for character and UGC briefs, where
 * the eight are different people and mood is exactly the right difference.
 * The interpreter picks; both are correct, for different briefs.
 */

/**
 * Direction archetypes — the shelf (plan line 211, archetype-library ruling).
 *
 * Descriptive names, never real houses: the ruling is explicit that brand
 * names stay internal vocabulary and should migrate to descriptive ones as the
 * adapter is built, so this shelf starts where legacy was told to end up. Each
 * entry is a casting thesis plus its anti-pattern, in the C1 style — the
 * anti-pattern is what stops every entry converging on the same face.
 */
/**
 * The archetype shelf.
 *
 * Each entry owns the sheet's skin FINISH as well as its casting thesis — the
 * A9 re-homing. A casting call is one lighting setup, so the finish is chosen
 * once per roll rather than per candidate, and the archetype is the only thing
 * in the pipeline that knows what kind of room this sheet is being shot in.
 * A commercial sheet is dewy; a raw editorial one is matte. The person-level
 * clause in CAPTURE keeps modulating on top of it, so eight candidates still
 * do not share one skin.
 */
export const ARCHETYPES = {
  "quiet luxury": {
    thesis:
      "Understated, expensive-looking bone structure. Groomed but not styled. Reads as money that does not need to announce itself.",
    avoid: "Do not render as glossy, tanned or overtly glamorous.",
    finish: "natural",
  },
  "raw editorial": {
    thesis:
      "Unusual, memorable features pushed past average — a strong nose, wide-set eyes, an asymmetric jaw. Interesting before it is pretty.",
    avoid: "Do not default to gaunt or alien. Distinctive, not damaged.",
    finish: "matte",
  },
  "everyday real": {
    thesis:
      "A person you would actually meet. Ordinary proportions, real skin, nothing corrected. The face of someone with a job.",
    avoid: "Do not render as a model with dressed-down styling.",
    finish: "natural",
  },
  "clean commercial": {
    thesis:
      "Warm, open, immediately likeable. Symmetric enough to read friendly, specific enough to read human.",
    avoid: "Do not render as bland or generically pretty — pick two features and make them specific.",
    finish: "dewy",
  },
  "street cast": {
    thesis:
      "Found on a pavement, not in an agency. Idiosyncratic hair, real posture, unpolished confidence.",
    avoid: "Do not render as a costume version of a subculture.",
    finish: "natural",
  },
  "athletic build": {
    thesis:
      "Physicality visible in the neck, traps and shoulders. Low body fat reads in the face — defined jaw, lean cheeks.",
    avoid: "Do not render as a bodybuilder unless the brief asks for one.",
    finish: "oily",
  },
  "screen presence": {
    thesis:
      "The face holds attention while doing nothing. Strong eyes, still features, the stillness of someone used to a lens.",
    avoid: "Do not render as posed or acted.",
    finish: "luminous",
  },
} as const satisfies Record<string, { thesis: string; avoid: string; finish: SkinFinish }>;
export type ArchetypeKey = keyof typeof ARCHETYPES;
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES) as ArchetypeKey[];

/** The only cohort M5 compiles. Anything else is refused, not approximated. */
export const SUPPORTED_COHORTS = ["photoreal_human"] as const;
export type CohortKey = (typeof SUPPORTED_COHORTS)[number];

/* ------------------------------------------------------------ the intent */

export type HeritageComponent = { heritage: Heritage; pct: number };

/**
 * One brief, understood.
 *
 * **Null means the brief did not say**, and that is the load-bearing
 * convention this whole design rests on (H7). A null field is not a gap to be
 * filled with a plausible default — it is creative latitude the adapter turns
 * into variation between candidates. Legacy states the consequence better than
 * a comment can: *"Empty fields become creative opportunities for the engine;
 * wrong fields become user-trust violations."*
 *
 * Everything non-null is therefore, by construction, something the user said —
 * which is what makes `lockFactsOf` below a derivation rather than a guess.
 */
export type CastingIntent = {
  cohort: CohortKey;
  /**
   * The archetype in the user's own terms — "a dad in his 30s", "punk
   * drummer", "wiry cyclist". C6's fidelity gate is why this survives at all:
   * a named social archetype may never be replaced by a generic type, and if
   * the sheet would look the same with this phrase deleted, it was not
   * specific enough.
   */
  role: string | null;
  /** Character-side detail only. Never the photograph, never the scene. */
  characterNotes: string | null;
  sex: Sex | null;
  ageBand: AgeBand | null;
  /** Stated phase within the decade. Locked when present, varied when null. */
  agePhase: AgePhase | null;
  heritage: HeritageComponent[];
  build: Build | null;
  energy: EnergyKey | null;
  archetype: ArchetypeKey | null;
  /**
   * Which axis the eight differ along. Null lets the adapter decide from
   * whether a casting category was named at all.
   */
  variationAxis: VariationAxis | null;
  /** A stated look locks across the sheet, per the archetype law. */
  look: LookKey | null;
  /**
   * Eight short reads in the brief's own register, for the tile captions.
   *
   * The fixed eight ("Warm, unhurried", "Dry and flat") were recycled onto
   * every disposition sheet regardless of who was being cast, which reads as
   * boilerplate the moment you see them twice. These are display-only: they
   * caption a tile and never enter a prompt, so the worst a bad one can do is
   * be a dull label — the energy DIRECTION driving the image stays code-owned.
   */
  reads: string[];
  /**
   * A casting direction composed for an aesthetic reference no shelf entry
   * fits — the C7 descendant. Null whenever `archetype` covers it, because a
   * reviewed constant outranks generated prose.
   *
   * In the ARCHETYPE GRAMMAR rather than free text, so the anti-pattern is a
   * required field rather than something the model may omit, and so it has an
   * obvious slot in the prompt beside the shelf entry it stands in for.
   */
  composedDirection: ComposedDirection | null;
  /**
   * WHAT the brief said about each part of hair. Never WHETHER — that is the
   * code-owned gate's job (D-89). See `StatedHair`.
   */
  statedHair: StatedHair;
  /**
   * What the CATEGORY implies about axes the brief never stated.
   *
   * Soft: these re-weight the draw and never lock it, so they can never beat a
   * stated fact and never make a value impossible. See `poolTendencies.ts`.
   */
  poolTendencies: PoolTendencies;
};

/** The same shape an  entry uses, and reviewed the same way. */
export type ComposedDirection = { thesis: string; avoid: string };

/**
 * WHAT the brief said about each part of hair — D-79's re-ship (D-89).
 *
 * The interpreter fills this; it does **not** decide whether a part was spoken.
 * That is `spokenHairParts`, a code-owned gate over the user's own sentence,
 * and the split is the whole safety argument: a null here degrades to
 * suppression, never to authoring, so the worst possible interpreter output
 * reproduces today's shipped behaviour instead of the D-79 contradiction.
 *
 * Free strings rather than closed vocabularies, deliberately — "pastel pink" is
 * in no enum, and forcing it into one would lose the user's own words, which is
 * the point of the feature. Containment comes from a closed SOURCE instead: see
 * `tokensComeFromBrief`. The model may only echo words the user typed.
 *
 * `greying` is a boolean the code acts on rather than a value it splices, and
 * that is not a detail — it is the one path that survived the D-79 rollback.
 * "Silver at the temples" says something is happening TO the hair while the
 * colour underneath is still open, so it constrains the base rather than
 * claiming it.
 */
export type StatedHair = {
  cutLength: string | null;
  colour: string | null;
  texture: string | null;
  greying: boolean;
};

export const STATED_HAIR_MAX = 40;

export const EMPTY_STATED_HAIR: StatedHair = {
  cutLength: null,
  colour: null,
  texture: null,
  greying: false,
};

export const COMPOSED_THESIS_MAX = 200;
export const COMPOSED_AVOID_MAX = 120;

export const ROLE_MAX = 80;
export const NOTES_MAX = 180;

/* --------------------------------------------------------------- scrubbing */

/**
 * Strip quoted spans from free text.
 *
 * Narrow on purpose. A general blocklist over prose is theatre — "a barista
 * mid-shift" legitimately describes a person and smuggles a café, and no word
 * list separates those. Quoted text is different: it is the single highest-cost
 * leak (the image model renders it as *letters in the picture*, which is the
 * one thing the framing block forbids outright) and it is a precise signal
 * with almost no legitimate use in a character description.
 *
 * This reduces leakage. It does not guarantee absence, and the guarantee that
 * does the real work is positional — see `composeCandidatePrompt`.
 */
export function stripQuotedSpans(value: string): string {
  return (
    value
      // Double quotes only, straight or curly. An apostrophe is not a quote
      // mark: treating it as one turned `a mug reading "World's Okayest
      // Handyman"` into `a mug reading s Okayest Handyman"` — the caption
      // survived and the scrub read as working. Possessives are ordinary
      // English and this must not touch them.
      .replace(/["“”][^"“”]{1,80}["“”]/g, " ")
      // A single-quoted span only counts when the quotes stand alone, which is
      // what separates 'quoted text' from someone's apostrophe.
      .replace(/(^|\s)['‘][^'’]{1,80}['’](?=\s|$|[.,;:!?])/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function cleanFreeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const scrubbed = stripQuotedSpans(value).slice(0, max).trim();
  return scrubbed.length > 0 ? scrubbed : null;
}

/* ---------------------------------------------------------------- parsing */

/**
 * The wire schema.
 *
 * Deliberately permissive about *shape* and ruthless about *content*: models
 * return `"none"`, `""` and `null` interchangeably for absence, and a schema
 * that rejects the whole payload over one such field would fail a roll that a
 * single coercion saves. Unknown keys are stripped rather than refused for the
 * same reason — a hallucinated `wardrobe` field must not reach the prompt, but
 * it also must not cost the user their sheet.
 */
const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (typeof value !== "string") return null;
      const match = values.find((option) => option.toLowerCase() === value.trim().toLowerCase());
      return (match as T[number] | undefined) ?? null;
    });

const wireSchema = z.object({
  cohort: z.string().nullable().optional(),
  role: z.unknown().nullable().optional(),
  characterNotes: z.unknown().nullable().optional(),
  sex: nullableEnum(SEXES),
  ageBand: nullableEnum(AGE_BANDS),
  agePhase: nullableEnum(AGE_PHASES),
  build: nullableEnum(BUILDS),
  energy: nullableEnum(ENERGY_KEYS as unknown as readonly [string, ...string[]]),
  archetype: nullableEnum(ARCHETYPE_KEYS as unknown as readonly [string, ...string[]]),
  variationAxis: nullableEnum(VARIATION_AXES),
  look: nullableEnum(LOOK_KEYS as unknown as readonly [string, ...string[]]),
  reads: z.array(z.unknown()).nullable().optional(),
  composedDirection: z.unknown().nullable().optional(),
  statedHair: z.unknown().nullable().optional(),
  poolTendencies: z.unknown().nullable().optional(),
  /*
    `.nullable()` matters as much as `.optional()` here, and the difference
    cost a founder 160 credits. Models return `null` and `undefined`
    interchangeably for "nothing"; a bare `.optional()` rejects `null`, which
    fails the WHOLE parse — so a reply that had correctly identified an
    uncertified cohort was discarded on a technicality, and the fallback then
    cast the brief as a photoreal human and charged for it.

    Nothing in this schema may reject a null. The whole design is that unknown
    fields are dropped and known fields are coerced — never that one awkward
    value throws the reply away.
  */
  heritage: z
    .array(
      z.object({
        heritage: z.string(),
        pct: z.union([z.number(), z.string()]).optional(),
      }),
    )
    .nullable()
    .optional(),
});

/**
 * Heritage blend: at most two components, percentages clamped and normalized.
 *
 * The two-component cap is legacy's (the engine could not hold more than two
 * coherently, and neither can this one). Normalization matters because a model
 * asked for percentages will happily return 60/60.
 */
function parseHeritage(raw: unknown): HeritageComponent[] {
  if (!Array.isArray(raw)) return [];
  const components: HeritageComponent[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { heritage?: unknown }).heritage;
    if (typeof name !== "string") continue;
    const match = HERITAGES.find((option) => option.toLowerCase() === name.trim().toLowerCase());
    if (!match) continue;
    if (components.some((component) => component.heritage === match)) continue;
    const rawPct = Number((entry as { pct?: unknown }).pct);
    components.push({
      heritage: match,
      pct: Number.isFinite(rawPct) ? Math.min(100, Math.max(0, Math.round(rawPct))) : 100,
    });
    if (components.length === 2) break;
  }
  if (components.length === 0) return [];
  if (components.length === 1) return [{ ...components[0], pct: 100 }];

  const total = components[0].pct + components[1].pct;
  if (total <= 0) return components.map((component) => ({ ...component, pct: 50 }));
  const first = Math.round((components[0].pct / total) * 100);
  return [
    { ...components[0], pct: first },
    { ...components[1], pct: 100 - first },
  ];
}

/**
 * Read labels: short, plain, and capped.
 *
 * Display-only, so validation is about keeping them terse and free of the
 * things a label should never carry — quotes that could look like copy, and
 * runaway length that would break a caption row.
 */
const READ_MAX = 26;

function parseReads(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const reads: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const clean = stripQuotedSpans(entry).replace(/\s+/g, " ").trim().slice(0, READ_MAX);
    if (clean) reads.push(clean);
    if (reads.length === 8) break;
  }
  return reads;
}

/**
 * The composed direction, contained the way every other free field here is.
 *
 * Four ways it can be dropped, and dropping is always the answer — a rejected
 * direction falls back to shelf behaviour and the roll still runs. Never patch
 * a language model's output with code; never fail a paid roll over it.
 *
 *   1. Not the right shape at all.
 *   2. A garment word in either half. The frame is a plain grey tee on
 *      seamless paper, so a direction about clothes is written against the
 *      wrong brief — and since brand identity lives in objects, it is also the
 *      likeliest way a house returns without its name. **Rejected whole**
 *      (founder ruling): half of it is not salvageable.
 *   3. Nothing left after the brand scrub.
 *   4. Either half empty. Half a direction is worse than none — the
 *      anti-pattern is what stops "editorial" collapsing into generic gloss.
 */
function parseComposedDirection(raw: unknown): ComposedDirection | null {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as { thesis?: unknown; avoid?: unknown };
  if (typeof wire.thesis !== "string" || typeof wire.avoid !== "string") return null;

  if (mentionsGarments(wire.thesis) || mentionsGarments(wire.avoid)) return null;

  const thesis = scrubBrands(cleanFreeText(wire.thesis, COMPOSED_THESIS_MAX));
  const avoid = scrubBrands(cleanFreeText(wire.avoid, COMPOSED_AVOID_MAX));
  if (!thesis || !avoid) return null;

  return { thesis, avoid };
}

/**
 * Words that carry no content, so they need not be traceable to the brief.
 *
 * Small on purpose. The check below is a containment boundary, and every word
 * added here is a word the model may introduce that the user never typed.
 */
const STATED_HAIR_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "with", "at", "in", "on", "to", "her",
  "his", "their", "its", "hair", "haired", "worn", "cut", "is", "was",
]);

/**
 * Every content word must come from the user's own sentence.
 *
 * **A closed SOURCE instead of a closed vocabulary** (D-89). Identity facts are
 * enums precisely so a language model cannot smuggle a plaid shirt or a
 * captioned mug into a paid prompt — but hair colour cannot be an enum without
 * losing "pastel pink", which is exactly the fact the user wants honoured. So
 * the containment moves: the value stays free text, and every content token in
 * it has to appear in the raw brief.
 *
 * That one property closes three failure modes at once. The model cannot
 * hallucinate a colour the brief never named; it cannot paraphrase "strawberry
 * blonde" into something adjacent; and it cannot inject an instruction, because
 * anything it writes must already be the user's own words — and the user
 * sabotaging their own paid roll is not a threat model, it is a refund.
 *
 * The stakes justify the strictness: this text lands in the SUBJECT block,
 * which the prompt's own priority line declares absolute.
 */
export function tokensComeFromBrief(value: string, briefText: string): boolean {
  const source = new Set(briefText.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => STATED_HAIR_STOPWORDS.has(token) || source.has(token));
}

/**
 * Parse the stated-hair fields, dropping anything that fails containment.
 *
 * Drop-to-null on every failure, never a refusal — the `parseComposedDirection`
 * shape. A rejected field falls back to suppression, which is today's shipped
 * behaviour, so the cost of the model misbehaving is that the feature does not
 * apply rather than that a paid roll dies.
 */
export function parseStatedHair(raw: unknown, briefText: string): StatedHair {
  if (!raw || typeof raw !== "object") return EMPTY_STATED_HAIR;
  const wire = raw as Record<string, unknown>;

  const field = (key: "cutLength" | "colour" | "texture"): string | null => {
    const cleaned = scrubBrands(cleanFreeText(wire[key], STATED_HAIR_MAX));
    if (!cleaned) return null;
    // Digits render as text artefacts in the picture, and a garment word means
    // the model answered about clothes. Both are drops, never edits.
    if (/[0-9]/.test(cleaned)) return null;
    if (mentionsGarments(cleaned)) return null;
    if (!tokensComeFromBrief(cleaned, briefText)) return null;
    return cleaned;
  };

  return {
    cutLength: field("cutLength"),
    colour: field("colour"),
    texture: field("texture"),
    greying: wire.greying === true,
  };
}

/**
 * Closed vocabularies both, so a bad reply degrades to "no tendency".
 *
 * This is the narrowest possible channel for a stage that influences weights:
 * an unrecognised value is dropped rather than coerced, and dropping it returns
 * the axis to the general population — which is exactly today's behaviour.
 */
export function parsePoolTendencies(raw: unknown): PoolTendencies {
  if (!raw || typeof raw !== "object") return NO_TENDENCIES;
  const wire = raw as { ageLean?: unknown; facialHairLean?: unknown };
  const age = typeof wire.ageLean === "string" ? wire.ageLean.trim().toLowerCase() : null;
  const beard = typeof wire.facialHairLean === "string" ? wire.facialHairLean.trim().toLowerCase() : null;
  return {
    ageLean: (AGE_BANDS as readonly string[]).includes(age ?? "") ? (age as AgeBand) : null,
    facialHairLean: (FACIAL_HAIR_LEANS as readonly string[]).includes(beard ?? "")
      ? (beard as FacialHairLean)
      : null,
  };
}

export type IntentParseResult =
  | { ok: true; intent: CastingIntent }
  | { ok: false; reason: "unreadable" | "unsupported_cohort" };

/**
 * Turn whatever came back into an intent, or say why not.
 *
 * Never throws on model output. The caller's fallback path is the answer to a
 * bad response, and an exception here would turn a recoverable interpreter
 * wobble into a failed roll.
 */
export function parseCastingIntent(raw: unknown, briefText = ""): IntentParseResult {
  let payload = raw;
  if (typeof raw === "string") {
    try {
      // Fenced JSON is common enough to be worth one unwrap (H22's lesson,
      // one stage rather than three — this transport asks for json_object).
      payload = JSON.parse(raw.replace(/^\s*```(?:json)?|```\s*$/g, "").trim());
    } catch {
      return { ok: false, reason: "unreadable" };
    }
  }

  const parsed = wireSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "unreadable" };
  const wire = parsed.data;

  const cohort = typeof wire.cohort === "string" ? wire.cohort.trim().toLowerCase() : "photoreal_human";
  if (!SUPPORTED_COHORTS.includes(cohort as CohortKey)) {
    // Honest capability: a certified adapter exists for one cohort, so an
    // anime brief is refused for free rather than rendered as a photograph of
    // someone vaguely anime-adjacent.
    return { ok: false, reason: "unsupported_cohort" };
  }

  return {
    ok: true,
    intent: {
      cohort: cohort as CohortKey,
      role: cleanFreeText(wire.role, ROLE_MAX),
      characterNotes: cleanFreeText(wire.characterNotes, NOTES_MAX),
      sex: wire.sex as Sex | null,
      ageBand: wire.ageBand as AgeBand | null,
      agePhase: wire.agePhase as AgePhase | null,
      heritage: parseHeritage(wire.heritage),
      build: wire.build as Build | null,
      energy: wire.energy as EnergyKey | null,
      archetype: wire.archetype as ArchetypeKey | null,
      variationAxis: wire.variationAxis as VariationAxis | null,
      look: wire.look as LookKey | null,
      reads: parseReads(wire.reads),
      composedDirection: parseComposedDirection(wire.composedDirection),
      statedHair: parseStatedHair(wire.statedHair, briefText),
      poolTendencies: parsePoolTendencies(wire.poolTendencies),
    },
  };
}

/* ------------------------------------------------------------- lock facts */

/**
 * The facts the brief pinned.
 *
 * Derived, not declared — a field is locked exactly when the interpreter left
 * it non-null, which under the restraint doctrine means the brief said it.
 * One rule, no second channel to disagree with the first.
 *
 * `role` is deliberately absent: it is prose, and a lock has to be
 * comparable. C6's archetype fidelity is enforced by keeping the phrase in
 * every candidate's prompt, not by asserting a string appears in an image.
 */
export type LockFacts = {
  sex?: Sex;
  ageBand?: AgeBand;
  agePhase?: AgePhase;
  heritage?: HeritageComponent[];
  build?: Build;
  energy?: EnergyKey;
  look?: LookKey;
};

export function lockFactsOf(intent: CastingIntent): LockFacts {
  return {
    ...(intent.sex ? { sex: intent.sex } : {}),
    ...(intent.ageBand ? { ageBand: intent.ageBand } : {}),
    ...(intent.agePhase ? { agePhase: intent.agePhase } : {}),
    ...(intent.heritage.length > 0 ? { heritage: intent.heritage } : {}),
    ...(intent.build ? { build: intent.build } : {}),
    ...(intent.energy ? { energy: intent.energy } : {}),
    ...(intent.look ? { look: intent.look } : {}),
  };
}

/**
 * What a single candidate actually resolved to, after the adapter varied
 * everything the brief left open. Structured for exactly one reason: so the
 * validator below compares values instead of hunting for words in a prompt.
 */
export type ResolvedIdentity = {
  /**
   * At what resolution the STYLING axes reached the prompt for this candidate.
   * Recorded so the M7 registry, and any follow of this candidate, can tell
   * what the image was actually asked for rather than inferring it.
   */
  stylingResolution?: "stated" | "prescribe" | "bias";
  sex: Sex;
  ageBand: AgeBand;
  agePhase: AgePhase;
  heritage: HeritageComponent[];
  /**
   * Null when a casting category governs physique instead.
   *
   * A stated category ("editorial fashion model") implies a physical envelope,
   * and asserting a random build alongside it puts the two in contradiction —
   * which is how a sheet that asked for models returned people who would not
   * be seen at the door. Silence lets the category decide.
   */
  build: Build | null;
  /**
   * Realized per candidate so a follow can inherit it (founder gate 16).
   *
   * Hair used to reach the image only through the free-text role, shared by all
   * eight — so the followed candidate's blondeness was the image model's own
   * unrecorded choice and nothing could carry it. A trait you never authored is
   * a trait you cannot follow.
   */
  hair: Hair | null;
  /**
   * The five axes legacy assigned and V2 was leaving to the image model.
   *
   * Not intent fields and never locks: an unassigned axis collapses to the
   * model default, which is how the majority of casts came back brown-eyed.
   * See `realizedAxes.ts`.
   */
  realized: RealizedAxes;
  energy: EnergyKey;
  /** Set when the sheet varies by look rather than disposition. */
  look: LookKey | null;
  /**
   * Where each hair axis came from — stated, anchored, realized or suppressed.
   *
   * Metadata about the other fields rather than an axis of its own, which is
   * why the registry excludes it alongside `stylingResolution`. It exists so a
   * later reader never has to INFER provenance: inferring is how a follow of a
   * bias-tier parent came to inherit specificity its lineage never had.
   */
  hairTiers?: Record<string, string>;
};

export type LockViolation = {
  field: keyof LockFacts;
  expected: string;
  got: string;
};

/**
 * Does this candidate still honour what the user pinned?
 *
 * The check that Path B does not ship without. M3's A/B measured 10.9%
 * treatment-level lock violations — a brief saying "her" came back male in 7
 * of 8 treatments — and the plan makes the validator the unlock condition
 * rather than a companion (M3 addendum, condition 2).
 *
 * Under Path A this is a contract test: the adapter composes from the locks,
 * so a violation means the adapter is broken, and finding that in CI is the
 * point. Under Path B it becomes a runtime gate — a violating treatment is
 * dropped and the roll falls back to Path A rather than putting a male cyclist
 * on a sheet that asked for her.
 */
export function validateLocks(locks: LockFacts, resolved: ResolvedIdentity): LockViolation[] {
  const violations: LockViolation[] = [];

  if (locks.sex && locks.sex !== resolved.sex) {
    violations.push({ field: "sex", expected: locks.sex, got: resolved.sex });
  }
  if (locks.ageBand && locks.ageBand !== resolved.ageBand) {
    violations.push({ field: "ageBand", expected: locks.ageBand, got: resolved.ageBand });
  }
  if (locks.agePhase && locks.agePhase !== resolved.agePhase) {
    violations.push({ field: "agePhase", expected: locks.agePhase, got: resolved.agePhase });
  }
  if (locks.build && locks.build !== resolved.build) {
    violations.push({ field: "build", expected: locks.build, got: resolved.build ?? "unset" });
  }
  if (locks.energy && locks.energy !== resolved.energy) {
    violations.push({ field: "energy", expected: locks.energy, got: resolved.energy });
  }
  if (locks.look && locks.look !== resolved.look) {
    violations.push({ field: "look", expected: locks.look, got: resolved.look ?? "unset" });
  }
  if (locks.heritage && locks.heritage.length > 0) {
    const expected = locks.heritage.map((component) => component.heritage).sort().join("+");
    const got = resolved.heritage.map((component) => component.heritage).sort().join("+");
    if (expected !== got) violations.push({ field: "heritage", expected, got });
  }

  return violations;
}
