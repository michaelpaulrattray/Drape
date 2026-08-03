/**
 * What one refinement instruction MEANS, and how a stack of them composes
 * (M8 §10).
 *
 * # Parsed once, at entry — never at render
 *
 * "Compose instructions 1..N" has at least three meanings, and the wrong one
 * puts "green eyes" and "brown eyes" in the same prompt to fight it out. So
 * each instruction is interpreted **once, when it is typed**, into an ABSOLUTE
 * structured delta, and composition after that is mechanical code: per-axis
 * last-writer-wins. Three things follow, and all three are load-bearing:
 *
 *   - a re-render is deterministic, because nothing is re-interpreted;
 *   - **removing** an instruction is arithmetic, not a re-interpretation;
 *   - **a refusal lands before any charge** — the roll's own compile-and-admit-
 *     first arrow, one surface down.
 *
 * # The consequence that keeps the record honest
 *
 * The edit prompt AND the variant's `resolvedIdentity` are derived from the
 * SAME deltas. The user's raw sentence is kept as provenance and is never sent
 * to the image model alongside parsed deltas as parallel bookkeeping — that is
 * the record-lies class rebuilt with extra steps. One source, so the record
 * cannot drift from the picture by construction rather than by discipline.
 *
 * # Relative instructions resolve at entry, and that is worth knowing
 *
 * "Greener still" becomes an absolute value the moment it is typed. So removing
 * an EARLIER instruction leaves a later one holding the value it resolved to at
 * the time. That is honest and deterministic, and it is not what a naive reader
 * expects, which is why it is written down here rather than discovered.
 */
import {
  EYE_COLOURS,
  EYE_SHAPES,
  HAIR_TEXTURES,
  type EyeColour,
  type EyeShape,
  type HairTexture,
} from "../../shared/castingRealization";
import { HAIR_COLOURS, type HairColour } from "../../shared/castingVocabularies";
import { HAIR_STYLE_NAMES, hairStyleByName } from "./hairStyles";
import { scrubBrands } from "./brandScrub";

/** One adjustment, not a paragraph — the brief box is where prose belongs. */
const MAX_MAKEUP_LENGTH = 80;
import type { ResolvedIdentity } from "./castingIntent";

/**
 * The v1 tier, and the whole of it: **eyes only** (§5).
 *
 * Colour and shape — the things a person looks at a face and wants nudged. Not
 * age, not heritage, not sex, not build: those are casting decisions, and the
 * answer to "I want an older one" is to roll or adjust the brief, not to edit a
 * photograph into a different person.
 *
 * A closed set of axes rather than an open one because every member has to have
 * a composed home before it can be persisted — an axis written into a variant
 * and then rendered by nothing is the unowned-axis collapse, and it has already
 * happened six times in this program.
 */
export const REFINABLE_AXES = [
  "eyeColour",
  "eyeShape",
  "hairStyle",
  "hairColour",
  "hairTexture",
  "makeup",
] as const;
export type RefinableAxis = (typeof REFINABLE_AXES)[number];

export type RefineDelta = {
  eyeColour?: EyeColour;
  eyeShape?: EyeShape;
  /** A cut BY NAME, and only one the roll itself could have drawn. */
  hairStyle?: string;
  hairColour?: HairColour;
  hairTexture?: HairTexture;
  /** Free text, capped and brand-scrubbed — §10's labelled slot. */
  makeup?: string;
};

/**
 * Why an instruction was refused — the copy is the caller's, the reason is ours.
 *
 * `out_of_tier` is the honest one and the one users will meet: a real ask the
 * product cannot do yet. It is deliberately NOT phrased as an error, because it
 * is not one — Refine is narrow on purpose, and the refusal is the product
 * telling the truth about its own edges.
 */
export type RefineRefusal =
  | { reason: "out_of_tier"; asked: string }
  | { reason: "unreadable" }
  | { reason: "empty" };

export type RefineParse =
  | { ok: true; delta: RefineDelta }
  | { ok: false; refusal: RefineRefusal };

/** Runtime validation of the interpreter's reply — a closed vocabulary is only
    closed if something checks. */
export function readDelta(value: unknown): RefineDelta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const delta: RefineDelta = {};
  if (raw.eyeColour != null) {
    if (!EYE_COLOURS.includes(raw.eyeColour as EyeColour)) return null;
    delta.eyeColour = raw.eyeColour as EyeColour;
  }
  if (raw.eyeShape != null) {
    if (!EYE_SHAPES.includes(raw.eyeShape as EyeShape)) return null;
    delta.eyeShape = raw.eyeShape as EyeShape;
  }
  /*
    THE HAIR TIER. Every value is checked against the vocabulary the ROLL draws
    from — `HAIR_STYLE_NAMES` is derived from the weight tables, so a refinement
    can only ask for a cut a sheet could itself have produced. An invented cut
    would be an axis value nothing knows how to render.
  */
  if (raw.hairStyle != null) {
    if (!HAIR_STYLE_NAMES.includes(raw.hairStyle as string)) return null;
    delta.hairStyle = raw.hairStyle as string;
  }
  if (raw.hairColour != null) {
    if (!HAIR_COLOURS.includes(raw.hairColour as HairColour)) return null;
    delta.hairColour = raw.hairColour as HairColour;
  }
  if (raw.hairTexture != null) {
    if (!HAIR_TEXTURES.includes(raw.hairTexture as HairTexture)) return null;
    delta.hairTexture = raw.hairTexture as HairTexture;
  }
  /*
    MAKEUP — the one slot with no enum behind it, so the code owns its SHAPE
    instead of its vocabulary: capped, brand-scrubbed, and rejected outright if
    scrubbing empties it. A brand name in a paid prompt is the guard every other
    free-text field in this program already carries, and length is what stops an
    instruction becoming a second brief.
  */
  if (raw.makeup != null) {
    if (typeof raw.makeup !== "string") return null;
    const scrubbed = scrubBrands(raw.makeup.trim());
    const cleaned = scrubbed?.trim() ?? "";
    if (!cleaned || cleaned.length > MAX_MAKEUP_LENGTH) return null;
    delta.makeup = cleaned;
  }
  /* An empty delta is not a delta. Charging for a generation that changes
     nothing is the worst possible outcome of a misread instruction. */
  return Object.keys(delta).length > 0 ? delta : null;
}

/**
 * Compose a stack of deltas over the original identity — mechanical, no model.
 *
 * Per-axis last-writer-wins, in order. This is the ONLY composition rule, and
 * its plainness is the feature: whatever the interpreter did at entry, what
 * ends up in the prompt and in the record is something a person can work out on
 * paper from the instruction list.
 */
export function composeDeltas(deltas: readonly RefineDelta[]): RefineDelta {
  const composed: RefineDelta = {};
  for (const delta of deltas) {
    if (delta.eyeColour != null) composed.eyeColour = delta.eyeColour;
    if (delta.eyeShape != null) composed.eyeShape = delta.eyeShape;
    if (delta.hairStyle != null) composed.hairStyle = delta.hairStyle;
    if (delta.hairColour != null) composed.hairColour = delta.hairColour;
    if (delta.hairTexture != null) composed.hairTexture = delta.hairTexture;
    if (delta.makeup != null) composed.makeup = delta.makeup;
  }
  return composed;
}

/**
 * The variant's FULL resolved identity — `apply(original, composed)`.
 *
 * Full rather than a patch, because Sign snapshots this as the Cast's technical
 * schema and Follow inherits it whole. A partial record would leave both
 * reading through to the original for everything the refinement did not touch,
 * which works right up until someone changes how that read-through resolves.
 *
 * **Sheet-level taste is deliberately NOT re-run.** It balanced eight faces at
 * roll time; a per-face edit is this user's deliberate choice about ONE of
 * them, and re-balancing would move faces they never touched.
 */
export function applyDelta(original: ResolvedIdentity, delta: RefineDelta): ResolvedIdentity {
  const style = delta.hairStyle != null ? hairStyleByName(delta.hairStyle) : null;
  return {
    ...original,
    /*
      HAIR COLOUR LIVES OUTSIDE `realized`, and forgetting that is how this
      record would quietly lie.

      It is a realized-shelf AXIS stored at `identity.hair.colour` for
      historical reasons — the registry documents the exception. Writing it into
      `realized` would persist a field the composer never reads, so the picture
      would change and the record would still say the old colour: the
      unowned-axis collapse and the record-lies class in one move.

      A cut also carries its own family, and sometimes its own texture and worn
      state, so the whole `HairStyle` object is written rather than the name —
      a name beside a stale family is a silhouette nobody asked for.
    */
    ...(delta.hairColour != null || style
      ? {
        hair: {
          ...(original.hair ?? {}),
          ...(style ? { family: style.family } : {}),
          ...(delta.hairColour != null ? { colour: delta.hairColour } : {}),
        },
      }
      : {}),
    realized: {
      ...original.realized,
      ...(delta.eyeColour != null ? { eyeColour: delta.eyeColour } : {}),
      ...(delta.eyeShape != null ? { eyeShape: delta.eyeShape } : {}),
      ...(delta.makeup != null ? { makeup: delta.makeup } : {}),
      ...(style ? { hairStyle: style } : {}),
      /*
        A cut that dictates its own texture WINS over a stated one, because the
        cut is the more specific fact: a twist-out is coiled by definition, and
        honouring "make it straight" alongside it would persist a combination
        that cannot exist. Same precedence the roll already uses.
      */
      ...(style?.texture
        ? { hairTexture: style.texture }
        : delta.hairTexture != null
          ? { hairTexture: delta.hairTexture }
          : {}),
      ...(style?.worn ? { wornState: style.worn } : {}),
    },
  } as ResolvedIdentity;
}

/**
 * The edit prompt handed to the identity engine, built from the SAME deltas.
 *
 * Engineered prose per value, never the bare enum word — the A9 pattern, for
 * the reason D-124 re-proved on paid renders: a single adjective loses to the
 * model's portrait prior, and "hooded" handed over as a word comes back as
 * ordinary wide-open eyes.
 *
 * The preservation clause is not boilerplate. This is a base-anchored edit of
 * one photograph, and everything the instruction did not name has to survive
 * it, or the tenth variant is a different person from the one who was picked.
 */
export function composeEditPrompt(delta: RefineDelta, prose: {
  eyeColour: (value: EyeColour) => string;
  eyeShape: (value: EyeShape) => string;
  hairStyle: (value: string) => string;
  hairColour: (value: HairColour) => string;
  hairTexture: (value: HairTexture) => string;
}): string {
  const edits: string[] = [];
  if (delta.eyeColour != null) {
    edits.push(`Change the iris colour to ${delta.eyeColour} — ${prose.eyeColour(delta.eyeColour)}.`);
  }
  if (delta.eyeShape != null) {
    edits.push(`Change the eye shape to ${delta.eyeShape} — ${prose.eyeShape(delta.eyeShape)}.`);
  }
  /*
    Hair is described as CUT, COLOUR and TEXTURE in one sentence where more than
    one changed, because they are one visible thing and three separate
    instructions invite the model to weigh them against each other — the same
    reason beard greying rides the facial-hair line rather than getting its own.
  */
  if (delta.makeup != null) {
    /*
      The user's own words, not a translation — there is no enum to translate
      into, and paraphrasing "a red lip" would be inventing a specificity they
      did not ask for. The STATED MAKEUP licence in the cohort constant is what
      gives them teeth.
    */
    edits.push(`Apply makeup: ${delta.makeup}. Everything else about the face stays bare.`);
  }
  const hair: string[] = [];
  if (delta.hairStyle != null) hair.push(`cut into ${prose.hairStyle(delta.hairStyle)}`);
  if (delta.hairColour != null) hair.push(`coloured ${prose.hairColour(delta.hairColour)}`);
  if (delta.hairTexture != null) hair.push(`with ${prose.hairTexture(delta.hairTexture)}`);
  if (hair.length > 0) {
    edits.push(
      `Change the hair: ${hair.join(", ")}. Keep the hairline and the density the same — `
      + "this is the same person's hair restyled, not a wig and not a different head of hair.",
    );
  }
  return [
    "Edit this photograph of this exact person, changing ONLY what is listed below.",
    ...edits,
    "Everything else must be identical to the reference: the same person, the same bone "
    + "structure, the same skin, the same hair, the same expression, the same clothing, the "
    + "same lighting, the same framing and the same background. This is a retouch of one "
    + "photograph, not a new photograph of a similar person.",
  ].join(" ");
}
