/**
 * THE POINTER ROAD — cutting a thing the catalogue has never heard of (#2566
 * slice 2 of the design he approved on #2532).
 *
 * # What it is for, in his words
 *
 * *"n3 is meant to be bringing in the ability to detect all/any features right
 * rather than from a list?"* Slice 1 answered the first half: a discovery read
 * NAMES everything on the cast, including the third eye, the jaw hardware, the
 * jacket and the sash. It then threw every one of those names away, because the
 * catalogue has no question for them and the panel draws no row without a
 * picture (his ruling on #2532: *"no features should ride in the image analyzer
 * on the right panel unless it has an image to go with it like i dont wanna
 * just see words in there"*). This module is the picture.
 *
 * Two calls per instance, and both are the measured choice rather than the
 * obvious one:
 *
 *   1. the open-vocabulary DETECTOR puts a rectangle round the customer's own
 *      bare noun (`RegionReader.pointer` -> moondream3 `detect`);
 *   2. the SEGMENTER cuts inside that one rectangle (`RegionReader.regionInBox`
 *      -> SAM 3 `box_prompts`).
 *
 * #2532's bench, 15 cells on three production casts: **`detect` -> box cuts the
 * whole feature 7 times in 10, where the text road manages 3 and a point
 * manages 4.** The text road asked `jaw hardware` and returned nothing at all.
 *
 * # ⚠ THE COUNT IS A CAP, AND IT IS THE ONE LINE THAT STOPS A RIGHT ANSWER
 * GOING WRONG
 *
 * The design says both of these and they read as a contradiction until the
 * measurement is in front of you: *"`box_prompts` with the FIRST box"*, and
 * *"a `detect` that returns several boxes on a counted feature is several
 * rows"*. What reconciles them is clause 2 of the same comment — **sending
 * several boxes does not combine them, it switches which object you get.** Two
 * boxes on the jaw moved the cut from the right tube to the left; on the
 * three-eyed cast the detector returned THREE boxes for `third eye` and sending
 * all three made the segmenter cut **a normal eye**, turning a right answer
 * wrong.
 *
 * So: **one box per call, always** — the reader's type refuses an array — and
 * **`count` boxes become this name's instances, in the order the detector
 * returned them**, where `count` is what the discovery read said it could see.
 * On a count of one that is exactly the arm that won 7 of 10. On a count of two
 * it is the design's *several rows*, one cut each, never a union (#2565 §6: left
 * and right are separate items).
 *
 * ⚠ **AND A BOX PAST THE COUNT IS NO LONGER THROWN AWAY UNASKED — #2838 ROAD 2,
 * AND THIS PARAGRAPH SAID THE OPPOSITE UNTIL IT LANDED.** It closed *"on the
 * cast that defeated the old shape it is the cap doing its job: `third eye`
 * counted ONE, so the two extra rectangles the detector found round the ordinary
 * eyes are never asked about"* — true of that cast, and the same sentence cost
 * his round-9 cast a sleeve. **Both facts are real and neither is a number
 * question**: the reading names `tattoo` once on `arm` where there are two full
 * sleeves, so a cap of `count` outlines one arm and leaves the other unpickable.
 * What separates the two cases is not how many boxes to cut but **what the extra
 * one turns out to BE**, which this module already decides for every other cut:
 * an extra is cut and kept only where it lands on nothing the scan already
 * holds. The third eye's extras are the ordinary eyes' own pixels and fold into
 * Eyes; a second sleeve on an arm no row covers stays. The measured price is at
 * the cap itself, in {@link cutDiscovered} — **0.4 extra calls a reading** over
 * five of his real readings, and both of the two were the defect.
 *
 * # WHICH NAMES COME HERE, AND THE LIST IS DERIVED
 *
 * A name the catalogue already asks about must NOT come here — the scan asks the
 * whole catalogue on every reading (the relay's second finding on PR #2570), so
 * a pointer call for `hair` would be the same feature bought twice and filed
 * twice. {@link coveredByCatalogue} answers that from `catalogueSlots()` itself
 * rather than from a second list beside it: slice 1 shipped a hand-written
 * phrasebook and the relay deleted it, and a replacement roster here would be
 * working law 4's mirror in the same week.
 *
 * ⚠ **The match is on the WHOLE normalised name and never a substring**, which
 * is not fussiness: `jaw` is a catalogue slot and **`jaw hardware` is the
 * feature this whole road exists for.** So is `third eye` against `eyes`, and
 * `neck tattoo` against nothing at all. Measured against the 69 names the three
 * production fixtures really produced (#2566's own full-frame run), a substring
 * rule would have swallowed the jaw hardware and the third eye — the two
 * headline finds of the card.
 *
 * # WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT JUDGE
 *
 * **TWO refusals, and neither of them is a number** — see the ⚠ below, where
 * the third one and its measurement are struck:
 *
 *   **a mask with no pixels** — there is nothing to draw and nothing to point
 *   at, so there is no row;
 *   **a mask that does not overlap the rectangle that asked for it** — the
 *   segmenter answered about something else. A yes/no about two rectangles,
 *   with no tolerance to tune, and checked twice over: `overlaps` here on the
 *   boxes, and `judgeCut`'s own `no-overlap` on the pixels.
 *
 * ⚠ **AND THE THIRD REFUSAL IS GONE — #2831, the relay's decision of
 * 2026-10-30: THE FACE PANEL STOPS REFUSING ON FILL.** This list read
 * ~~*"**a mask that fills less than a fifth of that rectangle** — the 'only
 * the straps' answer"*~~ for one day, and the day after it shipped the bar was
 * measured on two more pictures: a **correct** cut of a long curved tail — the
 * whole sweep of it, looked at — fills **17.00%**, so it was thrown away and
 * that feature would simply not be listed; and a cut of **the sword in the
 * character's hand**, asked for as *"the armour plating on the chest"*, passed
 * at **21.64%** and would have been drawn as a row called armour. **A right
 * answer scored lower than a wrong one, so the measure does not order
 * correctness** — the one thing a refusal has to do. Anything worn *around*
 * something makes it worse by geometry: a ring's bounding box is the whole
 * thing it encircles, so a band must be 7% of its own span to clear 20%.
 * **The fill is still measured and logged on every judgement** — that is how
 * these two were found — and it decides nothing here. The floor is a
 * per-caller argument now and the take road (`referenceTake.ts`) keeps it,
 * where a refused cut costs nothing and an unseen partial cut costs a paid
 * render; here every row's cut is outlined on hover, so a wrong cut is visible
 * and **a missing row is not** (#2800, #2810, #2817).
 *
 * ⚠ **BROKENNESS IS JUDGED HERE NOW, AND THE SENTENCE THAT SAID IT WAS NOT IS
 * STRUCK — 2026-10-29, #2565 slice 2.** ~~*"this road has no clean-and-refuse
 * pipeline to call and does not invent one: an area threshold here would be a
 * number nobody measured"*~~ — the number was measured and this road was its
 * first caller. **Kept as the record, because the ⚠ above is what happened to
 * it:** the threshold lasted a day on this road, the population it was set on
 * (*"correct cuts 42.3–73.5%"*) is falsified, and what the pipeline still does
 * here is close holes and clean a cut it is keeping. The two things §4's own
 * sentence gets wrong — holes run BACKWARDS as a signal, and want closing
 * rather than refusing — are in that module's header and are untouched by
 * #2831.
 *
 * ⚠ **LOOSENESS IS STILL NOT JUDGED, AND THAT HALF STAYS DECLARED.** #2532's
 * own open list ends *"the loose-region case is still unsolved"* — a shoulder
 * wrap the detector declines, a forehead the detector returns with the eyes
 * inside it. A loose cut is one that claims MORE than it should, and a fill bar
 * cannot see it: filling a rectangle generously is what a correct garment cut
 * does. What guards that case is every cut logging its noun, its area and now
 * its fill, so the frames can be read rather than guessed at.
 *
 * ⚠ **AND "THE FLAG IS DARK" CAME OFF THAT SENTENCE ON 2026-10-29, BECAUSE IT
 * WAS ALREADY FALSE WHEN THE QUALITY BAR WAS WIRED IN.** This paragraph read
 * ~~*"the flag is dark and the flip is his eye on real panels"*~~, and
 * `CASTING_FACE_DISCOVERY_SCOPE` has stood at **`users:1` — HIS ACCOUNT —
 * since 2026-10-28** (read at `scripts/lib/productionFlagPositions.mts`, not
 * assumed; his word was *"never ask me to switch things on for my account just
 * do it"*). So this road is LIVE for him and he has been reading its panels in
 * eye rounds 3 and 4 the same week. **A refusal added here is in front of him
 * on the next deploy, not waiting behind a flip** — which is the argument for
 * logging every fill rather than only the refusals, and it is why the fill bar
 * that stood here for one day was taken off by a decision rather than quietly
 * retuned (#2831): the rows it was dropping were already in front of him.
 *
 * # It cannot take a row off the panel, and it cannot break a scan
 *
 * Every failure is local to one name: a detector that errors, a segmenter that
 * returns nothing, a mask that will not fetch — each drops THAT row and leaves
 * every other row and the whole catalogue scan exactly as they are. A reader
 * without the capability produces no rows at all, which is today's panel. That
 * is the property slice 1 was held on twice and it is the one to protect.
 */
import { boundsOf } from "./segmentCuts";
import { FILL_MEASURED_NOT_REFUSED, judgeCut } from "./cutQuality";
import { LANDMARK_OF_ACCESSORY, accessoryEntry } from "./accessoryKinds";
import { scanPlan } from "./faceScan";
import { catalogueSlots, type SlotGroup } from "./referenceSlotCatalogue";
import { createModuleLogger } from "../logging/logger";
import type { DiscoveredFeature, FeatureKind } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { PanelBox } from "./facePanel";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";

const log = createModuleLogger("castingV2/pointerCut");

/**
 * THE KEY PREFIX FOR A ROW NOBODY CATALOGUED.
 *
 * `open:` is already taken and means something different — a kind the CUSTOMER
 * introduced by editing, whose rows live in the library. These are rows the
 * READING found, so they get their own namespace and cannot be confused with
 * either a catalogue slot or an open kind by anything that parses a key.
 *
 * ⚠ **NOTHING MAY READ A CUSTOMER-FACING WORD OUT OF THIS KEY**, which is the
 * open lane's own binding condition arriving again: `cat ears` and `cat-ears`
 * both slug the same way, so the key cannot say which was written. The noun
 * travels as data on {@link DiscoveredRegion}, and the panel reads it from
 * there.
 */
export const DISCOVERED_SLOT_PREFIX = "discovered:";

/*
  AND THERE IS NO `isDiscoveredSlot` BESIDE IT, deliberately. A predicate here
  would read as diligence and have no caller: nothing in the product branches on
  whether a key is this road's, because the prefix makes a collision with a
  catalogue slot or an `open:` kind impossible by construction. `pointerCut.test.ts`
  holds that non-collision against the real catalogue, which is the one place it
  can actually be checked — an unread export is what #2605 swept 62 of.
*/

/**
 * The key for one instance of one found name.
 *
 * Stable across readings of the same frame so a client keying on it does not
 * remount a row for no reason, and unique within a reading, which is all it has
 * to be: it is an identity, not a description.
 */
export function discoveredSlotOf(name: string, instance: number): FeatureSlot {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${DISCOVERED_SLOT_PREFIX}${slug === "" ? "feature" : slug}#${instance}`;
}

/** One cut instance of one thing the reading found on this cast. */
export type DiscoveredRegion = {
  slot: FeatureSlot;
  /** The customer's own bare noun, as the reading wrote it. Never derived from
   *  {@link DiscoveredRegion.slot}. */
  noun: string;
  /** Which instance of that noun, from 1 — so a row can say so if it ever
   *  needs to, and so two rows of one noun are legibly two. */
  instance: number;
  /**
   * WHAT THE READING SAID THIS THING IS, and WHAT IT SITS ON — carried, never
   * re-derived (#2566 slice 2, the grouping design of 2026-10-28).
   *
   * The panel groups by these two and by nothing else: `clothing` is what may
   * enter the one Outfit row, `accessory` is what lists under Accessories (his
   * ruling of 2026-10-29, #2789), and `on` is what chains a buckle to its strap.
   * They ride on the region rather than being looked up again downstream
   * because the only other road to them is a word table, and a word table is
   * the failure this pass exists to remove — his own ⚠ is that the body
   * implants were labelled *Collar*, so any rule keyed on the WORD sweeps
   * hardware into clothing.
   *
   * `coverage` is deliberately NOT here: a `scattered` thing never reaches the
   * detector at all ({@link pointerFeatures}), so every region that exists is
   * `single` and a field saying so could only ever disagree with itself.
   */
  kind: FeatureKind;
  /**
   * The bare noun of what it sits on, or `""` — the reading's own word, with
   * ONE exception the picture decides (#2752): an accessory whose cut lies
   * mostly on a garment's cut sits on THAT garment, whatever the reading said
   * (`settleByPlace`). On his screenshot crop the collar was read as sitting on
   * the neck, and 92% of its cut lay on the jacket's pixels.
   */
  on: string;
  box: PanelBox;
  mask: Mask;
};

/**
 * ONE THING THE READING NAMED AND NOTHING CUT — its words, and where they go.
 *
 * His ruling, through the approved design: *a feature that can be named but not
 * cut gets no row*. It is not thereby FORGOTTEN — the design's rules 2 and 4
 * both send its words somewhere a later edit can reach them, which is the one
 * thing that makes "no row" an answer rather than a loss.
 *
 * ⚠ **THIS TYPE EXISTS BECAUSE THE CLAIM WAS ALREADY IN THIS FILE AND THE CODE
 * DID NOT SUPPORT IT.** `cutDiscovered`'s declined branch has said *"the words
 * still reach the current description (#2565 §2) and the next edit to that area
 * asks again"* since slice 2's first landing, and `declined` was returned to a
 * caller that threw it away — read at the bytes 2026-10-28: `faceScanService`
 * took `cut.regions` and nothing else, and no other module in the product read
 * the field. A comment describing a road nobody built is law 1's own shape.
 */
export type NamedNotCut = {
  /** The reading's own bare noun. */
  noun: string;
  /** The bare noun of what it sits on, or `""`. The panel resolves it. */
  on: string;
  /** What the reading said about it — the words themselves. */
  about: string;
  /**
   * WHAT THE READING SAID IT IS, carried for the reason the cut rows carry it:
   * the panel routes these words by the same two facts it groups rows by, and
   * a scattered PIECE OF CLOTHING says its words on the Outfit row.
   *
   * ⚠ **It is not a mirror of {@link NamedNotCut.why}** even though a `makeup`
   * thing always has `why: "makeup"`. `why` is about the ROAD — why there is no
   * row — and this is about the THING; an `uncut` entry can be any kind at all,
   * which is most of the population here.
   */
  kind: FeatureKind;
  /**
   * WHY there is no row, because the four answers are not interchangeable:
   *
   * `scattered` — it has no outline to cut (freckles, stubble, stitching), so
   *     the detector was never asked. Its words belong to the thing it sits on.
   * `makeup` — his ruling: makeup is a refine subject, not a feature of the
   *     cast. No row, no cut, and it is never retried.
   * `uncut` — the detector was asked and produced nothing usable, so this one
   *     is the only kind that is worth asking about again.
   * `dropped` — a call on this name did not complete. Nothing was learned
   *     about it either way, so it is not an absence and not an `uncut`.
   *
   * ⚠ **`dropped` WAS WRITTEN AS `uncut` UNTIL #2805, AND THE WORD MATTERED
   * MORE THAN IT LOOKS.** `uncut`'s own sentence above says *the detector was
   * asked*, and a name whose call threw was never asked at all — so the kept
   * reading filed a dropped call under the one word that asserts it happened,
   * and the two were told apart in the LOG (`failedNouns`) and nowhere else.
   * That log reaches back about thirty-six hours, which is why #2805's own
   * question — how often does this happen — was unanswerable at any artifact
   * that outlives a day, and why two shifts measuring it could only count the
   * readings still in retention.
   *
   * ⚠ **IT CHANGES NOTHING A CUSTOMER SEES AND THAT IS DELIBERATE** — the
   * panel treats it exactly as `uncut` (no row of its own, and no words written
   * onto whatever it sits on, `facePanel`), and no retry is built on it. The
   * repair this card asks for is a SECOND ASK, refused twice on measurement
   * (0 failures in every production reading the road has made) and still
   * refused; what is fixed here is only that the record stops saying the call
   * was made.
   */
  why: "scattered" | "makeup" | "uncut" | "dropped";
};

/**
 * Every word the catalogue already asks about or already draws, normalised.
 *
 * Derived from `catalogueSlots()` on every call — the catalogue is a pure
 * function over module constants, so this is cheap, and a cached copy is the
 * second list this function exists to avoid.
 *
 * Five fields rather than one, each for a different reason a name can already
 * be covered: `question` is what goes to the segmenter, `display` is the region
 * a row may be drawn from, `noun` and `pairNoun` are what the panel calls it,
 * and `feature` is the key's own half. A discovery saying any of them is talking
 * about a row the scan is already buying.
 */
function catalogueVocabulary(): ReadonlySet<string> {
  const words = new Set<string>();
  const asked = scanAskedSlots();
  for (const definition of catalogueSlots()) {
    /*
      ⚠ AN ACCESSORY THE SCAN DOES NOT ASK IS NOT COVERED (#2781).

      The catalogue holds a slot for every worn kind, and the scan asks only
      the ones whose court has passed (`scanPlan`, `armedBornWornClasses`) —
      so `nose stud` has a question and nobody sends it. Counted as covered, a
      reading that said "nose stud" took the catalogue road, the scan never
      bought it, and the pointer road never cut it: a visible piercing with no
      road at all. The header's own sentence is the test — *the scan is already
      buying a question for it* — and for an unasked accessory it is false.
    */
    if (definition.group === "accessories" && !asked.has(definition.slot)) continue;
    for (const word of catalogueWordsOf(definition)) words.add(word);
  }
  return words;
}

/**
 * EVERY WORD THE CATALOGUE HAS FOR ONE SLOT, normalised — the five fields the
 * header above names, read in ONE place.
 *
 * Three readers ask it three different questions: whether a name is a word the
 * scan already buys ({@link catalogueVocabulary}), whether a found thing sits
 * UNDER a drawn row (`facePanel`'s host words), and where the reading said a
 * found thing is ({@link hostCutsOf}, #2796). Each kept its own copy of the
 * five until #2796, and the third would have been a third copy (working law 4).
 */
export function catalogueWordsOf(definition: {
  question: string | null;
  display: string | null;
  noun: string;
  pairNoun?: string | null;
  feature: string;
}): string[] {
  const words: string[] = [];
  for (const word of [
    definition.question,
    definition.display,
    definition.noun,
    definition.pairNoun,
    definition.feature,
  ]) {
    if (typeof word !== "string" || word.trim() === "") continue;
    words.push(normalisedName(word));
  }
  return words;
}

/**
 * One spelling of a name, for comparison only.
 *
 * Lowercased, hyphens and runs of space folded to one space, and a trailing
 * `s` dropped from the LAST word — so `ears` reaches the catalogue's `ear`,
 * `facial-hair` reaches `facial hair`, and `shoulder plates` reaches
 * `shoulder plate` without either of them reaching anything they should not.
 *
 * ⚠ The plural fold is on the last word only and is deliberately crude: it is
 * used to decide WHICH ROAD cuts a name, where both roads produce a row, so a
 * wrong answer costs a feature being bought on the cheaper road or on the wider
 * one. It is never shown to anybody and never sent to a model — the noun the
 * customer reads is the reading's own, untouched.
 */
export function normalisedName(name: string): string {
  const flat = name.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  const words = flat.split(" ");
  const last = words[words.length - 1];
  if (last !== undefined && last.length > 3 && last.endsWith("s") && !last.endsWith("ss")) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(" ");
}

/**
 * Whether the catalogue already asks about this name.
 *
 * Whole-name equality after {@link normalisedName}, and the module header says
 * why it may never be a substring test.
 */
export function coveredByCatalogue(name: string): boolean {
  return catalogueVocabulary().has(normalisedName(name));
}

/** Every slot the scan actually asks a question for — read off `scanPlan`, the
 *  one place that decides it, never re-derived from the arming rule here. */
function scanAskedSlots(): ReadonlySet<string> {
  return new Set(scanPlan().flatMap((entry) => entry.slots.map((slot) => slot.slot)));
}

/**
 * THE PRODUCT'S OWN WORD FOR A WORN THING THE DETECTOR COULD NOT PLACE (#2781),
 * or `null`.
 *
 * His cast's septum ring was named `septum ring` by the reading on 4 of 4
 * reads, and the detector answered NO box for it on every one — nor for
 * `septum` or `septum piercing` — while `nose stud`, `nose ring` and
 * `nose piercing` each boxed the ring (measured on his screenshot crop). The
 * reading's word was right; the detector does not know it.
 *
 * The accessory table already knows it: `septum` is one of the nose piercing's
 * own words (#2612), so the kind is `nose stud`, and that is the word the
 * product asks about that kind in. So when the detector declines a found
 * ACCESSORY the table recognises, it is asked once more in the table's word,
 * and the row still carries the reading's own noun.
 *
 * Two refusals, each for a reason:
 *
 *   **a kind the scan already asks** (an earring, glasses) — the catalogue reads
 *   that kind itself, so a found duplicate cut here would be the same thing
 *   twice on the panel (#2757's class);
 *   **anything that is not an accessory** — `nostril` is a nose-piercing word,
 *   and an anatomy find called "nostril" re-asked as "nose stud" would put the
 *   nostril's row on a stud.
 */
export function productWordFor(feature: { name: string; kind: FeatureKind }): string | null {
  if (feature.kind !== "accessory") return null;
  const kind = accessoryEntry(feature.name);
  if (kind === null) return null;
  if (normalisedName(kind.region) === normalisedName(feature.name)) return null;
  const asked = new Set(scanPlan().map((entry) => entry.question));
  if (asked.has(kind.region)) return null;
  return kind.region;
}

/**
 * The reading's names that no catalogue question covers — the pointer road's
 * whole population.
 *
 * Order is the reading's own, which is the order the model named things in and
 * is as good an order as any; the panel sorts its own rows.
 */
export function offListFeatures(
  features: readonly DiscoveredFeature[],
): readonly DiscoveredFeature[] {
  return features.filter((feature) => !coveredByCatalogue(feature.name));
}

/**
 * EVERY NAME SOMETHING ELSE SAYS IT SITS ON, normalised.
 *
 * The reading's own graph, read off the reading: `charm on=strap`, `strap
 * on=robe`, `teeth on=mouth`. It is what {@link placeNames} and the panel's
 * fold both ask, and it is derived here once so the two cannot disagree about
 * what a host is (working law 4).
 *
 * ⚠ **A thing does not host ITSELF.** A reading that answers `on` with its own
 * noun — `skin on=skin` — is saying nothing, and counting it would make every
 * such find a place for itself and take its row away.
 */
export function hostedNames(
  features: readonly DiscoveredFeature[],
): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const feature of features) {
    const on = feature.on.trim();
    if (on === "") continue;
    const host = normalisedName(on);
    if (host === normalisedName(feature.name)) continue;
    hosts.add(host);
  }
  return hosts;
}

/**
 * A PLACE, NOT A FEATURE — the design's own narrow sibling rule.
 *
 * Verbatim from the grouping design: *"an off-list **anatomy** name that other
 * finds name as their `on` host — 'head', 'mouth' on these fixtures — is a
 * PLACE, not a feature: it draws no row and buys no cut. Things are left
 * pointing at it; it does not become a 'Head' row."*
 *
 * Measured on the design's own three production fixtures, merged across both
 * crops (`output/2566/grouping-discovery.json`): **exactly one find is a place
 * — `head` on cast 2472** — and it is a place only AFTER the merge, because the
 * full-frame crop named `head` while the head crop was the one that said `ears
 * on=head`. A rule applied per crop would have missed it.
 *
 * ⚠ **THE KIND RESTRICTION IS LOAD-BEARING AND IT IS WHY `strap` SURVIVES.**
 * `charm on=strap` makes `strap` a host on cast 2472, and `buckle on=strap`
 * does the same on 2556 — but a strap is `accessory`, so it keeps its row and
 * its cut. Only an ANATOMY find is ever demoted to a place.
 *
 * ⚠ **AND HERE IS THE HAZARD THIS RULE CARRIES, DECLARED RATHER THAN
 * DISCOVERED LATER: a genuine anatomy feature that something sits ON loses its
 * row.** If a reading ever says `stud on=third eye`, the third eye — the
 * headline find of this whole card — becomes a place and draws nothing. It does
 * NOT happen on the three fixtures (0 of 6 arms, and 0 of 3 merged casts: the
 * host names are `face forehead head jaw mouth neck robe shoulder strap`, none
 * of which is a non-place anatomy FIND), and the flag is at `users:1` with his
 * eye as the gate — so the rule ships as the design wrote it rather than being
 * quietly tightened here.
 *
 * **The repair, if his eye ever meets it, is named so nobody has to re-derive
 * it**: on these fixtures a place is also a find that sits on NOTHING (`head`,
 * `on=""`), where the third eye sits on a forehead — so *hosts something and is
 * hosted by nothing* is a tighter rule available from the same reading, with no
 * word list. It is not built, because choosing between the two is a design
 * decision and this slice is execution.
 */
export function placeNames(
  features: readonly DiscoveredFeature[],
): ReadonlySet<string> {
  const hosts = hostedNames(features);
  const places = new Set<string>();
  for (const feature of features) {
    if (feature.kind !== "anatomy") continue;
    const name = normalisedName(feature.name);
    if (hosts.has(name)) places.add(name);
  }
  return places;
}

/**
 * WHICH ROAD ONE FOUND THING TAKES — one answer, read in one place.
 *
 * Four roads and they are exhaustive, which is the point: before this slice
 * there were two (`coveredByCatalogue` said catalogue or pointer) and every
 * name that was not literally a catalogue word was cut and became a top-level
 * row. The two new ones are where the design's spend gating lives.
 *
 *   `catalogue` — the scan is already buying a question for it.
 *   `place`     — it is somewhere things sit, not a thing. Nothing at all.
 *   `words`     — no outline to cut (`scattered`), or makeup. Its words travel.
 *   `pointer`   — detect, then cut inside the box. A row with a picture.
 */
export type FoundRoad = "catalogue" | "place" | "words" | "pointer";

export function foundRoadOf(
  feature: DiscoveredFeature,
  places: ReadonlySet<string>,
): FoundRoad {
  if (coveredByCatalogue(feature.name)) return "catalogue";
  if (places.has(normalisedName(feature.name))) return "place";
  /* Makeup before coverage, because makeup is his ruling about the FEATURE and
     holds whether the reading called it single or scattered. */
  if (feature.kind === "makeup") return "words";
  if (feature.coverage === "scattered") return "words";
  return "pointer";
}

/**
 * THE NAMES THE DETECTOR IS ACTUALLY ASKED ABOUT.
 *
 * {@link offListFeatures} answers *has the catalogue got a question for this*;
 * this answers *is there anything here to point at*, which is a different
 * question and the one that decides the spend. Measured on the three production
 * fixtures: **29 names today, 25 after the gate** — `wrinkles`, `head`,
 * `leather patch` and `stitching` — so four `detect` calls and the box calls
 * under them are not bought.
 *
 * ⚠ **THE SAVING IS NOT WHY IT EXISTS and the numbers say so** — four names of
 * twenty-nine is a courtesy, not an optimisation. What it removes is a CLASS:
 * the detector is never asked for a thing that has no outline, which is the
 * source of the freckles-cut-like-an-object defect his eye found. The spend
 * falling is a consequence.
 */
export function pointerFeatures(
  features: readonly DiscoveredFeature[],
): readonly DiscoveredFeature[] {
  const places = placeNames(features);
  return features.filter((feature) => foundRoadOf(feature, places) === "pointer");
}

/**
 * THE NAMES THAT TRAVEL AS WORDS BECAUSE NOTHING WILL BE CUT FOR THEM.
 *
 * The `scattered` and `makeup` halves — known before any call is made. The
 * third kind (`uncut`: asked, and nothing usable came back) can only be known
 * after the asking, so {@link cutDiscovered} adds those to its own answer.
 *
 * A `place` contributes NOTHING here, deliberately: its words describe a head
 * or a mouth, which is not a feature of this cast, and routing them would put
 * the reader's own scaffolding into the customer's description.
 */
export function wordsOnlyFeatures(
  features: readonly DiscoveredFeature[],
): readonly NamedNotCut[] {
  const places = placeNames(features);
  const said: NamedNotCut[] = [];
  for (const feature of features) {
    if (foundRoadOf(feature, places) !== "words") continue;
    said.push({
      noun: feature.name,
      on: feature.on,
      about: feature.about,
      kind: feature.kind,
      why: feature.kind === "makeup" ? "makeup" : "scattered",
    });
  }
  return said;
}

/** Do two rectangles share any pixel at all. */
function overlaps(a: PointerBox, b: PointerBox): boolean {
  return a.x < b.x + b.width
    && b.x < a.x + a.width
    && a.y < b.y + b.height
    && b.y < a.y + a.height;
}

/*
  ---- WHERE A FOUND THING IS DECIDES WHAT IT IS (#2752, his eye on the live
  grouping, 2026-10-29) ----

  His words, verbatim: *"croissmark and scar ar the same thing>?"* and *"collar
  is showing up seperate to the outfit"*. Two rows, `Cross mark` and `Scar`,
  were cut onto one cross-shaped scar on the cheek; a third, `Collar`, was cut
  onto the garment's own collar and drawn outside the Outfit.

  ⚠ **THE CLASS IS IDENTITY DECIDED BY SPELLING, ONE STEP DOWNSTREAM OF WHERE
  ROUND 1 REPAIRED IT.** Every found thing travels under its own noun, and
  until this block nothing on the road ever asked whether two nouns had been cut
  onto the SAME PIXELS. `mergeDiscoveries` joins two crops' answers by
  `normalisedName`, so `cross mark` and `scar` are two features; each is handed
  to the detector by name; each comes back as a row. Measured on his screenshot
  crop through this very road (`output/2752/his-names.txt`, never committed):
  the two nouns' cuts share **99.8% and 100%** of their pixels on two runs.

  So the answer is read off the picture, here, where the masks are in hand —
  never off the words, which is the N3 principle (*"the image is analyzed and
  features are determined that way"*). Two rules, and the third clause is the
  guard his own ⚠ of round 1 set:

    SAME PLACE   two cuts that each lie mostly on the other's pixels are ONE
                 thing, and one row is drawn for it. "Mostly" is more than half
                 of the LARGER cut's pixels, so it holds both ways round.
    ON A GARMENT an accessory whose cut lies mostly on a garment's pixels is
                 worn on that garment, so it sits on it (`on`), and the panel's
                 chain puts it in the one Outfit row.
    ANATOMY      is never folded into anything by either rule. Body hardware
                 reads `anatomy` (the bench: 4 of 4), and an implant fused to the
                 jaw or neck is never "the same thing" as a collar or "worn on" a
                 jacket — whatever its pixels touch.

  # WHY MORE THAN HALF, AND WHY IT IS NOT A TUNED NUMBER

  The grouping design declined *"geometry-overlap dedupe … a tuned threshold
  wearing a rule's clothes"*, and that sentence is why this one says what its
  number is. It is the MAJORITY — *most of these pixels are that thing's* — and
  the measurement says how far the real pairs sit from it, on the crop:

    the same thing, two nouns      cross mark/scar 0.998–1.000 · collar/jacket
                                   0.605 · scar/neck tattoo 0.782
    two things, kinds it may join  shoulder pads/jacket 0.013 · strap/jacket
                                   0.014–0.025
    two things, kinds it may not   collarbone/tattoo 0.25–0.33 (anatomy and a
                                   marking: never joined whatever the number)

  ⚠ **What it does NOT merge, declared**: a small cut lying inside a large one
  of the same kind (a mole on a tattoo, a belt inside a jacket's cut) is two
  things, because the large one is mostly NOT the small one. That is the
  two-instance rule (#2565 §6) holding: two real scars in two places share no
  pixels and stay two rows; two boxes the segmenter answered with the same
  pixels are one scar.

  ⚠ **And the kinds it will join**: equal kinds, or a garment and an accessory
  (the garment's row survives, because the pixels are garment pixels). A
  marking and a garment on the same pixels are NOT joined — a marking is on the
  skin by the reading's own definition, so one of the two cuts is wrong and the
  picture cannot say which; both rows stay, exactly as before this block.
*/

/** The pixels a cut claims — the same predicate `boundsOf` draws its box round
 *  (`> 0`), counted inside that box because no claimed pixel lies outside it. */
function claimedPixels(region: DiscoveredRegion): number {
  const { mask, box } = region;
  let count = 0;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    const row = y * mask.width;
    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (mask.data[row + x]! > 0) count += 1;
    }
  }
  return count;
}

/**
 * How many pixels two cuts both claim.
 *
 * Counted inside the intersection of their two boxes, which is the only place a
 * shared pixel can be. ⚠ **Two masks of different sizes share nothing**, rather
 * than being resampled into agreement: every cut on one reading is of one frame,
 * so a size mismatch is a fault upstream, and the answer that cannot remove a
 * row is "not the same place".
 */
function sharedPixels(
  a: { box: PointerBox; mask: Mask },
  b: { box: PointerBox; mask: Mask },
): number {
  if (a.mask.width !== b.mask.width || a.mask.height !== b.mask.height) return 0;
  const left = Math.max(a.box.x, b.box.x);
  const top = Math.max(a.box.y, b.box.y);
  const right = Math.min(a.box.x + a.box.width, b.box.x + b.box.width);
  const bottom = Math.min(a.box.y + a.box.height, b.box.y + b.box.height);
  let shared = 0;
  for (let y = top; y < bottom; y += 1) {
    const row = y * a.mask.width;
    for (let x = left; x < right; x += 1) {
      if (a.mask.data[row + x]! > 0 && b.mask.data[row + x]! > 0) shared += 1;
    }
  }
  return shared;
}

/**
 * MAY TWO CUTS BE ONE THING AT ALL — the kinds the same-place rule will join.
 *
 * Equal kinds, or a garment and an accessory. Never anatomy with anything else
 * (his ⚠ of round 1: body hardware must not be swept into clothing), never a
 * marking with a garment (see the block above).
 */
function joinable(a: FeatureKind, b: FeatureKind): boolean {
  if (a === b) return true;
  const pair = new Set([a, b]);
  return pair.has("clothing") && pair.has("accessory");
}

/** Measured once per cut, so a reading with a dozen rows counts each mask once. */
type Placed = { region: DiscoveredRegion; at: number; pixels: number };

function samePlace(a: Placed, b: Placed): boolean {
  if (!joinable(a.region.kind, b.region.kind)) return false;
  if (sharedPixels(a.region, b.region) * 2 > Math.max(a.pixels, b.pixels)) return true;
  return oneWornThingTwice(a.region, b.region);
}

/**
 * Do two rectangles mostly coincide: more than half of the LARGER rectangle is
 * shared. The pixel rule's own majority, read on the rectangle — the same
 * "mostly each other" both ways round, and no tolerance to tune.
 */
function sameRectangle(a: PointerBox, b: PointerBox): boolean {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (across <= 0 || down <= 0) return false;
  return across * down * 2 > Math.max(a.width * a.height, b.width * b.height);
}

/*
  ---- ONE RING, TWO NAMES, AND WHY THE PIXEL RULE COULD NOT SEE IT (#2789,
  his eye round 4) ----

  His words, verbatim: *"star tatoo was coming up under also on this character
  and under nose?"* The reading named one septum ring twice, and the panel drew
  two rows for it. Measured on his screenshot crop (`output/2789/`, never
  committed): the reading said `nose ring` and `septum ring`, both `accessory`,
  both `on: nose`; the two cuts landed on the same ring with rectangles of
  17x12 and 20x11 that share 187 of their pixels — and their MASKS share 7
  pixels, of 98 and 21.

  ⚠ **That is the class, and it is not a fault in either cut.** The majority
  rule above was measured on a cheek scar, a solid patch, where two cuts of one
  thing are pixel-identical (0.998–1.000). A ring, a hoop or a bar is a few
  pixels wide, so two outlines of the same ring are two different slivers of it:
  the segmenter cut the ring's body once and its edges once, and they barely
  touch. So for a WORN thing the rectangle says what the pixels cannot.

  It is guarded three ways, each because something real sits on the far side:

    BOTH WORN    two accessories only. Two garments' rectangles coincide all the
                 time — a jacket over a shirt — and they are two things; so do a
                 tattoo and the scar inside it.
    TWO NOUNS    never two instances of one noun. The reading COUNTED those, and
                 two straps crossing in an X have nearly one rectangle and are
                 still two straps (#2565 §6). Two different names the reading
                 gave one place is the defect; two of one name is the rule.
    ONE HOST     both sit on the same thing by the reading's own `on`, which is
                 the relay's own sentence of the class: *two names the reading
                 gives one object, under one parent, are one row*.
*/
function oneWornThingTwice(a: DiscoveredRegion, b: DiscoveredRegion): boolean {
  if (a.kind !== "accessory" || b.kind !== "accessory") return false;
  if (normalisedName(a.noun) === normalisedName(b.noun)) return false;
  const host = normalisedName(a.on);
  if (host === "" || host !== normalisedName(b.on)) return false;
  return sameRectangle(a.box, b.box);
}

/**
 * ONE ROW PER PLACE ON THE PICTURE — the whole of the two rules above, as one
 * pure function so it can be driven without a reader.
 *
 * Deterministic whatever order the provider answered in, which is the pointer
 * road's own law (*"a panel that re-orders itself between two readings of one
 * frame is the instability slice 1 was held on"*):
 *
 *   WHICH ONE SURVIVES   a garment over an accessory (the pixels are garment
 *                        pixels); otherwise the LARGER cut, because it is the
 *                        more complete picture of that place; otherwise the
 *                        reading's own order. The survivor keeps its own noun,
 *                        kind, host and cut — nothing is blended.
 *   THE ORDER RETURNED   the reading's, never the size order the rule walks in.
 *
 * ⚠ **A survivor's noun is the picture's best guess and not a certainty**: on
 * the crop the detector boxed the NECK TATTOO for `scar` and `cross mark`, so
 * three nouns met on one place and the largest cut's noun — `neck tattoo` —
 * named it. Where two nouns' cuts are pixel-identical nothing on the road can
 * say which noun was meant, and the reading's order decides; that is declared
 * here rather than dressed up as knowledge.
 */
export function settleByPlace(regions: readonly DiscoveredRegion[]): {
  regions: DiscoveredRegion[];
  /** Every cut that turned out to be another one's place, by noun. */
  samePlace: { noun: string; into: string }[];
  /** Every accessory the picture put on a garment, by noun. */
  onGarment: { noun: string; onto: string }[];
} {
  const placed: Placed[] = regions.map((region, at) => ({
    region,
    at,
    pixels: claimedPixels(region),
  }));
  const walk = [...placed].sort((a, b) => {
    const garment = Number(b.region.kind === "clothing") - Number(a.region.kind === "clothing");
    if (garment !== 0) return garment;
    if (b.pixels !== a.pixels) return b.pixels - a.pixels;
    return a.at - b.at;
  });
  const kept: Placed[] = [];
  const merged: { noun: string; into: string }[] = [];
  for (const one of walk) {
    /* Against the KEPT ones only, and each of those was walked before this one
       — so it is the garment, or the larger, or the earlier, and survives. */
    const home = kept.find((held) => samePlace(held, one));
    if (home === undefined) {
      kept.push(one);
      continue;
    }
    merged.push({ noun: one.region.noun, into: home.region.noun });
  }

  const garments = kept.filter((one) => one.region.kind === "clothing");
  const rehosted: { noun: string; onto: string }[] = [];
  const settled = kept.map((one): Placed => {
    if (one.region.kind !== "accessory" || one.pixels === 0) return one;
    let best: { garment: Placed; shared: number } | null = null;
    for (const garment of garments) {
      const shared = sharedPixels(one.region, garment.region);
      if (shared * 2 <= one.pixels) continue;
      if (best === null || shared > best.shared || (shared === best.shared && garment.at < best.garment.at)) {
        best = { garment, shared };
      }
    }
    if (best === null) return one;
    const onto = best.garment.region.noun;
    if (normalisedName(one.region.on) === normalisedName(onto)) return one;
    rehosted.push({ noun: one.region.noun, onto });
    return { ...one, region: { ...one.region, on: onto } };
  });

  return {
    regions: settled.sort((a, b) => a.at - b.at).map((one) => one.region),
    samePlace: merged,
    onGarment: rehosted,
  };
}

/*
  ---- A FOUND THING ON A CATALOGUE ROW'S OWN CUT IS THAT ROW (#2789, closing
  #2757's class) ----

  His words, verbatim: *"under ears is also ear piercing which is also under
  accesories?"* One hoop, two rows: the catalogue's Earrings, and a found `ear
  piercing`. `coveredByCatalogue` decides by SPELLING whether a name is the
  catalogue's, so `ear piercing` — not a catalogue word — was cut again, and
  nothing on the road ever compared that cut with the catalogue's.

  So it is compared HERE, where both cuts are in hand, and decided by place.
  Measured on his screenshot crop: the found cut is the hoop and its inside
  (692 px), the catalogue's is the hoop (344 px) — **every one of the
  catalogue's pixels lies on the found cut**, and the found cut is 50% the
  hoop. Two rules, each with the case on its far side named:

    THE SAME PLACE   more than half of the LARGER cut shared — the rule above,
                     unchanged. A found `lip piercing` cut to the whole lips
                     (#2757's own specimen) is the Lips row; a real lip ring is a
                     small part of the lips and stays its own thing.
    WORN ON WORN     a found ACCESSORY and a catalogue ACCESSORY row where one
                     cut lies mostly on the other (more than half of the SMALLER
                     shared). Jewellery is not worn on jewellery the catalogue
                     already draws: a hoop's inside, a stud inside a side's
                     union of pieces — each is the earring, drawn once.

  ⚠ **The two-instance rule survives it, and the measurement is why** (#2565
  §6): a second real piercing on the same ear shares no pixels with the first,
  so it is a second thing and keeps its row. Only a cut that lies on the
  catalogue's own pixels is the catalogue's.

  ⚠ **A garment is never a catalogue row**, whatever its pixels touch: a hood
  over the hair is not the Hair row, and the catalogue draws no clothing.

  ⚠ **The catalogue row always survives**, because it is the product's own
  question answered for exactly that place; the found row with the same place
  is the same thing under a second name. Only rows the panel DRAWS count: Build
  and Skin draw no row on the discovery road (#2752), and folding a found row
  into a row that is not there would take it off the panel entirely.
*/

/** One catalogue row the scan cut, as the pointer road compares against it. */
export type CatalogueCut = {
  slot: FeatureSlot;
  group: SlotGroup;
  /** The question the scan asked for it — what a kind's `site` names. */
  question: string;
  box: PointerBox;
  mask: Mask;
};

/**
 * THE CATALOGUE ROWS A FOUND THING CAN BE, read off one scan.
 *
 * From `scanPlan()` — the one place that decides what is asked — and the
 * catalogue's own panel placement, never a list here. A slot that answered
 * nothing has no box and no mask, and is simply absent.
 */
export function catalogueCutsOf(scan: {
  boxes: ReadonlyMap<FeatureSlot, PointerBox>;
  masks: ReadonlyMap<FeatureSlot, Mask>;
}): CatalogueCut[] {
  return scanCutsOf(scan, (definition) => definition.panel.row === "own" && definition.noRowOnDiscovery === undefined);
}

/**
 * THE PLACES THE SCAN CUT AND THE PANEL DELIBERATELY DRAWS NO ROW FOR on the
 * discovery road (#2810) — by the catalogue's own `noRowOnDiscovery` (his
 * ruling of #2752), never a list here. Today that is the face's skin alone: the
 * build is the other no-row slot, and it is composed rather than asked, so it
 * is not among the scan's asked cuts this reads.
 *
 * Kept apart from {@link catalogueCutsOf} on purpose: every rule over THAT list
 * may fold a found row into a row, and folding into a row that is not drawn
 * would take a thing off the panel. The one rule that reads these is
 * {@link unDrawnPlaceOf}, and it is about body parts only.
 */
export function unDrawnCutsOf(scan: {
  boxes: ReadonlyMap<FeatureSlot, PointerBox>;
  masks: ReadonlyMap<FeatureSlot, Mask>;
}): CatalogueCut[] {
  return scanCutsOf(scan, (definition) => definition.panel.row === "own" && definition.noRowOnDiscovery !== undefined);
}

function scanCutsOf(
  scan: { boxes: ReadonlyMap<FeatureSlot, PointerBox>; masks: ReadonlyMap<FeatureSlot, Mask> },
  keep: (definition: ReturnType<typeof scanPlan>[number]["slots"][number]) => boolean,
): CatalogueCut[] {
  const cuts: CatalogueCut[] = [];
  for (const entry of scanPlan()) {
    for (const definition of entry.slots) {
      if (!keep(definition)) continue;
      const box = scan.boxes.get(definition.slot);
      const mask = scan.masks.get(definition.slot);
      if (box === undefined || mask === undefined) continue;
      cuts.push({
        slot: definition.slot,
        group: definition.group,
        question: entry.question,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        mask,
      });
    }
  }
  return cuts;
}

/** Pixels a mask claims inside a rectangle — every claimed pixel lies in its own box. */
function pixelsIn(mask: Mask, box: PointerBox): number {
  let count = 0;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    const row = y * mask.width;
    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (mask.data[row + x]! > 0) count += 1;
    }
  }
  return count;
}

/**
 * THE CATALOGUE ROW THIS FOUND THING IS, or null — the two rules above.
 *
 * Where it is several (a cut across both of a pair's sides), the one sharing
 * the most pixels, then the catalogue's own order: deterministic whatever order
 * the provider answered in.
 */
export function catalogueRowOf(
  region: DiscoveredRegion,
  cuts: readonly CatalogueCut[],
): CatalogueCut | null {
  if (region.kind === "clothing") return null;
  const mine = pixelsIn(region.mask, region.box);
  if (mine === 0) return null;
  let best: { cut: CatalogueCut; shared: number } | null = null;
  for (const cut of cuts) {
    const theirs = pixelsIn(cut.mask, cut.box);
    if (theirs === 0) continue;
    const shared = sharedPixels(region, cut);
    if (shared === 0) continue;
    const samePlace = shared * 2 > Math.max(mine, theirs);
    const wornOnWorn = region.kind === "accessory"
      && cut.group === "accessories"
      && shared * 2 > Math.min(mine, theirs);
    if (!samePlace && !wornOnWorn) continue;
    if (best === null || shared > best.shared) best = { cut, shared };
  }
  return best?.cut ?? null;
}

/*
  ---- A BODY PART CUT AS THE WHOLE FACE IS NOT A PART OF IT (#2810, his eye
  round 8, #2807 part 2) ----

  His words, verbatim: *"also nose and snout im confused the snout nose is his
  snout?"* Read on the founder's creature at 1024 wide: the reading named `snout`, the
  detector's box was the whole head, and the cut inside it filled 0.638 of it —
  one solid piece, so every bar passed. It holds **0.987 of the scan's own
  face-skin cut** and the face skin is 0.798 of it; it holds every pixel of the
  Nose, Lips and Teeth cuts and both eyes. The Nose cut is 0.062 of it, which
  is why {@link catalogueRowOf} could not fold it: the larger cut decides.

  #2795's header names the class: *"a loose cut is one that claims MORE than it
  should, and a fill bar cannot see it"*. What CAN see it is a cut the scan
  already has: the face skin is the scan's own picture of the face, and its
  slot draws no row on this road by his ruling (#2752, *"same with skin not
  neccesary to pick up"*). So it is judged by {@link catalogueRowOf}'s own
  same-place rule, unchanged — more than half of the LARGER cut shared — against
  those un-drawn places: a body part on the same place as the face's skin IS
  that place under a part's name, and the panel already decided
  not to draw that place. It gets no row and keeps its words (`uncut`).

  ⚠ **Body parts only.** A worn mask cut as the face is a real thing the cast
  wears and keeps its row; a garment is never judged here. And a real part of the face
  is a small share of it — the measured snout, cut as a snout, would not be.

  ⚠ **What it would refuse, said plainly.** A creature whose snout really is
  most of its face (a long-jawed reptile) and is cut that way shares more than
  half of the larger cut with the face skin too, and keeps only its words. None
  is measured; it is the same call, made on the same majority, that folding
  makes every day.
*/

/** The un-drawn place this body part's cut IS, by the same-place rule, or null. */
export function unDrawnPlaceOf(
  region: DiscoveredRegion,
  unDrawn: readonly CatalogueCut[],
): CatalogueCut | null {
  if (region.kind !== "anatomy") return null;
  const mine = pixelsIn(region.mask, region.box);
  if (mine === 0) return null;
  for (const cut of unDrawn) {
    const theirs = pixelsIn(cut.mask, cut.box);
    if (theirs === 0) continue;
    if (sharedPixels(region, cut) * 2 > Math.max(mine, theirs)) return cut;
  }
  return null;
}

/*
  ---- A BODY PART LYING ON OTHER PLACES IS NOT THAT BODY PART (#2801, the
  founder's eye on the first creature) ----

  The founder's words, verbatim: *"no idea what brow ridge is on this creature
  exactly"*. The row's picture was scattered dark fragments. Read on the
  founder's picture at 1024 wide (reading r4, the recorded masks): the `brow ridge` cut
  is the insides of both ears. **0.911 of its own pixels lie on the catalogue's
  own cuts** — 0.535 on the left ear, 0.333 on the right, 0.037 on a horn — and
  the reading said it is on `face`, which names none of them. So the cut is a
  second picture of the ears, under a name that is not the ears.

  That is this module's existing class, a cut lying on another place's pixels
  ({@link besideItsHost}, {@link catalogueRowOf}), and it is judged the same way:
  by place, with "more than half" as the bar, no tuned number. A found body
  part more than half of whose own pixels lie on catalogue cuts of places the
  reading did NOT say it is on gets no row, and keeps its words (`uncut`).

  # WHY NOT "A BODY PART IN PIECES" — the rule this replaced (the relay's finding)

  The first repair refused any body part whose largest connected piece held
  under three quarters of its cut. Many creature parts are in pieces by nature,
  inside one box — whiskers, a row of spines, scales, gill slits, a frill, the
  two nostrils of a snout — and that floor would have taken every one of them
  off the panel. This rule never counts pieces: a cut in ten pieces that lies on
  no other place is drawn exactly as before.

  # THE TWO CASES IT LEAVES ALONE, and why each is a principle

  1. **The place the reading named.** A cut lying on the catalogue cut of its
     own `on` (nostrils `on: nose`, lying on the nose's cut) is where the
     reading said it is. Only cuts of OTHER places count, through
     {@link hostCutsOf} — the same words {@link besideItsHost} uses.
  2. **A name the catalogue already drew part of.** On reading r2 the second
     tusk lies 0.997 on the LIPS' cut — the segmenter's lips take in the mouth —
     while the first tusk IS the Teeth row's cut. A name with a cut folded into
     a catalogue row is that row's thing, and its other cuts sit ON that row
     (the join below), so they are not judged here. Without this the tusks
     repair beside it would be undone.

  ⚠ **What it would still drop, said plainly.** A body part the catalogue drew
  NONE of, lying mostly inside a loose catalogue cut of somewhere else — two
  tusks swallowed by the lips' cut on a reading whose Teeth cut missed both —
  gets no row and keeps its words. None of the four recorded readings has that
  shape (the Teeth cut held one tusk on all four), and it is the same call
  {@link besideItsHost} already makes about a stray. Body parts only: a worn
  thing on a catalogue place (a stud on the lips) is judged by the host and
  site rules above, and a garment is never a catalogue row.
*/

/**
 * The share of a found cut's own pixels lying on the catalogue cuts of places
 * the reading did NOT say it is on — 0 for a cut that claims nothing. A pixel
 * counts once however many of those cuts claim it; a cut of another size
 * shares nothing (the module's rule, see {@link sharedPixels}).
 */
export function shareOnOtherPlaces(
  region: { box: PointerBox; mask: Mask; on: string },
  cuts: readonly CatalogueCut[],
): number {
  const hosts = new Set(hostCutsOf(region.on, cuts));
  const { box, mask } = region;
  const others = cuts.filter(
    (cut) => !hosts.has(cut) && cut.mask.width === mask.width && cut.mask.height === mask.height,
  );
  let own = 0;
  let elsewhere = 0;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    const row = y * mask.width;
    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (!(mask.data[row + x]! > 0)) continue;
      own += 1;
      const onAnother = others.some(
        (cut) =>
          x >= cut.box.x && x < cut.box.x + cut.box.width &&
          y >= cut.box.y && y < cut.box.y + cut.box.height &&
          cut.mask.data[row + x]! > 0,
      );
      if (onAnother) elsewhere += 1;
    }
  }
  return own === 0 ? 0 : elsewhere / own;
}

/*
  ---- A BOX FROM THE PRODUCT'S WORD MUST BE WHERE THAT KIND IS WORN (#2789) ----

  His panel drew *Septum ring* with the STAR TATTOO as its picture. The road,
  read on his screenshot crop: the reading said `septum ring`, the detector
  found nothing for it (0 of 6 sizes), and #2781's second ask in the accessory
  table's word — `nose stud` — is what placed it. That word is WIDER than the
  reading's, and the detector proves it on the same crop: asked `stud` it boxed
  the star (x228–241, the star is x227–241), and at 768 px wide `nose stud`
  boxed the LIP STUD below the lip. Nothing checked where the box landed, and a
  ring is not a star-shaped mark.

  The reading said where it is (`on: nose`), and the accessory table says where
  that KIND is worn (`site`): a nose stud is through the nose, so its cut must
  touch the nose the scan already cut. A yes/no about two rectangles, the
  module's own idiom (a cut outside its own rectangle is refused the same way),
  and no request: the nose is a question the scan has already asked.

  ⚠ **It applies to the product's word only, and that is the class rather than
  a gap.** The reading's own word is what the reading said the thing is; the
  table's word is a stand-in, and the stand-in is what needs checking. Run on
  every found accessory instead, the table's substring match would send a `lip
  stud` (`stud` is an earring word) to the EAR and refuse a real piercing.

  ⚠ **No nose, no row**: a site the scan did not cut cannot be agreed with, so
  the second ask's row is refused and the name is kept as words (`uncut`) —
  exactly what it was before #2781's second ask existed.
*/
function onItsSite(
  region: DiscoveredRegion,
  productWord: string,
  cuts: readonly CatalogueCut[] | null,
): boolean {
  const site = LANDMARK_OF_ACCESSORY.find((entry) => entry.region === productWord)?.site.question;
  if (site === undefined || cuts === null) return false;
  return cuts.some((cut) => cut.question === site && overlaps(region.box, cut.box));
}

/*
  ---- A FOUND THING IS WHERE THE READING SAID IT IS (#2796, his eye round 5) ----

  His words, verbatim: *"everything else was correct but lip piercing was the
  septum piercing and the lip piercing wasnt picked up at all"*. Read on a crop
  of his screenshot, painted clean of the hover overlay and sized to the
  1024-wide frame production reads: the reading said `lip piercing` on `lips`
  and `nose piercing` on `nose`; the detector, asked `lip piercing`, put its
  ONE rectangle on the septum ring, and the cut inside it cleared the fill
  floor (0.230). Asked `nose piercing`, it put its rectangle round the whole
  nose, and that cut was folded into the Nose row as the nose itself (#2757's
  rule). So the ring was drawn once, as *Lip piercing*, and the stud under the
  lip was drawn nowhere.

  ⚠ **THE CLASS IS THE ONE #2789 CLOSED FOR THE PRODUCT'S WORD, ON THE READING'S
  OWN WORD.** `onItsSite` above refused a box that the TABLE's word placed
  somewhere that kind is not worn, and its own paragraph said why it stopped
  there: the table's substring match sends a `lip stud` to the EAR. That
  warning still binds, so this check never reads the table. It reads the
  READING's own `on` — `lip piercing on=lips` — against the catalogue cuts the
  scan made on the same frame, through the catalogue's own five words
  ({@link catalogueWordsOf}), the same words the panel uses to put a found thing
  under a row.

  # WHY "NEARER ITS HOST THAN ANY OTHER PLACE", AND NOT "TOUCHES ITS HOST"

  Touching was the obvious rule, and it refuses a real labret: a stud under the
  lower lip sits in the hollow of the chin and need not touch the lips' own cut
  at all. So the question is relative, and needs no tolerance: of every place
  the scan cut on this frame, is the one the reading named the NEAREST to this
  cut? Measured on his frame: the ring's cut is 0 px from the nose's pixels and
  14 px from the lips', so `on=lips` is refused; the stud's own cut (one
  segmenter call in a box round it) is 0 px from the lips and 74 px from the
  nose, so it passes. On his frame that stud happens to touch the lips' cut by
  three rows, so the stud that touches NOTHING — lower in the chin's hollow —
  is proven by an arm in the suite rather than here. Distance is to the nearest pixel a
  place's cut CLAIMS, never to its rectangle — the hair's rectangle holds the
  whole face, and a rectangle test would make the hair the nearest place to
  everything.

  # WHEN IT DOES NOT JUDGE, DECLARED

  When the reading's `on` names no place the scan cut — `neck`, `cheek`,
  `forehead`, a found thing, or an ear the hair hides — there is nothing to be
  nearer to, and the cut is used exactly as before. A refusal is local to the
  one cut: no row, and the name keeps its words (`uncut`), exactly as a cut the
  detector placed nowhere.
*/

/**
 * THE CATALOGUE CUTS A READING'S `on` NAMES — both sides of a pair — or none.
 *
 * Matched through {@link catalogueWordsOf} on the cut's own slot definition, so
 * `lips`, `lip`, `ears`, `ear` and `eyebrow` all reach the row the panel would
 * put the thing under, and `neck` reaches nothing.
 */
export function hostCutsOf(
  on: string,
  cuts: readonly CatalogueCut[],
): CatalogueCut[] {
  if (on.trim() === "") return [];
  const host = normalisedName(on);
  const bySlot = new Map(catalogueSlots().map((definition) => [definition.slot, definition]));
  return cuts.filter((cut) => {
    const definition = bySlot.get(cut.slot);
    return definition !== undefined && catalogueWordsOf(definition).includes(host);
  });
}

/**
 * How far a rectangle is from the nearest pixel a cut claims, squared — 0 when
 * a claimed pixel lies inside it, and `Infinity` when the two are not of one
 * frame (the module's rule: a size mismatch is a fault upstream, and the
 * answer that cannot remove a row is "cannot say").
 */
function gapToCut(
  box: PointerBox,
  frame: { width: number; height: number },
  cut: { box: PointerBox; mask: Mask },
): number {
  const { mask } = cut;
  if (mask.width !== frame.width || mask.height !== frame.height) return Infinity;
  const right = box.x + box.width - 1;
  const bottom = box.y + box.height - 1;
  let best = Infinity;
  for (let y = cut.box.y; y < cut.box.y + cut.box.height; y += 1) {
    const dy = y < box.y ? box.y - y : y > bottom ? y - bottom : 0;
    if (dy * dy >= best) continue;
    const row = y * mask.width;
    for (let x = cut.box.x; x < cut.box.x + cut.box.width; x += 1) {
      if (mask.data[row + x]! <= 0) continue;
      const dx = x < box.x ? box.x - x : x > right ? x - right : 0;
      const gap = dx * dx + dy * dy;
      if (gap < best) {
        best = gap;
        if (best === 0) return 0;
      }
    }
  }
  return best;
}

/**
 * THE RECTANGLE A SECOND ASK IS MADE ON — the hosts' own rectangles, together,
 * grown by half their size on every side and kept inside the frame.
 *
 * Half is the measured size, not a tuned one: on his frame, the lips grown by
 * half is where the detector offered the stud at all (see the re-ask in
 * {@link cutDiscovered}). A crop that small still holds the septum ring, and
 * that is safe because every box offered meets {@link besideItsHost} first.
 */
function grownAround(
  boxes: readonly PointerBox[],
  frame: { width: number; height: number },
): PointerBox {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  const padX = Math.round((right - left) / 2);
  const padY = Math.round((bottom - top) / 2);
  const x = Math.max(0, left - padX);
  const y = Math.max(0, top - padY);
  return {
    x,
    y,
    width: Math.min(frame.width, right + padX) - x,
    height: Math.min(frame.height, bottom + padY) - y,
  };
}

/** One place a cut can be judged against, with an id its caller recognises. */
type Place = { id: string; box: PointerBox; mask: Mask };

/**
 * OF THE PLACES OFFERED, IS ONE THE READING NAMED THE NEAREST — the whole of
 * the measure, in ONE place, for both host checks ({@link besideItsHost} over
 * the scan's cuts, {@link besideItsFoundHost} over the reading's own found
 * things).
 *
 * Ties go to the host: a cut touching both the nose and the lips is on the
 * place the reading named, and refusing it would take a right row away on a
 * coin's edge.
 *
 * ⚠ **It exists because #2798 needed the same measure over a different
 * population, and a second copy of it would be working law 4 in the one place
 * this module can least afford it** — the gap is to the nearest pixel a place
 * CLAIMS, never to its rectangle, and a copy that quietly used the rectangle
 * would make the hair the nearest place to everything.
 */
function nearestNamedPlace(
  box: PointerBox,
  frame: { width: number; height: number },
  places: readonly Place[],
  hostIds: ReadonlySet<string>,
): { at: "unchecked" } | { at: "host" } | { at: "elsewhere"; nearest: string } {
  if (hostIds.size === 0) return { at: "unchecked" };
  let host = Infinity;
  for (const place of places) {
    if (!hostIds.has(place.id)) continue;
    host = Math.min(host, gapToCut(box, frame, place));
  }
  /* Nothing to be nearer to, or a frame the places are not of: the answer that
     cannot remove a row is "cannot say". */
  if (host === Infinity) return { at: "unchecked" };
  let nearest: { id: string; gap: number } | null = null;
  for (const place of places) {
    if (hostIds.has(place.id)) continue;
    const gap = gapToCut(box, frame, place);
    if (gap < host && (nearest === null || gap < nearest.gap)) nearest = { id: place.id, gap };
  }
  return nearest === null ? { at: "host" } : { at: "elsewhere", nearest: nearest.id };
}

/** What {@link besideItsHost} found. */
export type HostVerdict =
  /* The reading's `on` names no place the scan cut — nothing to be nearer to. */
  | { at: "unchecked" }
  /* Nearest the place the reading said, or tied with another for nearest. */
  | { at: "host" }
  /* Strictly nearer another place the scan cut, which is named. */
  | { at: "elsewhere"; nearest: CatalogueCut };

/**
 * IS THIS CUT WHERE THE READING SAID IT IS — the block above, as one pure
 * function over the cut and the scan's own cuts.
 *
 * Ties go to the host: a cut touching both the nose and the lips is on the
 * place the reading named, and refusing it would take a right row away on a
 * coin's edge.
 */
export function besideItsHost(
  thing: { box: PointerBox; on: string },
  frame: { width: number; height: number },
  cuts: readonly CatalogueCut[] | null,
): HostVerdict {
  if (cuts === null) return { at: "unchecked" };
  const hosts = hostCutsOf(thing.on, cuts);
  if (hosts.length === 0) return { at: "unchecked" };
  /* Keyed by POSITION and not by slot: two cuts of one slot would otherwise
     make a host its own rival, and the identity test this replaces could not. */
  const places = cuts.map((cut, at) => ({ id: String(at), box: cut.box, mask: cut.mask }));
  const hostIds = new Set(
    cuts.map((cut, at) => (hosts.includes(cut) ? String(at) : null)).filter((id) => id !== null),
  );
  const verdict = nearestNamedPlace(thing.box, frame, places, hostIds);
  if (verdict.at !== "elsewhere") return verdict;
  return { at: "elsewhere", nearest: cuts[Number(verdict.nearest)]! };
}

/*
  ---- AND THE PLACE MAY BE ANOTHER THING THE READING FOUND (#2798 road 1) ----

  #2796 closed the class where the reading's `on` names a place the SCAN cut.
  A reading also says things like `cross pendant on=chain necklace`, and a
  necklace is not a catalogue row — so {@link besideItsHost} answers
  `unchecked` and the box is used wherever it landed. His own cast reads exactly
  that, and the card's words for what it leaves open are *"a pendant box that
  landed on, say, the choker's ring would be used as it is."*

  # READ ON HIS OWN FRAME BEFORE ANY OF THIS WAS WRITTEN

  Measured on the reading #2796 was built from (his cast, overlay painted out,
  sized to the 1024-wide frame production reads), every number from the
  recorded cuts of that one reading:

    - the pendant's own cut is **0 px** from its host's cut and **36 px** from
      the choker's, so this check ACCEPTS it and his panel does not move;
    - the card's case does separate where the geometry allows it: a
      pendant-sized box walked over the choker's own pixels is refused for
      `on=chain necklace` at **7 of 20** stops — every one of them in the band
      above the chain's own cut. At the lower stops the chain's cut claims the
      same pixels as the choker's, the two are **0 px** apart, and no distance
      measure can separate them; a tie goes to the host, so the box is kept.
      ⚠ **That is declared rather than fixed**: where two cuts are the same
      pixels, "which of them is it on" is not a question about geometry.

  # WHY THE SCAN'S OWN CUTS ARE NOT RIVALS HERE, AND IT IS A MEASUREMENT

  The obvious thing — one population, every place in hand — was driven and
  refused. This cast's hair is cut down the whole body, so its claimed pixels
  are **0 px** from the collar, the choker, the chain and the corset alike. Of
  869 pendant-sized boxes standing 1–30 px off their correct host's cut, the
  catalogue cuts in the rival set refuse **553**; the found cuts alone refuse
  **270**; and **283 are refused by a catalogue place with no found rival at
  all — every one of them by the hair.** A row taken away by a strand of hair
  lying over the necklace is the wrong trade, and the honest sentence is that
  the rival places are the ones of the same sort as the host: a cut said to be
  on a place the SCAN cut is judged against the scan's places, and a cut said
  to be on a thing the READING found is judged against the reading's things.

  ⚠ **The converse is deliberately NOT changed**: found cuts do not become
  rivals in {@link besideItsHost}. That check is live on his account and his eye
  has passed it, and on this frame it would decide nothing differently — the
  lip piercing's cut is 0 px from both the nose's cut and the nose piercing's,
  and it is already refused.
*/

/** One thing the reading found and this module has already drawn. */
export type FoundPlace = { noun: string; box: PointerBox; mask: Mask };

/** What {@link besideItsFoundHost} found — `nearest` is the other thing's noun. */
export type FoundHostVerdict =
  | { at: "unchecked" }
  | { at: "host" }
  | { at: "elsewhere"; nearest: string };

/**
 * IS THIS CUT ON THE THING THE READING SAID IT IS WORN ON — the block above,
 * as one pure function over the cut and the things already drawn.
 *
 * The host is matched on the NOUN, through {@link normalisedName}, because that
 * is what a reading's `on` names and what the panel itself follows to put a
 * pendant under its chain (`facePanel`'s `foundHosting`).
 *
 * Two things are never rivals: the thing's own noun (a second pendant on one
 * chain is not evidence that the first is somewhere else) and an empty `on`.
 */
export function besideItsFoundHost(
  thing: { box: PointerBox; on: string; noun: string },
  frame: { width: number; height: number },
  found: readonly FoundPlace[],
): FoundHostVerdict {
  const host = normalisedName(thing.on);
  const own = normalisedName(thing.noun);
  if (host === "" || host === own) return { at: "unchecked" };
  const places: Place[] = [];
  const hostIds = new Set<string>();
  for (let at = 0; at < found.length; at += 1) {
    const one = found[at]!;
    const noun = normalisedName(one.noun);
    if (noun === own) continue;
    places.push({ id: String(at), box: one.box, mask: one.mask });
    if (noun === host) hostIds.add(String(at));
  }
  const verdict = nearestNamedPlace(thing.box, frame, places, hostIds);
  if (verdict.at !== "elsewhere") return verdict;
  return { at: "elsewhere", nearest: found[Number(verdict.nearest)]!.noun };
}

/**
 * Cut every off-list thing the reading named.
 *
 * `onFiled` is called as each row lands, so a panel that is already on screen
 * fills in rather than waiting for the last garment — the same courtesy
 * `scanFace` gives the catalogue rows, and the reason a reading that takes
 * forty seconds does not read as a reading that is stuck.
 *
 * ⚠ **EVERY NAME IS ASKED IN PARALLEL AND THE BOUND IS THE READER'S OWN GATE,
 * NOT A NUMBER HERE.** A dressed cast produces a dozen off-list names and each
 * one is two calls, so serial would be seventy-odd seconds in front of somebody
 * watching a panel fill — against the design's own estimate of 40–60 s for a
 * whole first reading. Every call this road makes goes through
 * `throughFalGate`, whose width is `FAL_CONCURRENCY` and whose reason is the
 * account's twenty-concurrent ceiling, so the queueing already happens in the
 * one place that knows about the catalogue scan running beside it. A second
 * limiter here would be a second opinion about one ceiling (working law 4), and
 * the one that fell behind would either waste the allowance or exceed it.
 */
export async function cutDiscovered(input: {
  frame: { bytes: Buffer; width: number; height: number; url?: string };
  features: readonly DiscoveredFeature[];
  reader: RegionReader;
  onFiled?: (region: DiscoveredRegion) => void;
  /**
   * THE CATALOGUE ROWS THE SCAN CUT ON THIS SAME FRAME, when they are in hand
   * (#2789) — {@link catalogueCutsOf} over the scan's own boxes and masks.
   *
   * A function and not a value because the scan runs BESIDE this road and
   * usually lands first: it is asked only once a name has a cut to compare, so
   * a reading with nothing found never waits for it. It decides two things —
   * a found cut on a catalogue row's own cut is that row (and is not drawn
   * again), and a box from the product's word must touch where that kind is
   * worn. ⚠ **Absent, or a scan that failed (`null`), and neither can be
   * shown**: nothing is folded, and every row the product's word placed is
   * refused rather than drawn unchecked.
   */
  catalogue?: () => Promise<readonly CatalogueCut[] | null>;
  /**
   * THE PLACES THE SCAN CUT THAT DRAW NO ROW ON THIS ROAD (#2810) —
   * {@link unDrawnCutsOf} over the same scan, asked the same lazy way. Absent
   * or `null`, and a body part cut as the whole face is drawn, as before.
   */
  unDrawn?: () => Promise<readonly CatalogueCut[] | null>;
}): Promise<{
  regions: DiscoveredRegion[];
  asked: number;
  declined: string[];
  failed: string[];
  /**
   * EVERYTHING THE READING NAMED THAT HAS NO ROW, with its words — the three
   * `why`s of {@link NamedNotCut} gathered in one list (#2566 slice 2).
   *
   * Two of them are known before any call (`scattered`, `makeup`) and one only
   * after (`uncut`), which is why this is assembled here rather than beside
   * {@link wordsOnlyFeatures}: a caller handed two lists would have to know
   * that the second completes the first.
   */
  named: NamedNotCut[];
}> {
  const { pointer, regionInBox } = input.reader;
  const regions: DiscoveredRegion[] = [];
  const declined: string[] = [];
  const failed: string[] = [];
  /* Every found noun the detector placed only in the product's own word. */
  const askedAs: { noun: string; as: string }[] = [];
  /* ...and every one of those whose box was not where that kind is worn (#2789). */
  const refusedAs: { noun: string; as: string }[] = [];
  /* Every found cut that was a catalogue row's own cut, by noun and slot (#2789). */
  const intoCatalogue: { noun: string; into: string }[] = [];
  /* Every cut nearer another place than the one the reading said (#2796)... */
  const strayed: { noun: string; on: string; nearer: string }[] = [];
  const strays: { from: number; region: DiscoveredRegion; nearest: CatalogueCut }[] = [];
  /* ...and every one of those a name on that place took as its own row. */
  const handedOver: { noun: string; to: string }[] = [];
  /* Every body-part cut lying mostly on other places the scan cut (#2801). */
  const notThere: { noun: string; on: string }[] = [];
  /* Every body-part cut that was a place the panel draws no row for (#2810). */
  const wholePlace: { noun: string; is: string }[] = [];
  /*
    EVERY BOX BEYOND THE COUNT THAT WAS CUT, AND WHETHER IT BECAME A ROW
    (#2838 road 2).

    ⚠ **It is a VERDICT and not a call count, and that distinction is the one
    this line could get wrong.** The summary log's own note says the number of
    calls belongs to the call census and nowhere else (working law 4), and this
    does not restate it: the census counts `POINTER_BOX_ABOUT` calls, this says
    what the extra ones DECIDED. The two differ whenever a cut comes back with
    no pixels, which the census counts and this does not.

    It is here because road 2's whole justification is a rate, and the rate it
    was built on is five of his readings read off a court's recorded answers.
    #2809 is the standing warning: a second look was shipped on three specimens
    and ran for three weeks with `rescued: 0` sitting in the log, written there
    for exactly this purpose and never read. So this reading exists from the
    first reading rather than from the first argument about it.
  */
  const beyondTheCount: { noun: string; kept: boolean }[] = [];
  /* Every name asked again on its own host's crop: boxes offered, and on the host. */
  const askedOnHost: {
    noun: string;
    /** Which road asked: a name whose cuts all strayed (#2796), or one the
     *  detector declined outright on the whole frame (#2798 road 2). */
    why: "strayed" | "declined";
    offered: number;
    onHost: number;
    cut: number;
  }[] = [];
  /* Cuts nearer another thing the reading FOUND than the one it said they are
     worn on, and the ones held back to be judged once every cut is in hand
     (#2798 road 1). */
  const strayedOnFound: { noun: string; on: string; nearer: string }[] = [];
  let heldBack = 0;
  let asked = 0;

  /* Asked once, the first time a cut needs it — see the input's own note. A
     scan that throws is a scan nothing can be compared with, which is `null`. */
  let catalogueRead: Promise<readonly CatalogueCut[] | null> | null = null;
  const catalogueCuts = (): Promise<readonly CatalogueCut[] | null> => {
    catalogueRead ??= (input.catalogue?.() ?? Promise.resolve(null)).catch(() => null);
    return catalogueRead;
  };
  let unDrawnRead: Promise<readonly CatalogueCut[] | null> | null = null;
  const unDrawnCuts = (): Promise<readonly CatalogueCut[] | null> => {
    unDrawnRead ??= (input.unDrawn?.() ?? Promise.resolve(null)).catch(() => null);
    return unDrawnRead;
  };

  /* Known without asking anybody: no outline to cut, or makeup. Gathered before
     the capability check below so a reader that cannot point still carries the
     words — the words were never the detector's to give. */
  const named: NamedNotCut[] = [...wordsOnlyFeatures(input.features)];

  /* A reader without the capability produces no rows, which is today's panel.
     It is checked once here rather than per name so the log says it once. */
  if (pointer === undefined || regionInBox === undefined) {
    log.warn({}, "this reader cannot point at a thing it has no word for — no found rows");
    return { regions, asked, declined, failed, named };
  }

  const frame = { width: input.frame.width, height: input.frame.height };
  /* ⚠ `pointerFeatures`, NOT `offListFeatures`: a scattered thing, a makeup and
     a place-name are off the catalogue's list and are still never asked about.
     The two functions answer different questions and the header says which. */
  const population = pointerFeatures(input.features);
  asked = population.length;

  /*
    WHAT HAS BEEN DRAWN ON THE PANEL SO FAR, so a second noun cut onto pixels
    already drawn is never drawn twice while the reading runs (#2752).

    ⚠ **This is the courtesy road and `settleByPlace` below is the authority.**
    Rows land in the order the provider answers, so the row drawn first is not
    always the one the settled reading keeps — the settled answer may relabel
    that place (the larger cut's noun) or move an accessory into the Outfit once
    the garment it is worn on has landed. What this prevents is the one thing a
    customer would read as broken: the same picture appearing as two rows and
    one of them vanishing.
  */
  const drawn: Placed[] = [];
  const draw = (region: DiscoveredRegion): void => {
    const one: Placed = { region, at: drawn.length, pixels: claimedPixels(region) };
    if (drawn.some((held) => samePlace(held, one))) return;
    drawn.push(one);
    input.onFiled?.(region);
  };

  /** Does the reading say this thing is worn on ANOTHER THING IT NAMED (#2798)? */
  const onAnotherFoundThing = (feature: DiscoveredFeature): boolean => {
    const host = normalisedName(feature.on);
    if (host === "" || host === normalisedName(feature.name)) return false;
    return population.some((other) => normalisedName(other.name) === host);
  };

  /*
    THE BARRIER — every cut in hand, so a thing worn on another found thing is
    judged against its host's own cut (#2798 road 1).

    ⚠ **The ASK stays parallel and only the JUDGEMENT waits, and the reason is
    the customer's own wait.** The obvious shape was a second wave: ask the
    pendant after the chain has landed. Driven at the recorded numbers of his
    own reading, a name costs about a `detect` plus a box cut — 11.6 s and
    11.4 s on that run — so a second wave adds some twenty seconds to a
    seventy-seven-second reading for every cast wearing a pendant on a chain,
    which is most of them. Deferring the judgement instead costs nothing but
    the ORDER that row fills in: a thing worn on another found thing appears
    when the reading finishes rather than as it lands. The module's own
    courtesy rule is unbroken — nothing is drawn and then taken away.

    ⚠ **ONE HOP, DECLARED.** The places are the things drawn in the first pass,
    so a chain of two (`buckle on=strap`, `strap on=coat`) leaves the buckle
    unjudged — `unchecked`, which is what it is today. Judging a chain means
    ordering the passes by depth, and nothing measured asks for it yet.
  */
  let releaseFound: (places: readonly FoundPlace[]) => void = () => {};
  const foundPlaces = new Promise<readonly FoundPlace[]>((resolve) => { releaseFound = resolve; });
  let stillAsking = population.length;
  const arrive = (): void => {
    stillAsking -= 1;
    if (stillAsking > 0) return;
    releaseFound(drawn.map(({ region }) => ({ noun: region.noun, box: region.box, mask: region.mask })));
  };

  const perName = await Promise.all(population.map(async (feature, at) => {
    const mine: DiscoveredRegion[] = [];
    /* Cuts held back for the barrier above — judged, drawn or refused once
       every name has been asked (#2798 road 1). */
    const deferred: DiscoveredRegion[] = [];
    /*
      THE WHOLE OF THIS TASK'S STATE, written by both phases and read ONCE, by
      the single return at the foot.

      ⚠ **It is read at the END rather than built where each phase finishes,
      and that is the defect the shape prevents**: a cut settled after the
      barrier can still fold into a catalogue row, so an object assembled
      before that would carry a stale `held` and the name would be reported as
      one nothing could draw.
    */
    let declined = false;
    let broke = false;
    /* Drawn by the catalogue already: not drawn again, and not "uncut" either. */
    let held = false;
    const heldInto: FeatureSlot[] = [];
    /* How many of this name's cuts were nearer another place (#2796). */
    let wandered = 0;
    /* This name's body-part cuts that lie mostly on other places (#2801),
       judged at the foot of this task once every cut is in hand. */
    const lying: DiscoveredRegion[] = [];
    let boxes: readonly PointerBox[] = [];
    /* The product's word, when it is what placed this name's boxes. */
    let product: string | null = null;
    /*
      THE SLOTS OF THE BOXES BEYOND THE COUNT (#2838 road 2), so the verdict on
      each is read at the FOOT of this task and not at the `settle` that first
      saw it. An extra worn on another thing the reading found is HELD BACK by
      the barrier, so a verdict taken where it was settled would read `kept:
      false` on a cut that is about to become a row.
    */
    const extraSlots: string[] = [];

    const cutInside = async (box: PointerBox, index: number) => {
      try {
        const mask = await regionInBox.call(input.reader, {
          image: input.frame.bytes,
          name: feature.name,
          box,
          imageUrl: input.frame.url,
        });
        if (mask === null) return { index, region: null, broke: false };
        const bounds = boundsOf(mask);
        if (bounds === null) {
          log.debug({ name: feature.name }, "the cut had no pixels in it — no row");
          return { index, region: null, broke: false };
        }
        if (!overlaps(bounds, box)) {
          /* The segmenter cut something, somewhere else. Not a quality
             judgement and not a tolerance: the rectangle WAS the question. */
          log.warn(
            { name: feature.name, askedAbout: box, answered: bounds },
            "the cut sits outside the rectangle it was asked about — no row",
          );
          return { index, region: null, broke: false };
        }
        /*
          THE JUDGEMENT — and on THIS road the fill is a MEASUREMENT and never
          a refusal (#2831, the relay's decision of 2026-10-30).

          ⚠ **IT USED TO REFUSE HERE AND THAT WAS THE DEFECT.** A cut filling
          under a fifth of its rectangle got no row, on the reasoning that it
          was the "only the straps" answer — a coherent fragment of the thing
          returned silently in place of the thing. Measured on two real
          pictures the day after it shipped: a **correct** cut of a long curved
          tail fills **17.00%** and was thrown away with nothing said, while a
          cut of **the sword in the character's hand**, asked for as chest
          armour, passed at **21.64%**. Fill does not order correctness, and on
          this road the cost of losing that coin flip is a feature of his
          character vanishing invisibly — the thing he reported by eye three
          times in one week (#2800, #2810, #2817). Every row's cut is outlined
          on hover here, so a partial or wrong cut is visible before anyone
          refines on it; a missing row is not.

          What still refuses, and both are yes/no facts: no pixels at all, and
          no overlap with the rectangle that asked. The second is checked twice
          over — `overlaps` above on the boxes, and `no-overlap` inside the
          judgement on the pixels.

          ⚠ **The fill is logged on EVERY judgement, which is now the whole of
          what it is for.** The number keeps growing its population for free —
          that is how the tail and the sword were found — and it decides
          nothing.
        */
        const verdict = judgeCut({ mask, box, fillFloor: FILL_MEASURED_NOT_REFUSED });
        if (!verdict.use) {
          log.warn(
            { name: feature.name, askedAbout: box, answered: bounds, fill: verdict.fill, why: verdict.why },
            "the cut had nothing of the rectangle it was asked about in it — no row",
          );
          return { index, region: null, broke: false };
        }
        log.debug(
          { name: feature.name, fill: verdict.fill, claimed: verdict.claimed },
          "the cut is kept, and this is how much of its rectangle it filled",
        );
        return {
          index,
          region: {
            slot: discoveredSlotOf(feature.name, index + 1),
            noun: feature.name,
            instance: index + 1,
            kind: feature.kind,
            on: feature.on,
            box: { ...bounds, frame },
            mask,
          } satisfies DiscoveredRegion,
          broke: false,
        };
      } catch (error) {
        log.warn(
          { name: feature.name, why: error instanceof Error ? error.message : String(error) },
          "the cut inside that rectangle could not be made — no row for it",
        );
        return { index, region: null, broke: true };
      }
    };

    /* One landed cut against the places in hand: a row, a fold, or a refusal. */
    const settle = (
      region: DiscoveredRegion,
      cuts: readonly CatalogueCut[] | null,
      /** The things already drawn, or `null` while the asking is still going
       *  on — see the barrier above. */
      found: readonly FoundPlace[] | null,
      /** The places the scan cut that the panel deliberately draws no row
       *  for (#2810), or `null` when the caller offered no scan. */
      unDrawn: readonly CatalogueCut[] | null,
      /**
       * A BOX BEYOND THE COUNT (#2838 road 2) — it may ADD a row and may do
       * nothing else.
       *
       * The reading did not count this instance, so whatever its cut turns out
       * to be says nothing about the name — and ONE piece of this task's state
       * is therefore left alone where a counted cut would move it:
       *
       *   **`held`** — #2801's *"a name the catalogue drew part of keeps its
       *   other cuts"*, the second tusk beside the tusk that IS Teeth. That rule
       *   was measured on COUNTED cuts, and the catalogue drawing an ORDINARY
       *   EYE under an extra rectangle of `third eye` is not the catalogue
       *   drawing part of the third eye. Letting an extra's fold set `held`
       *   would keep a `lying` cut this module measured and refused — on the
       *   three-eyed cast, a picture of the HAIR drawn as a third eye. Its arm
       *   is in `pointerCut.test.ts`, driven on that shape, and it reddens under
       *   the removal of this one line.
       *
       * ⚠ **AND ONE THING IS DELIBERATELY *NOT* GUARDED, WHICH THIS BLOCK
       * CLAIMED FOR A WHILE AND COULD NOT PROVE: A STRAYED EXTRA.** A draft
       * kept an extra out of `strays`/`wandered` on the reasoning that it must
       * not open the paid second ask on a crop (gated on `wandered > 0`). Two
       * things were wrong with it. **It is not better behaviour**: a strayed
       * cut is evidence already bought, and handing it to the name whose place
       * it landed on is precisely what #2796's road exists for — the septum
       * ring would otherwise have no row under any name. **And it could not be
       * driven**: reaching that gate needs `mine` empty with `landed` not, so
       * every counted cut judged away WITHOUT straying, which takes a counted
       * cut that is `lying` while the extra strays and an `on` that names a
       * catalogue slot at the same time. Two attempts at real geometry could not
       * build it, and a guard whose arm passes green under its own removal is
       * the inert shape this repository keeps paying for.
       *
       * **So the honest statement of the cost is not "no new calls":** a reading
       * where every counted cut was judged away and an extra strayed may buy one
       * `detect` on a crop that the cap would not have. That is #2796's road
       * doing its job on a reading that had already gone wrong, and it is said
       * here rather than implied by a clause about additivity.
       */
      beyondTheCount = false,
    ): void => {
      /* A box from the product's word must be where that kind is worn. */
      if (product !== null && !onItsSite(region, product, cuts)) {
        log.warn(
          { name: feature.name, as: product, answered: region.box },
          "the product's word placed this somewhere that kind is not worn — no row",
        );
        refusedAs.push({ noun: feature.name, as: product });
        return;
      }
      /* Any cut, in either word, must be where the READING said it is (#2796). */
      const place = besideItsHost(region, region.mask, cuts);
      if (place.at === "elsewhere") {
        log.warn(
          { name: feature.name, on: feature.on, nearer: place.nearest.slot, answered: region.box },
          "the cut is nearer another place than the one the reading said it is on — not this name's row",
        );
        strayed.push({ noun: feature.name, on: feature.on, nearer: place.nearest.slot });
        strays.push({ from: at, region, nearest: place.nearest });
        wandered += 1;
        return;
      }
      /*
        ...AND THE PLACE MAY BE ANOTHER THING THE READING FOUND (#2798 road 1).

        Only where the catalogue had nothing to say, so this is never a second
        opinion on its verdict — a reading's `on` either names a place the scan
        cut or it does not. `found` is `null` until every name has been asked,
        because a pendant cannot be judged before its chain has been cut: those
        cuts are held back and settled at the foot of this task.
      */
      if (place.at === "unchecked" && onAnotherFoundThing(feature)) {
        if (found === null) {
          deferred.push(region);
          heldBack += 1;
          return;
        }
        const among = besideItsFoundHost(
          { box: region.box, on: feature.on, noun: region.noun },
          region.mask,
          found,
        );
        if (among.at === "elsewhere") {
          log.warn(
            { name: feature.name, on: feature.on, nearer: among.nearest, answered: region.box },
            "the cut is nearer another thing the reading found than the one it is worn on — no row",
          );
          strayedOnFound.push({ noun: feature.name, on: feature.on, nearer: among.nearest });
          return;
        }
      }
      /* A cut on a catalogue row's own cut is that row (#2757's class). */
      const row = cuts === null ? null : catalogueRowOf(region, cuts);
      if (row !== null) {
        intoCatalogue.push({ noun: feature.name, into: row.slot });
        if (beyondTheCount) return;
        heldInto.push(row.slot);
        held = true;
        return;
      }
      /* A body part cut as the whole face is not a part of it (#2810). */
      const whole = unDrawn === null ? null : unDrawnPlaceOf(region, unDrawn);
      if (whole !== null) {
        log.warn(
          { name: feature.name, is: whole.slot, answered: region.box },
          "the cut of this body part is a whole place the panel draws no row for — not a part, no row",
        );
        wholePlace.push({ noun: feature.name, is: whole.slot });
        return;
      }
      /* A body part lying mostly on other places is decided once this name's
         every cut is in hand — see `shareOnOtherPlaces`. */
      if (feature.kind === "anatomy" && cuts !== null && shareOnOtherPlaces(region, cuts) > 0.5) {
        lying.push(region);
        return;
      }
      mine.push(region);
      draw(region);
    };

    /*
      THE SECOND ASK, ON A CROP OF THE PLACE THE READING NAMED — ONE ROAD, TWO
      CALLERS: a name whose every cut strayed (#2796) and a name the detector
      declined outright (#2798 road 2). It was inline in the first of those
      until the second needed it, and a copy would have been working law 4 on a
      road that spends money.

      ⚠ **It needs a place the SCAN cut, so a name worn on another FOUND thing
      is not re-asked — declared, not forgotten.** That cut is not in hand
      while the asking is going on (the barrier above), so reaching it would
      cost the second wave this module measured and refused.
    */
    const askOnHostCrop = async (
      cuts: readonly CatalogueCut[] | null,
      unDrawn: readonly CatalogueCut[] | null,
      why: "strayed" | "declined",
    ): Promise<void> => {
      if (cuts === null) return;
      const hosts = hostCutsOf(feature.on, cuts);
      /* ⚠ **Sabotaging this line reddens nothing and the reason is worth
         knowing**: `grownAround` of no rectangles is `Infinity` wide, which the
         crop refuses on its own, so the behaviour is doubly held. The line is
         here for the LOG — a name with no place to crop to is not a name whose
         place "could not be asked about again". */
      if (hosts.length === 0) return;
      const area = grownAround(hosts.map((cut) => cut.box), frame);
      try {
        const sharp = (await import("sharp")).default;
        const crop = await sharp(input.frame.bytes)
          .extract({ left: area.x, top: area.y, width: area.width, height: area.height })
          .png()
          .toBuffer();
        const offered = await pointer.call(input.reader, { image: crop, name: product ?? feature.name });
        const onHost = offered
          .map((box) => ({ x: box.x + area.x, y: box.y + area.y, width: box.width, height: box.height }))
          .filter((box) => besideItsHost({ box, on: feature.on }, frame, cuts).at === "host");
        /*
          THE CAP, as on the first ask, in the order the detector offered them.

          ⚠ **AND #2838 ROAD 2 IS DELIBERATELY *NOT* APPLIED HERE — the law-7
          sweep's one other site, with the reason read rather than assumed.**
          His defect cannot occur on this road: it fires only for a name whose
          `on` names a place the SCAN cut (`hosts.length === 0` returns, four
          lines up), and every `on` road 2's measured extras carry — `arm`,
          `cheek`, `forehead` — is no catalogue slot. A sleeve on an arm never
          reaches this crop at all.

          What IS reachable here is a name on a real slot whose crop offers more
          rectangles than the reading counted — two earrings on one ear. That is
          **his own open design question** on #2833 (several of one noun on one
          place) and #2862's one-thing-one-row ruling, not a cap question, so it
          is named here and left for those cards rather than folded into this
          one (his 2026-09-24 rule).
        */
        const near = onHost.slice(0, Math.max(1, feature.count));
        askedOnHost.push({ noun: feature.name, why, offered: offered.length, onHost: onHost.length, cut: near.length });
        const again = await Promise.all(near.map(cutInside));
        for (const one of again.sort((a, b) => a.index - b.index)) {
          if (one.broke) broke = true;
          if (one.region !== null) settle(one.region, cuts, null, unDrawn);
        }
      } catch (error) {
        log.warn(
          { name: feature.name, why: error instanceof Error ? error.message : String(error) },
          "the place the reading named could not be asked about again — no row for it",
        );
      }
    };

    const phaseOne = async (): Promise<void> => {
      try {
        boxes = await pointer.call(input.reader, {
          image: input.frame.bytes,
          name: feature.name,
          imageUrl: input.frame.url,
        });
        /* Declined in the reading's word — once more in the product's, for a
           worn thing the accessory table knows (see `productWordFor`). */
        const wider = boxes.length === 0 ? productWordFor(feature) : null;
        if (wider !== null) {
          product = wider;
          boxes = await pointer.call(input.reader, {
            image: input.frame.bytes,
            name: product,
            imageUrl: input.frame.url,
          });
          if (boxes.length > 0) askedAs.push({ noun: feature.name, as: product });
        }
      } catch (error) {
        /* A transport failure is NOT an absence — see `RegionReader.pointer`. It
           costs this one row and nothing else. */
        log.warn(
          { name: feature.name, why: error instanceof Error ? error.message : String(error) },
          "the detector could not be asked about this one — no row for it",
        );
        broke = true;
        return;
      }
      if (boxes.length === 0) {
        /*
          DECLINED ON THE WHOLE FRAME — ASK ONCE MORE ON THE PLACE THE READING
          NAMED (#2798 road 2).

          Read on his own frame before this was written, because the card says
          the road was unmeasured and to measure it first. On the reading #2796
          was built from, `septum ring` — a word his readings have used — is
          **0 boxes on the whole 1024-wide frame** and **ONE box on a crop of the
          nose's own cut grown by half**, landing on the ring (x513-548 y519-542).
          A `labret` is the other way round: a wrong 510x82 band across the
          corset on the whole frame, and nothing on the crop — so the crop also
          declines honestly where the frame answers rubbish, and the host check
          below would have refused that band anyway. The positive controls on the
          same two crops answer as the frame does (`nose piercing` one box,
          `lip piercing` four).

          ⚠ **AND IT IS CHEAP IN THE ONE WAY THAT SHOWS, which is why the card's
          own worry does not bite**: a crop that small is **730–853 ms** against
          **11.5–18.5 s** for the same question on the whole frame, so the second
          ask costs a fraction of the first. The gate is narrow — only a name the
          reading put on a place the SCAN cut, which on that whole reading was
          none of them.

          ⚠ **A name whose call FAILED is not re-asked here.** That is a retry,
          not a second look, and a transport failure is not an absence (the
          `catch` above). The same reading is the warning: it declined NOTHING
          and its two word-only names were both `fetch failed`.
        */
        await askOnHostCrop(await catalogueCuts(), await unDrawnCuts(), "declined");
        /* Still nothing that could be drawn: the reading named it and the
           detector cannot find it. No row, by his ruling, and it is recorded
           rather than silently dropped — the words still reach the current
           description (#2565 §2) and the next edit to that area asks again. */
        if (mine.length === 0 && !held && deferred.length === 0) declined = true;
        return;
      }

      /*
        THE CAP, AND THE BOXES BEYOND IT (#2838 road 2) — the module header
        carries the cap's own measurement, and this carries road 2's.

        The cap is `count` boxes, in the detector's order, and it stays exactly
        that for the boxes that BECOME this name's instances. What changes is
        that a box past it is no longer thrown away unasked: it is cut, and kept
        only where it lands on nothing the scan already holds. `settle` is the
        whole of that judgement and it already existed — a cut that is a
        catalogue row's own pixels is that row, a cut nearer another place than
        the one the reading named is not this name's, a body part cut as a whole
        place is not a part of it. Road 2 adds no bar and no number.

        # WHY THE CAP COULD NOT SIMPLY BE RAISED, WHICH IS THE WHOLE CARD

        His round-9 cast has a full tattoo sleeve on each arm. The reading names
        `tattoo` ONCE, on `arm`, count 1; the detector boxes BOTH arms; the cap
        cuts the first. So one sleeve is outlined and the other cannot be picked
        — *"her tattoos were not picked up"*, from the other end. And the cap
        cannot go: on the three-eyed cast the detector returned THREE boxes for
        `third eye` and two of them were the ordinary eyes, which is the
        measurement in the module header. Both are true, so the question is not
        how many boxes to cut but which of the extra ones is a thing.

        # WHAT IT COSTS, MEASURED ON WHAT WAS ALREADY BOUGHT

        Read off the boxing court's own recorded `detect` answers — the same
        model this road calls (`falRegionReader.ts`'s `DETECT`) — over five of
        his real readings (r5, r8, r9, r10c, r10t), against each reading's own
        count:

          names the detector boxed at all   25
          boxes cut today (at most count)   28
          boxes beyond the count            2   ← road 2's whole spend

        **0.4 extra segmenter calls per reading**, against the 21–27 reads a
        scan already makes (#2191). And both of the two are the defect itself:

          r9  tattoo on=arm   count 1, 2 boxes — kept x0-196, EXTRA x872-1024
          r5  tattoo on=cheek count 1, 2 boxes — kept x391-417, EXTRA x641-663

        ⚠ **A HOST FILTER ON THE RECTANGLE WAS DESIGNED, MEASURED AND DROPPED,
        and it is recorded so nobody builds it again.** The tempting cheap gate
        is {@link besideItsHost} on the extra's rectangle alone, which is what
        {@link askOnHostCrop} does before its own cap. It refuses NOTHING here:
        it needs `on` to name a place the scan cut, and the three `on` values
        this road's extras actually carry — `arm`, `cheek`, `forehead` — are
        none of them catalogue slots (`scanPlan()`), so all three answer
        `unchecked`. A filter that cannot fire is machinery, not a saving.

        ⚠ **AND A BARE "the rectangle touches a cut the scan drew" GATE IS WORSE
        THAN NONE, which this module has already measured.** The hair is cut
        down the whole body on some casts, so its claimed pixels are 0 px from
        everything — {@link besideItsHost}'s own docblock records 283 correct
        boxes refused by a catalogue place with no found rival, *every one of
        them by the hair*. So the extras are judged on their CUT, like every
        other cut on this road, and the two wasted calls on the three-eyed cast
        are the stated price of not refusing a real row by a strand of hair.
      */
      const counted = Math.max(1, feature.count);
      const asking = boxes.slice(0, counted);
      const cut = await Promise.all(asking.map(cutInside));
      const landed: DiscoveredRegion[] = [];
      for (const one of cut.sort((a, b) => a.index - b.index)) {
        if (one.broke) broke = true;
        if (one.region !== null) landed.push(one.region);
      }
      /*
        THE BOXES BEYOND THE COUNT ARE A SECOND WAVE, AND BOTH HALVES OF THAT
        SENTENCE ARE LOAD-BEARING (#2838 road 2).

        **SECOND**, not part of the `Promise.all` above, because an extra may
        only be kept where it lands on nothing the scan already holds — so the
        scan's cuts must be in hand to judge it, and `catalogueCuts()` is a
        promise the catalogue scan RESOLVES. Cutting the counted boxes first
        keeps today's timing exactly: the counted cuts still run while the
        catalogue scan is still going, and only a reading that actually has an
        extra waits for it. Measured, that is 0.4 readings in one.

        **AND NO EXTRA IS BOUGHT AT ALL WITH NO SCAN IN HAND**, which is the
        fail-closed half. With `cuts === null` — no catalogue offered, or a scan
        that threw — nothing can say whether an extra is a thing or an ordinary
        eye, and the honest answer to a question you cannot ask is the cap. This
        is not a corner: it is the shape every unit fixture of this road takes,
        and without this line the three-eyed cast's two extras would become two
        rows in exactly the case where nothing could notice.
      */
      const over = boxes.slice(counted);
      /*
        ⚠ **THE COUNTED CUTS SETTLE FIRST AND THE ORDER IS LOAD-BEARING**, for
        the same reason the held-back cuts settle before the lying ones are
        judged: `settle` reads and moves this task's own state. A counted cut
        that folds into a catalogue row sets `held`, and #2801's rule then keeps
        this name's other cuts — so settling an extra first would read a `held`
        that the counted cut was about to set, and the two orders disagree on
        the real second-tusk cast. The extras go last, where the state they
        read is final.
      */
      const askExtras = async (
        cuts: readonly CatalogueCut[] | null,
        unDrawn: readonly CatalogueCut[] | null,
      ): Promise<void> => {
        if (over.length === 0) return;
        if (cuts === null) {
          log.debug(
            { name: feature.name, boxes: boxes.length, count: counted },
            "the detector offered more rectangles than the reading counted, and there is no scan to judge them against — the count is the cap",
          );
          return;
        }
        const extra = await Promise.all(over.map((box, at) => cutInside(box, counted + at)));
        for (const one of extra.sort((a, b) => a.index - b.index)) {
          if (one.broke) broke = true;
          if (one.region === null) continue;
          extraSlots.push(one.region.slot);
          settle(one.region, cuts, null, unDrawn, true);
        }
      };
      if (landed.length === 0) {
        /* Nothing of this name could be drawn, so the extras are still asked —
           a reading whose first rectangle came back empty is exactly a reading
           whose second one may be the thing. */
        await askExtras(await catalogueCuts(), await unDrawnCuts());
      }
      if (landed.length > 0) {
        const cuts = await catalogueCuts();
        const unDrawn = await unDrawnCuts();
        for (const region of landed) settle(region, cuts, null, unDrawn);
        await askExtras(cuts, unDrawn);
        /*
          EVERY CUT WAS SOMEWHERE ELSE — ASK ONCE MORE, ON THE PLACE THE READING
          NAMED (#2796, the third defect: the real stud had no row at all).

          Measured on his frame at 1024 wide: asked `lip piercing` on the WHOLE
          frame, the detector offered ONE rectangle, the septum ring; `lip stud`
          and `lip ring` offered the whole lower lip, and `labret` nothing.
          Asked `lip piercing` on a crop round the lips' own cut, grown by half
          its size on every side, it offered FOUR: the stud's two balls and the
          septum ring's two. So the crop is where the thing becomes findable, and
          the host check above is what makes the crop safe — the ring's balls are
          in the crop too, and are nearer the nose. The boxes offered are
          filtered to the ones on the host BEFORE the cap, so no segmenter call is
          bought for a rectangle already known to be somewhere else.

          ⚠ **Once per name, and the second caller arrived with #2798 road 2**:
          this clause read *"a name the detector declined outright is not
          re-asked by this — that is unmeasured"*, and the measurement is now in
          the decline branch above, which asks through this same road. The spend
          is one `detect` and at most `count` box cuts, on a reading where
          something was already wrong.
        */
        if (mine.length === 0 && !held && deferred.length === 0 && wandered > 0) {
          await askOnHostCrop(cuts, unDrawn, "strayed");
        }
      }
    };

    try {
      await phaseOne();
    } finally {
      /*
        EVERY NAME ARRIVES, AND THERE IS EXACTLY ONE PLACE THAT SAYS SO.

        The early exits are what this is about and each of the three has an arm:
        a failed call, a decline, and a cut nothing could draw. Their sabotage
        is deleting this line — the arms then HANG rather than answering wrong,
        which is the shape a barrier's test has to take.

        ⚠ **The `finally` itself guards less than it looks, stated rather than
        implied.** `phaseOne` catches every provider failure of its own, so the
        only way out of it is the caller's `onFiled` throwing — and that
        rejects this task, which rejects the `Promise.all`, so nothing hangs
        either way. It is here because one call site that cannot be missed is
        worth more than three that can.
      */
      arrive();
    }

    /*
      THE CUTS HELD BACK, now that every name has been asked and everything
      drawable is drawn (#2798 road 1).

      They go through the same {@link settle}, so a held-back cut still meets
      the catalogue fold and the duplicate-place rule — the only thing that
      changed is that its host's own cut is now in hand.
    */
    if (deferred.length > 0) {
      const places = await foundPlaces;
      const cuts = await catalogueCuts();
      const unDrawn = await unDrawnCuts();
      for (const region of deferred) settle(region, cuts, places, unDrawn);
    }

    /*
      ⚠ **THE HELD-BACK CUTS ARE SETTLED BEFORE THE LYING ONES ARE JUDGED, AND
      THE ORDER IS LOAD-BEARING.** The loop below reads `held`, and a cut
      released by the barrier can still fold into a catalogue row and set it —
      so judging first would read a stale `held` and refuse a cut that the
      fold was about to keep. This is the same reason the task's own state is
      read once, at the foot, and not where each phase finishes.
    */
    /*
      A NAME THE CATALOGUE DREW PART OF KEEPS ITS OTHER CUTS; ANY OTHER NAME
      LYING ON OTHER PLACES GETS NO ROW (#2801). The first: the second tusk on
      the lips' cut, beside the tusk that IS Teeth, joins Teeth below. The
      second: the brow ridge on the two ears.
    */
    for (const region of lying) {
      if (held) {
        mine.push(region);
        draw(region);
        continue;
      }
      log.warn(
        { name: feature.name, on: feature.on, answered: region.box },
        "the cut of this body part lies mostly on other places the scan cut — not this body part, no row",
      );
      notThere.push({ noun: feature.name, on: feature.on });
    }
    for (const slot of extraSlots) {
      beyondTheCount.push({ noun: feature.name, kept: mine.some((region) => region.slot === slot) });
    }
    return { name: feature.name, regions: mine, declined, broke, held, heldInto };
  }));

  /*
    ---- A CUT ON THE WRONG PLACE IS OFFERED TO THE NAME THAT PLACE HOSTS (#2796,
    the second half of the class) ----

    *"Two names whose boxes land on one thing must not leave that thing under
    the wrong name and the other thing with no row at all."* On his frame the
    one cut of the septum ring was `lip piercing`'s, and the name the reading
    gave the ring — `nose piercing`, on the nose — had no cut of its own: its
    rectangle was the whole nose, which is the Nose row. Refusing the cut for
    `lip piercing` alone would leave the ring with no row under ANY name.

    So a refused cut is offered, once, to the FIRST name in the reading's order
    that the place it lies on hosts by the reading's own `on`, of the SAME kind,
    with no row of its own — either nothing was cut for it, or its only cut was
    its host itself. No request is made: the cut is evidence already bought,
    and the reading already named what is there.

    ⚠ **What it does not do, declared.** A name whose cut was folded into a
    DIFFERENT catalogue row (a found hoop that is the Earrings row) is drawn,
    as that row, and is not offered anything. A refused cut nobody on that place
    can take is dropped — the reading did not name that thing, and a feature the
    reading did not name gets no row. And the handed cut still meets
    {@link catalogueRowOf}: a cut that is its new host's own pixels is that host.
  */
  if (strays.length > 0) {
    const cuts = await catalogueCuts();
    const taken = new Set<number>();
    for (const stray of [...strays].sort((a, b) => a.from - b.from || a.region.instance - b.region.instance)) {
      if (cuts === null) break;
      const to = population.findIndex((other, at) => {
        if (at === stray.from || taken.has(at)) return false;
        if (other.kind !== stray.region.kind) return false;
        if (normalisedName(other.name) === normalisedName(stray.region.noun)) return false;
        const theirs = perName[at]!;
        if (theirs.regions.length > 0) return false;
        const hosts = hostCutsOf(other.on, cuts);
        if (!hosts.some((cut) => cut.slot === stray.nearest.slot)) return false;
        /* No row of its own: nothing cut, or only its own host's pixels. */
        return theirs.heldInto.every((slot) => hosts.some((cut) => cut.slot === slot));
      });
      if (to < 0) continue;
      const other = population[to]!;
      const handed: DiscoveredRegion = {
        ...stray.region,
        slot: discoveredSlotOf(other.name, 1),
        noun: other.name,
        instance: 1,
        kind: other.kind,
        on: other.on,
      };
      if (catalogueRowOf(handed, cuts) !== null) continue;
      taken.add(to);
      perName[to]!.regions.push(handed);
      handedOver.push({ noun: stray.region.noun, to: other.name });
      draw(handed);
    }
  }

  /*
    ---- ONE COUNTED BODY PART IS ONE ROW, EVEN WHEN THE CATALOGUE DREW PART OF
    IT (#2801, his eye on the first creature) ----

    His words, verbatim: *"his tusks and teeth are getting confused"*. Read on
    his picture: the catalogue's `all the teeth` cut ONE tusk, and that is the
    Teeth row's picture. The reading named `tusks`, count 2, and the detector
    boxed both. The fold above (#2757's rule) is decided one cut at a time, so
    the tusk on the Teeth row's own pixels was folded into Teeth and the other
    became a second row, *Tusks*. One thing, split across two rows.

    So when a body part's name has a cut that IS a catalogue row's own cut, the
    name's other cuts are more of that same thing: they sit ON that row, and
    the panel draws them inside it (its children, under the same tap). The
    picture decides where it sits, as `settleByPlace`'s garment rule already
    does. Both tusks end up in the one Teeth row, and neither is drawn twice.

    ⚠ **Body parts only, and that is the two-instance rule rather than a gap
    (#2565 §6).** A second piercing on an ear shares no pixels with the
    catalogue's earring and is a second thing with its own row (#2789). A body
    part the reading counted is ONE feature with several pieces.
  */
  const slotNoun = new Map(catalogueSlots().map((definition) => [definition.slot, definition.noun]));
  const joined: { noun: string; into: string }[] = [];
  for (let at = 0; at < perName.length; at += 1) {
    const one = perName[at]!;
    if (population[at]!.kind !== "anatomy" || one.heldInto.length === 0 || one.regions.length === 0) continue;
    const into = one.heldInto[0]!;
    const noun = slotNoun.get(into);
    if (noun === undefined) continue;
    one.regions = one.regions.map((region) => ({ ...region, on: noun }));
    joined.push({ noun: population[at]!.name, into });
  }

  /* Gathered in the READING's own order, never in the order the provider
     happened to answer in: a panel that re-orders itself between two readings
     of one frame is the instability slice 1 was held on. */
  for (let at = 0; at < perName.length; at += 1) {
    const one = perName[at]!;
    if (one.declined) declined.push(one.name);
    if (one.broke) failed.push(one.name);
    for (const region of one.regions) regions.push(region);
    /*
      ASKED, AND NOTHING CAME BACK THAT COULD BE DRAWN — the third `why`, and
      the only one of the four worth asking about again.

      ⚠ **It is keyed on ROWS and not on `declined`**, which is the whole
      difference between this list and that one: a name the detector answered
      and the segmenter then failed on — no mask, no pixels, outside its own
      rectangle — is `declined: false, broke: false` and has no row either.
      Keying on the refusal would have silently dropped exactly the specimen
      this module's header is written about (the three-eyed cast's discarded
      cut), which is the direction that hides work.

      ⚠ **AND A NAME WHOSE CALL DROPPED IS `dropped`, NOT `uncut` (#2805).**
      `broke` already says a call on this name did not complete — the detect
      threw, or every cut of its rectangles did — and in that case nothing was
      learned about the thing: it is not an absence, and it is not "asked and
      nothing usable came back" either. It was written as `uncut` until this
      card, so the kept reading asserted an ask that never happened and the
      distinction survived only in `failedNouns` on a log line with about
      thirty-six hours of retention.

      ⚠ **`broke` WINS OVER `declined` WHERE A NAME IS BOTH, and that pair is
      reachable rather than theoretical**: a detect that answers nothing on the
      whole frame sends the name to the host-crop ask, and a crop that offers
      rectangles whose every cut then throws leaves `declined` AND `broke` both
      true. The detector found something there; it is the cut that was lost, so
      the honest word is the one that says a call is missing.
    */
    /* A name whose cut was a catalogue row's own cut IS drawn — as that row —
       so it is not a name nothing could draw (#2789). */
    if (one.regions.length > 0 || one.held) continue;
    const feature = population[at]!;
    named.push({
      noun: feature.name,
      on: feature.on,
      about: feature.about,
      kind: feature.kind,
      why: one.broke ? "dropped" : "uncut",
    });
  }

  /*
    ONE ROW PER PLACE, decided after every cut is in hand (#2752). Each name's
    own rows were gathered above exactly as before — which is what keeps the
    `uncut` record honest: a name whose cut turned out to be another noun's
    place WAS drawn, so it is not "named and not cut", and it is logged below
    under the place it joined rather than written into `named`.
  */
  const settled = settleByPlace(regions);

  /*
    ⚠ `found` IS ROWS, NOT CALLS, AND THE DIFFERENCE IS THE COST (the relay's
    note on PR #2692, #2566).

    A cut that came back with no mask, with no pixels in it, or sitting outside
    the rectangle it was asked about is a call BOUGHT and a gate slot SPENT
    with no row to show for it — so `found` systematically understates what a
    reading cost, in the one direction that hides it. The header's own
    three-eyed-cast specimen is exactly that: a rectangle answered, a normal
    eye cut, the row discarded.

    **The number of calls is the call census's, not this line's** — one
    instrument, which is why there is no counter here (working law 4). They are
    `POINTER_DETECT_ABOUT` and `POINTER_BOX_ABOUT` in the census's `byAbout`,
    kept apart because a `detect` is one per name and a box call is up to
    `count` of them; `wallMs` beside them is the reading's wall time. The
    scan logs the whole table on every reading (`[faceScanService] scanned a
    face-version`).
  */
  log.info(
    {
      asked,
      found: settled.regions.length,
      declined: declined.length,
      failed: failed.length,
      /* The noun and the share of the frame each row covers, so the flip can be
         judged at the frames rather than at a count — the loose-cut question the
         header declares is open is exactly what this line is for. */
      rows: settled.regions.map((region) => ({
        noun: region.noun,
        instance: region.instance,
        kind: region.kind,
        on: region.on === "" ? null : region.on,
        area: Number(
          ((region.box.width * region.box.height) / (frame.width * frame.height)).toFixed(4),
        ),
      })),
      /*
        WHAT THE GATE DECIDED, so a reading can be judged without re-driving it.

        `named` counted by its reason is the one number that says whether the
        gate is doing anything on real casts — on the design's three fixtures it
        is 4 across 29 names, and a cast where it is suddenly most of them is a
        finding about the READING rather than about this module.
      */
      /*
        ⚠ **`dropped` IS A FOURTH COUNTER HERE AND IS NOT `failed` RESTATED
        (#2805).** `failed` above counts every name a call dropped ON; this
        counts the names that therefore have no row at all. A detect that
        answered, one rectangle cut and a second that threw is `failed: 1` with
        a row to show, so the two numbers differ on purpose and neither is a
        mirror of the other (working law 4). Without this line the fourth `why`
        would simply leave `gated`'s counts short of `named`.
      */
      gated: {
        scattered: named.filter((one) => one.why === "scattered").length,
        makeup: named.filter((one) => one.why === "makeup").length,
        uncut: named.filter((one) => one.why === "uncut").length,
        dropped: named.filter((one) => one.why === "dropped").length,
      },
      /*
        ⚠ AND BY NOUN, BECAUSE A COUNT COULD NOT ANSWER HIS FIFTH FINDING (#2752).

        His neck tattoo got no row, and the first question about that is WHICH
        road lost it: the reading called it scattered, the detector found
        nothing, a call failed, or the reading never named it at all. Read off
        this line until now, all four were a number. The nouns are the
        reading's own bare nouns — the same ones `rows` above already carries —
        and never the `about` prose, which stays out of every log.
      */
      /* ⚠ **No `dropped` list here on purpose (#2805)**: `failedNouns` below is
         already every noun a call dropped on, and the ones with no row are the
         ones absent from `rows` above. A third list of the same nouns is the
         mirror working law 4 is about. */
      wordsOnly: {
        scattered: named.filter((one) => one.why === "scattered").map((one) => one.noun),
        uncut: named.filter((one) => one.why === "uncut").map((one) => one.noun),
      },
      declinedNouns: declined,
      failedNouns: failed,
      /* Placed only when asked in the accessory table's word (#2781) — both
         words are nouns, the reading's and the product's. */
      askedAs,
      /* ...and those whose box was not where that kind is worn (#2789). */
      refusedAs,
      /* Found cuts that were a catalogue row's own cut, by noun and slot (#2789). */
      intoCatalogue,
      /* Cuts nearer another place than the reading's own `on`, and the names
         on that place that took them (#2796). */
      strayed,
      handedOver,
      askedOnHost,
      /* Cuts nearer another thing the reading FOUND than the one they are worn
         on, and how many were held back for the barrier to judge (#2798). The
         two are reported together because a `heldBack` that never produces a
         row or a refusal is the barrier failing to release, which is the one
         way this road could cost a reading its rows. */
      strayedOnFound,
      heldBack,
      /* Body parts partly drawn by a catalogue row, whose other cuts now sit on
         that row (#2801). */
      joined,
      /* Body-part cuts that were pictures of other places, so got no row (#2801). */
      notThere,
      /* Body-part cuts that were a whole un-drawn place — the face — so got no row (#2810). */
      wholePlace,
      /* Boxes beyond the reading's own count that were cut, and whether each
         became a row (#2838 road 2) — the rate road 2 rests on, from the first
         reading rather than from an argument about it. */
      beyondTheCount,
      /* What the place rules decided, so a merged or moved row can be traced to
         the pixels that decided it rather than looking like a lost one. */
      samePlace: settled.samePlace,
      onGarment: settled.onGarment,
    },
    "pointer road",
  );
  return { regions: settled.regions, asked, declined, failed, named };
}
