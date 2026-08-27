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
 * ⚠ REWRITTEN TO THE ROLE-FAMILY SPEC (#166, founder verbatim, 2026-08-27):
 * the first shape said *"cast a close relative of one person … Same sex, same
 * age … the face itself is new"*, and he read it at the sheet for what it is —
 * *"Image models read 'close relative' as same skull, slight remix. … That's
 * not a fork of the look. That's a reprint of the person."* The clause now
 * casts A ROLE FAMILY, his photographer sentence's shape: same casting brief,
 * new person; KEEP sex, age range, heritage, hair-colour family and the
 * grooming world; DO NOT COPY the face, the exact hairline, the bone
 * structure, or the expression. His success test binds the drive: *"you could
 * believe they are different talent on the same shortlist — not siblings, not
 * clones."* The words "close relative" and "relative" are forbidden in any
 * clause (arm in the suite), and his "Cast eight different people" closer is
 * adapted to per-picture language because a clause may never count the casts
 * (the "eight" ban below).
 *
 * What it says, and what it deliberately does not:
 *
 *   - A FOLLOW carries sex, age band, heritage, hair COLOUR and look — the
 *     axes the house follow holds on every candidate (`anchoredHeritage`,
 *     `anchoredHairColour`, `anchoredLook` in `cohortPhotorealHuman.ts`). The
 *     CUT is not carried: the house road's own taste ruling is *"one family,
 *     not one barber"*, and a named cut in words is a clone stamp. The realized
 *     axes (eye colour, brows, skin) are not carried — his answer (3).
 *   - "Cousins, not clones" is his answer (1), sharpened by #166 to the role
 *     family: the house follow varies the second heritage component per
 *     candidate and one prompt cannot, so the clause names the primary
 *     heritage through the one renderer the house composer uses
 *     (`describeHeritage`, law 4) and lets the engine vary.
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
 * the series. Its closer says "a different person", per picture, for that
 * reason — and never "each time", which narrates the series too.
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

/**
 * What holds on every portrait of a role family: the axes the anchor still
 * supplies after unlocks, in his list's own order (#166: *"Follow should hold:
 * sex, age band, heritage, hair-colour family, brief"* — plus the grooming
 * world, his own parenthesis, which is the look axis's name here). "Hair-colour
 * family", not "hair colour": the exact shade is a released detail.
 */
function holds(axes: ClauseAxes, anchor: FollowAnchor): string[] {
  const held: string[] = [];
  if (axes.sex) held.push("sex");
  if (axes.ageBand) held.push("age range");
  if (axes.heritage.length > 0) held.push("heritage");
  if (anchor.hair?.colour) held.push("hair-colour family");
  if (axes.look) held.push("grooming world");
  return held;
}

function joinHeld(held: string[]): string {
  if (held.length <= 1) return held.join("");
  return `${held.slice(0, -1).join(", ")} and ${held[held.length - 1]}`;
}

/**
 * The clause, or null when there is no follow to carry.
 *
 * `anchor` is the follow's anchor AFTER unlocks (`withUnlocksApplied`); an
 * anchor with every carried axis stripped still says "continue this family"
 * because the roll still IS a follow, and the engine is told what it may vary.
 *
 * A chip edit WITHOUT an anchor carries nothing here any more (#164): it used
 * to become "Cast as {person}; where this differs from the request above,
 * this wins." — the original plus an override plus a tie-breaker, the
 * fighting prompt his ruling kills. The edit is applied to the brief itself
 * now (`rewriteBrief`), so with no anchor there is nothing for a clause to
 * say. On a follow the overrides still replace their axes below, and the
 * clause states the same fact the rewritten brief states — consistent
 * repetition, never a fight, and no precedence sentence anywhere.
 */
export function familyClause(input: {
  anchor: FollowAnchor | null;
  overrides: LockOverrides | undefined;
}): CarriedIdentity | null {
  if (!input.anchor) return null;
  const overrides = nonNullOverrides(input.overrides);

  const axes = axesOf(input.anchor, overrides);
  const person = describe(axes).join(", ");

  /*
    His photographer sentence, shape for shape (#166): keep the booking
    brief's axes, release the person. The closer is per-picture ("a
    different person", never a count) because a clause that counts the
    casts paints a contact sheet — the "eight" ban, measured on roll 95.
  */
  const held = joinHeld(holds(axes, input.anchor));
  const keep = held.length > 0 ? `Keep the same ${held}. ` : "";
  const clause =
    `Continue this family: same casting brief, new person — ${person}. `
    + keep
    + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
    + "Cast a different person who could be booked for the same role.";
  return { follow: true, overrides, clause };
}
