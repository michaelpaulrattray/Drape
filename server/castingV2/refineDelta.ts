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
import { REFINABLE_CUT_NAMES, hairStyleByName } from "./hairStyles";
import { scrubBrands } from "./brandScrub";
import { classifyInkPlacement, namesDesign, placementClause } from "./inkPlacement";
import { namesUnknownProperNoun } from "./properNouns";
import { tokensComeFromBrief } from "./castingIntent";
import { FREE_SUBJECT_KEYS, FREE_SUBJECTS, isPresentationSubject, type FreeSubject } from "./refineSubjects";
import { facetOfAxis, facetOfSubject, subjectsOfFacet, type Facet } from "./refineFacets";

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
  /**
   * The FREE LANE (D-131) — one entry per code-owned subject.
   *
   * A record rather than a list, which is what makes composition mechanical:
   * the key is the subject, so last-writer-wins per subject falls straight out
   * of an object spread and two instructions about brows cannot accumulate into
   * a prompt that argues with itself.
   */
  free?: Partial<Record<FreeSubject, string>>;
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
  /** A wall, and refusals always NAME theirs (D-131). */
  | { reason: "wall_likeness" }
  | { reason: "wall_stage"; asked: string }
  | { reason: "wall_content" }
  | { reason: "wall_unfileable"; asked: string }
  /** Not a wall — a GATE. It names what does work and what is coming (D-137). */
  | { reason: "gate_ink_document" }
  | { reason: "unreadable" }
  | { reason: "empty" };

export type RefineParse =
  | { ok: true; delta: RefineDelta }
  | { ok: false; refusal: RefineRefusal };

/**
 * What a free-lane value may be, before it is allowed anywhere near a prompt.
 *
 * `instruction` is REQUIRED, because source containment cannot check what it is
 * not given: every content word of a free value has to appear in the sentence
 * the user actually typed. Without it the model could author a fact nobody
 * asked for and file it as though they had — the invented-fact class, arriving
 * through the one lane with no closed vocabulary to stop it.
 */
export type FreeLaneCheck = {
  instruction: string;
  /** Set when the value hit a wall, so the caller can name which one. */
  wall?: RefineRefusal;
};

/** One adjustment per subject, not a paragraph. */
const MAX_FREE_LENGTH = 120;

/**
 * Words that are about the STAGE, not the person — wall (b)'s second half.
 *
 * The closed subject list is the primary enforcement (a red coat has no subject
 * to file under), but a model can also smuggle scenery into a person subject:
 * "skin" carrying "against a red backdrop". Cheap to check, and the failure it
 * prevents is a paid edit that repaints the room.
 */
const STAGE_WORDS = [
  "backdrop", "background", "wall", "studio", "set", "scene", "location",
  "coat", "jacket", "shirt", "dress", "suit", "hat", "scarf", "wearing",
  "holding", "prop", "chair", "table",
];

/**
 * Words the ACCESSORIES subject is allowed to use (D-160).
 *
 * "Wearing" is how anyone describes an earring, so the stage guard was refusing
 * the subject the founder opened by the only verb it has. Every garment noun
 * still fires — "wearing a red coat" is still a garment — and headwear stays
 * out, which is the same carve-out the cohort's own accessories licence makes.
 */
const ACCESSORY_ALLOWED = new Set(["wearing"]);

/** Runtime validation of the interpreter's reply — a closed vocabulary is only
    closed if something checks. */
export function readDelta(value: unknown, check?: FreeLaneCheck): RefineDelta | null {
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
    /*
      WORN-NEUTRAL ONLY (D-157). A cut that carries its own worn state is a
      stored contradiction waiting for a worn instruction to disagree with it —
      which is exactly how "hair tied up" wrote a CUT and then reverted.
    */
    if (!REFINABLE_CUT_NAMES.includes(raw.hairStyle as string)) return null;
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
  /* ---- the free lane (D-131) ---- */
  if (raw.free != null && (typeof raw.free !== "object" || Array.isArray(raw.free))) return null;
  /*
    A KNOWN SUBJECT AT THE TOP LEVEL IS A SHAPE SLIP, NOT A DIFFERENT MEANING.

    The guaranteed axes are top-level fields and the free ones are nested, so a
    prompt line that reads like "this files under ink" gets replies of
    `{"ink": "…"}` rather than `{"free": {"ink": "…"}}`. That used to leave an
    empty delta with no wall set, which surfaces as "that didn't come through
    clearly" — the interpreter's own habit reported to the user as their
    mistake, which is the exact failure `stripFence` was added for.

    Hoisting is safe in the only way that matters: the value still passes every
    guard below — scrub, both walls, source containment and the ink gate — so
    this forgives the SHAPE and nothing else. Free subjects and guaranteed axes
    cannot collide, because the type-level carve-out forbids it.
  */
  const stated: Record<string, unknown> = { ...(raw.free as Record<string, unknown> | undefined ?? {}) };
  for (const key of FREE_SUBJECT_KEYS) {
    if (raw[key] != null && stated[key] == null) stated[key] = raw[key];
  }
  if (Object.keys(stated).length > 0) {
    const free: Partial<Record<FreeSubject, string>> = {};
    for (const [subject, entry] of Object.entries(stated)) {
      /*
        WALL (b), primary form: a subject the code does not own cannot be
        filed, and wall (d) says an ask that cannot be filed refuses. This is
        also what stops a model-authored subject key from becoming a
        composition key — D-89's gate on the free lane.
      */
      if (!FREE_SUBJECT_KEYS.includes(subject as FreeSubject)) return null;
      if (typeof entry !== "string") return null;

      const scrubbed = scrubBrands(entry.trim())?.trim() ?? "";
      if (!scrubbed || scrubbed.length > MAX_FREE_LENGTH) return null;

      /*
        THE GUARANTEE LANE STAYS GUARANTEED. A value that an engineered
        vocabulary can express is PROMOTED into it, so "green eyes" routed here
        by an over-eager interpreter still lands with its iris prose and its
        failed-candidate teeth rather than as bare free text.
      */
      const promoted = promoteToGuaranteedLane(subject as FreeSubject, scrubbed, delta);
      if (promoted) continue;

      /*
        THE INK GATE (D-137). Only pixels render a design, and the one case
        where words suffice is ink the anchor itself documents — face and neck.
        Everything else waits for the body-art studio rather than being rendered
        from a sentence, which would be a different tattoo in every frame.
      */
      /*
        AND IT FOLLOWS THE DESIGN, NOT THE DRAWER (D-158).

        The gate was on the `ink` subject alone, so it was bypassed by filing:
        "a small star behind her ear" carries no word "tattoo", came back as a
        MARK, and marks have no placement law — so it rendered. A star is a
        design wherever it is filed. Marks that name a design are held to the
        same visibility rule; freckles, scars and birthmarks are not, because
        they are things skin does rather than things drawn on it.

        Found by driving the real interpreter, not by the unit tests, which
        could only ever ask the question with the subject already chosen.
      */
      if (check && (subject === "ink" || (subject === "marks" && namesDesign(scrubbed)))) {
        if (classifyInkPlacement(scrubbed).kind !== "in_frame") {
          check.wall = { reason: "gate_ink_document" };
          return null;
        }
      }

      if (check) {
        /* WALL (a): never another person. The listless proper-noun guard,
           run over the PARSED OUTPUT rather than the prompt (D-82). */
        if (namesUnknownProperNoun(scrubbed, { mode: "phrase" })) {
          check.wall = { reason: "wall_likeness" };
          return null;
        }
        /* WALL (b), secondary: scenery smuggled into a person subject. */
        const lowered = scrubbed.toLowerCase();
        const stage = STAGE_WORDS.find((word) => (
          !(subject === "statedAccessories" && ACCESSORY_ALLOWED.has(word))
          && new RegExp(`\\b${word}\\b`).test(lowered)
        ));
        if (stage) {
          check.wall = { reason: "wall_stage", asked: stage };
          return null;
        }
        /*
          SOURCE CONTAINMENT. Every content word must come from the user's own
          sentence — the D-79 mechanism, applied to the one lane that has no
          vocabulary to constrain it. A model elaborating "a scar" into "a long
          knife scar from a bar fight" is inventing biography.
        */
        /*
          Apostrophes are normalised on BOTH sides before the check.

          The founder's fox-eyes stack regressed on this: they typed "cupids
          bow", the model wrote "cupid's bow", and containment split that into
          "cupid" + "s" and refused an entirely honest value. Source containment
          exists to stop INVENTED CONTENT, not to police punctuation, and a
          guard that refuses the user's own words with an apostrophe added is a
          guard doing the opposite of its job.
        */
        const strip = (text: string) => text.replace(/['’]/g, "");
        /*
          And STEMMED, for the same reason the apostrophe is stripped.

          "Tie her hair up" came back as "tied up" and was refused, because
          "tied" is not the token "tie". That is a morphological variant of the
          user's own word, not an invention — and a guard built to stop INVENTED
          CONTENT must not fire on a verb tense. The second time this exact
          shape has cost an honest instruction (D-157).
        */
        if (!stemmedContainment(strip(scrubbed), strip(check.instruction))) {
          check.wall = { reason: "wall_unfileable", asked: subject };
          return null;
        }
      }
      free[subject as FreeSubject] = scrubbed;
    }
    if (Object.keys(free).length > 0) delta.free = free;
  }

  /* An empty delta is not a delta. Charging for a generation that changes
     nothing is the worst possible outcome of a misread instruction. */
  return Object.keys(delta).length > 0 ? delta : null;
}

/**
 * Move a free-lane value into its engineered home when one exists.
 *
 * The regression this prevents is silent and expensive: the interpreter routes
 * "green eyes" into the free lane, the value is perfectly readable, the edit
 * happens — and the iris prose, the closed vocabulary and the failed-candidate
 * teeth are all quietly gone. Promotion is mechanical, so it does not depend on
 * the interpreter having been told the right thing.
 */
function promoteToGuaranteedLane(
  subject: FreeSubject,
  value: string,
  delta: RefineDelta,
): boolean {
  const lowered = value.toLowerCase();

  /*
    A cut the catalogue KNOWS keeps its guaranteed home even when the
    interpreter files it free — so "give her a bob" still buys the family, the
    worn state and the failed-candidate teeth, while "give her a mullet" (not in
    the 36) stays in the free lane and gets an honest attempt.
  */
  if (subject === "eyeColourFree") {
    for (const colour of EYE_COLOURS) {
      if (lowered === colour) {
        delta.eyeColour = colour;
        return true;
      }
    }
  }
  if (subject === "eyeShapeFree") {
    for (const shape of EYE_SHAPES) {
      if (lowered === shape) {
        delta.eyeShape = shape;
        return true;
      }
    }
  }
  /*
    Promotion matches on the SUBJECT WORD too, not just the whole value.
    "copper hair" filed under hairShade is still copper; requiring an exact
    whole-string match was too narrow, and a value that failed to promote used
    to overwrite the cut, which is how the mullet died.
  */
  if (subject === "hairCut") {
    const cut = REFINABLE_CUT_NAMES.find((name) => name.toLowerCase() === lowered);
    if (cut) {
      delta.hairStyle = cut;
      return true;
    }
  }
  if (subject === "hairShade") {
    const colour = HAIR_COLOURS.find((c) => lowered === c || lowered === `${c} hair`);
    if (colour) {
      delta.hairColour = colour;
      return true;
    }
  }
  if (subject === "hairPattern") {
    const texture = HAIR_TEXTURES.find((t) => lowered === t || lowered === `${t} hair`);
    if (texture) {
      delta.hairTexture = texture;
      return true;
    }
  }
  return false;
}

/** Which FACETS one delta writes — the unit composition supersedes on (D-159). */
export function facetsWrittenBy(delta: RefineDelta): Set<Facet> {
  const facets = new Set<Facet>();
  for (const axis of REFINABLE_AXES) {
    if (delta[axis] != null) facets.add(facetOfAxis(axis));
  }
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    if (value) facets.add(facetOfSubject(subject as FreeSubject));
  }
  return facets;
}

/** Clear every key — either lane — that answers one of these facets. */
function clearFacets(composed: RefineDelta, facets: ReadonlySet<Facet>): void {
  for (const axis of REFINABLE_AXES) {
    if (facets.has(facetOfAxis(axis))) delete composed[axis];
  }
  if (!composed.free) return;
  for (const subject of Object.keys(composed.free) as FreeSubject[]) {
    if (facets.has(facetOfSubject(subject))) delete composed.free[subject];
  }
  if (Object.keys(composed.free).length === 0) delete composed.free;
}

/**
 * ONE delta answering one facet twice — the legacy shape, resolved GUARANTEED-WINS.
 *
 * A freshly parsed instruction cannot do this: promotion moves a value into the
 * guaranteed lane and `continue`s rather than filing it twice. But composed
 * deltas persisted BEFORE facet supersession existed can hold both, with no
 * ordering left to recover, and those rows are read back as the predecessor of
 * every new refinement.
 *
 * Guaranteed wins because that is what the PIXELS did: in every such row the
 * engineered prose beat the bare free clause, so the convention agrees with the
 * picture the user kept and is looking at. The row heals itself the next time
 * anything writes that facet.
 */
function collapseWithinDelta(delta: RefineDelta): RefineDelta {
  if (!delta.free) return delta;
  const guaranteed = new Set<Facet>();
  for (const axis of REFINABLE_AXES) {
    if (delta[axis] != null) guaranteed.add(facetOfAxis(axis));
  }
  const free: Partial<Record<FreeSubject, string>> = {};
  let collided = false;
  for (const [subject, value] of Object.entries(delta.free)) {
    if (guaranteed.has(facetOfSubject(subject as FreeSubject))) {
      collided = true;
      continue;
    }
    if (value) free[subject as FreeSubject] = value;
  }
  if (!collided) return delta;
  const next: RefineDelta = { ...delta };
  if (Object.keys(free).length > 0) next.free = free;
  else delete next.free;
  return next;
}

/**
 * Compose a stack of deltas over the original identity — mechanical, no model.
 *
 * Per-FACET last-writer-wins, in order. This is the ONLY composition rule, and
 * its plainness is the feature: whatever the interpreter did at entry, what
 * ends up in the prompt and in the record is something a person can work out on
 * paper from the instruction list.
 *
 * **Per facet, not per key** (D-159). It was per key, and the two lanes give one
 * facet two of them — so "copper hair" and then "pastel pink hair" both survived
 * into a single prompt and fought, and the heavier engineered prose won while
 * the record said pink. Superseding by facet makes a prompt with two answers to
 * one question unrepresentable rather than merely detectable.
 */
export function composeDeltas(deltas: readonly RefineDelta[]): RefineDelta {
  const composed: RefineDelta = {};
  for (const raw of deltas) {
    const delta = collapseWithinDelta(raw);
    /* Everything this delta is about loses its previous answer FIRST, in either
       lane, so the assignments below are the only surviving writers. */
    clearFacets(composed, facetsWrittenBy(delta));
    if (delta.eyeColour != null) composed.eyeColour = delta.eyeColour;
    if (delta.eyeShape != null) composed.eyeShape = delta.eyeShape;
    if (delta.hairStyle != null) composed.hairStyle = delta.hairStyle;
    if (delta.hairColour != null) composed.hairColour = delta.hairColour;
    if (delta.hairTexture != null) composed.hairTexture = delta.hairTexture;
    if (delta.makeup != null) composed.makeup = delta.makeup;
    /*
      PER-SUBJECT last-writer-wins, which is why the free lane is a record
      rather than a list. Two brow instructions overwrite; a brow instruction
      and a nose instruction coexist. Plural subjects (marks, ink) hold the
      whole current set as one value, restated absolutely, so removal stays
      arithmetic here as it does everywhere else.
    */
    if (delta.free) composed.free = { ...(composed.free ?? {}), ...delta.free };
  }
  return composed;
}

/**
 * What a facet's value IS right now, read from the composed identity.
 *
 * The interpreter resolves relative asks — "make it lighter", "shorter" —
 * against these, so reading the wrong one buys a paid edit relative to a value
 * the face does not have. Facet supersession makes that a live hazard rather
 * than a theoretical one: once a free `hairShade` clears the guaranteed
 * `hairColour`, `identity.hair.colour` falls back to the ORIGINAL colour while
 * the face on screen is pastel pink. So the read follows the facet, not the
 * field — the stated detail first, the guaranteed home only if no stated one
 * currently owns it.
 */
export function currentValueOfFacet(
  identity: ResolvedIdentity | null | undefined,
  facet: Facet,
): string | null {
  if (!identity) return null;
  const realized = (identity.realized ?? {}) as Record<string, unknown>;
  const stated = (realized.statedDetails ?? {}) as Record<string, unknown>;
  for (const subject of subjectsOfFacet(facet)) {
    const value = stated[subject];
    if (typeof value === "string" && value.trim()) return value;
  }
  switch (facet) {
    case "eye.colour": return asText(realized.eyeColour);
    case "eye.shape": return asText(realized.eyeShape);
    case "hair.cut": return asText((realized.hairStyle as { name?: unknown })?.name);
    case "hair.colour": return asText((identity.hair as { colour?: unknown })?.colour);
    case "hair.texture": return asText(realized.hairTexture);
    case "makeup": return asText(realized.makeup);
    default: return null;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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
  const identityDetails = identityDetailsOf(delta);
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
      /*
        FILED, which is wall (d). Every free-lane entry that is not presentation
        state lands in the identity record as a source-contained stated detail,
        under the ONE registered `statedDetails` axis — so the D-87 sweep can
        see it and a follow inherits it like any other fact.
      */
      ...(identityDetails ? { statedDetails: identityDetails } : {}),
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
 * The human-readable SUBJECTS an instruction was filed under (D-149).
 *
 * Headings only — "HAIR CUT", "EYE SHAPE" — never the values, which are the
 * recipe and stay internal. What the user needs to see is WHERE their words
 * landed, because that is what Follow will inherit and what a later instruction
 * will overwrite.
 */
export function filedSubjectsOf(deltas: unknown): string[] {
  const delta = readDelta(deltas);
  if (!delta) return [];
  const subjects: string[] = [];
  if (delta.eyeColour) subjects.push("EYE COLOUR");
  if (delta.eyeShape) subjects.push("EYE SHAPE");
  if (delta.hairStyle) subjects.push("HAIR CUT");
  if (delta.hairColour) subjects.push("HAIR COLOUR");
  if (delta.hairTexture) subjects.push("HAIR TEXTURE");
  if (delta.makeup) subjects.push("MAKEUP");
  for (const subject of Object.keys(delta.free ?? {})) {
    subjects.push(FREE_SUBJECTS[subject as FreeSubject]);
  }
  return Array.from(new Set(subjects));
}

/**
 * COMPOSE-COMPLETENESS — every filed fact must reach the prompt (D-143).
 *
 * The design's promise was that a filing failure degrades to
 * filed-but-not-rendered "which the sweep can see". Nothing saw it. The
 * founder's stack kept a mullet in the record and rendered no mullet, and the
 * only witness was a chip tooltip he happened to hover.
 *
 * So the promise gets mechanical teeth: composition is CHECKED against the
 * delta it came from, and a fact that did not make it stops the render instead
 * of being quietly dropped. Annihilation becomes unrepresentable rather than
 * detectable — which is the difference between a law and a hope.
 */
export function missingFromPrompt(delta: RefineDelta, prompt: string): string[] {
  const lowered = prompt.toLowerCase();
  const missing: string[] = [];
  const wants: Array<[string, string | undefined]> = [
    ["eyeColour", delta.eyeColour],
    ["eyeShape", delta.eyeShape],
    ["hairStyle", delta.hairStyle],
    ["hairColour", delta.hairColour],
    ["hairTexture", delta.hairTexture],
    ["makeup", delta.makeup],
    ...Object.entries(delta.free ?? {}).map(([k, v]) => [k, v] as [string, string]),
  ];
  for (const [key, value] of wants) {
    if (!value) continue;
    if (!lowered.includes(value.toLowerCase())) missing.push(key);
  }
  return missing;
}

/**
 * Source containment, tolerant of ordinary word endings.
 *
 * Stems both sides by dropping the common English suffixes before comparing, so
 * tie/tied/tying and freckle/freckles are the same word. Deliberately crude:
 * the job is to catch a model INVENTING a fact, and no stemmer is needed to
 * notice "a long knife scar from a bar fight" when the user said "a scar".
 */
function stemmedContainment(value: string, instruction: string): boolean {
  const stem = (word: string) => word
    .replace(/(ing|ed|es|s)$/i, "")
    /* And a trailing "e", so tie and tied both reduce to "ti". */
    .replace(/e$/i, "");
  const source = new Set(
    instruction.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem),
  );
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => token.length <= 2 || source.has(stem(token)));
}

/**
 * Per-subject qualifiers — the modifiers a bare word needs to render honestly.
 *
 * "Copper" alone came back saturated traffic-cone orange and "black" came back
 * faintly dyed: the model reads a colour word as a DYE JOB rather than as hair.
 * The roll pipeline never had this problem because its colourist palette always
 * carried tone, depth and where the light sits — so free colours get the same
 * treatment, in the one place a free value can be qualified without inventing
 * a fact the user did not state.
 */
function qualifierFor(subject: FreeSubject): string {
  if (subject === "hairShade") {
    return ", rendered as natural hair — dimensional rather than flat, with a "
      + "slightly deeper root shadow and the tone reading as grown rather than dyed";
  }
  if (subject === "ink") return "";
  /*
    THE LICENCE, CARRIED (D-160). The cohort constant gives stated accessories
    failure-to-appear teeth on the ROLL; the edit prompt has to say it too, or
    the one surface where a person deliberately asks for an earring is the one
    surface where it can quietly not appear.
  */
  if (subject === "statedAccessories") {
    return ", worn by this person and plainly visible, rendered accurately as "
      + "described and as their own — an accessory that fails to appear is a "
      + "failed candidate. Nothing else is added: no other jewellery, no "
      + "headwear, no props";
  }
  if (subject === "hairCut") {
    return ", cut and dressed as a real haircut on this person's own hair density "
      + "and hairline";
  }
  return "";
}

/**
 * The free-lane entries that are IDENTITY, keyed by subject.
 *
 * Expression is excluded here and only here (D-136): it is the variant's
 * presentation state, and `readResolvedIdentity` passes unknown fields through
 * whole — so filing a smile into the identity blob would have every follow
 * inherit it, making a momentary choice permanent for eight strangers.
 */
export function identityDetailsOf(delta: RefineDelta): Record<string, string> | null {
  if (!delta.free) return null;
  const details: Record<string, string> = {};
  for (const [subject, value] of Object.entries(delta.free)) {
    if (isPresentationSubject(subject as FreeSubject)) continue;
    if (value) details[subject] = value;
  }
  return Object.keys(details).length > 0 ? details : null;
}

/** The presentation state — recorded on the variant, never on the identity. */
export function presentationOf(delta: RefineDelta): Record<string, string> | null {
  if (!delta.free) return null;
  const state: Record<string, string> = {};
  for (const [subject, value] of Object.entries(delta.free)) {
    if (!isPresentationSubject(subject as FreeSubject)) continue;
    if (value) state[subject] = value;
  }
  return Object.keys(state).length > 0 ? state : null;
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
}, pinned = false): string {
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
  /*
    THE FREE LANE, each under its registered heading — which is what the D-87
    sweep looks for, so a heading that drifts is a fact the sweep stops seeing.
    Composed from the same object that was filed, never from the raw sentence.
  */
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    if (!value) continue;
    const heading = FREE_SUBJECTS[subject as FreeSubject];
    edits.push(subject === "ink"
      ? `${heading}: ${value}.${placementClause(value)}`
      : `${heading}: ${value}${qualifierFor(subject as FreeSubject)}.`);
  }
  return [
    pinned
      ? "You are given TWO images of the same person. The FIRST is the identity "
        + "reference — that is who she is. The SECOND is how she currently looks, "
        + "including every earlier change already made to her. Keep the SECOND "
        + "image exactly as it is in every respect, and change only what is "
        + "listed below. Do not redraw, restyle or reinterpret anything else — "
        + "a haircut, a colour or a mark already present must come through "
        + "unchanged and identical."
      : "Edit this photograph of this exact person, changing ONLY what is listed below.",
    ...edits,
    "Everything else must be identical to the reference: the same person, the same bone "
    + "structure, the same skin, the same hair, the same expression, the same clothing, the "
    + "same lighting, the same framing and the same background. This is a retouch of one "
    + "photograph, not a new photograph of a similar person.",
  ].join(" ");
}
