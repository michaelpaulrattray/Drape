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
 * **at most `count` boxes, in the order the detector returned them**, where
 * `count` is what the discovery read said it could see. On a count of one that
 * is exactly the arm that won 7 of 10. On a count of two it is the design's
 * *several rows*, one cut each, never a union (#2565 §6: left and right are
 * separate items). And on the cast that defeated the old shape it is the cap
 * doing its job: `third eye` counted ONE, so the two extra rectangles the
 * detector found round the ordinary eyes are never asked about.
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
 * Two refusals, and neither is a threshold somebody picked:
 *
 *   **a mask with no pixels** — there is nothing to draw and nothing to point
 *   at, so there is no row;
 *   **a mask that does not overlap the rectangle that asked for it** — the
 *   segmenter answered about something else. A yes/no about two rectangles,
 *   with no tolerance to tune.
 *
 * ⚠ **WHOLENESS AND LOOSENESS ARE NOT JUDGED HERE, AND THAT IS DECLARED RATHER
 * THAN OVERLOOKED.** #2532's own open list ends *"the loose-region case is still
 * unsolved"* — a shoulder wrap the detector declines, a forehead the detector
 * returns with the eyes inside it — and the bar that handles it is **#2565 §4's**
 * (*"a cut with holes or broken edges is not used"*, with the clean-up that
 * closes gaps and feathers outside only). That card's slice 2 is unbuilt at the
 * time of writing, so this road has no clean-and-refuse pipeline to call and
 * does not invent one: an area threshold here would be a number nobody
 * measured, standing in for a bar he has already approved the shape of. What
 * guards it meanwhile is that the flag is dark and the flip is **his eye on real
 * panels** (the design's §8 step 4), and that every cut logs its noun and its
 * area so the frames can be read rather than guessed at.
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
import { catalogueSlots } from "./referenceSlotCatalogue";
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
   * enter the one Outfit row, and `on` is what folds a lip ring under Lips.
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
   * WHY there is no row, because the three answers are not interchangeable:
   *
   * `scattered` — it has no outline to cut (freckles, stubble, stitching), so
   *     the detector was never asked. Its words belong to the thing it sits on.
   * `makeup` — his ruling: makeup is a refine subject, not a feature of the
   *     cast. No row, no cut, and it is never retried.
   * `uncut` — the detector was asked and produced nothing usable, so this one
   *     is the only kind that is worth asking about again.
   */
  why: "scattered" | "makeup" | "uncut";
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
  for (const definition of catalogueSlots()) {
    for (const word of [
      definition.question,
      definition.display,
      definition.noun,
      definition.pairNoun,
      definition.feature,
    ]) {
      if (typeof word !== "string" || word.trim() === "") continue;
      words.add(normalisedName(word));
    }
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
function sharedPixels(a: DiscoveredRegion, b: DiscoveredRegion): number {
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
  return sharedPixels(a.region, b.region) * 2 > Math.max(a.pixels, b.pixels);
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
  let asked = 0;

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

  const perName = await Promise.all(population.map(async (feature) => {
    const mine: DiscoveredRegion[] = [];
    let boxes: readonly PointerBox[];
    try {
      boxes = await pointer.call(input.reader, {
        image: input.frame.bytes,
        name: feature.name,
        imageUrl: input.frame.url,
      });
    } catch (error) {
      /* A transport failure is NOT an absence — see `RegionReader.pointer`. It
         costs this one row and nothing else. */
      log.warn(
        { name: feature.name, why: error instanceof Error ? error.message : String(error) },
        "the detector could not be asked about this one — no row for it",
      );
      return { name: feature.name, regions: mine, declined: false, broke: true };
    }
    if (boxes.length === 0) {
      /* The reading named it and the detector cannot find it. No row, by his
         ruling, and it is recorded rather than silently dropped: the words
         still reach the current description (#2565 §2) and the next edit to
         that area asks again. */
      return { name: feature.name, regions: mine, declined: true, broke: false };
    }

    /* THE CAP — the module header carries the measurement it comes from. */
    const asking = boxes.slice(0, Math.max(1, feature.count));
    let broke = false;
    const cut = await Promise.all(asking.map(async (box, index) => {
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
    }));
    for (const one of cut.sort((a, b) => a.index - b.index)) {
      if (one.broke) broke = true;
      if (one.region === null) continue;
      mine.push(one.region);
      draw(one.region);
    }
    return { name: feature.name, regions: mine, declined: false, broke };
  }));

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
      the only one of the three worth asking about again.

      ⚠ **It is keyed on ROWS and not on `declined`**, which is the whole
      difference between this list and that one: a name the detector answered
      and the segmenter then failed on — no mask, no pixels, outside its own
      rectangle — is `declined: false, broke: false` and has no row either.
      Keying on the refusal would have silently dropped exactly the specimen
      this module's header is written about (the three-eyed cast's discarded
      cut), which is the direction that hides work.
    */
    if (one.regions.length > 0) continue;
    const feature = population[at]!;
    named.push({
      noun: feature.name,
      on: feature.on,
      about: feature.about,
      kind: feature.kind,
      why: "uncut",
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
      gated: {
        scattered: named.filter((one) => one.why === "scattered").length,
        makeup: named.filter((one) => one.why === "makeup").length,
        uncut: named.filter((one) => one.why === "uncut").length,
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
      wordsOnly: {
        scattered: named.filter((one) => one.why === "scattered").map((one) => one.noun),
        uncut: named.filter((one) => one.why === "uncut").map((one) => one.noun),
      },
      declinedNouns: declined,
      failedNouns: failed,
      /* What the place rules decided, so a merged or moved row can be traced to
         the pixels that decided it rather than looking like a lost one. */
      samePlace: settled.samePlace,
      onGarment: settled.onGarment,
    },
    "pointer road",
  );
  return { regions: settled.regions, asked, declined, failed, named };
}
