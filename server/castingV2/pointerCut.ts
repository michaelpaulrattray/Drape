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
 * Three refusals, and the one threshold among them was measured rather than
 * picked:
 *
 *   **a mask with no pixels** — there is nothing to draw and nothing to point
 *   at, so there is no row;
 *   **a mask that does not overlap the rectangle that asked for it** — the
 *   segmenter answered about something else. A yes/no about two rectangles,
 *   with no tolerance to tune;
 *   **a mask that fills less than a fifth of that rectangle** — the "only the
 *   straps" answer, a coherent fragment of the thing returned silently in
 *   place of the thing. `cutQuality.ts` carries the measurement and the ⚠
 *   below carries what it replaced.
 *
 * ⚠ **BROKENNESS IS JUDGED HERE NOW, AND THE SENTENCE THAT SAID IT WAS NOT IS
 * STRUCK — 2026-10-29, #2565 slice 2.** ~~*"this road has no clean-and-refuse
 * pipeline to call and does not invent one: an area threshold here would be a
 * number nobody measured"*~~ — **the number is measured and this road is its
 * first caller.** `cutQuality.ts`'s `judgeCut` refuses a cut filling less than
 * a fifth of the rectangle it was asked about; correct cuts measured 42.3–73.5%
 * and the known-bad 8.3%, with 5.1× of room between them, and a correct nose
 * stud and hoop earring clear it comfortably (49.6% and 67.1%), which was the
 * falsification arm. The population and the two things §4's own sentence gets
 * wrong — holes run BACKWARDS as a signal, and want closing rather than
 * refusing — are in that module's header. **It is a third refusal of exactly
 * the kind the two above already are**: local to one name, no row, every other
 * row and the whole catalogue scan untouched.
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
 * logging every fill rather than only the refusals, and for the floor being
 * one exported constant.
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
import { judgeCut } from "./cutQuality";
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
  const cuts: CatalogueCut[] = [];
  for (const entry of scanPlan()) {
    for (const definition of entry.slots) {
      if (definition.panel.row !== "own" || definition.noRowOnDiscovery !== undefined) continue;
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
  let asked = 0;

  /* Asked once, the first time a cut needs it — see the input's own note. A
     scan that throws is a scan nothing can be compared with, which is `null`. */
  let catalogueRead: Promise<readonly CatalogueCut[] | null> | null = null;
  const catalogueCuts = (): Promise<readonly CatalogueCut[] | null> => {
    catalogueRead ??= (input.catalogue?.() ?? Promise.resolve(null)).catch(() => null);
    return catalogueRead;
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

  const perName = await Promise.all(population.map(async (feature) => {
    const mine: DiscoveredRegion[] = [];
    let boxes: readonly PointerBox[];
    /* The product's word, when it is what placed this name's boxes. */
    let product: string | null = null;
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
      return { name: feature.name, regions: mine, declined: false, broke: true, held: false };
    }
    if (boxes.length === 0) {
      /* The reading named it and the detector cannot find it. No row, by his
         ruling, and it is recorded rather than silently dropped: the words
         still reach the current description (#2565 §2) and the next edit to
         that area asks again. */
      return { name: feature.name, regions: mine, declined: true, broke: false, held: false };
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
        /*
          THE QUALITY BAR — #2565 §4's, measured, and this road's own declared
          gap now filled (see this module's header, where the sentence saying
          there was no pipeline to call is struck).

          A cut that fills less than a fifth of the rectangle it was asked
          about is the "only the straps" answer: the segmenter returning a
          coherent fragment of the thing, silently, with a plausible-looking
          mask. It gets no row, exactly as a cut with no pixels gets no row.

          ⚠ **The fill is logged on EVERY judgement, used or refused, and that
          is deliberate rather than noisy.** The floor is a FLOOR taken on one
          known-bad specimen, so the population it wants is the one this road
          produces in use; logging only refusals would grow a record of what
          the bar already catches and tell nobody where the correct cuts sit.
        */
        const verdict = judgeCut({ mask, box });
        if (!verdict.use) {
          log.warn(
            { name: feature.name, askedAbout: box, answered: bounds, fill: verdict.fill, why: verdict.why },
            "the cut did not fill enough of the rectangle it was asked about — no row",
          );
          return { index, region: null, broke: false };
        }
        log.debug(
          { name: feature.name, fill: verdict.fill, claimed: verdict.claimed },
          "the cut cleared the quality bar",
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
    }));
    const landed: DiscoveredRegion[] = [];
    for (const one of cut.sort((a, b) => a.index - b.index)) {
      if (one.broke) broke = true;
      if (one.region !== null) landed.push(one.region);
    }
    /* Drawn by the catalogue already: not drawn again, and not "uncut" either. */
    let held = false;
    if (landed.length > 0) {
      const cuts = await catalogueCuts();
      for (const region of landed) {
        /* A box from the product's word must be where that kind is worn. */
        if (product !== null && !onItsSite(region, product, cuts)) {
          log.warn(
            { name: feature.name, as: product, answered: region.box },
            "the product's word placed this somewhere that kind is not worn — no row",
          );
          refusedAs.push({ noun: feature.name, as: product });
          continue;
        }
        /* A cut on a catalogue row's own cut is that row (#2757's class). */
        const row = cuts === null ? null : catalogueRowOf(region, cuts);
        if (row !== null) {
          intoCatalogue.push({ noun: feature.name, into: row.slot });
          held = true;
          continue;
        }
        mine.push(region);
        draw(region);
      }
    }
    return { name: feature.name, regions: mine, declined: false, broke, held };
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
    /* A name whose cut was a catalogue row's own cut IS drawn — as that row —
       so it is not a name nothing could draw (#2789). */
    if (one.regions.length > 0 || one.held) continue;
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
      /* Placed only when asked in the accessory table's word (#2781) — both
         words are nouns, the reading's and the product's. */
      askedAs,
      /* ...and those whose box was not where that kind is worn (#2789). */
      refusedAs,
      /* Found cuts that were a catalogue row's own cut, by noun and slot (#2789). */
      intoCatalogue,
      /* What the place rules decided, so a merged or moved row can be traced to
         the pixels that decided it rather than looking like a lost one. */
      samePlace: settled.samePlace,
      onGarment: settled.onGarment,
    },
    "pointer road",
  );
  return { regions: settled.regions, asked, declined, failed, named };
}
