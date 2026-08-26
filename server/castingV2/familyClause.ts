/**
 * THE FAMILY CLAUSE — how the author road carries a FOLLOW and a chip edit
 * (#154, design `docs/specs/CASTING_V2_AUTHOR_ROAD_FAMILY_CLAUSE_DESIGN.md`;
 * the founder's countersign, Crew reply #11, 2026-08-26 20:49Z, verbatim:
 * *"Yes to building it; (1) yes, let the engine vary; (2) yes, read-only chips
 * with the sentence; (3) no fine details. It is dark until it lands, and the
 * first follow on your account is the court."*).
 *
 * The author road paints eight frames from ONE prompt whose first paragraph
 * is the customer's words verbatim. The house road's follow and chip edits act
 * on the reader's structured record and reach the engine through per-candidate
 * prose the author road never writes — so until this module existed such a
 * roll dropped back to the house composer under the flag. This is the carry:
 * ONE paragraph, written by CODE from the anchor (after unlocks) and the
 * overrides, placed after the verbatim brief and before the author's content.
 *
 * What it says, and what it deliberately does not:
 *
 *   - A FOLLOW carries sex, age band, heritage, hair COLOUR and look — the
 *     axes the house follow holds on every candidate (`anchoredHeritage`,
 *     `anchoredHairColour`, `anchoredLook` in `cohortPhotorealHuman.ts`). The
 *     CUT is not carried: the house road's own taste ruling is *"one family,
 *     not one barber"*, and a named cut in words is a clone stamp. The realized
 *     axes (eye colour, brows, skin) are not carried — his answer (3).
 *   - "Cousins, not clones" is his answer (1): the house follow varies the
 *     second heritage component per candidate and one prompt cannot, so the
 *     clause names the primary heritage through the one renderer the house
 *     composer uses (`describeHeritage`, law 4) and lets the engine vary.
 *   - An OVERRIDE is a sentence the customer said with a control instead of
 *     the keyboard, so it becomes words — on a follow it REPLACES that axis in
 *     the family clause; on a plain authored roll it is the whole clause.
 *   - An UNLOCK on a follow strips the axis (the caller hands in the anchor
 *     with `withUnlocksApplied` already run). On a plain authored roll an
 *     unlock cannot do anything — the brief travels verbatim, so a chip derived
 *     from *"a woman in her 30s"* cannot be unsaid by removing it — and the
 *     sheet draws those chips read-only rather than offering a control that
 *     does nothing (`buildChips`).
 *
 * Its vocabulary is swept against `NEVER_WRITTEN` and the house sentences by
 * `familyClause.test.ts` over every value the closed vocabularies can produce:
 * the clause must never say "eight" (the first MAX roll painted 7 of 8 tiles
 * as contact-sheet grids when the author counted the casts) and never narrate
 * the series. It says "the face itself is new" for
 * that reason — and never "each time", which narrates the series too.
 */
import type { LockOverrides } from "./briefCompiler";
import { describeHeritage, type FollowAnchor } from "./cohortPhotorealHuman";
import type { AgeBand, AgePhase, ArchetypeKey, Build, EnergyKey, Heritage, HeritageComponent, LookKey, Sex } from "./castingIntent";
import type { HairColour } from "../../shared/castingVocabularies";

/** What the clause was written from — recorded on the row so the sheet can say (design §2d). */
export type CarriedIdentity = {
  /** True when a follow's anchor was carried; false when only chip edits were. */
  follow: boolean;
  /** The overrides that became words, non-null entries only. */
  overrides: LockOverrides;
  /** The paragraph itself — the same bytes that sit inside `register.prompt`. */
  clause: string;
};

const SUBJECT_NOUN: Record<Sex, string> = {
  female: "a woman",
  male: "a man",
  /* The house composer's own noun (`composeCandidatePrompt`), not a second phrasebook. */
  nonbinary: "an androgynous person",
};

/** "in their late 30s" — the phase only where one was stated (an override carries it; an anchor does not). */
export function agePhrase(band: AgeBand, phase: AgePhase | null): string {
  const qualifier = phase ? `${phase} ` : "";
  if (band === "70s+") return `in their ${qualifier}seventies or older`;
  if (band === "teens") return `in their ${qualifier}teens`;
  return `in their ${qualifier}${band}`;
}

/** The family clause's own phrasing of a hair colour: the colour holds on a follow; the cut does not. */
function hairPhrase(colour: HairColour): string {
  return `${colour} hair`;
}

const ENERGY_PHRASE: Record<EnergyKey, string> = {
  warm: "a warm, unhurried presence",
  dry: "a dry, flat presence",
  bright: "a bright, quick presence",
  grave: "a still, grave presence",
  open: "an open, easy presence",
  guarded: "a guarded presence",
  wry: "a wry presence",
  plain: "a plain, direct presence",
};

/**
 * The axes a clause can name, in the order the sentence reads them. Each is
 * null when neither the anchor nor an override supplies it.
 */
type ClauseAxes = {
  sex: Sex | null;
  ageBand: AgeBand | null;
  agePhase: AgePhase | null;
  heritage: HeritageComponent[];
  build: Build | null;
  energy: EnergyKey | null;
  look: LookKey | null;
  archetype: ArchetypeKey | null;
  hairColour: HairColour | null;
};

function nonNullOverrides(overrides: LockOverrides | undefined): LockOverrides {
  const kept: LockOverrides = {};
  for (const [field, value] of Object.entries(overrides ?? {})) {
    if (value != null) (kept as Record<string, unknown>)[field] = value;
  }
  return kept;
}

/**
 * Overrides beat the anchor on every axis they name, exactly as `applyOverrides`
 * runs last on the house road: "vary this" followed by "no, make it 40s"
 * resolves to 40s, and a follow whose age was overridden says the new age.
 */
function axesOf(anchor: FollowAnchor | null, overrides: LockOverrides): ClauseAxes {
  const heritageOverride: HeritageComponent[] | null = overrides.heritage
    ? [{ heritage: overrides.heritage as Heritage, pct: 100 }]
    : null;
  const ageBand = overrides.ageBand ?? anchor?.ageBand ?? null;
  return {
    sex: overrides.sex ?? anchor?.sex ?? null,
    ageBand,
    /*
      A phase has no sentence without a band ("in their late …" of what?), so
      it rides only beside one; the popover sends both together today, and a
      phase-only override reaching here would otherwise be dropped silently
      under a clause claiming precedence over an axis it never states (review
      of PR #156). Stated rather than assumed: the arm in `familyClause.test.ts`.
    */
    agePhase: ageBand ? (overrides.agePhase ?? null) : null,
    heritage: heritageOverride ?? anchor?.heritage ?? [],
    build: overrides.build ?? null,
    energy: overrides.energy ?? null,
    look: overrides.look ?? anchor?.look ?? null,
    archetype: overrides.archetype ?? null,
    hairColour: anchor?.hair?.colour ?? null,
  };
}

/** The description of the person, as a list the sentence joins: "a woman, in their 30s, of Nordic heritage, blonde hair, with a severe minimal look". */
function describe(axes: ClauseAxes): string[] {
  const parts: string[] = [];
  parts.push(axes.sex ? SUBJECT_NOUN[axes.sex] : "a person");
  if (axes.ageBand) parts.push(agePhrase(axes.ageBand, axes.agePhase));
  if (axes.heritage.length > 0) parts.push(`of ${describeHeritage(axes.heritage)}`);
  if (axes.build) parts.push(`${axes.build} build`);
  if (axes.hairColour) parts.push(hairPhrase(axes.hairColour));
  if (axes.look) parts.push(`with a ${axes.look} look`);
  if (axes.energy) parts.push(ENERGY_PHRASE[axes.energy]);
  if (axes.archetype) parts.push(`cast in the ${axes.archetype} direction`);
  return parts;
}

/** What holds on every portrait of a family: the axes the anchor still supplies after unlocks. */
function holds(axes: ClauseAxes, anchor: FollowAnchor): string[] {
  const held: string[] = [];
  if (axes.sex) held.push("same sex");
  if (axes.ageBand) held.push("same age");
  if (axes.heritage.length > 0) held.push("same heritage");
  if (anchor.hair?.colour) held.push("same hair colour");
  return held;
}

function joinHeld(held: string[]): string {
  if (held.length <= 1) return held.join("");
  return `${held.slice(0, -1).join(", ")} and ${held[held.length - 1]}`;
}

/**
 * The clause, or null when there is nothing to carry — no anchor and no
 * override — so a plain authored roll's prompt is exactly what it is today.
 *
 * `anchor` is the follow's anchor AFTER unlocks (`withUnlocksApplied`); an
 * anchor with every carried axis stripped still says "continue this family"
 * because the roll still IS a follow, and the engine is told what it may vary.
 */
export function familyClause(input: {
  anchor: FollowAnchor | null;
  overrides: LockOverrides | undefined;
}): CarriedIdentity | null {
  const overrides = nonNullOverrides(input.overrides);
  const edited = Object.keys(overrides).length > 0;
  if (!input.anchor && !edited) return null;

  const axes = axesOf(input.anchor, overrides);
  const person = describe(axes).join(", ");

  if (input.anchor) {
    const held = joinHeld(holds(axes, input.anchor));
    const second = held.length > 0 ? `${held}; the face itself is new.` : "the face itself is new.";
    const precedence = edited ? " Where this differs from the request above, this wins." : "";
    const clause =
      `Continue this family: cast a close relative of one person — ${person}. `
      + `${second.charAt(0).toUpperCase()}${second.slice(1)}${precedence}`;
    return { follow: true, overrides, clause };
  }

  /*
    PRECEDENCE, IN WORDS. On the house road a hand adjustment runs LAST and
    beats the reader (`applyOverrides`: "vary this" then "no, make it 40s" is
    40s). Here the brief above still says "in their 30s" verbatim and cannot
    be edited, so the clause states the same precedence the block's AUTHORITY
    paragraph states for defaults — otherwise the engine meets two ages and
    picks one.
  */
  /* Nothing stated (a phase with no band is the one way in) is nothing to carry. */
  if (describe(axes).length <= 1) return null;
  return { follow: false, overrides, clause: `Cast as ${person}; where this differs from the request above, this wins.` };
}
