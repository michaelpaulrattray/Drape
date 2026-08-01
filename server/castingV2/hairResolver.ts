/**
 * The hair axes, resolved in ONE place with the precedence written down.
 *
 * M7's resolver unification, first axis group — the founder's condition on
 * accepting slice zero's deferral: *"unification completes before Sign ships,
 * axis-by-axis under the registry, starting with hair."*
 *
 * **What was wrong with the old shape.** Hair's six axes were resolved across
 * three call sites with the order implied rather than stated: a `??` chain in
 * `resolveCandidateIdentity` picked anchored-or-realized, a separate chain
 * picked the colour, the sheet taste pass rewrote some of them afterwards, and
 * `withHonestRecord` blanked whatever deference had silenced. Every one of those
 * was correct on its own. Nowhere did a reader find out what OUTRANKS what, and
 * six drop-a-stated-fact defects lived in exactly that gap.
 *
 * **The precedence, stated once:**
 *
 *   stated → hand-adjusted → follow-anchored → category/bias → realized
 *   → sheet-adjusted
 *
 * Two of those tiers are deliberately absent here and saying so is part of the
 * contract. **Hand-adjusted** has no hair affordance — `OVERRIDABLE_FIELDS`
 * carries no hair axis, because the brief echo offers locks and hair is a
 * deference fact rather than a lock (D-89). **Sheet-adjusted** cannot run here
 * at all: it is a property of the SET of eight and this function sees one
 * candidate, which is the exact mistake the first taste-pass implementation
 * made and paid for. It runs in `briefCompiler.resolveSheet`, after this, and
 * stamps its own tier through `applyTasteWrite`.
 *
 * **Category/bias is a RESOLUTION, not a source.** It does not supply a value;
 * it decides at what fidelity the value composes. So it is recorded beside the
 * tier rather than inside it — `stylingResolution` already persists it.
 *
 * The tiers are recorded per axis rather than derived later, because a reader
 * that has to infer where a value came from is a reader that will infer wrong:
 * that is how a follow of a bias-tier parent came to inherit specificity its
 * lineage never had.
 */

import type { AgeBand, HairColour, HeritageComponent, Sex } from "./castingIntent";
import type { HairPart, HairStyle, RealizedAxes } from "../../shared/castingRealization";

/**
 * Where a hair value came from.
 *
 * `suppressed` is a first-class outcome rather than an absence: the brief spoke
 * to this part, so nothing was authored and the record must say null. Telling it
 * apart from "resolved to nothing" is what stops the next reader treating a
 * deferred axis as an unfilled one.
 */
export type HairTier = "stated" | "anchored" | "realized" | "suppressed";

export const HAIR_AXES = [
  "hairColour",
  "hairStyle",
  "hairTexture",
  "hairModifiers",
  "wornState",
  "facialHair",
] as const;
export type HairAxis = (typeof HAIR_AXES)[number];

export type HairTiers = Record<HairAxis, HairTier>;

export type ResolvedHair = {
  colour: HairColour | null;
  realized: RealizedAxes;
  tiers: HairTiers;
};

export type HairResolverInput = {
  /** Which parts the brief settled, and the coverage case. */
  spoken: ReadonlySet<HairPart>;
  coverage: boolean;
  /** Present on a follow. Null when this candidate has no lineage. */
  anchored: (() => RealizedAxes | null) | null;
  anchoredColour: (() => HairColour) | null;
  /** Always available — the tier of last resort, and the one that varies. */
  realize: () => RealizedAxes;
  realizeColour: () => HairColour;
};

/**
 * Which axes each part of the brief silences.
 *
 * The cut owns its own components and its worn state, so a stated length takes
 * all three: authoring a curtain fringe onto a length the user named is
 * authoring inside a fact they stated. Texture and colour answer for themselves.
 *
 * Facial hair is absent on purpose — it is a different axis with its own gate
 * (`statedAxis("facialHair")`), and folding it in here would let a statement
 * about a jaw silence the scalp, which is a defect this codebase has already
 * shipped and fixed once.
 */
const SILENCED_BY: Record<HairPart, readonly HairAxis[]> = {
  cutLength: ["hairStyle", "hairModifiers", "wornState"],
  colour: ["hairColour"],
  texture: ["hairTexture"],
};

/**
 * Resolve every hair axis for one candidate, and record where each came from.
 *
 * Behaviour-preserving by construction: each tier is the function that already
 * implemented it. What changes is that the ORDER is written here rather than
 * spread across three call sites, and that the answer carries its provenance.
 */
export function resolveHairAxes(input: HairResolverInput): ResolvedHair {
  /*
    TIER 1 — STATED. Coverage silences everything (there is no cut on a bald
    man); otherwise each spoken part silences the axes it owns. Computed first
    so that the tiers below can never write into a silenced axis, which is the
    D-89 theorem expressed as control flow rather than as a convention.
  */
  const silenced = new Set<HairAxis>();
  if (input.coverage) {
    HAIR_AXES.forEach((axis) => axis !== "facialHair" && silenced.add(axis));
  } else {
    (Object.keys(SILENCED_BY) as HairPart[]).forEach((part) => {
      if (input.spoken.has(part)) SILENCED_BY[part].forEach((axis) => silenced.add(axis));
    });
  }

  /*
    TIER 3 — FOLLOW-ANCHORED, then TIER 5 — REALIZED.

    The anchored tier answers for the whole realized group or for none of it,
    and that coupling is deliberate rather than a limitation: a follow's drift
    moves the cut, its texture, its components and its worn state TOGETHER, so
    resolving them independently would strand a curtain fringe on a french crop.
    The unification is in the precedence being stated, not in pretending six
    coupled axes are six free ones.
  */
  const anchored = input.anchored?.() ?? null;
  const realized = anchored ?? input.realize();
  const groupTier: HairTier = anchored ? "anchored" : "realized";

  const colourTier: HairTier = input.anchoredColour ? "anchored" : "realized";
  const colour = input.anchoredColour ? input.anchoredColour() : input.realizeColour();

  const tiers = Object.fromEntries(
    HAIR_AXES.map((axis) => [
      axis,
      silenced.has(axis) ? "suppressed" : axis === "hairColour" ? colourTier : groupTier,
    ]),
  ) as HairTiers;

  return {
    colour: silenced.has("hairColour") ? null : colour,
    realized,
    tiers,
  };
}

/**
 * Blank what the tiers say was never authored.
 *
 * The record half of the same answer, kept beside the resolution rather than in
 * the compiler, so that "what was suppressed" is decided once. Applied AFTER
 * composition, because the prompt is built from the resolved values and the
 * record must describe the prompt that was actually sent.
 */
export function blankSuppressed(realized: RealizedAxes, tiers: HairTiers): RealizedAxes {
  const blanked = { ...realized };
  for (const axis of HAIR_AXES) {
    if (axis === "hairColour") continue;
    if (tiers[axis] === "suppressed") {
      (blanked as Record<string, unknown>)[axis] = null;
    }
  }
  return blanked;
}

/** The cut a candidate ended up with, or null when the brief owned it. */
export function cutOf(resolved: ResolvedHair): HairStyle | null {
  return resolved.tiers.hairStyle === "suppressed" ? null : resolved.realized.hairStyle;
}

export type { AgeBand, HeritageComponent, Sex };
