/**
 * What a refinement is allowed to be ABOUT — the free lane's closed subjects
 * (D-131).
 *
 * # Subjects are code-owned. Only values are free.
 *
 * The tempting shape is a model-authored `{ axis, text }`, and it is wrong for
 * D-89's reason: it hands the composition key to the model. "Her brows" comes
 * back as `brows` one time, `brow shape` the next and `eyebrows` the third, so
 * last-writer-wins silently becomes accumulation and "thin" and "thick" end up
 * in one prompt arguing with each other. A closed subject list makes the
 * overwrite mechanical again.
 *
 * # This list IS wall (b)
 *
 * Person, never stage. There is no subject for a red coat, a backdrop or a
 * prop — so the wall is a **missing slot** rather than an instruction the model
 * is asked to respect. A wardrobe ask cannot be filed, and wall (d) says
 * anything that cannot be filed refuses.
 *
 * # And the guarantee lane is carved out of it by TYPE
 *
 * Anything with an engineered vocabulary is deliberately absent here, and
 * `GuaranteedSubjectsAreExcluded` below fails the build if one creeps in. That
 * is what stops "green eyes" quietly losing its iris prose and its
 * failed-candidate teeth by taking the free lane instead.
 */
import type { RefinableAxis } from "./refineDelta";
import {
  FREE_SUBJECT_KEYS,
  REPAINT_ONLY_SUBJECTS,
  SUBJECT_CARD_ENTRIES,
  subjectsWhere,
  tableOf,
  type FreeSubject,
} from "./subjectCards";

/**
 * The free-lane subjects, each with the heading its prose is composed under.
 *
 * Headings matter: the D-87 sweep's footprint check looks for `SUBJECT: value`
 * in the composed prompt, so a subject without a stable heading is a subject
 * the sweep cannot see.
 */
export const FREE_SUBJECTS: Record<FreeSubject, string> = tableOf((card) => card.heading);

/* Re-exported so every consumer keeps importing it from here. */
export type { FreeSubject };

export { FREE_SUBJECT_KEYS };

/** The subjects only the repaint road may serve — see the card field it comes
 *  from. Re-exported here so consumers keep importing the vocabulary from one
 *  place. */
export { REPAINT_ONLY_SUBJECTS };

/**
 * PRESENCE OR DEGREE — the split that decides whether an ask can REFUSE.
 *
 * # Why this table exists, and what it cost to learn
 *
 * `refineService` bound exactly one facet — `statedAccessories` — and every
 * other free subject was advisory, so a render could come back with NONE of
 * what the user typed, be correctly reported as such by the reader, and still
 * be charged for. Run 1 of the replay walk (2026-08-11, production, the
 * founder's own account) is the specimen: *"wear her hair down"* delivered a
 * high bun, the reader said **"hair pulled up into a high curly bun, not
 * down"** verbatim on both renders, the live reference library independently
 * refused the crop as `disputedDelivery` — and 25 credits were charged, twice.
 * The identical failure on the identical facet had already been refunded once
 * as a correction on 2026-08-07 (operation `92e327ab`, *"tie her hair up"*);
 * the response then was to make the READER re-read affirmatives (D-235), which
 * worked perfectly and changed nothing, because nothing consulted what it saw.
 *
 * D-246 class (c) — *"the asked thing COMPLETELY absent"* — is a founder ruling
 * and it is a runtime gate. The gate existed for accessories only because the
 * specimens arrived there first, and the old comment set the condition in as
 * many words: *"Each widening comes with its own specimens."* Run 1 is those
 * specimens.
 *
 * # The split, and why it is not "bind everything"
 *
 * D-187 is real and stays: asking a reader whether greenish-hazel is
 * *distinctly* "seafoam green" refunded six legitimate renders in eighteen.
 * The distinction the product can hold a reader to is the one already written
 * beside the old flag — **presence binds; degree advises**:
 *
 *   - **presence** — either the thing is in the picture or it is not. "Are
 *     there dangly cross earrings on her." "Is her hair down." A photograph
 *     answers it and two honest people agree on the answer.
 *   - **degree** — a matter of shade, amount, or quality nobody has defined.
 *     "Is this green *distinctly* seafoam." "Are these lips *fuller*." A
 *     photograph cannot settle it and a reader asked to try invents a verdict.
 *
 * # What actually makes the widening safe
 *
 * Not the shortness of the presence list — the ABSENCE GATE beside it. A
 * presence miss refuses only when the reader says the asked thing is *entirely
 * absent* (`FacetCheck.absent`), never when it merely quibbles with how the
 * thing was done. The must-not-fire specimen is run-10's: she asked for gold
 * hoop earrings, got gold hoop earrings, and the reader marked it unverified
 * because they were *"thin and understated, not bold hoops"* — an adjective she
 * never used. The hoops are IN the picture, so that is not an absence, so it
 * cannot refuse. See `renderVerification.FacetCheck.absent`.
 *
 * A subject classified `degree` here can never refuse however loudly a reader
 * complains; a subject classified `presence` refuses only on a worded absence.
 */
export const FREE_SUBJECT_KIND: Record<FreeSubject, "presence" | "degree"> =
  tableOf((card) => card.kind);

/** Whether an ask on this subject is one the product may refuse over. */
export function bindsOnPresence(subject: FreeSubject): boolean {
  return FREE_SUBJECT_KIND[subject] === "presence";
}

/**
 * WHAT PEOPLE CALL EACH CLOSED SUBJECT — the open lane's collision check reads
 * this, and nothing else does yet (OPEN_LANE_DESIGN_NOTE §1).
 *
 * # Why this table has to exist, measured before it was written
 *
 * The open lane keys an ask by a noun a model produced. §1 drove that and it
 * converged — with ONE systematic exception, 3/3 rather than a wobble:
 *
 *     "her cheeks should be covered in scales"  →  cheeks · cheeks · cheeks
 *
 * When the sentence makes the SITE its grammatical subject, the normalizer keys
 * the site instead of the thing. And `cheeks` is a hair's breadth from
 * `cheekbones`, **a subject the closed lane already owns** — so the failure
 * mode is not a wobbly key, it is an open key quietly becoming a face edit.
 *
 * The guard against it is to check every normalized kind against the closed
 * vocabulary before accepting it as new. **And the vocabulary it has to be
 * checked against is not this file's KEYS.** `cheeks` does not equal
 * `cheekbones`; `earrings` does not equal `statedAccessories`; `tattoo` does
 * not equal `ink`. A check written against the identifiers would have passed
 * the exact sentence that motivated it — the misaimed-guard class, which in
 * this campaign has now cost a carve-out and 28 clothing words.
 *
 * So: what a subject is CALLED, as a total function over the closed set. Total
 * on purpose — a subject added without its nouns will not compile, which is the
 * same construction the eight tables in §0 use and for the same reason. An
 * unowned axis falls silently to the loudest prior.
 *
 * # What this table is NOT
 *
 * It is not the interpreter's routing vocabulary and must never become it —
 * routing is the model's job through `freeSubjectGuidance`, and a second list
 * that decided routing would be working law 4's violation exactly. This list
 * answers one question: *is this noun already ours?*
 *
 * # Its honest limit, declared
 *
 * A synonym nobody listed passes as a new kind. That is a real hole and it is
 * not closable by cleverness — "what words name this feature" is information,
 * not derivation, and a fuzzy stem rule broad enough to catch the misses would
 * also swallow legitimate new kinds, which is the same bug pointed the other
 * way. **The demand table (§7) is the instrument for it**: a kind accumulating
 * rows that is obviously one of these subjects is a missing noun, visible in
 * the one place somebody is already looking.
 *
 * Plurals are folded by the reader, so a word need not be listed twice.
 */
export const SUBJECT_NOUNS: Record<FreeSubject, readonly string[]> =
  tableOf((card) => card.nouns);

/**
 * The one subject that files somewhere else.
 *
 * `readResolvedIdentity` passes unknown fields through whole, so an expression
 * filed into the identity blob would be inherited by every follow by default —
 * a momentary choice made permanent for eight strangers. It is separated here,
 * once, rather than remembered at each write site.
 */
export const PRESENTATION_NOUNS: Partial<Record<FreeSubject, string>> = Object.fromEntries(
  SUBJECT_CARD_ENTRIES
    .filter(([, card]) => card.presentationNoun !== null)
    .map(([subject, card]) => [subject, card.presentationNoun]),
);

export const PRESENTATION_SUBJECTS: readonly FreeSubject[] =
  Object.keys(PRESENTATION_NOUNS) as FreeSubject[];

export function isPresentationSubject(subject: FreeSubject): boolean {
  return PRESENTATION_SUBJECTS.includes(subject);
}

/** The recipe's word for a presentation subject, or null for every other one. */
export function presentationNounOf(subject: FreeSubject): string | null {
  return (PRESENTATION_NOUNS as Partial<Record<FreeSubject, string>>)[subject] ?? null;
}

/**
 * Subjects that are PLURAL — one slot holding a whole set.
 *
 * "a scar on her cheek and freckles across her nose" is one marks value, and a
 * later marks instruction restates the whole set absolutely rather than adding
 * to it. That keeps last-writer-wins honest: removal stays arithmetic, because
 * the value is always the complete current answer rather than an increment.
 */
export const PLURAL_SUBJECTS: readonly FreeSubject[] = subjectsWhere((card) => card.plural);

export function isPluralSubject(subject: FreeSubject): boolean {
  return PLURAL_SUBJECTS.includes(subject);
}

/**
 * Subjects whose things sit ON her and can therefore LEAVE (law 8).
 *
 * A departure is only the right shape where absence is a state a person can
 * actually be in. Glasses come off, a tattoo is removed, freckles clear, a beard
 * is shaved — for each of those "she is not wearing it" is a picture anyone can
 * imagine, and it is what the user means.
 *
 * **The fringe is why this list is short.** "Remove her fringe" is not a face
 * with a fringe-shaped hole in it; it is a HAIRCUT, and the founder's own ruling
 * is that a fringe is part of a cut rather than strands painted on a forehead.
 * A departed clause there — "no her fringe, it has been taken off" — is the
 * maths-class answer to a stylist's ask, and it would render as exactly the
 * absurdity it describes. Same for a nose, a jaw, an expression: those change,
 * they do not depart.
 *
 * So everything outside this list keeps the older road — the removal is re-read
 * as an ordinary edit, and the stylist's own answer ("a cut with no fringe") is
 * what reaches the painter. This is a deliberate boundary, not an oversight, and
 * it grows only with a named case.
 */
export const DEPARTABLE_SUBJECTS: readonly FreeSubject[] =
  subjectsWhere((card) => card.departable);

export function isDepartableSubject(subject: FreeSubject): boolean {
  return DEPARTABLE_SUBJECTS.includes(subject);
}

/*
  THE GUARANTEE-LANE CARVE-OUT, at compile time.

  Every axis with an engineered vocabulary must be ABSENT from the free
  subjects. Adding `eyeColour` here would stop the build rather than quietly
  costing every future "green eyes" its iris prose and its teeth.
*/
type GuaranteedSubjectsAreExcluded = Extract<FreeSubject, RefinableAxis> extends never ? true : never;
const _guaranteedSubjectsAreExcluded: GuaranteedSubjectsAreExcluded = true;
void _guaranteedSubjectsAreExcluded;

/**
 * THE SUBJECTS A BRANCH MAY BE ASKED ABOUT — one list, for everybody.
 *
 * Derived from `bornPathsServing` (item 8, shape ruled fable-1455 Q1), which
 * this file still reads rather than restates: a card saying `everyPath` is
 * served, and the one card saying `wardrobeOnly` is not.
 *
 * ⚠ **IT WAS A FUNCTION OF THE PATH UNTIL #203 SLICE 2, AND ITS ANSWER HAS NOT
 * MOVED A CHARACTER.** The path it asked about was `casting_rolls.path`, and
 * since slice 1 that column is written a constant `null` — so the only branch
 * that was ever served the whole vocabulary is one nobody can buy, and the
 * thirteen rolls in production that hold a path hold no candidate, which is to
 * say no branch at all. `subjectsServedOnPath(null)` returned these
 * twenty-nine; this constant IS those twenty-nine, and **the four precomputed
 * interpreter prompts were driven and hashed either side of the collapse and
 * did not move a character** — the four sha256s are in
 * `docs/specs/TWO_PATHS_PREDICATES_2026-09-24.md`. They are a RECORD and not a
 * guard on purpose: a pinned hash would redden on every honest edit to a prompt
 * sentence, which trains a reader to re-stamp it rather than read it. What
 * `bornPathSubjects.test.ts` guards instead is the thing the collapse could
 * actually break — that no prompt names a subject nothing serves.
 *
 * ⚠ **WHAT IS WITHHELD IS STILL WITHHELD, AND THAT IS NOT THIS FILE'S CALL TO
 * REVERSE.** The wardrobe subject is served to nobody, so an outfit ask meets
 * the same wall it has always met for every customer. Whether it should instead
 * become a capability for everyone is **#1148**, and it is a product decision
 * and a scope widening — a retirement that quietly widens something is the same
 * mistake as one that quietly narrows it.
 *
 * `docs/specs/TWO_PATHS_PREDICATES_2026-09-24.md` re-answers each of the
 * predicates in writing, and records what folding them together once cost:
 * reusing this WITHHOLDING as a refusal's condition turned *"put her in a long
 * black coat"* into a Basics refusal for the whole customer base. Two of the
 * three are now retired — §7.2's door and the panel's wardrobe section — and
 * each went on its own argument rather than on this one.
 */
export const SERVED_SUBJECTS: readonly FreeSubject[] =
  subjectsWhere((card) => card.bornPathsServing === "everyPath");

/**
 * The instruction the interpreter is given about where each free ask belongs.
 *
 * Built from the same constant the parser validates against, so the prompt and
 * the checker cannot drift — the failure that would otherwise show up as a
 * model dutifully using a subject the code has never heard of.
 *
 * ⚠ **THE ARGUMENT IS NOT A CONVENIENCE — it is what keeps item 8 dark.**
 * A subject added to this string is added to EVERY interpreter call, and this
 * program's own measurement is that prompt context is not additive: a SUBSET of
 * context raised the stage wall twice as often as its superset. So the wardrobe
 * subject reaches the prompt only where a branch may be served it, and the
 * flag-off prompt stays byte-identical to the one that shipped
 * (`refineOpenLaneClause.test.ts` pins that, and it caught this addition).
 *
 * ⚠ **AND THE DEFAULT IS `SERVED_SUBJECTS`, NOT EVERY KEY** (#203 slice 2). It
 * was `FREE_SUBJECT_KEYS` while a wardrobe branch existed to be served them
 * all; with that branch retired, a caller who omits the argument would be
 * handing the model the one subject nothing serves. No caller omits it today —
 * this is the trap closed rather than a behaviour changed.
 */
export function freeSubjectGuidance(
  served: readonly FreeSubject[] = SERVED_SUBJECTS,
): string {
  return served.join(", ");
}
