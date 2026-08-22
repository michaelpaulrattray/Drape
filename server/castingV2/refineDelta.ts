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
/* Value import, and the edge back is TYPE-ONLY (`OpenKindAsk`), so it is erased
   and there is no runtime cycle. */
import { readOpenKinds } from "./openLaneKind";
import { classifyInkPlacement, namesDesign, placementClause } from "./inkPlacement";
import type { WardrobeResolution } from "./wardrobeLine";
import { namesUnknownProperNoun } from "./properNouns";
import { tokensComeFromBrief } from "./castingIntent";
import {
  FREE_SUBJECT_KEYS,
  FREE_SUBJECTS,
  bindsOnPresence,
  isPluralSubject,
  isPresentationSubject,
  type FreeSubject,
} from "./refineSubjects";
import { qualifierFor } from "./subjectQualifiers";
import { accessoryKindOf, pairClauseFor } from "./accessoryKinds";
import { facetOfAxis, facetOfSubject, subjectsOfFacet, type Facet } from "./refineFacets";
import { isSurfaceFacet } from "./changeAmplitude";
import { composePreservation } from "./refinePreservation";
import { createModuleLogger } from "../logging/logger";
import {
  captionClause,
  captionWording,
  pinIdOf,
  withoutArrangementClaims,
  type RealizationCaptions,
} from "./realizationCaption";

/*
  The makeup cap moved to `makeupSlots.ts` on 2026-08-18 and is now DERIVED from
  the slot contract rather than chosen here. It was 80, judged for a world where
  makeup meant one typed adjustment — and a copied look is four surfaces at
  once, which needed 121 characters of that 80. Re-exported because the parse
  guard below is still where it is enforced, and callers of this module should
  not have to know which file the arithmetic lives in.
*/
export { MAX_MAKEUP_LENGTH } from "./makeupSlots";
import { MAX_MAKEUP_LENGTH } from "./makeupSlots";
import type { ResolvedIdentity } from "./castingIntent";

const log = createModuleLogger("castingV2/refineDelta");

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
  free?: Partial<Record<FreeSubject, FreeValue>>;
  /**
   * WHICH OF HER DESIGNS THIS STEP ACTUALLY PUT ON HER — keyed by ink slot,
   * holding the design row's public id (shape A, ruled fable-1167 §2).
   *
   * # The hole it fills, read off the wire
   *
   * A delivered tattoo did not survive the next unrelated edit. Step one
   * painted a chest piece; step two — *"give him green eyes"* — dispatched the
   * master and a hair crop, no ink reference and no ink clause, and the design
   * was gone (opus-864 §1). The chain still held the customer's ink WORDS the
   * whole time. What it did not hold was WHICH DESIGN, so nothing could put the
   * artwork back, and painting a tattoo from the surviving words alone is
   * D-137's forbidden render.
   *
   * # Why here and not on the design row
   *
   * `casting_ink_designs` records the design — its bytes, its place, its cut —
   * and is silent about whether anything was ever PAINTED with it. It cannot
   * stand in for this: the studio door files a row the moment a customer
   * attaches a picture, and road (D) files one at the shown-cut moment, before
   * her confirming tap. Riding rows would paint a tattoo she never asked for
   * onto her next unrelated edit, at full price.
   *
   * A column on the row was weighed and refused twice over. One column holds
   * one variant, so re-applying a design on a second branch MOVES the mark and
   * the first branch silently loses its tattoo; and an applications TABLE keyed
   * on the variant gets PRUNES wrong — a pruned ink step's variant is still in
   * the ancestry, so the design would go on riding after she took the ask back,
   * and the filter that would fix it (`slotsNamedByChain`) cannot name an ink
   * slot at all, because ink's assignment is per-placement and the placement is
   * a runtime fact.
   *
   * **The chain has none of those problems and it has them for free.** The
   * chain IS the branch, so a fork carries what its own steps did; a prune is
   * chain arithmetic that already runs, so a struck ink step composes away and
   * the master — which never had the design — does the removing.
   *
   * # It is written by CODE, never read off a model's reply
   *
   * The open lane's rule, verbatim and for a sharper reason. `readDelta` — the
   * strict reader guarding the boundary where a model's reply enters the record
   * — does NOT read this field and must not: a reply free to name a design id
   * would be a model choosing which of a customer's eight designs gets painted
   * onto her, which is the road `inkDesignForAsk` exists to own. It enters the
   * record only from the service that resolved the design itself, and comes
   * back out through `readStoredDelta`, which guards our own past.
   *
   * # And the id is re-checked, never trusted
   *
   * What rides is read from the ROW by this id, owner-scoped, digest-checked at
   * the recipe, and refused if its cut disposition is `null` — so a delta
   * naming a declined or unexamined design paints nothing. The id points; the
   * row decides.
   *
   * ⚠ **THE TWO-TATTOO LIMIT LIVES ONE FIELD ALONG** (filed fable-1167 §2e).
   * This record is per SLOT and composes per slot, so two placements coexist
   * here. `free.ink` does not — the free lane is last-writer-wins per subject,
   * so a second tattoo ask REPLACES the first's words in the composed delta.
   * The day a second design is served, that is the line to fix, and this one
   * is deliberately not made to agree with a limit it does not have.
   *
   * Absent on every delta written before this existed, which reads as *nothing
   * applied* — true of all of them.
   */
  inkApplied?: Readonly<Record<string, string>>;
  /**
   * AND THE PICTURE OF HOW IT LANDED — slot -> the delivered crop's own
   * `publicId` (migration 0050, ruled fable-1197 §1 as shape (c)).
   *
   * # Why `inkApplied` alone was not enough, and it is two failures not one
   *
   * **A words-only tattoo has no design.** D-137's road paints ink from the
   * customer's own sentence, so `inkApplied` — which is `slot -> designId` and
   * whose reader requires a UUID — can hold nothing for it. The delivery was
   * never recorded, never carried, and vanished on the next unrelated edit
   * (filed opus-888 §2, on the very lane fable-1180 §1 had just opened). This
   * field can hold it because a crop needs no design row: the picture of the
   * ink on her neck IS the carrier.
   *
   * **And the design lane was finding its crop by the wrong name.** The row
   * used to be keyed on (candidate, design, slot) and the carry matched it that
   * way; since 0050 the row is keyed on the DELIVERY, so a match on the design
   * is a match on less than the thing is keyed by. Both lanes now look a crop
   * up by the crop's own name.
   *
   * # It is written by CODE, and the id is minted BEFORE the crop exists
   *
   * `readDelta` — the strict reader guarding the boundary where a model's reply
   * enters the record — does NOT read this field and must not, for
   * `inkApplied`'s own reason one step sharper: a reply free to name a crop id
   * would be a model choosing which picture of a customer's body rides the next
   * render. It comes back out through `readStoredDelta`, which guards our own
   * past.
   *
   * The name is allocated at CLAIM time and handed to the mint, because the
   * delta is written at claim and no path amends it afterwards. So a render
   * whose ink never arrived — the mint answering `no-cut` — leaves this field
   * naming a row that does not exist. That is not a new hole: THE ID POINTS AND
   * THE ROW DECIDES is what `inkApplied` was written under for a design the
   * customer has since deleted, and the carry skips a missing row loudly.
   *
   * # It moves with `inkApplied` and with the WORDS, always
   *
   * Composed by the same rule and in the same loop, so the three halves of one
   * fact — her words, which design, which picture — can never disagree about
   * whether she still has a tattoo. A shared loop rather than a second copy of
   * the rule: `derive-never-mirror`, at the one place where a drift would leave
   * a paid removal not removing.
   *
   * Absent on every delta written before this existed, which reads as *nothing
   * delivered* — true of all of them.
   */
  inkDelivered?: Readonly<Record<string, string>>;
  /**
   * WHAT HAS LEFT HER — the one negative fact the recipe can hold (D-238).
   *
   * Every other field above is a positive assertion, and that omission is why no
   * removal of a BASE-WORN thing has ever worked in this product. A removal that
   * the chain can prune is arithmetic — the step goes, and the recipe stops
   * asking. A removal of something the ORIGINAL PHOTOGRAPH already had has
   * nothing to prune: her glasses came from the brief, no instruction ever added
   * them, and subtracting nothing from nothing leaves the glasses on her face.
   *
   * It was carried as a local variable that died with the request, so it reached
   * the mask-cutter and the fact-checker and never the painter — masked for,
   * verified for, refunded for, never ASKED for. Even with the clause added it
   * would have lasted exactly one render: renders are base-anchored, so her next
   * ask re-renders from the bespectacled original, and a recipe that cannot say
   * "not wearing glasses" resurrects them. Run-7's vanishing freckles in
   * reverse, at 100% reproduction.
   *
   * So the departure is a permanent fact about the recipe rather than an event.
   * Per subject, holding her own words, and json — old rows simply have no key,
   * which reads as nothing-departed, which is true of every row written before
   * this existed.
   */
  absent?: Partial<Record<FreeSubject, string[]>>;
  /**
   * A KIND NOBODY HAS CATALOGUED — the open lane's ask
   * (`OPEN_LANE_DESIGN_NOTE.md` §8 step 4, shape (a) ruled in fable-760 §2).
   *
   * Keyed by the normalizer's TOKEN — a single lowercase word, kebabbed
   * (`horns`, `cat-ears`) — which is also the tail of the slot key the lane
   * synthesizes (`open:cat-ears`). A record rather than a list for the free
   * lane's own reason: the key is the kind, so two instructions about horns
   * cannot accumulate into a recipe that argues with itself.
   *
   * # It is written by CODE, never read off a model's reply
   *
   * The lane is a FALLBACK, not a peer (§8 step 0) — the one choice here that
   * cannot be retrofitted. An open kind is named only after the closed
   * interpreter has declined, by `normalizeOpenKind`, whose answer is checked
   * against the closed vocabulary before it counts as new. So `readDelta` — the
   * strict reader that guards the boundary where a model's reply enters the
   * record — does NOT read this field, and must not: a reply free to name its
   * own kind could route *"give her wings"* into the open lane before the
   * closed lane ever declined, and wings would stop being eyeliner.
   *
   * `readStoredDelta` DOES read it, because that boundary is our own past
   * re-entering and history has already been paid for. Both directions are
   * pinned in `refineLegacy.test.ts`.
   *
   * # TWO READERS THAT DO NOT SEE IT, FILED RATHER THAN LEFT TO BE FOUND
   *
   * Both go through `readDelta` and therefore drop this field. Neither is a
   * defect today, because nothing writes one — the acceptance path is step 5 —
   * and both are step 5's to close, named here so that build finds them rather
   * than rediscovering them the way `parentVariantId` was rediscovered:
   *
   * - `filedSubjectsOf` — the headings the customer is shown for *where your
   *   words landed*. An open kind would land nowhere visible.
   * - `refineService`'s wall (d) re-read of the persisted row
   *   (`readDelta(variant.deltas)`), which feeds the paste road's prompt and
   *   the contradiction check. The repaint recipe is built from the ask list
   *   instead, so this one costs nothing on the road the open lane runs on.
   *
   * # An open kind has no facet, and that is what makes it CARRY
   *
   * `composeDeltas` clears a facet before the writers below run, and an open
   * kind is in none of those tables — so it survives every later edit until
   * something supersedes it by name. That is `openKindDeparture()`'s
   * `dropTheCarry` stated as arithmetic rather than as machinery: it is present
   * in a later frame only because the composition still carries it.
   */
  open?: Record<string, OpenKindAsk>;
};

/**
 * ONE OPEN KIND, AS THE RECORD HOLDS IT.
 *
 * Two fields on purpose (fable-775 §3): the KEY is an identifier and the NOUN
 * is the words. `cat ears` and `cat-ears` both key as `cat-ears`, so the noun
 * cannot be recovered from the key and must never be derived from it — the
 * reconstruction would be the second list that drifts (working law 4), and here
 * it would drift into a customer's face. Everything a person reads comes from
 * `noun`, spaces intact.
 */
export type OpenKindAsk = {
  /** The stylist's word for it, spaces intact — the only thing copy may read. */
  noun: string;
  /** Her own words about it: the state this feature is to be painted in. */
  words: string;
};

/**
 * THE ONE SENTENCE A DEPARTURE IS SAID IN — painter and reader share it.
 *
 * The prompt asks for the absence and the verification net checks for it, and
 * two hand-authored wordings of one fact is a second vocabulary waiting to
 * drift. So there is one function, `refineDelta.test` pins that the string the
 * reader is given appears VERBATIM in the prompt the painter is sent, and a
 * rewording that touches only one of them cannot pass.
 */
export function departedClause(item: string): string {
  return `no ${item} — they have been taken off and are not in the picture`;
}

/** The customer's half of the same fact — spliced into "came back ___". */
export function departedShortfall(item: string): string {
  return `with ${item} still in the picture`;
}

/** Everything a composed recipe says has left her, in her own words. */
export function departedItems(delta: RefineDelta): string[] {
  return Object.values(delta.absent ?? {}).flatMap((items) => items ?? []);
}

/**
 * Her words with the pointing word taken off the front.
 *
 * People type "remove HER glasses" and "take off THE necklace", and the match is
 * the phrase as they said it — so the two sentences a departure is spoken in
 * came out as "no her glasses" and "came back with the necklace still in the
 * picture". The second is fine and the first is not, and one of them is a
 * paid vision prompt.
 *
 * The mirror of the walk's article bug, which read "This face doesn't have
 * necklace" and was fixed by ADDING a word. Same lesson from the other side: a
 * noun phrase spliced into a frame has to be the bare noun, and the frame
 * supplies the grammar.
 *
 * Provenance is untouched — their sentence is stored whole as the chain step.
 */
export function departedNoun(match: string): string {
  const bare = match.trim().replace(/^(her|his|their|its|the|a|an)\s+/i, "").trim();
  return bare || match.trim();
}

/**
 * A free value is one thing, or SEVERAL (D-171).
 *
 * Plural subjects — marks, ink, accessories — hold their items structurally, so
 * removal can delete an ITEM rather than the whole step. A step reading "small
 * gold hoops and thin wire glasses" used to be deleted entirely by "remove the
 * hoops", and the glasses went with them.
 *
 * Rows written before this hold plain strings, so both shapes are read forever;
 * there is no migration, because this is a json column and a string is still a
 * perfectly good answer for a singular subject.
 */
export type FreeValue = string | string[];

/** Read either shape as a list — the form every guard now works in. */
export function itemsOf(value: FreeValue | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [value];
}

/** And back to prose, for a prompt or a record. Their order, never sorted. */
export function joinItems(value: FreeValue | undefined): string {
  return itemsOf(value).join(", ");
}

/**
 * Why an instruction was refused — the copy is the caller's, the reason is ours.
 *
 * The honest one, and the one users will meet, is a REAL ask the product cannot
 * do yet. It is deliberately NOT phrased as an error, because it is not one —
 * Refine is narrow on purpose, and the refusal is the product telling the truth
 * about its own edges.
 *
 * ⚠ This paragraph said `out_of_tier` until 2026-08-22, naming a reason that
 * never existed in the union below. Census card C1 gave the class an id at last
 * and it is NOT that word — see `wall_unbacked` for why the better-sounding
 * name is false on a beach. A header naming a member the type does not have is
 * how a reader ends up grepping for a door that was never built.
 */
export type RefineRefusal =
  /** A wall, and refusals always NAME theirs (D-131). */
  | { reason: "wall_likeness" }
  /**
   * `backed` says whether the STAGE LEXICON agreed with the model's claim.
   *
   * The interpreter already computes this — it checks a stage claim against
   * `stageWordIn` and gives the model one re-look when the sentence names no
   * stage word (`refineInterpreter.ts`, fable-363 ruling 1). Until it was
   * carried here the answer reached a log line and nothing else, so an UNBACKED
   * refusal was delivered in the BACKED refusal's words: *"horns is a garment, a
   * prop or the set"*, said to somebody who asked for something growing out of
   * her head. A false sentence is a worse refusal than a vague one.
   *
   * Absent means backed — every refusal written before this existed came from a
   * matched stage word, which is what the field says.
   */
  | { reason: "wall_stage"; asked: string; backed?: boolean }
  /**
   * THE MODEL CLAIMED A WALL AND THE LEXICON COULD NOT BACK IT — the unbacked
   * half of the wall above, given its own name (census card C1, ruled
   * fable-1336 §1).
   *
   * The two SENTENCES were already different and neither moves; only the RECORD
   * said they were the same thing, and the record is what a report counts.
   * Measured on the census the day it split: **five of the six rows that
   * reached `wall_stage` carried this sentence**, so the id the pair was named
   * for was the minority case, one row in six.
   *
   * ⚠ **The name is the CONDITION, never a claim about the subject, and two
   * better-sounding names died on exactly that.** `wall_out_of_tier` would say
   * *a real ask the product cannot do yet* — false of a beach, which IS the
   * shoot and lands here only because `STAGE_WORDS` has no `beach`, and false
   * of a tee the day the Two Paths road ships. `wall_unnamed` would collide
   * with `removal_unnamed`, where "unnamed" means SHE named nothing while here
   * it would mean WE could name nothing — one spelling, two subjects.
   *
   * So the pair means exactly what its two sentences claim and no more:
   * `wall_stage` is *provably the shoot*; this is *claimed out of scope,
   * unconfirmed*. It is named for the `backed?` field it derives from.
   */
  | { reason: "wall_unbacked"; asked: string }
  | { reason: "wall_content" }
  /**
   * `value` is WHAT THE MODEL ACTUALLY SAID, carried so the refusal can be
   * diagnosed instead of argued about.
   *
   * Run-11 met this wall on a plain three-word instruction and the reply was
   * unrecoverable an hour later — not because logs expire (they reach back to
   * container start) but because **the refusal path wrote nothing at all**. A
   * refusal that costs the customer nothing should not also cost us the ability
   * to tell why. Operator-log only; it never crosses a projection.
   */
  | { reason: "wall_unfileable"; asked: string; value?: string }
  /** Not a wall — a GATE. It names what does work and what is coming (D-137). */
  /**
   * ⚠ IT CARRIES WHICH PLACES THE ROAD SERVES THIS ACCOUNT (census 4(c)).
   *
   * The sentence names the surfaces words alone can document, and it named them
   * as a hard-coded *"a neck tattoo"* — to accounts whose upper arm was open
   * too. A refusal that under-states what the product can do is the
   * inert-control failure with its sign flipped, one copy string along, and the
   * fix is the one this file uses everywhere: the sentence is DERIVED from the
   * list that decides the road, so a placement joining `WORDS_ROAD_PLACEMENTS`
   * cannot be left behind in prose that has outgrown it.
   */
  | { reason: "gate_ink_document"; wordsRoadOpen: boolean }
  /**
   * A PLACE WE CAN SEE AND CANNOT KEEP — the words-road court's own answer
   * (opus-960, ratified fable-1301 §1). `place` is the surface in her own kind
   * of words, so the sentence can name it rather than apologise generically.
   */
  | { reason: "gate_ink_uncarried"; place: string; alternatives: readonly string[] }
  /**
   * THE SURFACE IS BARE AND THIS ROAD STILL CANNOT KEEP A RESULT THERE
   * (item 7a). `gate_ink_uncarried`'s twin, split from it because the two
   * reasons coincided while the product had one outfit: on a shirtless Basics
   * cast, *"your top covers your chest"* is false about the picture she is
   * looking at, and the true sentence is that the road cannot crop a result
   * there yet.
   */
  | { reason: "gate_ink_unkeepable"; place: string; alternatives: readonly string[] }
  /**
   * NOBODY HAS READ WHETHER THIS CAST'S OUTFIT LEAVES THE SURFACE SHOWING
   * (item 7a, fable-1368 ruling 1). Fails closed like a covering and says so in
   * its own words — a fail-closed gate that lies about WHY it closed is how a
   * customer learns to distrust every refusal this product writes.
   */
  | { reason: "gate_ink_coverage_unread"; place: string; alternatives: readonly string[] }
  | { reason: "unreadable" }
  | { reason: "empty" }
  /**
   * THE ASK WAS ABSORBED — everything filed was already true of her.
   *
   * Not a wall and not a gate: the sentence was read, it was fileable, and what
   * came back says only what she already is. Measured on the interpreter, three
   * of nineteen readings of *"give her freckles"* against a record holding
   * `marks: ["lightly freckled"]` came back as that item and nothing else — the
   * ask absorbed into a restatement of the prior.
   *
   * It is refused rather than recorded because of what happens if it is not:
   * the delta files, the render is dispatched, it changes nothing (there is
   * nothing to change), the customer is charged — and the verification net,
   * which checks `facetsWrittenBy(composed)`, has NO ROW for the thing she
   * actually asked for. That is a false pass by construction, and the
   * zero-false-pass bar cannot see it, because the check it would have failed
   * was never written down. A refusal costs a sentence; this costs the bar.
   */
  | { reason: "absorbed"; asked: string }
  /**
   * THE SAME THING, ABOUT A DEPARTURE (fable-480 §2).
   *
   * "A departure is new by definition" was the exemption at the top of
   * `saysNothingNew`, and it was true right up until the thing had already
   * left. On the founder's glasses it was the hole the wrong charge went
   * through: a reading that echoed a standing departure sailed past the one
   * door built to catch a reading that echoes the prior, and everything
   * downstream then worked perfectly on it.
   *
   * A separate reason because it needs a separate SENTENCE. "She already has
   * no glasses" is not English; what she can see is that they are already off.
   */
  | { reason: "absorbed_departure"; asked: string };

/**
 * What the box was asked to DO — classified once, at entry (D-163).
 *
 * Removal is typed rather than clicked, so the same free text carries three
 * different intents and the parser is what tells them apart. Two of the three
 * cost nothing, which is exactly why classification lives here: before the
 * claim, before the charge, in the step that was already free.
 *
 * `intent` is optional on an edit so that every existing caller and every test
 * mock which returns `{ ok: true, delta }` still means what it always meant.
 */
/**
 * WHICH WAY THE INVENTION DOOR WENT, when it ran at all (fable-498 §4).
 *
 * `rescued` — containment refused and the door read the value as saying only
 * what she asked, so the ask went through. `upheld` — the door agreed with
 * containment and the refusal stood. Absent on every parse the door never saw.
 *
 * It rides the parse because the interpreter knows the verdict and the SERVICE
 * knows the customer: the count has to be written where both are true.
 */
export type InventionDoorOutcome = "rescued" | "upheld";

/**
 * WHICH WALL THE DOOR WAS STANDING AT (fable-635 §2c).
 *
 * Three doors now produce `rescued` / `upheld`: the invention door at
 * `wall_unfileable`, the colour-context door at `wall_content`, and the
 * prior-context door at `wall_unbacked` — which UNTIL 2026-08-22 was
 * spelled "an UNBACKED `wall_stage`", the same door under the name the split
 * gave it (census card C1). Without
 * this the service's rescue count would file every rescue under the first
 * one's name — it hard-coded that reason, correctly, on the day it was the
 * only door — and the honest-ask-refused rate would be reading two different
 * populations as one.
 *
 * A closed pair rather than the whole `reason` union, so it can only ever mean
 * "a door ran here" and never drift into a second copy of the refusal reason.
 */
export type DoorAt = "wall_unfileable" | "wall_content" | "wall_unbacked";

export type RefineParse =
  | {
    ok: true;
    intent?: "edit";
    delta: RefineDelta;
    /**
     * A likeness comparison rode this ask and was set aside (D-181).
     *
     * The value files; the reference does not, and the outcome sentence says
     * so. D-172's invention shape applied to likeness — the scar files, the
     * knife fight does not.
     */
    droppedReference?: boolean;
    /**
     * SUBJECTS SHE NAMED THAT NOTHING FILED — the half-served record
     * (ruled fable-1374 §2, noun ruled fable-1376).
     *
     * `readDelta` records a subject it does not own and skips it; the open lane
     * then serves it, rescues it, or refuses it. What is left is a thing the
     * customer typed which reached no lane at all — and if the rest of the ask
     * survived, the render HAPPENED and was CHARGED. She typed two things, paid
     * once, and only one arrived.
     *
     * It is the KEYS and never the values: the value under an unowned subject is
     * model-authored text, and this list is read to write a sentence she reads.
     *
     * Absent on every ordinary ask, which is what makes it free.
     */
    unserved?: readonly string[];
    /**
     * THE VALUES IN THIS DELTA ARE TO COME FROM THE ATTACHED PICTURE
     * (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §10; the entrance, ruled
     * fable-1104 §2).
     *
     * Read only when a picture actually rides the ask, and it is what separates
     * the two sentences a reference road has to tell apart:
     *
     *     "copy this hair"        → she pointed AT the picture   → true
     *     "make her hair copper"  → a complete ask of her own    → absent
     *
     * Without it the second sentence takes the first one's road — the take
     * resolver defaults to the whole lot for ANY sentence, so a picture she
     * attached and did not mention would be cut and carried into a render that
     * already had its own value. It is a field on the CONTRACT rather than a
     * word test on the sentence because the thing being read is English: *"like
     * this"*, *"from the photo"* and *"copy that"* all point, and a list of
     * pointing words is the phrasing list D-163 outlaws as a class.
     *
     * Absent — never false — when nothing points, so a reply from before the
     * field and a reply that considered it and said no are the same fact: the
     * picture is unused, and the road confesses it.
     */
    fromReference?: boolean;
    /** Set when a door rescued this reading — see the type. */
    door?: InventionDoorOutcome;
    /** Which door — see `DoorAt`. Always present when `door` is. */
    doorAt?: DoorAt;
  }
  /** Bare "undo" / "go back" — free navigation, never a render. */
  | { ok: true; intent: "navigate" }
  /**
   * "Take the earrings off" — resolved against the RECIPE by the code.
   *
   * The model names the subject and hands back the user's own words; it does
   * not decide which steps go, and it never sees the chain.
   */
  | {
    ok: true;
    intent: "remove";
    subject: string | null;
    match: string | null;
    /**
     * DID THEY NAME THE WHOLE SUBJECT, OR A THING INSIDE IT?
     *
     * "Take off her earrings" and "take off all her jewellery" are different
     * asks in the user's own ontology (law 8), and the record has to be able to
     * tell them apart. It used to say so by leaving `match` EMPTY — and that is
     * the contract run-7 died on: a targeted removal whose words went missing
     * became indistinguishable from a genuine whole-subject one, so it deleted
     * every step on the facet, and the provenance check (which needs a noun to
     * ask the picture about) was skipped for both. Her paid earrings step went
     * with it.
     *
     * So the two facts are now carried separately: `match` is always their own
     * words, and this says how wide they meant it. A removal that arrives with
     * neither has said nothing the code can act on, and prunes nothing.
     */
    whole?: boolean;
    /**
     * The stored items this removal means, echoed VERBATIM (D-173).
     *
     * Referent resolution lives in the parser because it needs language:
     * "remove the earrings" has to find "small gold hoops", and knowing that
     * hoops ARE earrings is grammar, not string comparison. Every entry here
     * has already been proved to be exactly a stored item, so the code is
     * matching on identity rather than on word overlap — which is what stops a
     * user ever having to speak the machine's own tag.
     */
    items?: string[];
  }
  | {
    ok: false;
    refusal: RefineRefusal;
    /** Set when a door upheld this refusal — see the type. */
    door?: InventionDoorOutcome;
    /** Which door — see `DoorAt`. Always present when `door` is. */
    doorAt?: DoorAt;
    /**
     * RE-RUN CONTAINMENT ON THIS VERY REPLY, with the value this run refused
     * vouched (ruled fable-1141 §2).
     *
     * Present only on a `wall_unfileable` that carries its value, and set only
     * by the interpreter's own containment step — never by a caller, and never
     * on a parse that already carried a vouch.
     *
     * **It takes no argument, and that is the design.** The invention door used
     * to rescue by asking the model a second time with the value vouched, and a
     * second sampling is free to re-word the value the door has just
     * adjudicated — `"…IN the attached picture"` came back as `"…FROM the
     * attached picture"` and the vouch missed, throwing away a decision that
     * had already been made correctly. A closure with nothing to pass cannot
     * carry a different string: the reply and the pair are the ones this run
     * produced, so a re-wording is impossible rather than detected.
     */
    recheckVouched?: () => Promise<RefineParse | null>;
  };

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
  /**
   * What this subject already held — the second half of containment (D-171).
   *
   * A plural subject restates its whole set every time, so an honest
   * restatement carries words from EARLIER sentences. Without this the guard
   * refuses the very shape the interpreter is instructed to produce.
   */
  prior?: Partial<Record<FreeSubject, string[]>>;
  /**
   * ONE VALUE THE INVENTION DOOR HAS VOUCHED FOR (fable-494/495).
   *
   * Containment polices WORDS; the harm it exists to stop is invented FACTS,
   * and the two came apart for the fifth time on *"a harry potter LIGHTING
   * bolt scar"*: the model repaired his typo to "lightning" and containment
   * read the repair as a word he never said.
   *
   * There is no lexical rule that separates a repair from a change of meaning —
   * `shave` and `shape` are one character apart and are different facts about
   * her face — so the question is asked of a model and DECIDED by the code
   * (`interpretRefinement`'s invention door), and its answer arrives here as a
   * single vouched pair. One pair, and only for the value that failed: a
   * vouching that widened to a subject would be the guard switched off.
   */
  vouched?: { subject: string; value: string };
  /**
   * WHETHER A PICTURE SHE POINTED AT DOCUMENTS THIS ASK — the ink gate's second
   * answer (fable-1078, ruled fable-1116).
   *
   * Set by the interpreter, and only when BOTH are true: the reply's own
   * `fromReference` contract field came back true, and the account is inside
   * `CASTING_INK_REFERENCE_SCOPE`. It is one derived bit rather than the two
   * facts separately, because the reader has no business knowing about flags and
   * the gate has no business re-deciding what "pointed at" means.
   *
   * Absent means the gate behaves exactly as it always has.
   */
  inkDocumentedByReference?: boolean;
  /**
   * WHETHER THE DESIGN IS DOCUMENTED BY A PICTURE THIS PRODUCT ALREADY PAINTED
   * — the ink gate's THIRD answer (the transform road, opus-949).
   *
   * # The wall this opens, and why it is the same question rather than a wider one
   *
   * The gate has always asked ONE thing: *is there a document for this design*.
   * The anchor was the first answer, a photograph she pointed at the second, and
   * the third arrived with the delivery crop store (migration `0049`): **the
   * tattoo as it actually landed on her, kept by the mint**. An ask to make that
   * design BIGGER is not a design invented from a sentence — it is the same
   * documented design with one clause changed, and the picture on the wire is
   * the crop.
   *
   * Found by driving the real entrance rather than the service (fable-1288 §5):
   * *"his upper chest tattoo — make it bigger"*, the sentence the panel popover
   * itself composes, came back `gate_ink_document` — refused 1,860 lines before
   * the transform road it was built to reach. Five commits of road, unreachable,
   * which is the entrance-before-the-road class exactly.
   *
   * # It cannot open the wall for a FRESH tattoo, which is what the gate is for
   *
   * Set by the service and only when BOTH are true: the prior question read her
   * own sentence as pointing at ink she already has AND naming a change to it
   * (`inkPriorAsk` — a pointer, a change word, and no indefinite form), and the
   * branch really holds a delivered crop for a resolvable slot. *"Give him a
   * tattoo on his chest"* satisfies neither and still walls.
   *
   * Absent means the gate behaves exactly as it always has.
   */
  inkDocumentedByDelivery?: boolean;
  /**
   * WHETHER THIS ACCOUNT'S WORDS ROAD REACHES PAST HER NECK —
   * `CASTING_INK_WORDS_SCOPE`, resolved by the service.
   *
   * Absent means off, which is today's product for everybody: an ask naming an
   * upper arm or an upper chest walls here, free, before the claim. On, those
   * two join `neck` and the same ask renders and mints.
   *
   * It governs the INK lane only. The mark lane's list is not a capability
   * question and no flag moves it.
   */
  inkWordsRoadOpen?: boolean;
  /**
   * WHAT THIS CAST IS WEARING — the branch's resolution, from the one owner
   * (`currentWardrobeLine`), resolved by the service (item 7a).
   *
   * The RESOLUTION and not the line, because the three cases do not flatten:
   * absent and `unpathed` are *cast before the paths* and answer the house crew
   * tee — today's answer for all 206 production rolls, which is what makes this
   * landing dark — while `incoherent` is *this roll claims a path and cannot say
   * what it is wearing*, which must not read as a crew neck on a cast that might
   * be Basics.
   */
  wardrobe?: WardrobeResolution;
  /** Set when the value hit a wall, so the caller can name which one. */
  wall?: RefineRefusal;
  /**
   * SUBJECTS THIS READER DOES NOT OWN — recorded here, decided by the CALLER
   * (the open lane's acceptance path, `OPEN_LANE_DESIGN_NOTE` §8 step 5).
   *
   * # Why the decision cannot live in `readDelta`
   *
   * This reader guards the boundary where a MODEL'S REPLY enters the record,
   * and the open lane is a FALLBACK rather than a peer (§8 step 0 — the one
   * choice that cannot be retrofitted). A reader that minted an open kind from
   * an unknown key would let the model name its own composition key with no
   * closed lane in front of it, and *"give her wings"* would stop being
   * eyeliner. So this field carries the FACT and never the verdict: the caller
   * runs `normalizeOpenKind`, whose answer is checked against the closed
   * vocabulary before it counts as new, and only then is anything filed.
   *
   * It is the same shape as `wall` one line up, for the same reason.
   *
   * # And its PRESENCE is what changes the whole-delta null
   *
   * §2's standing defect: one unknown noun discarded every facet in the same
   * instruction, including the ones read correctly, and the user was told their
   * ask did not come through clearly. A caller that passes a `check` is asking
   * to be told — so for that caller the unowned subject is recorded and SKIPPED
   * and the rest of the delta survives.
   *
   * **A caller with no `check` is unchanged: the whole delta still nulls.**
   * Those callers are our own record re-entering (`refineService`'s persisted
   * re-read, `refineLegacy`, the paste road), where an unowned subject is
   * corruption rather than an ask, and partially accepting corruption is worse
   * than refusing it. That is the reader split, and both halves are driven.
   */
  unowned?: Array<{ subject: string; value: unknown }>;
};

/**
 * One adjustment per subject, not a paragraph — the DEFAULT, and every subject
 * took it until 2026-08-19.
 *
 * **Exported because a composer now has to fit inside it.** A composer judging
 * its own budget by a number typed beside this one is the mirror law 4 forbids:
 * it drifts the day somebody widens one of the two.
 */
export const MAX_FREE_LENGTH = 120;

/**
 * WHERE A SUBJECT NEEDS MORE ROOM THAN THE DEFAULT — and every entry carries
 * the arithmetic that produced its number (bound (a), fable-1088 §2).
 *
 * A bare table of numbers is the announced-cap trap in storage form: the next
 * person reads a figure somebody chose and treats it as measured. So an entry
 * here is only legitimate with its derivation beside it, and a subject absent
 * from this table takes {@link MAX_FREE_LENGTH}, which is what all of them did
 * until the first one earned otherwise.
 *
 * # WHY A TABLE RATHER THAN A WIDER SHARED NUMBER
 *
 * Raising the shared cap for one road gives teeth two hundred characters for no
 * reason anybody could state. **A hair colour is a longer fact than an eye
 * colour**, and that is a true thing about the subjects rather than a
 * concession to one feature.
 *
 * # hairShade — 220, and here is where it comes from
 *
 * `hairColourFromReference` composes a colour description as a list of blocks,
 * each one a tone, a place, and (when it is a side) a picture half spelled by
 * `sidePhrasing`. The founder's own blocked-colour specimen returns FIVE blocks,
 * and the sentence the reader's own answer composes to, **measured by composing
 * it rather than by adding the parts up**
 * (`court-hair-colour-words-disposable.mts`, 2026-08-19):
 *
 * ```
 *   dark brown at the roots                          23   running  23
 *   platinum blonde at the fringe (picture left)     44            69
 *   copper orange at the fringe (picture right)      43           114
 *   copper orange at the ends (picture left)         40           156
 *   platinum blonde at the ends (picture right)      43           201
 * ```
 *
 * At 120 that head arrived as **two blocks of five**, with the near-black roots
 * — the dominant tone — returned to her as leftovers.
 *
 * **The first version of this table said 198 and this cap was set to 200.** The
 * sum was hand-added from the block lengths and was three characters short, so
 * a cap derived from it dropped the last block by ONE character and the suite
 * caught it. Assert against the composed artifact, never against the figure you
 * printed about it — the same lesson as `margin-false-in-the-third-digit`, one
 * table along.
 *
 * **220 is 201 plus the ordinary variation between two readings of one head**,
 * which is a real quantity here rather than a padding instinct: the same
 * specimen composed to 157 on one reading and 201 on the next, so a cap sitting
 * exactly on one observation is a cap fitted to a coin toss.
 *
 * **And it is sized for the observed head, not for infinity** (bound (b)): the
 * composer still drops and still RETURNS what it dropped, so an eight-tone
 * monster is handled honestly rather than promised silently.
 */
const FREE_SUBJECT_MAX_LENGTH: Readonly<Partial<Record<FreeSubject, number>>> = Object.freeze({
  hairShade: 220,
});

/** The cap this subject's values are judged by. */
export function freeSubjectMaxLength(subject: FreeSubject): number {
  return FREE_SUBJECT_MAX_LENGTH[subject] ?? MAX_FREE_LENGTH;
}

/**
 * Words that mean somebody coloured hair on purpose (D-177).
 *
 * Not a phrasing list in D-163's sense — it is a closed set of VERBS for one
 * act, the way `namesDesign` is a closed set of nouns for one kind of thing.
 * The rule is "a dye word owns the hair drawer"; these are the dye words.
 */
const DYE_WORDS = ["dye", "dyed", "dyeing", "bleach", "bleached", "box colour", "box color", "highlights", "balayage", "ombre", "toner", "tinted"];

/**
 * Features that are NOT hair, even when a dye word is standing next to them.
 *
 * The roll side learned this once at a cost of sixteen tiles, and it is pinned
 * in `heritageNeighbourhoods.test` and `partialDeference.test`: **bleached brows
 * are makeup.** So are tinted moisturiser and a tinted lip. The dye word names
 * the ACT; this list names the thing the act was done to, and the named feature
 * wins — the same shape as D-176's "hairline contouring".
 *
 * It grows when a casualty is found, and each addition should name the casualty.
 */
const NOT_HAIR_FEATURES = [
  "brow", "brows", "eyebrow", "eyebrows",
  "lash", "lashes", "eyelash", "eyelashes",
  "moisturizer", "moisturiser", "skin",
  "lip", "lips", "nail", "nails",
];

/**
 * `\b` INSIDE A TEMPLATE LITERAL IS A BACKSPACE, NOT A WORD BOUNDARY.
 *
 * This shipped as ``new RegExp(`\b${word}\b`)``, which builds `\x08dyed\x08`
 * and matches nothing — so the D-177 backstop was **structurally inert from the
 * moment it landed**. The driver passed because the PROMPT obeyed, and a
 * backstop exists precisely for when the prompt does not: invariant 7's nastier
 * variant, in brand-new code.
 *
 * The log lied about it too — printing the regex renders the backspace as `\b`,
 * so it looked correct in every diagnostic.
 *
 * The lesson generalises and is now the standard: **if the only test for a
 * backstop goes through the interpreter, the backstop is untested.** Its tests
 * call `readDelta` directly, where no model can rescue it.
 */
const boundary = (word: string) => new RegExp(`\\b${word}\\b`);

/**
 * Does this makeup value actually belong in the HAIR drawer? (D-176, D-177.)
 *
 * Two owner declarations, one carve-out. The word "hair" names the drawer;
 * a dye word names an act only done to hair. Either is enough — unless the
 * value names a feature that is NOT hair, in which case the feature wins,
 * because "bleached brows" and "tinted moisturiser" are cosmetics whatever
 * verb sits beside them.
 */
export function namesHairColour(text: string): boolean {
  const lowered = text.toLowerCase();
  if (NOT_HAIR_FEATURES.some((feature) => boundary(feature).test(lowered))) return false;
  if (boundary("hair").test(lowered)) return true;
  return DYE_WORDS.some((word) => boundary(word).test(lowered));
}

/** And a set is a handful, not a second brief arriving as a list (D-171). */
const MAX_ITEMS = 8;

/*
  ─────────────────────────────────────────────────────────────────────────────
  A GUARD THAT REFUSES BY **ABSENCE** PROTECTS NOTHING ONCE A FALLBACK LANE
  STANDS BEHIND IT. A GUARD THAT REFUSES BY **ACTING** TRAVELS.

  Ordered onto the record by fable-875 §3, from the open lane's step-5a build,
  and written here because this is the wall it happened to.

  The rule that used to keep a garment out of a face edit was *"a red coat has
  no subject to file under"* — enforcement by there being no home for it. That
  is airtight for as long as an unfiled ask DIES. The open lane is a fallback
  whose entire job is to catch what no closed subject claimed, so the day it
  opened, `{coat: "red"}` arrived at its door in exactly the shape `{fangs: …}`
  does, and the first cut of the acceptance would have minted `open:coat` — the
  one wall keeping a face edit from repainting the room, turned into the new
  lane's front door.

  **The three-wall audit, run rather than reasoned** (law 7 — the class, not the
  instance):

    stage wall          refuses by ABSENCE  → BROKE. Fixed by asking this
                        lexicon of the open kind's NOUN as well as its words,
                        because in that ask the garment is the KEY and the value
                        is merely "red"
    source containment  refuses by ACTING   → travels. It measures a value
                        against the customer's sentence, and the open lane runs
                        it on the words it files
    brand scrub         refuses by ACTING   → travels. Same reason: it operates
                        on the text rather than on where the text was filed

  **And the way it was caught belongs in the rule.** Nothing failed. The arm
  that found it — *"refuses a subject the code does not own"*, asserting `coat`
  and `backdrop` — still passes and was never going to fail, because `readDelta`
  files nothing either way. It was read to confirm the change had not moved it,
  and the sentence read to confirm it is what said the new door had a hole. A
  test that cannot fail can still be a READING; that is not a reason to keep
  one, and it is a reason to read the ones you have when a lane opens behind
  them.

  Before adding any lane that catches what nothing else claimed, walk the guards
  in front of it and sort them into these two piles.
  ─────────────────────────────────────────────────────────────────────────────
*/
/**
 * Words that are about the STAGE, not the person — wall (b)'s second half.
 *
 * The closed subject list is the primary enforcement (a red coat has no subject
 * to file under), but a model can also smuggle scenery into a person subject:
 * "skin" carrying "against a red backdrop". Cheap to check, and the failure it
 * prevents is a paid edit that repaints the room.
 *
 * **Since step 5a it is also asked of an open kind's noun** — see the block
 * above for why, and for the class that made it necessary.
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

/**
 * DOES THEIR OWN SENTENCE NAME A STAGE WORD — the code's half of the stage wall
 * (fable-363 ruling 1).
 *
 * # What this is for, and the defect it closes
 *
 * `wall_stage` was the one refusal in the interpreter the code never re-checked:
 * `refineInterpreter` took the model's claim and returned it, while the real
 * instrument below never ran. Measured on the founder's own ask, *"make her
 * albino"* hit that wall **4 times in 5** and filed correctly the fifth — a
 * coin-flip wall on a legitimate face edit, which is the shape D-181 already
 * ruled blocking. Beside it, six body asks hit the same wall **18 times out of
 * 18**, perfectly stable. The wall is steady where the model is sure and flips
 * exactly where a real ask half-registers.
 *
 * # ITS ABSENCE IS NOT EVIDENCE OF ABSENCE, and the caller must treat it so
 *
 * This is a LEXICON. It can say "their sentence definitely names scenery"; it
 * can never say "their sentence definitely does not", because the list has no
 * `beach`, no `sofa`, no `jeans`, and no finite list ever would. So a `true`
 * here BACKS a refusal and a `false` only means the refusal is UNBACKED — which
 * is a reason to look again, never a licence to file. The caller does the
 * looking; this function does not decide.
 *
 * # The accessory carve-out travels with it (D-160)
 *
 * `readDelta` exempts "wearing" for the accessories subject, because that is how
 * anyone describes an earring. This site does not know the subject — there is no
 * parsed delta yet — so it applies the exemption rather than withholding it: the
 * failure being fixed is a wrong refusal, and a guard aimed at parsed VALUES,
 * re-pointed at the raw sentence without its carve-out, would refuse
 * *"wearing small gold hoops"* on the very word the carve-out exists for. Every
 * real garment ask names its garment too — "wearing a red coat" still fires on
 * `coat` — so nothing that should refuse stops refusing.
 */
export function stageWordIn(text: string): string | null {
  const lowered = text.toLowerCase();
  return STAGE_WORDS.find(
    (word) => !ACCESSORY_ALLOWED.has(word) && new RegExp(`\\b${word}\\b`).test(lowered),
  ) ?? null;
}

/** Runtime validation of the interpreter's reply — a closed vocabulary is only
    closed if something checks. */
export function readDelta(value: unknown, check?: FreeLaneCheck): RefineDelta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const delta: RefineDelta = {};
  /*
    A VALUE IN THE WRONG LANE IS NOT AN INVENTED VALUE (D-166's third finding).

    "Pastel pink hair" came back as `{hairColour: "pastel pink"}` — the right
    ask in the guaranteed slot, where the closed vocabulary cannot hold it. The
    whole reply was then discarded, and the user was told their perfectly clear
    instruction "didn't come through clearly". **It never worked as a first
    instruction**, which is most of why the founder saw it behave differently on
    different faces: it only ever succeeded when the model happened to file it
    free.

    So an out-of-vocabulary guaranteed value is DEMOTED to the free lane rather
    than rejected — the mirror of the hoist added for the opposite slip. The
    vocabulary stays closed: the value cannot pretend to be an enum, it gets no
    engineered prose, and it must still pass scrub, both walls and source
    containment down in the free lane.

    Demotion needs `check`, because containment is what separates the user's own
    words from a model invention. Without it there is no way to tell "violet"
    the honest ask from "violet" the hallucination, and the answer stays no.
  */
  const demoted: Record<string, unknown> = {};
  const guaranteed = <T extends string>(
    key: keyof RefineDelta, value: unknown, vocabulary: readonly T[], subject: FreeSubject,
  ): boolean => {
    if (vocabulary.includes(value as T)) {
      (delta as Record<string, unknown>)[key] = value;
      return true;
    }
    if (!check || typeof value !== "string") return false;
    demoted[subject] = value;
    return true;
  };

  if (raw.eyeColour != null
    && !guaranteed("eyeColour", raw.eyeColour, EYE_COLOURS, "eyeColourFree")) return null;
  if (raw.eyeShape != null
    && !guaranteed("eyeShape", raw.eyeShape, EYE_SHAPES, "eyeShapeFree")) return null;
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
    if (!guaranteed("hairStyle", raw.hairStyle, REFINABLE_CUT_NAMES, "hairCut")) return null;
  }
  if (raw.hairColour != null
    && !guaranteed("hairColour", raw.hairColour, HAIR_COLOURS, "hairShade")) return null;
  if (raw.hairTexture != null
    && !guaranteed("hairTexture", raw.hairTexture, HAIR_TEXTURES, "hairPattern")) return null;
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
    /*
      "HAIR" IN THE VALUE MEANS IT IS NOT MAKEUP (D-176).

      "Pastel pink hair color" filed as makeup, and that is not an ambiguity the
      bare-term defaults arbitrate — the word *hair* IS the owner declaration,
      supplied by the user, and filing it elsewhere throws away the one piece of
      disambiguation they gave.

      A word boundary is what keeps this narrow: "hairline contouring" says
      hairline and stays makeup. And it routes rather than refuses, so the ask
      still lands — in the drawer it named. The prompt says this too; a rule
      enforced only by asking nicely is not a rule.
    */
    /*
      AND A DYE WORD OWNS IT TOO (D-177).

      "Dyed pink", "bleached blonde" and "box colour red" were landing in three
      different drawers — makeup, the guaranteed colour, and a free shade — and
      they are one class. Dyeing is a thing done to HAIR, so the dye word is the
      owner declaration exactly as "hair" is, and D-89's older reading (a stated
      dye files as makeup/styling) is superseded now that hair has a drawer of
      its own to be declared for.
    */
    if (namesHairColour(cleaned)) {
      demoted.hairShade = cleaned;
    } else {
    /*
      MAKEUP IS FREE TEXT AND HAD NO CONTAINMENT AT ALL.

      Found while driving D-172: a reply came back with
      `makeup: "none — a bare face"` — the CONTEXT LINE from the user message,
      copied into the field. Nothing stopped it, because this slot is checked
      for length and brands and never for provenance, so any sentence the model
      produced would have gone into a paid prompt as an instruction.

      It is user-authored text like every other free value, so it faces the same
      question every other free value faces: did they say it?
    */
    if (check) {
      const strip = (text: string) => text.replace(/['’]/g, "");
      if (!stemmedContainment(strip(cleaned), strip(check.instruction))) {
        check.wall = { reason: "wall_unfileable", asked: "makeup", value: cleaned };
        return null;
      }
    }
    delta.makeup = cleaned;
    }
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
  const stated: Record<string, unknown> = {
    ...demoted,
    ...(raw.free as Record<string, unknown> | undefined ?? {}),
  };
  for (const key of FREE_SUBJECT_KEYS) {
    if (raw[key] != null && stated[key] == null) stated[key] = raw[key];
  }
  if (Object.keys(stated).length > 0) {
    const free: Partial<Record<FreeSubject, FreeValue>> = {};
    for (const [subject, entry] of Object.entries(stated)) {
      /*
        WALL (b), primary form: a subject the code does not own cannot be
        filed, and wall (d) says an ask that cannot be filed refuses. This is
        also what stops a model-authored subject key from becoming a
        composition key — D-89's gate on the free lane.

        SINCE STEP 5 IT IS RECORDED BEFORE IT REFUSES, and only for a caller
        that asked to be told (`check`). The refusal above is unchanged for
        every reader of our own record; what changes is that the live
        interpreter now learns WHICH subject it did not own, so the open lane
        can be tried at the caller — where the closed vocabulary is consulted
        first — instead of the ask dying here as "that didn't come through
        clearly". The whole-delta null was §2's standing defect: one unknown
        noun discarded every facet in the same instruction.

        This site still files NOTHING for the subject. It records and skips.
      */
      if (!FREE_SUBJECT_KEYS.includes(subject as FreeSubject)) {
        if (!check) return null;
        (check.unowned ??= []).push({ subject, value: entry });
        continue;
      }
      /*
        A PLURAL SUBJECT MAY ARRIVE AS A LIST (D-171), and the ITEMS are what
        every guard below runs against. The interpreter splits, because a code
        split on "and" is a phrasing list by another name and D-163 outlaws
        that class; the code validates each piece.
      */
      const plural = isPluralSubject(subject as FreeSubject);
      const rawItems = Array.isArray(entry) ? entry : [entry];
      if (!plural && rawItems.length > 1) return null;
      if (rawItems.length > MAX_ITEMS) return null;
      /* Each item carries WHERE ITS WARRANT CAME FROM, because that is what
         tells a replacement from an addition below (`supersedeWithinSet`). */
      const kept: SetItem[] = [];
      let promotedAway = false;

      for (const rawItem of rawItems) {
      if (typeof rawItem !== "string") return null;

      const scrubbed = scrubBrands(rawItem.trim())?.trim() ?? "";
      /* The subject's own cap, not one number for every drawer — see
         `FREE_SUBJECT_MAX_LENGTH`. Everything absent from that table is
         byte-unchanged at the old 120. */
      if (!scrubbed || scrubbed.length > freeSubjectMaxLength(subject as FreeSubject)) return null;
      /* False without a `check`: with no instruction and no prior to read,
         nothing here is known to be a restatement, and a set that supersedes on
         a guess is worse than one that accumulates. */
      let carriedRestatement = false;

      /*
        THE GUARANTEE LANE STAYS GUARANTEED. A value that an engineered
        vocabulary can express is PROMOTED into it, so "green eyes" routed here
        by an over-eager interpreter still lands with its iris prose and its
        failed-candidate teeth rather than as bare free text.
      */
      const promoted = promoteToGuaranteedLane(subject as FreeSubject, scrubbed, delta);
      if (promoted) { promotedAway = true; continue; }

      /*
        WHICH ITEMS THIS SENTENCE ACTUALLY ASKED FOR — read HERE, above the ink
        gate, because the gate is the first thing that needs the answer
        (fable-1326 §3, from the census's own pinned branch).

        `free.ink` is ONE subject holding every tattoo she has (fable-1167 §2e),
        and plural subjects are told to restate all of them. So on a branch
        already wearing a chest piece, *"give him a small swallow tattoo on his
        NECK"* comes back as two items — the new neck one and the restated chest
        one — and the gate below, which classified EVERY item, hit the carried
        chest first and refused the whole ask with the CHEST sentence. Nobody
        asked for the chest.

        Nothing new is measured for this. `alreadyStated` and `fromInstruction`
        are the two halves of source containment, which sat forty lines lower
        and already answered exactly this question for `carriedRestatement`;
        they are read once here and used twice (working law 4). Both are pure
        string reads, so moving them changes no value and no order of walls —
        the containment refusal itself still fires in its own place below.
      */
      const strip = (text: string) => text.replace(/['’]/g, "");
      const alreadyStated = check === undefined
        ? false
        : (check.prior?.[subject as FreeSubject] ?? [])
          .some((item) => strip(item).toLowerCase() === strip(scrubbed).toLowerCase());
      const fromInstruction = check === undefined
        ? false
        : stemmedContainment(strip(scrubbed), strip(check.instruction));
      /*
        An item warranted ONLY by the prior is the restatement we instructed the
        model to make; an item their sentence contains is what they said THIS
        time — even when it also happens to be filed already ("keep the gold
        hoops, add crosses" states both, deliberately).
      */
      const restatedFromPrior = alreadyStated && !fromInstruction;

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
      /*
        AND THE PICTURE IS A DOCUMENT (founder ruling relayed fable-1078,
        designed opus-822, ruled fable-1115/1116).

        > *"no any tattoo request from a reference image must be respected
        > regardless if u can see it or not"*

        The gate above has always been asking ONE question — *is there a
        document for this design* — and answering it with the only document that
        existed: the anchor itself. A photograph the customer attached and
        POINTED AT is the other answer, and it is the one his ruling is about.

        The condition is `inkDocumentedByReference`, which the interpreter sets
        only when the reply's own `fromReference` came back true AND the account
        is inside `CASTING_INK_REFERENCE_SCOPE`. Deliberately NOT the flag alone
        and NOT the presence of a handle: a picture riding along while she asks
        for something else documents nothing, so gating on the handle would open
        this wall for an ask that never mentioned her photograph.

        ⚠ WHAT THIS DOES NOT DO IS RENDER ANYTHING. Until the crop-from-photo
        cutter lands, the ask that gets through here is ANSWERED — the take and
        the side question — and never dispatched. The arm and the take shipped
        in one commit for exactly this reason: an opened gate with no cutter
        behind it is a tattoo rendered from words, which is the render D-137
        forbids and the one this gate was built to stop.
      */
      /*
        AND A TATTOO SHE ALREADY HAS IS NOT BEING ASKED FOR AGAIN.

        The gate asks *is there a document for this design*, and that question
        was answered the day the design arrived — by the anchor, by a picture
        she pointed at, or by the crop the delivery kept. Asking it a second
        time of a RESTATEMENT is asking it of a decision already made, and the
        answer it gives is about the wrong tattoo: on his own cast, a neck ask
        was refused with the chest sentence, twice at the census on the properly
        pinned branch and deterministically at the interpreter.

        Only the items her sentence did NOT ask for are skipped, so nothing a
        customer types can route around this gate — an item she typed is
        `fromInstruction` and goes through it exactly as before, whether or not
        she is already wearing one like it.
      */
      if (check && !restatedFromPrior
        && (subject === "ink" || (subject === "marks" && namesDesign(scrubbed)))) {
        if (
          !check.inkDocumentedByReference
          /* AND THE THIRD DOCUMENT — a tattoo this product already delivered and
             kept a crop of. See the field's own docblock: the question is
             unchanged, the answers are now three. */
          && !check.inkDocumentedByDelivery
        ) {
          /*
            THREE ANSWERS NOW, AND THE THIRD IS NOT A DOCUMENT PROBLEM (the
            words-road court, opus-960, ratified fable-1301 §1).

            `not_carried` is a place the vocabulary HOLDS and this road cannot
            KEEP — measured, visible, and under a garment the reader cannot see
            through, so the render would land and the crop would not. Sending
            that to `gate_ink_document` would tell somebody who named a real
            place that they need a design document, which is neither true nor
            actionable. It has its own wall and its own sentence.
          */
          /* THE LANE IS THE SUBJECT, and it decides which list answers — see
             `inkPlacement`'s per-lane note. The face carve-out is retired for
             `ink`, which dies at the measured-placement door anyway, and KEPT
             for a design-named mark, which renders on a face and always has. */
          const placement = classifyInkPlacement(
            scrubbed,
            subject === "ink" ? "ink" : "mark",
            check.inkWordsRoadOpen === true,
            /* AND WHAT THIS CAST IS WEARING (item 7a). Absent is silence, which
               is `unpathed`: every roll cast before the paths, answering the
               house crew tee — today's product, byte for byte. */
            check.wardrobe,
          );
          if (placement.kind === "not_carried") {
            check.wall = {
              reason: "gate_ink_uncarried",
              place: placement.place,
              alternatives: placement.alternatives,
            };
            return null;
          }
          /* Item 7a's two siblings. Same road, same wait, different true
             sentence — and the ALTERNATIVES ride with each of them, derived
             where both the account's road and this cast's outfit are in hand,
             so the copy cannot freeze the way `gate_ink_uncarried`'s did. */
          if (placement.kind === "road_cannot_keep") {
            check.wall = {
              reason: "gate_ink_unkeepable",
              place: placement.place,
              alternatives: placement.alternatives,
            };
            return null;
          }
          if (placement.kind === "coverage_unread") {
            check.wall = {
              reason: "gate_ink_coverage_unread",
              place: placement.place,
              alternatives: placement.alternatives,
            };
            return null;
          }
          if (placement.kind !== "in_frame") {
            check.wall = {
              reason: "gate_ink_document",
              /* The same bit the classifier above was handed, so the refusal
                 and the routing cannot disagree about which road she is on. */
              wordsRoadOpen: check.inkWordsRoadOpen === true,
            };
            return null;
          }
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
        /* `strip`, `alreadyStated` and `fromInstruction` are read ABOVE, where
           the ink gate needs them first. Same two reads, same values. */
        /*
          And STEMMED, for the same reason the apostrophe is stripped.

          "Tie her hair up" came back as "tied up" and was refused, because
          "tied" is not the token "tie". That is a morphological variant of the
          user's own word, not an invention — and a guard built to stop INVENTED
          CONTENT must not fire on a verb tense. The second time this exact
          shape has cost an honest instruction (D-157).
        */
        /*
          THE SOURCE IS THEIR SENTENCE **OR** SOMETHING THEY ALREADY STATED
          (D-171), and without the second half this guard has been refusing the
          product's own instruction to the model.

          Plural subjects are told to "restate all of them", so "add freckles"
          comes back as "a scar and freckles" — and containment refused it on
          the word *scar*, which they did not type THIS time because they typed
          it last time. The plural class has been refuse-or-annihilate on every
          second instruction, and both halves were invisible.

          Invention is still impossible: a model cannot introduce a fact that is
          in neither the sentence nor the prior items. Fourth instance of the
          guard-too-strict shape, and the first where the guard was refusing
          something we ourselves asked for.
        */
        /* The invention door's own answer about THIS value, exact on both the
           subject and the words — see `FreeLaneCheck.vouched`. */
        const vouchedHere = check.vouched !== undefined
          && check.vouched.subject === subject
          && strip(check.vouched.value).toLowerCase() === strip(scrubbed).toLowerCase();
        if (!alreadyStated && !fromInstruction && !vouchedHere) {
          check.wall = { reason: "wall_unfileable", asked: subject, value: scrubbed };
          return null;
        }
        /*
          AND THE SAME TWO SOURCES SAY WHICH ITEMS THIS SENTENCE ASKED FOR.

          An item warranted ONLY by the prior is the restatement we instructed
          the model to make; an item their sentence contains is what they said
          this time — even when it also happens to be filed already ("keep the
          gold hoops, add crosses" states both, deliberately). Nothing new is
          measured for this: it is the two halves of containment, read for the
          second question they can answer — and read ONCE, above the ink gate,
          which is the first door that needs the same answer.
        */
        carriedRestatement = restatedFromPrior;
      }
      kept.push({ value: scrubbed, carried: carriedRestatement });
      }

      if (kept.length === 0) {
        /* Everything here was promoted into the guaranteed lane, which is a
           success rather than an empty subject. */
        if (promotedAway) continue;
        return null;
      }
      /* THE ASK SUPERSEDES — the current set, never the accumulation. */
      const current = plural ? supersedeWithinSet(kept) : kept;
      /* An empty list is not "a subject with no items" — it is no subject, and
         `[]` being truthy would otherwise reach every reader downstream. */
      free[subject as FreeSubject] = plural
        ? current.map((item) => item.value)
        : current[0]!.value;
    }
    if (Object.keys(free).length > 0) delta.free = free;
    /*
      ONE INSTRUCTION MAY NOT ANSWER ONE FACET TWICE — and here the FREE lane
      wins (D-166's second finding).

      The interpreter is told the current values so relative asks can resolve
      against them, and it turns out to ECHO them: "pastel pink hair" came back
      as `{hairColour: "copper", free: {hairShade: "pastel pink"}}` — the
      current colour restated in the guaranteed slot beside the new one in the
      free slot. D-159's guaranteed-wins convention then did exactly what it was
      written to do for LEGACY rows, and kept the copper.

      **That is why pink stayed copper**, on a path entirely upstream of the
      preservation tail. Two defects wearing one symptom.

      Free wins because promotion has already run: a value expressible in the
      closed vocabulary was moved INTO the guaranteed lane and never reaches
      here, so anything still in the free lane is the ask the vocabulary could
      not hold — the new information, in the user's own words. The guaranteed
      value beside it can only be an echo of what the face already was.

      `composeDeltas` keeps guaranteed-wins for collisions ACROSS deltas, which
      is a different question with a different answer: those rows were written
      before facets existed, and there the engineered prose is what the pixels
      actually followed.
    */
    for (const subject of Object.keys(free) as FreeSubject[]) {
      const facet = facetOfSubject(subject);
      for (const axis of REFINABLE_AXES) {
        if (delta[axis] != null && facetOfAxis(axis) === facet) delete delta[axis];
      }
    }
  }

  /*
    THE DEPARTURES — read back from OUR OWN RECORD, never accepted from a model.

    `check` is exactly the model boundary: it is present when a reply is being
    validated and absent when a stored row is being re-read. A departure is
    authored by the code at the one place that has proved the thing is on her
    face, so a reply carrying `absent` has invented an authority it was never
    given — the interpreter is not even told the key exists. It refuses rather
    than being ignored, because a model that has started answering a question
    nobody asked is a model whose whole reply is suspect.
  */
  if (raw.absent != null) {
    if (check) return null;
    if (typeof raw.absent !== "object" || Array.isArray(raw.absent)) return null;
    const absent: Partial<Record<FreeSubject, string[]>> = {};
    for (const [subject, value] of Object.entries(raw.absent as Record<string, unknown>)) {
      if (!FREE_SUBJECT_KEYS.includes(subject as FreeSubject)) return null;
      if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
      const items = value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
          && item.length <= freeSubjectMaxLength(subject as FreeSubject),
      );
      if (items.length !== value.length) return null;
      /* An empty list is no subject here for the same reason it is no subject
         in the free lane — it would claim a facet while saying nothing. */
      if (items.length > 0) absent[subject as FreeSubject] = items;
    }
    if (Object.keys(absent).length > 0) delta.absent = absent;
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

/**
 * Which facets one delta ANSWERS — the unit composition supersedes on (D-159).
 *
 * Positive lanes only, and that is the whole of the distinction below: an answer
 * is a claim about what the facet IS, so a later one replaces whatever was said
 * before. **`[]` is not an answer.** An emptied plural subject reads as truthy
 * and used to claim its facet here, which would clear a live value on behalf of
 * a subject holding nothing — `readDelta` has always said "an empty list is not
 * a subject with no items, it is no subject", and this now agrees with it.
 */
export function facetsAnsweredBy(delta: RefineDelta): Set<Facet> {
  const facets = new Set<Facet>();
  for (const axis of REFINABLE_AXES) {
    if (delta[axis] != null) facets.add(facetOfAxis(axis));
  }
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    if (itemsOf(value).length > 0) facets.add(facetOfSubject(subject as FreeSubject));
  }
  return facets;
}

/**
 * Every VALUE a delta states, in its own words — the positive lanes only.
 *
 * `facetsAnsweredBy` says which questions a reading answered; this says what it
 * answered them WITH, which is a different question and the one the removal
 * backstop needs: a positive lane can hold a negation ("no earrings"), and the
 * code has to read the words to tell that apart from a thing to have.
 */
export function valuesFiledBy(delta: RefineDelta): string[] {
  const values: string[] = [];
  for (const axis of REFINABLE_AXES) {
    const value = delta[axis];
    if (typeof value === "string" && value.trim()) values.push(value);
  }
  for (const value of Object.values(delta.free ?? {})) values.push(...itemsOf(value));
  return values;
}

/**
 * Which facets one delta SAYS SOMETHING ABOUT — answers and departures alike.
 *
 * # Why this is two functions and not one, which is the load-bearing decision
 *
 * A departure has to reach every consumer that keys off the recipe, or it is the
 * blinded-consumer class again: the prompt must ask for it, the preservation
 * tail must stop protecting it, its guard must see it, the mask must cover it,
 * the net must check it. All of those ask "is this facet in play", and for a
 * departure the answer is yes. So `absent` belongs here.
 *
 * **But it must not reach the CLEAR.** `clearFacets` is symmetric — it drops
 * everything on the facet — and a departure sharing a facet with a positive
 * statement would then delete it. Walked on the founder's own shape: a chain
 * holding "small gold hoops" plus a base-worn "remove her glasses" are both
 * `statedAccessories`, so clearing on the departure takes the hoops out of the
 * recipe, and renders are base-anchored, so the next render stops asking for
 * them and the hoops she PAID for leave her face. That is run-7 one layer in,
 * and it is reachable by the ordinary road: the parser cannot echo "glasses"
 * against a recipe holding only hoops, so nothing matches, and nothing-matched
 * is exactly the base-worn road that writes a departure.
 *
 * The rule that separates them is a property of the two kinds rather than a case
 * in the composition, and it is one sentence:
 *
 *   **An answer replaces everything previously said about its facet, a departure
 *   included. A departure displaces no answers, and departures accumulate until
 *   an answer clears them.**
 *
 * Which is why the founder's remove-then-re-add still falls out by derivation:
 * "round wire-frame glasses" ANSWERS the facet, so the ordinary clear retires
 * the departure with no branch anywhere.
 */
export function facetsWrittenBy(delta: RefineDelta): Set<Facet> {
  const facets = facetsAnsweredBy(delta);
  for (const [subject, items] of Object.entries(delta.absent ?? {})) {
    if ((items ?? []).length > 0) facets.add(facetOfSubject(subject as FreeSubject));
  }
  return facets;
}

/** Clear every key — either positive lane — that answers one of these facets. */
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
 * The same recipe with some facets UNASKED — what the painter is told when the
 * compositor is going to supply those pixels instead.
 *
 * # Why a render ever asks for less than the recipe holds
 *
 * Renders are base-anchored: every render restates the whole recipe from the
 * master, so a facet delivered three edits ago is asked for again, painted
 * again, and re-rolled again. That is the drift the segment store exists to
 * end — and the store only ends it if the prompt STOPS ASKING for what the
 * composite is about to paste. Otherwise the paste lands and the fresh paint,
 * which is applied last by design, wins the pixels straight back.
 *
 * The first production walk of the segment architecture is the specimen: her
 * freckles were pasted-eligible and asked for anyway, so the painter re-rolled
 * them and lost them, twice, on renders she paid for.
 *
 * **Departures are deliberately NOT stripped.** A removal describes something
 * that is still on the master — it has to be performed on every render, forever,
 * and a segment can never supply an absence. `clearFacets` only touches the
 * positive lanes, which is exactly the half this needs.
 *
 * A copy, never a mutation: the recipe is the record, and only the ASK narrows.
 */
export function withoutFacets(delta: RefineDelta, facets: ReadonlySet<Facet>): RefineDelta {
  if (facets.size === 0) return delta;
  const copy: RefineDelta = { ...delta };
  if (delta.free) copy.free = { ...delta.free };
  clearFacets(copy, facets);
  return copy;
}

/**
 * Do these two descriptions name THE SAME THING? (D-238.)
 *
 * The kind table first, because it is knowledge rather than string overlap:
 * "round wire-frame glasses" and "tortoiseshell frames" are both eyewear
 * although they share no word, and "small gold hoops" is not eyewear although it
 * is worn on a head. Where the table knows both sides it is the answer.
 *
 * Otherwise the departed thing's own words have to appear in the answer — the
 * same containment the free lane already uses, deliberately not a new matcher.
 * `marks` and `ink` have no kind vocabulary, and this is what serves them: a
 * scar does not name freckles, so adding one retires nothing.
 */
/*
  EXPORTED since 2026-08-15, for the rail's take grouping (`railTakes.ts`).

  "Is this the same thing" is asked in two places now — the departure lane, and
  whether two renders are two TAKES of one edit — and a second implementation
  would be free to disagree with this one about whether "gold hoop earrings" and
  "gold hoops" name one object. One judgement, two callers (law 4).
*/
export function namesSameThing(departed: string, answer: string): boolean {
  const departedKind = accessoryKindOf(departed);
  const answerKind = accessoryKindOf(answer);
  if (departedKind && answerKind) return departedKind === answerKind;
  return stemmedContainment(departed, answer);
}

/** One item of a plural subject, beside the source that warranted it. */
type SetItem = {
  value: string;
  /**
   * True when the ONLY warrant for this item is the prior — i.e. it is the
   * restatement the interpreter was instructed to make, rather than something
   * this sentence says.
   */
  carried: boolean;
};

/**
 * THE ASK SUPERSEDES: a replacement within a set files the CURRENT set rather
 * than the accumulation (fable-312 ruling 1, D-244's doctrine one module over).
 *
 * # The picture that was paid for and not delivered
 *
 * Step 2 of the five-ask walk asked for **dangly cross earrings** on a face
 * already wearing hoops. The interpreter did exactly as instructed — plural
 * subjects "restate ALL of them including ones stated earlier" — so the delta
 * came back `["gold hoop earrings", "dangly cross earrings"]`, and the recipe
 * asked the painter for hoops AND crosses *"one on each ear, a matching pair"*.
 * That is not a picture that exists. The engine resolved the contradiction by
 * keeping the hoops; the gate found earrings and passed it; 25 credits.
 *
 * **On the old rule every replacement-of-an-item-in-a-set could false-pass by
 * construction**, because the item being replaced still satisfies the question
 * the new one was supposed to change.
 *
 * # Why this is subtraction and not a new instruction to the model
 *
 * D-244 already ruled the same thing for the library's words — a feature's
 * stack is its CURRENT state, one sentence, replacing — and the ask lane was
 * simply never brought under it. The restatement instruction stays exactly as
 * it is, because it is still what keeps a DIFFERENT kind of thing alive: the
 * glasses have to survive an ask about her ears. What changes is that the code,
 * which knows which items the sentence asked for and which were merely restated,
 * drops a restated item once this sentence names its own version of it.
 *
 * Deterministic knowledge, no paid-prompt change, and the same
 * {@link namesSameThing} the departure lane uses — a second answer to "are
 * these the same thing" is how the two would come to disagree (law 4).
 *
 * # What it deliberately does NOT do
 *
 * - **An item the user typed this time never supersedes another one they typed
 *   in the same breath.** "Keep the gold hoops, add crosses" is a mismatched
 *   pair asked for on purpose, and both are warranted by their own sentence.
 * - **Nothing is superseded by a set with no fresh item in it.** A pure
 *   restatement changes nothing here; `saysNothingNew` is the guard for that.
 * - **A kind the table cannot name falls back to containment**, so `marks` and
 *   `ink` keep accumulating exactly as D-171 designed — a scar does not name
 *   freckles, and adding one retires nothing.
 */
function supersedeWithinSet(items: readonly SetItem[]): SetItem[] {
  const asked = items.filter((item) => !item.carried);
  if (asked.length === 0) return [...items];
  return items.filter((item) => (
    !item.carried || !asked.some((fresh) => namesSameThing(item.value, fresh.value))
  ));
}

/**
 * Retire the departures a new answer has overtaken — scoped to the THING.
 *
 * # The subject is too coarse a unit, and that is the fourth direction
 *
 * Retiring every departure on an answered facet is right for a subject that
 * holds ONE fact: asking for stubble after "shave the beard" plainly retires the
 * departure. It is wrong for a plural subject, which holds a set:
 *
 *     "remove her glasses"  then  "round wire-frame glasses"   → retire
 *     "remove her glasses"  then  "small gold hoops"           → DO NOT retire
 *
 * Both answer `statedAccessories`. Retiring on the second would put her glasses
 * back on while she was asking about her ears — the same coarseness disease as
 * clearing paid work on a departure, one lane over. So a plural subject retires
 * per departed item, and only the items the new answer actually names.
 */
function retireDepartures(
  composed: RefineDelta,
  delta: RefineDelta,
  answered: ReadonlySet<Facet>,
): void {
  if (!composed.absent) return;
  for (const subject of Object.keys(composed.absent) as FreeSubject[]) {
    if (!answered.has(facetOfSubject(subject))) continue;
    const answers = itemsOf(delta.free?.[subject]);
    /* A singular subject holds one fact, so any answer replaces it. So does an
       answer that arrives without nameable items — there is nothing to compare
       against, and the conservative reading is that the facet was re-answered. */
    if (!isPluralSubject(subject) || answers.length === 0) {
      delete composed.absent[subject];
      continue;
    }
    const surviving = (composed.absent[subject] ?? []).filter(
      (departed) => !answers.some((answer) => namesSameThing(departed, answer)),
    );
    if (surviving.length > 0) composed.absent[subject] = surviving;
    else delete composed.absent[subject];
  }
  if (Object.keys(composed.absent).length === 0) delete composed.absent;
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
  const free: Partial<Record<FreeSubject, FreeValue>> = {};
  let collided = false;
  for (const [subject, value] of Object.entries(delta.free)) {
    if (guaranteed.has(facetOfSubject(subject as FreeSubject))) {
      collided = true;
      continue;
    }
    if (itemsOf(value).length > 0) free[subject as FreeSubject] = value;
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
/**
 * THE POINTER HALVES OF THE INK FACT — the fields that must compose exactly as
 * `free.ink` composes, and exactly as each other.
 *
 * A list rather than two hand-written blocks so that adding a third pointer is
 * one line and cannot land with a subtly different restatement rule. Ordered
 * only for readability; the loop is order-independent.
 */
export const INK_POINTER_FIELDS = ["inkApplied", "inkDelivered"] as const;

export function composeDeltas(deltas: readonly RefineDelta[]): RefineDelta {
  const composed: RefineDelta = {};
  for (const raw of deltas) {
    const delta = collapseWithinDelta(raw);
    /* Everything this delta is about loses its previous answer FIRST, in either
       lane, so the assignments below are the only surviving writers. */
    const answered = facetsAnsweredBy(delta);
    clearFacets(composed, answered);
    /* And the departures this answer has overtaken — per thing, not per facet,
       or "gold hoops" would put her glasses back on. */
    retireDepartures(composed, delta, answered);
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
    /*
      DEPARTURES ACCUMULATE — they do not spread over each other.

      A plain object spread is what the free lane does, and it is wrong here for
      a reason the free lane does not have: a plural subject restates its whole
      current set every time, so overwriting is honest, while each removal event
      names ONE thing and the code authors it. "Remove her glasses" then "remove
      her necklace" are both `statedAccessories`, and a spread would have put the
      necklace where the glasses were and quietly handed the glasses back.

      Nothing needs to un-accumulate: an ANSWER on the facet has already cleared
      the whole entry above, which is the only way something comes back.
    */
    if (delta.absent) {
      const absent: Partial<Record<FreeSubject, string[]>> = { ...(composed.absent ?? {}) };
      for (const [subject, items] of Object.entries(delta.absent)) {
        const already = absent[subject as FreeSubject] ?? [];
        const seen = new Set(already.map((item) => item.toLowerCase()));
        absent[subject as FreeSubject] = [
          ...already,
          ...(items ?? []).filter((item) => !seen.has(item.toLowerCase())),
        ];
      }
      composed.absent = absent;
    }
    /*
      AND THE OPEN KINDS, WHICH NOTHING ABOVE CAN CLEAR.

      Per-KIND last-writer-wins, exactly as the free lane spreads per subject
      and for the same reason: two asks about horns overwrite, horns and a tail
      coexist. What is different is the line above it — `clearFacets` is keyed
      by facet and an open kind has none, so nothing any later edit writes can
      take one away. **That is the carry**, and it is arithmetic rather than
      machinery: an open kind is in a later frame only because this line still
      carries it, and it leaves by not being carried (`openKindDeparture()` —
      `dropTheCarry`, never a vacancy sentence about a thing her master never
      had).

      Which is also why a prune removes one for free: `composeChain` runs this
      over the SURVIVING steps, so a chain without the step composes without
      the kind and the master — which never had it — does the removing.
    */
    if (delta.open) composed.open = { ...(composed.open ?? {}), ...delta.open };
    /*
      AND THE DESIGNS THIS STEP PUT ON HER — RESTATED WITH THEIR OWN WORDS.

      `inkApplied` is the pointer half of a fact whose word half is `free.ink`,
      and the one rule this needs is that the two halves can never disagree
      about whether she still has a tattoo. So the pointers are governed by the
      SUBJECT rather than by the facet: `ink` is a plural subject, which the
      note above says holds the whole current set as one value, restated
      absolutely — so a step that says anything at all about ink replaces the
      pointer set with its own, and a step that says nothing leaves it alone.

      That single rule covers all three states, measured against composition
      rather than assumed:

        an unrelated later edit    the design carries — THE WHOLE POINT
        a new design               the words are replaced and so are the
                                   pointers, together
        `free: {ink: []}`          she had it taken off: the words go empty and
                                   the pointers go with them

      The third is why this is not `clearFacets`' business. An emptied plural
      subject deliberately answers no facet (*"[] is not an answer"*), so a
      facet-keyed rule would leave the pointer standing while the words went
      empty — a paid removal that does not remove, which is this product's most
      expensive shape.

      And a prune removes one for free: `composeChain` runs this over the
      SURVIVING steps, so a chain without the ink step composes without the
      design, nothing carries it, and the master — which never had it — does the
      removing. The carry and the un-carry in one line.

      ⚠ THE ONE LIMIT, SHARED WITH THE WORDS AND FILED (fable-1167 §2e): a
      second design at a second placement does not accumulate, because the
      interpreter restates `free.ink` with the newest ask alone rather than the
      whole set. Both halves lose the first design together, so they stay in
      step and the record stays honest — but the day a Cast wears two, THIS is
      the line to fix and `free.ink`'s restatement is the line to fix first.
    */
    /*
      BOTH POINTER FIELDS, IN ONE LOOP — never two copies of the rule.

      `inkDelivered` (slot -> the delivered crop) obeys the paragraphs above
      identically, and the reason it shares this loop rather than getting its
      own is the reason the loop is worth reading twice: the three halves of one
      fact are her WORDS (`free.ink`), WHICH DESIGN (`inkApplied`) and WHICH
      PICTURE (`inkDelivered`), and the only thing that must never happen is
      that they disagree about whether she still has a tattoo. Two copies of a
      restatement rule drift, and the drift's cheapest shape is a paid removal
      where the words go empty and a pointer stays — which is this product's
      most expensive frame. `derive-never-mirror`, at the line that pays for it.
    */
    const inkRestated = delta.free !== undefined && "ink" in delta.free;
    for (const field of INK_POINTER_FIELDS) {
      if (!inkRestated && !delta[field]) continue;
      const next = inkRestated
        ? { ...(delta[field] ?? {}) }
        : { ...(composed[field] ?? {}), ...delta[field] };
      if (Object.keys(next).length === 0) delete composed[field];
      else composed[field] = next;
    }
  }
  return composed;
}

/**
 * THE ITEMS A FACET'S VALUE IS MADE OF, when that value is a SET the gate binds
 * on — and null for every other shape (fable-312 ruling 2).
 *
 * # The question the old shape could not be asked
 *
 * `statedAccessories` is one facet over a whole set of worn things, and the
 * verification net asked ONE question per facet: *"gold hoop earrings, dangly
 * cross earrings, one on each ear, a matching pair"*. A reader looking at a face
 * wearing hoops answers `present: true` to that, correctly — there are earrings
 * on her — and the gate that decides whether a render is delivered or refunded
 * had no way to fail. **"Are there dangly cross earrings on her" is answerable;
 * "are there hoops and crosses" is not.**
 *
 * # Derived from the same read `asked` comes from
 *
 * The subject is chosen by `subjectsOfFacet` order and the first stated one
 * wins — the identical walk {@link currentValueOfFacet} makes — so the items
 * returned here are exactly the pieces of the string that call site produces,
 * joined. A second walk over the same facet is how the question and the answer
 * would come to be about different things.
 *
 * Null unless the subject is BOTH plural and presence-shaped: a degree subject
 * has no teeth to sharpen, and a singular subject is already one question.
 */
export function presenceItemsOfFacet(
  delta: RefineDelta,
  facet: Facet,
): { subject: FreeSubject; items: string[] } | null {
  for (const subject of subjectsOfFacet(facet)) {
    const items = itemsOf(delta.free?.[subject]);
    if (items.length === 0) continue;
    if (!isPluralSubject(subject) || !bindsOnPresence(subject)) return null;
    return { subject, items };
  }
  return null;
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
    /*
      MARKS HAVE A SECOND HOME, and it is the one the DICE write (D-167).

      Freckles a person was rolled with are not a refinement — they are
      `realized.skinCharacter`, from the roll's own weights. Reading only the
      free lane would say "she has no freckles" about a visibly freckled face,
      which is the false confession this whole step exists to avoid.

      "Plain" is the registry's own silent value: it means nothing distinguishing,
      so it reads as absence rather than as a fact.
    */
    case "marks": {
      const skin = asText(realized.skinCharacter);
      return skin && skin !== "plain" ? skin : null;
    }
    default: return null;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * DOES THIS DELTA SAY ANYTHING THAT IS NOT ALREADY TRUE OF HER?
 *
 * The guard behind the `absorbed` refusal, and it is pointed deliberately at
 * OUR filing rather than at her sentence.
 *
 * Containment already guards the other direction — an item in neither her words
 * nor the record is an invention and is refused. That guard protects her from
 * the model inventing; nothing protected her from the model LOSING her. Asked
 * to restate every item of a plural subject, it sometimes returns the
 * restatement and drops the ask, and a delta that only repeats the prior is a
 * render that changes nothing, charged for.
 *
 * This direction is the safe one to check, and that is why it is this one: it
 * can never refuse her for the model's eloquence, only refuse the model for
 * losing her. A richer phrasing of her ask still differs from what she already
 * was, so it passes here; only an exact echo of her current state does not.
 *
 * The comparison is per subject and per facet against what the face IS now —
 * the free lane against the items already filed for that subject, the labelled
 * axes against `currentValueOfFacet`. A departure always says something new by
 * construction: nothing that has left is still true of her.
 */
export function saysNothingNew(input: {
  delta: RefineDelta;
  /** What each free subject already held — the same map the parse was shown. */
  prior: Partial<Record<FreeSubject, string[]>>;
  /**
   * What has ALREADY LEFT, from the composed recipe she is standing on.
   *
   * The exemption below used to be unconditional, and that was the hole the
   * founder's wrong charge went through (fable-480 §2). Optional so a caller
   * that cannot supply it gets exactly the old behaviour — a departure with no
   * prior to compare against is new, which is what it was before this existed.
   */
  priorAbsent?: Partial<Record<FreeSubject, string[]>>;
  /**
   * WHICH DESIGN THIS INK ASK POINTS AT, AND WHICH ARE ALREADY ON HER.
   *
   * **AN INK SUBJECT'S IDENTITY LIVES IN BYTES, NOT WORDS** (ruled fable-1173
   * §1, shape countersigned fable-1174 §1), and that asymmetry with every other
   * subject's door is DELIBERATE rather than discovered.
   *
   * The reason is a measured fact about the words themselves: an ask that
   * points at an attached picture spells the SAME SENTENCE for every design —
   * *"the tattoo design in the attached picture on her neck"* — because the
   * words name the place and the picture, never the artwork. So two different
   * designs at one address are word-identical, the last writer wins the
   * spelling, and this door reads the second ask as an echo of the first and
   * refuses it free. That is the exact customer the replace offer was built
   * for, turned away one door before it.
   *
   * Every other subject keeps answering by WORDS, because their words ARE
   * discriminating: "meadow green" and "icey blue" are not the same sentence.
   * If a second subject ever grows a byte identity, this docblock is its
   * precedent rather than its accident.
   *
   * `askDigest` is the sha256 of the attachment the ask points at;
   * `appliedDigests` is the `sourceDigest` of every design the chain records as
   * already applied. A HAND-UPLOADED design has no source picture, so its
   * digest is null and is never in this list — an ask pointing at a picture
   * therefore stands aside from it, which is right: it did not come out of that
   * picture.
   *
   * Optional, and absent means exactly today's behaviour — the `priorAbsent`
   * precedent above. **The caller supplies it only for an ask that names ink
   * from the attached picture, and `namesInkFromReference` is the one owner of
   * that decision** — the same predicate that decides whether the tattoo branch
   * is entered at all, so this door and that branch cannot come to disagree
   * about what an ink ask is.
   */
  inkPointer?: {
    askDigest: string | null;
    appliedDigests: readonly string[];
  };
  /**
   * ⚠ WHAT THE FRAME SHE IS LOOKING AT NO LONGER HAS (ordered fable-1244 §2b,
   * countersigned fable-1250 §1).
   *
   * # The trap, and it was his
   *
   * He set a jacked build, asked for a neck tattoo, and the render dropped the
   * build. He asked for the build again — and was told *"already has jacked
   * build — this would have changed nothing, so nothing was charged."*
   *
   * **The absorption was right about the CHAIN and wrong about the FRAME.** The
   * chain does say jacked build; the picture in front of him does not. So a
   * dropped feature that the record still claims became a dropped feature
   * nobody could re-buy — LOST-UNDER-WORDS plus ABSORBED-ON-REASK, and the
   * customer could not self-heal the exact state the carry break had created.
   *
   * # The discriminator, and it costs nothing
   *
   * Every delivered render stores its own verification on its row. A facet
   * whose check there reads `read ∧ !verified` is one this frame's own reader
   * looked for and did not find. An ask naming it is NEW, however exactly its
   * words repeat the chain.
   *
   * This is `inkPointer`'s precedent one door along, for the third time in this
   * function: **when words cannot discriminate, consult what actually
   * happened.** Optional, and absent means exactly today's behaviour, byte for
   * byte — the `priorAbsent` shape.
   *
   * # What it deliberately does NOT do
   *
   * It never reads a facet the verifier did not look at, and it does not touch
   * the DEPARTURE direction: an item a reader disputes as still-present is a
   * different question and would want its own measurement before a re-ask of
   * *"take it off"* stopped being absorbed.
   */
  disputedFacets?: readonly Facet[];
  identity: ResolvedIdentity | null | undefined;
}): { absorbed: false } | { absorbed: true; alreadyTrue: string; departed?: boolean } {
  const { delta } = input;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  /*
    THE PICTURE SHE IS POINTING AT IS NOT ONE OF THE ONES ALREADY ON HER — so
    this ask says something new whatever its words repeat. See `inkPointer`.

    A null `askDigest` is an ask carrying no picture, and that is the words-only
    lane: unchanged, byte for byte, by construction.
  */
  const pointer = input.inkPointer;
  if (pointer && pointer.askDigest !== null) {
    const askDigest = pointer.askDigest;
    if (!pointer.appliedDigests.some((applied) => same(applied, askDigest))) {
      return { absorbed: false };
    }
  }
  const echoed: string[] = [];
  /*
    A DEPARTURE IS NEW BY DEFINITION — UNLESS IT HAS ALREADY LEFT.

    She was wearing it a moment ago, so "take it off" always said something...
    right up until the recipe already said it was off. Then the reading is an
    echo like any other, and it was the ONE echo this door could not see: every
    other subject's restatement is caught below, and a removal's restatement
    skipped the whole function. That is how a restyle read as a removal reached
    a paid render (opus-363).
  */
  const gone: string[] = [];
  for (const subject of FREE_SUBJECT_KEYS) {
    const departures = itemsOf(delta.absent?.[subject]);
    if (departures.length === 0) continue;
    const already = input.priorAbsent?.[subject] ?? [];
    /* One genuinely new departure makes the whole delta new — she is asking
       for something to go that has not gone. */
    if (!departures.every((item) => already.some((held) => same(held, item)))) {
      return { absorbed: false };
    }
    gone.push(...departures);
  }

  /* See `disputedFacets`. A `Set` because both loops below ask it per item. */
  const disputed = new Set<Facet>(input.disputedFacets ?? []);

  for (const subject of FREE_SUBJECT_KEYS) {
    const filed = itemsOf(delta.free?.[subject]);
    if (filed.length === 0) continue;
    /* THE FRAME DISAGREES WITH THE CHAIN — his build. Asked for again, this is
       not a repeat: it is the one sentence that is true about the picture. */
    if (disputed.has(facetOfSubject(subject))) return { absorbed: false };
    const already = input.prior[subject] ?? [];
    for (const item of filed) {
      if (!already.some((held) => same(held, item))) return { absorbed: false };
      echoed.push(item);
    }
  }

  const labelled: [keyof RefineDelta, Facet][] = [
    ["eyeColour", "eye.colour"],
    ["eyeShape", "eye.shape"],
    ["hairStyle", "hair.cut"],
    ["hairColour", "hair.colour"],
    ["hairTexture", "hair.texture"],
    ["makeup", "makeup"],
  ];
  for (const [field, facet] of labelled) {
    const filed = asText(delta[field]);
    if (filed === null) continue;
    /* The same question on the guaranteed lane: a hair colour the chain holds
       and this frame's own reader could not find is a re-ask, not an echo. */
    if (disputed.has(facet)) return { absorbed: false };
    const current = currentValueOfFacet(input.identity, facet);
    if (current === null || !same(current, filed)) return { absorbed: false };
    echoed.push(filed);
  }

  /*
    NOTHING FILED AT ALL is not this refusal's business. An empty delta reaches
    the free-question and rule-3 paths, which have their own answers; claiming
    it here would take a sentence those paths handle away from them.
  */
  if (echoed.length === 0 && gone.length === 0) return { absorbed: false };
  /*
    A DELTA THAT ONLY RESTATES A DEPARTURE gets the departure's own sentence:
    "she already has no glasses" is not English, and what she can see is that
    they are already off. A delta that echoes BOTH is described by the positive
    half, which is the half she named.
  */
  if (echoed.length === 0) {
    return { absorbed: true, alreadyTrue: gone.join(", "), departed: true };
  }
  return { absorbed: true, alreadyTrue: echoed.join(", ") };
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
  const subjects: string[] = [];
  /*
    AN OPEN KIND IS READ FIRST, AND THAT ORDER IS THE WHOLE FIX.

    `readDelta` does not see `open` at all, so a delta holding ONLY an open kind
    — *"give him fangs"*, which is the ordinary shape of an open ask rather than
    a corner — reads as an EMPTY delta and nulls. Behind the early return that
    used to sit here, the customer with the purest open ask in the product got
    no chip whatsoever.

    Found by sabotage rather than by reading: the control arm for this loop was
    written against an open-only delta and passed while the loop was
    unreachable, because `not.toContain` on an empty array cannot fail. An
    assertion that cannot fail on a blank surface is the class this campaign has
    already paid for; it caught itself here only because the positive arm beside
    it carried a second subject.
  */
  const open = Object.values(readOpenKinds(deltas) ?? {}).map((ask) => ask.noun.toUpperCase());
  const delta = readDelta(deltas);
  /* Its CHIPS stay in the order they have always been shown in — last, after
     the subjects the closed lane names — but the READ has to happen above,
     because the delta being empty is the very case this closes. */
  if (!delta) return Array.from(new Set(open));
  if (delta.eyeColour) subjects.push("EYE COLOUR");
  if (delta.eyeShape) subjects.push("EYE SHAPE");
  if (delta.hairStyle) subjects.push("HAIR CUT");
  if (delta.hairColour) subjects.push("HAIR COLOUR");
  if (delta.hairTexture) subjects.push("HAIR TEXTURE");
  if (delta.makeup) subjects.push("MAKEUP");
  for (const subject of Object.keys(delta.free ?? {})) {
    subjects.push(FREE_SUBJECTS[subject as FreeSubject]);
  }
  /* A removal landed somewhere too, and the chip is where the user reads that
     it did. A departure with no heading is a paid edit that filed nowhere. */
  for (const subject of Object.keys(delta.absent ?? {})) {
    subjects.push(FREE_SUBJECTS[subject as FreeSubject]);
  }
  subjects.push(...open);
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
  /*
    EVERY ITEM, not the value (D-171). A plural subject holds a list, and this
    used to call `.toLowerCase()` on it — a runtime throw inside the money path,
    on a check whose whole job is to be the thing that never fails silently.
    Flattening to items also makes the check STRICTER: each fact has to reach
    the prompt on its own.
  */
  const wants: Array<[string, string]> = [
    ["eyeColour", delta.eyeColour],
    ["eyeShape", delta.eyeShape],
    ["hairStyle", delta.hairStyle],
    ["hairColour", delta.hairColour],
    ["hairTexture", delta.hairTexture],
    ["makeup", delta.makeup],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string");
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    for (const item of itemsOf(value)) wants.push([subject, item]);
  }
  /*
    A DEPARTURE IS A FILED FACT, so it gets D-143's teeth like every other one.
    The whole defect this closes is a removal that never reached the prompt; a
    composition that drops it again must stop the render rather than buy a
    picture with the glasses still on.
  */
  for (const [subject, items] of Object.entries(delta.absent ?? {})) {
    for (const item of items ?? []) wants.push([`absent.${subject}`, item]);
  }
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
export function stemmedContainment(value: string, instruction: string): boolean {
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
    /*
      JOINED, not the array (D-171). `statedDetails` is read as prose by
      `currentValueOfFacet`, by D-167's confession and by the interpreter's
      current-values line. The CHAIN is where the structure lives, and the
      chain is what removal operates on — so this stays a string and no
      existing reader has to learn a new shape.
    */
    const joined = joinItems(value);
    if (joined) details[subject] = joined;
  }
  return Object.keys(details).length > 0 ? details : null;
}

/**
 * WHAT THIS BRANCH SAYS ABOUT A PRESENTATION FACET, for the reader (fable-446).
 *
 * `currentValueOfFacet` cannot answer it, and that is by design one layer up:
 * presentation is deliberately kept out of the identity ({@link
 * identityDetailsOf}), so the composed recipe is the ONLY place a smile is
 * written down. Without this the fact has no `asked` value, drops out of the
 * verification list, and the render is delivered with nobody having looked at
 * the one thing it was asked to change.
 */
export function presentationWordsOfFacet(delta: RefineDelta, facet: Facet): string | null {
  for (const [subject, value] of Object.entries(presentationOf(delta) ?? {})) {
    if (facetOfSubject(subject as FreeSubject) !== facet) continue;
    return value.trim() === "" ? null : value;
  }
  return null;
}

/** The presentation state — recorded on the variant, never on the identity. */
export function presentationOf(delta: RefineDelta): Record<string, string> | null {
  if (!delta.free) return null;
  const state: Record<string, string> = {};
  for (const [subject, value] of Object.entries(delta.free)) {
    if (!isPresentationSubject(subject as FreeSubject)) continue;
    const joined = joinItems(value);
    if (joined) state[subject] = joined;
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
}, realized: Partial<Record<Facet, string>> = {}): string {
  /**
   * THE REMEMBERED WORDING, SPOKEN IN THE LANE THAT INSTRUCTS (D-152, 2026-08-08).
   *
   * Recipe v3 already writes down what a facet actually looked like. It was
   * being carried into every later render — in the ALREADY-TRUE clause, which
   * is not an instruction. So the prompt said her freckles twice: `MARKS:
   * freckles` in the imperative lane, and the precise caption in a lane that
   * merely asserts. **The specific wording was never the ask**, and the bare
   * noun bought a different density every render — nothing at run-12's step 4,
   * a light scatter at steps 1 and 3, three times that at step 5.
   *
   * Worse than vague: the two lanes CONTRADICT. "Change this" and "this is
   * already true" about one facet, where the reference — the master — does not
   * have it. One way to reconcile being told a false thing about the picture in
   * front of you is to change nothing.
   *
   * So the caption specifies the ask, in the ask's own clause. Exactly D-143's
   * and D-166's lesson, which the repo had already learnt for the PRESERVATION
   * lane and never extended to this one: one fact, one lane, one wording.
   *
   * **The user's own words stay at the head of the clause.** They are the
   * record of what she asked for, `missingFromPrompt` proves they reached the
   * prompt, and prune arithmetic runs on them. The caption sharpens the ask; it
   * does not replace it.
   */
  const specified = (facet: Facet, clause: string): string => {
    const caption = realized[facet];
    if (!caption) return clause;
    /* Both ends trimmed of a full stop and exactly one put back, because these
       clauses are concatenated with more prose and a caption that happens not
       to end in a period produced a run-on sentence into the next instruction. */
    return `${clause.replace(/\.\s*$/, "")}, rendered exactly as this: ${caption.replace(/\.\s*$/, "")}.`;
  };

  /**
   * The same specification, placed BESIDE THE VALUE instead of after the clause.
   *
   * Replayed against run-12's own filed rows, appending put it forty words
   * downstream of the noun — *"…and a change that does not appear at all is a
   * failed render, rendered exactly as this: A faint scatter of…"* — where it
   * reads as a remark about the failed render. The whole point of the change is
   * that the precise wording governs the ask, and a specification the painter
   * has to scope backwards over a qualifier to reach does not govern anything.
   *
   * Found by looking at the produced string rather than at the test that passed.
   */
  const withCaption = (facet: Facet, text: string): string => {
    const caption = realized[facet];
    return caption ? `${text} — rendered exactly as this: ${caption.replace(/\.$/, "")}` : text;
  };

  const edits: string[] = [];
  if (delta.eyeColour != null) {
    edits.push(`Change the iris colour to ${withCaption(facetOfAxis("eyeColour"), delta.eyeColour)}`
      + ` — ${prose.eyeColour(delta.eyeColour)}.`);
  }
  if (delta.eyeShape != null) {
    edits.push(`Change the eye shape to ${withCaption(facetOfAxis("eyeShape"), delta.eyeShape)}`
      + ` — ${prose.eyeShape(delta.eyeShape)}.`);
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
    edits.push(`Apply makeup: ${withCaption(facetOfAxis("makeup"), delta.makeup)}.`
      + " Everything else about the face stays bare.");
  }
  const hair: string[] = [];
  if (delta.hairStyle != null) hair.push(`cut into ${prose.hairStyle(delta.hairStyle)}`);
  if (delta.hairColour != null) hair.push(`coloured ${prose.hairColour(delta.hairColour)}`);
  if (delta.hairTexture != null) hair.push(`with ${prose.hairTexture(delta.hairTexture)}`);
  if (hair.length > 0) {
    /* Cut, colour and texture are one visible thing and share one clause, so
       the specification hangs off whichever of the three this delta names —
       first one wins, and they cannot disagree because they describe the same
       hair in the same render. */
    const hairFacet = (["hairStyle", "hairColour", "hairTexture"] as const)
      .map((axis) => facetOfAxis(axis))
      .find((facet) => realized[facet]);
    edits.push(
      specified(hairFacet ?? facetOfAxis("hairStyle"), `Change the hair: ${hair.join(", ")}.`)
      + " Keep the hairline and the density the same — "
      + "this is the same person's hair restyled, not a wig and not a different head of hair.",
    );
  }
  /*
    THE FREE LANE, each under its registered heading — which is what the D-87
    sweep looks for, so a heading that drifts is a fact the sweep stops seeing.
    Composed from the same object that was filed, never from the raw sentence.
  */
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    const items = itemsOf(value);
    if (items.length === 0) continue;
    const heading = FREE_SUBJECTS[subject as FreeSubject];
    if (subject === "ink") {
      /*
        ONE CLAUSE PER ITEM (D-171). `placementClause` finds the FIRST place
        word in a value, so a two-item ink value with two placements has been
        getting one clause covering both — the second design's address quietly
        borrowed from the first.
      */
      /* Ink takes the specification too. Skipping it here would have been
         worse than leaving it alone: the routing moves an asked facet's caption
         OUT of the already-true lane, so a lane that then declines to speak it
         drops the memory entirely. Found by sweeping the lanes rather than by
         a test, which is why the sweep is part of the fix. */
      edits.push(specified(
        facetOfSubject("ink"),
        `${heading}: ${items.map((item) => `${item}.${placementClause(item)}`).join(" ")}`,
      ));
      continue;
    }
    /*
      A PAIR MEANS BOTH EARS, IN THE ASK ITSELF (fable-118 ruling (b)).

      The founder asked for "gold hoop earrings" and got one, with the other ear
      bare and plainly visible. Nothing in the prompt he paid for had ever said
      a pair is two — the qualifier is per SUBJECT and laterality is a fact
      about the OBJECT, so it comes from the same kinds table the mask corridor
      and composition read. Empty for glasses, for a nose stud, and for every
      subject that is not an accessory.
    */
    const pair = subject === "statedAccessories" ? pairClauseFor(items.join(", ")) : "";
    edits.push(`${heading}: ${withCaption(facetOfSubject(subject as FreeSubject), items.join(", "))}`
      + `${pair}${qualifierFor(subject as FreeSubject)}.`);
  }
  /*
    AND THE THING THAT IS GONE — the sentence that was never being said.

    The painter has been obeying us precisely: `departed` reached the mask-cutter
    and the fact-checker and never this function, so across three paints on two
    faces nothing in the prompt ever asked for a removal. This is the ask.

    `departedClause` is shared VERBATIM with the verification net, so the
    painter and the reader hold one fact in one wording — a test pins that the
    reader's exact string appears in the prompt, and a rewording of either alone
    goes red.

    The trailing instruction is D-183's lesson kept: naming a thing invites it,
    and the one mention of glasses in a prompt is now this clause. So the same
    sentence that asks for them to go also forbids anything arriving in their
    place, and says what to draw instead of leaving that to the portrait prior.
  */
  const departed = departedItems(delta);
  if (departed.length > 0) {
    edits.push(
      `TAKEN OFF: ${departed.map((item) => `${departedClause(item)}.`).join(" ")} `
      + "Draw the skin, hair and shadow behind them exactly as they would look without them, "
      + "and put nothing in their place.",
    );
  }
  return [
    "Edit this photograph of this exact person, changing ONLY what is listed below.",
    ...edits,
  ].join(" ");
}

/**
 * The whole render prompt, in LANES — one composition, checked and sent (D-166).
 *
 * # Why the lanes are separate, and why that is not cosmetic
 *
 * The pre-claim check and the render used to build DIFFERENT strings: the
 * preview was `composeEditPrompt` alone, while the render sent that plus the
 * caption clause. So D-143's completeness guard was verifying a prompt the model
 * never saw — the exact shape D-143 exists to forbid, inside D-143's own
 * implementation.
 *
 * Worse, `missingFromPrompt` is a substring check. Once the tail names facets,
 * a filed value could be "found" in the PROTECTION rather than in the
 * instruction, and the guard would rubber-stamp a prompt that never asked for
 * the thing. Running it against the `edits` lane alone makes that impossible
 * rather than unlikely.
 *
 * So there is one composer. It returns the lanes for the checks that need to be
 * narrow, and `full` for the render — which is sent verbatim, never rebuilt.
 */
export type RenderPrompt = {
  /** The instructions alone — what D-143's completeness check may look at. */
  edits: string;
  /** Realizations carried in words (D-152). */
  captions: string;
  /** What must not change, minus what this render changes (D-166). */
  tail: string;
  /** Exactly what the model is sent. */
  full: string;
  /** Facets the tail protects — asserted disjoint from the edited ones. */
  protectedFacets: Facet[];
  /**
   * Facets the already-true clause speaks for — asserted disjoint from the
   * facets the edits lane asks for, which is the half nothing checked.
   */
  captionedFacets: Facet[];
};

/**
 * THE THREE LANES, AND WHICH ONE SPEAKS FOR EACH FACET.
 *
 * Takes the captions themselves rather than a finished clause, because the
 * routing is the whole point: a facet the edits lane is already naming must
 * have its caption SPOKEN THERE, not repeated in the already-true clause as a
 * second, contradicting statement about the same thing.
 */
export function composeRenderPrompt(
  delta: RefineDelta,
  prose: Parameters<typeof composeEditPrompt>[1],
  captions: RealizationCaptions,
): RenderPrompt {
  /*
    A facet the edits lane names takes its caption INTO that clause; the rest
    stay in the already-true lane, where they belong — those are facets nothing
    is asking to change, and the render still has to reproduce them.
  */
  const written = facetsWrittenBy(delta);
  const asked = facetsAnsweredBy(delta);
  const hairWornFacet = facetOfSubject("hairWorn");
  const adopted: Partial<Record<Facet, string>> = {};
  const carried: Partial<Record<Facet, string>> = {};
  for (const [facet, entry] of Object.entries(captions)) {
    /* Both kinds of caption say the same thing to a painter; only the
       retirement rule cares which kind it is (fable-118). */
    const spoken = captionWording(entry);
    if (!spoken) continue;
    /*
      A CAPTION FOR ONE FACET MUST NOT SPEAK FOR ANOTHER THAT IS BEING ASKED —
      AND IT HAS TO BE STOPPED BEFORE THE LANES SPLIT (run 1 step 4).

      v#169's prompt carried, as ALREADY TRUE, `HAIR COLOUR: Bright copper-orange
      hair, warm reddish-brown tone, tight curls piled into a high bun.` while
      the ask was `HAIR WORN: hair down`. Every facet-keyed rule below passed it:
      the caption belongs to `hair.colour`, nothing asked `hair.colour` to
      change, so nothing dropped it. Its TEXT is the contradiction.

      **Pruned here rather than in the carried branch**, and the test that made
      that necessary is worth keeping in mind: ask for copper hair AND hair down
      in one breath — an entirely ordinary thing to type — and `hair.colour` is
      now an ASKED facet, so the same caption reaches the painter glued to the
      colour clause instead ("…rendered exactly as this: … piled into a high
      bun"). Same sentence, same contradiction, third door. One prune above the
      split closes all of them.

      Scoped to renders where it can do harm: the arrangement has to actually be
      under ask. A caption mentioning a bun on a render nobody is styling is
      simply true, and true is what the already-true lane is for.
    */
    const speaksForTheAskedArrangement = facet !== hairWornFacet && asked.has(hairWornFacet);
    const pruned = speaksForTheAskedArrangement
      ? withoutArrangementClaims(spoken)
      : { caption: spoken, stripped: [] as string[] };
    if (pruned.stripped.length > 0) {
      log.warn(
        { facet, stripped: pruned.stripped, asked: "hairWorn" },
        "[refineDelta] a caption spoke for the arrangement while the arrangement was being asked",
      );
    }
    const caption = pruned.caption;
    if (!caption) continue;
    /*
      A SURFACE FACET'S CAPTION IS DROPPED FROM THE ASK, NOT MOVED (2026-08-09).

      Measured, 32 paints on run-15's own face: with the caption in the ask, her
      freckles were delivered **0 of 16** — five wordings, both framings, inside
      the clause and after it. With the caption absent and nothing else changed,
      **11 of 16**. On `hair.colour` the same two arms read 4/4 and 4/4, which
      is what makes this a boundary rather than a verdict on captions.

      `isSurfaceFacet` carries the mechanism: a few-levels change described back
      to a painter holding the master reads as a report on the picture in hand,
      and the answer to "it already has them" is to do nothing.

      **Dropped, not carried.** The other lane is where this caption lived
      before D-152 and it was moved out for a reason stated at length above: an
      asked facet's caption in the already-true lane makes the prompt say
      "change this" and "this is already true" about one facet in one breath.
      There is no third lane, and the evidence says the words cost more than
      they buy — so for this class the render is asked in the user's own words
      and the specific density is bought back by the retry, not by prose.
    */
    if (asked.has(facet)) {
      /*
        A PIN IS A FACT ABOUT THE BASE. AN ASK IS A REQUEST TO CHANGE IT. THE
        FIRST MUST NEVER SHARPEN THE SECOND (run 1, 2026-08-11).

        Production, the founder's own account, step 5 of the replay walk. The
        prompt it paid for:

          HAIR WORN: hair down — rendered exactly as this: in a bun —
          gathered and coiled or knotted against the head, as the same hair
          restyled…

        The ask and its own specification contradict each other inside one
        clause, and the picture came back with a bun. `withCaption` adopts a
        facet's caption INTO the ask so the ask is specific (D-152) — right
        when the caption describes a render that DELIVERED the asked value, and
        exactly wrong when it describes the state the ask is trying to replace.

        The two are already told apart structurally, which is what
        `PinnedCaption` was built for: a realization caption is prose read back
        off a DELIVERED frame and corroborated before it is stored (D-183, the
        captioner writes nothing when the ask did not take), while a PIN is read
        off the MASTER by `capturePresentation` — a fact about how she was
        before anybody asked for anything. Sharpening "hair down" with it is
        handing the painter the old value as the definition of the new one.

        Note the gap this closes rather than the symptom. Captions are dropped
        for the facets THIS STEP writes (`dropFacets`, D-159) but adopted for
        the facets the COMPOSED delta asks — so an earlier step's ask, still in
        the recipe, kept pulling a base pin into its clause on every later
        render. Step 4 asked for hair down and its own clause was clean; step 5
        asked for nothing about hair and got the contradiction.

        The pin is NOT deleted — it stays in the already-true lane for facets
        nothing is asking to change, which is the whole of D-186's job.
      */
      if (!isSurfaceFacet(facet as Facet) && pinIdOf(entry) === null) adopted[facet] = caption;
    }
    /*
      A DEPARTED FACET'S CAPTION IS DROPPED, NOT CARRIED.

      The edits lane names it — `TAKEN OFF: no glasses, they have been taken
      off` — but there is no positive clause for a caption to sharpen. Leaving
      it in the already-true lane would put "she is wearing square dark
      tortoiseshell frames, reproduce them exactly" in the same prompt as "take
      them off", which is the contradiction this whole change exists to end,
      pointed at the facet where it does the most damage.

      Found by sweeping the lanes for the class rather than by a failing test.
    */
    else if (!written.has(facet)) carried[facet] = caption;
  }

  const edits = composeEditPrompt(delta, prose, adopted);
  /*
    THE COMPOSED delta, not one step of it. Subtracting a single step would
    leave every earlier edit protected against the ORIGINAL, which is a quiet
    instruction to undo the stack once per render.
  */
  const preservation = composePreservation(facetsWrittenBy(delta));
  const captionsClause = captionClause(carried);
  return {
    edits,
    captions: captionsClause,
    tail: preservation.clause,
    full: `${edits}${captionsClause} ${preservation.clause}`,
    protectedFacets: preservation.protectedFacets,
    captionedFacets: Object.keys(carried) as Facet[],
  };
}

/**
 * A LANE NAMING A FACET ANOTHER LANE ALSO NAMES — D-143, pointed at the
 * template that was doing the contradicting (D-166).
 *
 * Empty by construction on both counts: the tail is built by subtraction, and
 * the already-true clause now hands an edited facet's caption to the edits lane
 * instead of restating it.
 *
 * # It was NOT empty, and nothing was looking
 *
 * This checked the preservation tail alone from the day it was written. The
 * captions lane grew afterwards and the guard never learnt about it, so every
 * carried captioned facet was in TWO lanes on every render — `MARKS: freckles`
 * as a thing to do, and the caption as a thing already done. Run-12 shipped
 * that contradiction on four consecutive paid renders and this function
 * returned `[]` each time.
 *
 * A guard that watches one of three doors reports a clean house.
 */
export function contradictedFacets(prompt: RenderPrompt, delta: RefineDelta): Facet[] {
  const edited = facetsWrittenBy(delta);
  return [
    ...prompt.protectedFacets.filter((facet) => edited.has(facet)),
    /* `facetsWrittenBy`, not `facetsAnsweredBy` — a DEPARTED facet is one the
       edits lane speaks about too, and it is the one where an already-true
       assertion contradicts hardest. */
    ...prompt.captionedFacets.filter((facet) => edited.has(facet)),
  ];
}
