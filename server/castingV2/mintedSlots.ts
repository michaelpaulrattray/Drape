/**
 * WHICH SLOTS THIS RENDER FILES, AND WHAT IT SAYS ABOUT THEM.
 *
 * The mint takes a list of slots with their words (`referenceMint.ts`); the
 * catalogue says what each slot IS (`referenceSlotCatalogue.ts`). This is the
 * step between them: it turns *what this render earned* into *what the library
 * is being told*, and it is a pure function of the render's own record so the
 * rules below can be driven without a database, a frame, or a vision call.
 *
 * # Only what this render EARNED, and it is the same list the segments use
 *
 * The caller hands in the facets that were written by this ask, verified on
 * their own reading, and not carried — `earned` in `refineService`, already
 * derived once for segment permanence. Reusing that list rather than deriving a
 * second one is working law 4: two answers to *what did this render deliver*
 * drift, and the drift is invisible because both are plausible.
 *
 * A slot whose words did not change this render is not filed at all. Its newest
 * live row along this branch's ancestry already holds them, and writing an
 * identical row every render would turn a version history into a heartbeat.
 *
 * # And one list beside it: what this render wrote and its own reader DISPUTED
 *
 * Those slots come out marked (`disputed`), and the mint treats a marked slot
 * completely differently — never stored, never filed as words, kept only as
 * pixels a human can look at to decide whether the painter or the reader was
 * wrong (fable-220 §3, `referenceMint`). This module's only job in that is to
 * name the slots and to settle the collision: **a slot reached by both lists is
 * earned.**
 *
 * # The words are the CAPTIONS, and a slot's stack is its facets' captions
 *
 * `capturedCaptions` is the read-back of the render that actually landed, keyed
 * by facet, carried forward from the ancestry for everything this ask did not
 * touch. So the stack for `hair` is what this face's hair currently IS across
 * all five hair facets, not just the one the user typed about — which is what
 * makes it a declarative stack rather than an edit log.
 *
 * A facet with no caption contributes nothing. That is honest: a read-back that
 * failed soft leaves no sentence, and inventing one from the recipe's own ask
 * would file what we asked for as though it were what we got.
 *
 * # A slot with no words at all is not filed
 *
 * The row would say nothing and carry nothing — a version bump asserting that a
 * feature exists, which the catalogue already says for free. The refusal matters
 * because it is the difference between a library that grows when a face changes
 * and one that grows when a request happens.
 */
import {
  FACET_SLOTS,
  facetsOfSlot,
  narrowToScope,
  slotsForFacet,
  slotSpecFor,
  slotsRemintedEveryRender,
  type SlotDefinition,
} from "./referenceSlotCatalogue";
import type { FeatureSlot } from "./recipeAssembler";
import { INSTANCES, openSideSlotKey, openSlotKey } from "./referenceSlots";
import { captionWording, type RealizationCaptions } from "./realizationCaption";
import type { SlotSpec } from "./referenceMint";
import type { Facet } from "./refineFacets";
import { cropMayCarry, type KindLocality } from "../../shared/kindLocality";

export type MintedSlotsInput = {
  /** The facets this render wrote, verified and did not carry. */
  earned: readonly Facet[];
  /**
   * The facets this render WROTE and its own reader then DISPUTED (fable-220 §3).
   *
   * `read && !verified && written && !carried` — the reader looked at the
   * delivered frame and said the change is not there. The render was delivered
   * and charged (D-187/D-246, untouched); what these slots come here for is
   * their PIXELS, because whether the painter failed or the reader did is a
   * question no instrument in this system can answer and a crop settles at a
   * glance.
   *
   * They are marked, never merged: the mint stores none of them and files words
   * for none of them. A slot that is both earned and disputed — `hair.cut`
   * verified, `hair.colour` disputed, one `hair` slot — is EARNED, because the
   * render did deliver something into it and the crop is certifiable.
   */
  disputed?: readonly Facet[];
  /**
   * The landed render's read-back, by facet — carried facets included.
   *
   * A caption is prose read off the frame OR a pin chosen from a vocabulary, and
   * `captionWording` is the one function that turns either into its sentence.
   * Reading `.wording` here would be a second answer to *what does this caption
   * say*, and the pinned kind would arrive in the library as `[object Object]`.
   */
  captions: RealizationCaptions;
  /**
   * What the instruction said the worn object IS, through the shared table's
   * longest-match rule (`accessoryKindOf`).
   *
   * Derived once by the caller and passed, never re-derived here: the harvest,
   * the segment cutter and this all have to name the same kind of object, and
   * three derivations of one string is how they come to disagree about whether
   * an ask was about ears or eyes.
   */
  accessoryKind?: string | null;
  /**
   * THE SLOTS THE LIBRARY ALREADY KEEPS SOMETHING FOR, on this branch.
   *
   * Only a slot re-cut every render consults it, and for that slot it is the
   * only honest answer to *has she paid for this?* — because the obvious proxy
   * is broken. **A body edit produces no caption at all**, measured on the live
   * pipeline (dev #365, shift 77): the render verifier passed the narrowing,
   * `buildSpan` read it at −10.8%, and the caption reader looked at the same
   * delivered frame and refused to write a sentence — *"no visible slimming
   * edit"* — for both facets the ask wrote. So "this slot has words" is a gate
   * that can never open for `build`, and it was the gate the whole feature
   * stood behind.
   *
   * Absent, a re-mint slot is filed only on the render that earns it, which is
   * every caller that has no library to consult.
   */
  held?: ReadonlySet<string>;
  /**
   * SLOTS THE BRANCH HAS A ROW FOR AND NO PIXELS — awaiting the carrier they
   * never got (fable-468 §2, ruling b).
   *
   * `supersededCarrySlots` is the same reader the repaint uses to decide which
   * features it must say in WORDS because their crop is missing; here it is the
   * list of slots that would take a crop if this render can prove one.
   */
  awaitingCarrier?: ReadonlySet<string>;
  /**
   * FACETS THIS RENDER DID NOT ASK FOR AND ITS OWN READER CONFIRMED.
   *
   * The other half of ruling (b): a later render looking at the delivered frame
   * and saying the build IS slim is the confirmation the disputed render never
   * got. Separate from `earned` — which is written ∩ verified ∩ not-carried —
   * because these facets were not written by this ask at all.
   */
  confirmed?: readonly Facet[];
  /**
   * THE ONE INSTANCE THE ASK WAS ABOUT — and it is where ruling C is kept.
   *
   * fable-444 chose the reference over the axis: the delta goes on saying
   * "green eyes" because that is what she typed, and *the library* is what
   * remembers that only one of them is green. That makes this call the place
   * the whole ruling is load-bearing, because the library's rows are minted
   * here.
   *
   * Without it, a scoped render PAINTS one eye and FILES both: `earned` carries
   * the facet, the facet fans out to both instances, and `eye@right` gets a row
   * asserting a delivery its own render never made — read from its own crop, so
   * plausible, and carried into every later recipe as a fact she paid for. That
   * is the fan-out this program has been paying for in other coats, arriving at
   * the one door the ruling put the memory behind.
   *
   * Undefined is a whole-face ask. **The panel DOES send one** — `FacePanel`
   * on a tapped row, `FaceRegions` on a clicked rectangle — and production
   * renders carry it: v#198 and v#199 on candidate 1625 both record
   * `askScope: "eye@left"`. This line was written when nothing sent one and
   * said so, and it went on saying so for two shifts after that stopped being
   * true; the sentence then read as an argument that the narrowing could not
   * matter, which is how the un-narrowed loop below survived a review.
   */
  scope?: FeatureSlot;
  /**
   * THE OPEN KINDS THIS ASK WROTE — the slots that walk through the mint's
   * open-kind door (5b, `OPEN_LANE_DESIGN_NOTE` §9.5 step 5b).
   *
   * The door has existed since step 3 and nothing has ever walked through it,
   * because every input to this function is a `Facet` and an open kind has none.
   * This is the producer.
   *
   * **THE ASK'S OWN DELTA, NEVER THE COMPOSED RECIPE.** A composed recipe carries
   * every open kind this face has ever been given, so composing the list from it
   * would re-file — and re-cut, and re-buy a vision read for — a kind three edits
   * old on every later render. The same rule the facet passes obey through
   * `earned`.
   */
  open?: readonly OpenKindToFile[];
};

/**
 * One open kind, as this ask wrote it, with the one property that decides
 * whether it may carry pixels.
 */
export type OpenKindToFile = {
  /** The normalizer's key — a single lowercase token (`fangs`, `cat-ears`). */
  kind: string;
  /** The customer's own words for it. The only words an open kind ever has. */
  words: string;
  /**
   * P1, from the kind-property store — **or `null`, which is not a locality**.
   *
   * `null` is nobody having answered: no row, no engine, a reader that declined.
   * It refuses the crop exactly as `distributed` does, because a gate treating
   * unknown as croppable files one wing under the name of two — but it files a
   * different reason, because only one of the two is a finding worth chasing.
   */
  locality: KindLocality | null;
};

export type MintedSlotsResult = {
  slots: SlotSpec[];
  /**
   * Facets that earned something and had nowhere to put it, with the reason.
   *
   * Returned rather than swallowed: a facet the library cannot file is a feature
   * the panel will never show, and an unowned axis falls silently to the loudest
   * prior on every tile at once. The caller logs these.
   */
  unfiled: Array<{ facet: Facet; reason: UnfiledReason }>;
  /**
   * OPEN KINDS THIS ASK WROTE THAT FILED NOTHING, with the reason.
   *
   * Its own field rather than an entry in {@link MintedSlotsResult.unfiled},
   * because that one is keyed by `Facet` and an open kind has none — and a union
   * there would make every existing reader ask which shape it is holding. Two
   * different things, two names.
   */
  unfiledOpen: Array<{ kind: string; reason: UnfiledReason }>;
};

/**
 * Why a facet that earned something filed nothing.
 *
 * `notASlot` is a DECIDED absence — makeup rides the anatomy it is worn on, an
 * expression is presentation rather than identity. `unnamedObject` is a thing
 * she is visibly wearing that the placement table cannot name, and it is the
 * only one of these that is owed work. `uncataloguedFeature` should be
 * unreachable (the totality test pins every facet's feature to an entry) and
 * exists so that a catalogue edit which breaks it is diagnosable rather than
 * quietly wearing another reason's label. `noWords` is a read-back that failed
 * soft, which costs later precision and nothing today.
 */
/*
  `openKind` — RESERVED FOR THE DEFECT, now that the open lane has a producer
  (5b, 2026-08-17).

  It landed as declared scaffolding with the note that *"the day the assembler
  files an open ask, reaching for `notASlot` is a visibly wrong choice rather
  than the only one available."* That day is this one, and the label's meaning
  narrowed rather than widened: the two ordinary outcomes for an open kind that
  files nothing have their own words below, and this one is left for the case
  that should be unreachable — the catalogue declining to synthesize a definition
  for a key the normalizer minted (`slotSpecFor` returning null).

  Kept rather than deleted, and reported rather than skipped, for the reason
  `uncataloguedFeature` is: a key that reached here and cannot be filed is a
  disagreement between the normalizer's grammar and the catalogue's, and it must
  arrive as a named finding in the log rather than as an ask that quietly filed
  nothing.

  An open kind is still a FOURTH situation and must never wear `notASlot`'s
  label. `notASlot` means "this rides somewhere else, and here is where" — three
  decided absences with written reasons. Filed under the first, **the count of
  asks with nowhere to go is invisible at exactly the place it exists to be
  seen**, and that count is the promotion signal.
*/
/*
  `openKindLocalityUnread` — nobody has answered where this kind's instances sit
  (fable-872 §2, countersigned fable-896 §3; renamed with the locality class,
  fable-951; narrowed to one word by the D1 wire, fable-1001).

  No row, no engine, a reader that declined. It refuses the crop, because a gate
  treating unknown as croppable files one wing under the name of two. **And it is
  a finding**: a kind stuck here is a kind whose property read is failing, and
  every ask for it is silently getting the conservative path forever.

  # `openKindDistributed` LIVED HERE AND IS GONE, and the record says why

  It was the pair ruling honoured: a distributed kind carried no crop at all,
  because a whole-frame read of two things on opposite sides returns ONE instance
  — measured on the court's wings frame, where the mask the mint would have
  carried was the image-left wing to thirteen pixels. Half a picture wearing the
  whole picture's name is the earring history, and it did not get a second run in
  a new lane.

  **The founder wired the counting instrument instead** (fable-987 §1, "yes"),
  and a distributed kind now files ONE SLOT PER SIDE — the earring architecture,
  whose whole purpose is this exact geometry. So the refusal moved rather than
  disappeared: it lives at `referenceMint`, where the frame is, and it refuses
  every count but two with the count in the reason. Keeping the word here would
  be a reason nothing can produce, which reads to the next person as a rule still
  in force.

  **These words were `openKindPaired` and `openKindPairUnread` until the founder's
  fangs ruling, and that rename was not cosmetic either**: the gate used to refuse
  every kind whose noun meant more than one thing, which took fangs and whiskers
  down with wings. What it was always reaching for is whether ONE CROP CAN HOLD
  THE SET — `coLocated` kinds pass it, and `distributed` ones now answer it with
  two crops rather than none.
*/
/*
  `outsideScope` — a facet this render earned whose slots do not include the one
  she pointed at.

  It should be unreachable, and it is reported rather than skipped for the same
  reason `uncataloguedFeature` is: the render that produced it was refused
  upstream by `repaintAsksFor`, whose fan-out narrows through the same helper and
  returns `notASlot` when the narrowing empties. So reaching this means the ask
  list and the mint disagree about which slots a scoped render is about — which
  is exactly the drift the shared helper exists to prevent, and it must arrive as
  a named finding in the log rather than as a slot that quietly filed nothing.
*/
export type UnfiledReason =
  | "notASlot"
  | "unnamedObject"
  | "uncataloguedFeature"
  | "noWords"
  | "openKind"
  | "openKindLocalityUnread"
  | "outsideScope";

function unfiledReasonFor(facet: Facet): UnfiledReason {
  const assignment = FACET_SLOTS[facet];
  if ("notASlot" in assignment) return "notASlot";
  if ("family" in assignment) return "unnamedObject";
  return "uncataloguedFeature";
}

/**
 * The mint's slot list for one landed render.
 *
 * Slots come out in first-earned order and never twice: `hair.cut` and
 * `hair.colour` both land in `hair`, and the slot's stack already holds both
 * their captions, so a second entry would be the same words filed twice under
 * one key — two rows holding one fact at the door the mint checks digests at.
 */
export function mintedSlotsForRender(input: MintedSlotsInput): MintedSlotsResult {
  const slots: SlotSpec[] = [];
  const unfiled: MintedSlotsResult["unfiled"] = [];
  const unfiledOpen: MintedSlotsResult["unfiledOpen"] = [];
  const seen = new Set<string>();

  /**
   * The slot's stack as this render leaves it, or null when nothing has ever
   * been said about it. Null is the honest state and it is not an error: it is
   * a slot whose feature the master alone still accounts for.
   */
  const stackOf = (definition: SlotDefinition): readonly string[] | null => {
    const members = facetsOfSlot(definition.slot) ?? [];
    const words = members
      .map((member) => captionWording(input.captions[member]).trim())
      .filter((caption) => caption !== "");
    return words.length === 0 ? null : words;
  };

  /**
   * WHICH FACETS THE READER DISPUTED, for the slot they landed in.
   *
   * A slot's dispute is a boolean at the mint's door; a COURT is facet-narrow
   * (fable-429 §3 condition 3), and `build` holds five facets of which one
   * instrument measures three. So the names travel with the mark rather than
   * being re-derived downstream from the slot — a second derivation of "which
   * facets does this slot hold" would be free to disagree with this one, and
   * the disagreement would decide whether a ruler may speak.
   */
  const disputedSet = new Set<Facet>(input.disputed ?? []);
  const disputedFacetsOf = (definition: SlotDefinition): readonly Facet[] =>
    (facetsOfSlot(definition.slot) ?? []).filter((facet) => disputedSet.has(facet));

  const file = (definition: SlotDefinition, words: readonly string[], disputed: boolean) => {
    const spec = slotSpecFor(definition.slot, words);
    if (spec === null) return;
    seen.add(definition.slot);
    slots.push(disputed
      ? { ...spec, disputed: true, disputedFacets: disputedFacetsOf(definition) }
      : spec);
  };

  const collect = (facets: readonly Facet[], disputed: boolean) => {
    for (const facet of facets) {
      /* Narrowed through the catalogue's own helper, which is also what the
         recipe's ask list narrows through — one definition of *the fan-out, cut
         to the instance she pointed at*, so the render and its record cannot
         come to disagree about which side this was. */
      const catalogued = slotsForFacet(facet, { accessoryKind: input.accessoryKind });
      const definitions = narrowToScope(catalogued, input.scope);
      if (definitions.length === 0) {
        /* The reason comes from the ASSIGNMENT rather than from what the caller
           happened to pass, so a decided absence and an unnamed object never wear
           each other's label — and a facet the SCOPE excluded is a third thing
           again, which is why it is not allowed to borrow either of theirs. */
        unfiled.push({
          facet,
          reason: catalogued.length > 0 ? "outsideScope" : unfiledReasonFor(facet),
        });
        continue;
      }
      for (const definition of definitions) {
        if (seen.has(definition.slot)) continue;
        const words = stackOf(definition);
        /*
          A SLOT WHOSE CARRIER IS ITS CROP IS NOT GATED ON ITS WORDS.

          For anatomy generally, D-244 makes the words the carrier of record and
          the crop the assist, so a wordless row would be a version bump
          asserting a feature exists. `build` is the measured exception in both
          halves: words-only retained 0% of a delivered build across three faces
          and the crop retained 92–109%, and the caption reader will not write a
          sentence about a body edit at all. Gating the crop on the words is
          gating the carrier on the assist, and it kept the whole feature dark.

          The row is not wordless either, as it happens: the mint reads a slot's
          words off its own CUT, which for `build` is a photograph of her torso
          rather than the whole frame the caption reader was defeated by.
        */
        if (words === null && definition.remint !== "everyRender") {
          unfiled.push({ facet, reason: "noWords" });
          continue;
        }
        file(definition, words ?? [], disputed);
      }
    }
  };

  /*
    EARNED FIRST, AND `seen` IS WHAT MAKES THAT A RULE RATHER THAN AN ORDERING.

    Two facets of one slot can come back with different verdicts — the ask wrote
    both, the reader saw one land and not the other. The slot is then EARNED: a
    crop of it is a picture of a feature the render did change and the guard can
    certify, and marking it disputed would throw away a good reference over a
    disagreement about a neighbouring facet. Running `earned` to completion
    before `disputed` is looked at is the whole of that rule.
  */
  collect(input.earned, false);
  collect(input.disputed ?? [], true);

  /*
    AND THE SLOTS THAT ARE RE-CUT EVERY RENDER, whatever this one earned.

    `build`'s crop is a photograph of her torso IN WHATEVER SHE IS WEARING, so a
    crop kept across somebody else's clothing edit is a picture of last week's
    top labelled "the exact build she has, unchanged" (fable-424 §4). Re-cutting
    from the frame in hand is law 4 — a crop re-cut cannot be stale, where a
    persisted one is a copy drifting from its source.

    LAST, and `seen` is what makes that a rule rather than an ordering: a render
    that DID earn this slot has already filed it above, with its own verdict, and
    a disputed build must stay disputed. This pass only reaches a slot no facet
    of this render mentioned.

    AND THE DISCRIMINATOR IS THE LIBRARY, never the words.

    A face nobody has body-edited is skipped in SILENCE, and rightly: the
    pristine master every render anchors on already carries her build, so there
    is nothing to preserve and nothing to report. But *"has anything been said
    about her build"* is the wrong way to ask that, because nothing ever is —
    the measurement is at {@link MintedSlotsInput.held}. So the question put
    here is *"does the library already keep something for this slot"*, which is
    true from the moment a render earns it and false before it.

    Skipped in silence rather than reported unfiled either way: this is not a
    facet that earned something and had nowhere to go.
  */
  for (const definition of slotsRemintedEveryRender()) {
    if (seen.has(definition.slot)) continue;
    if (!input.held?.has(definition.slot)) continue;
    file(definition, stackOf(definition) ?? [], false);
  }

  /*
    AND THE CARRIER A SLOT NEVER GOT, MINTED ON THE RENDER THAT CONFIRMS IT
    (fable-468 §2, ruling b).

    The specimen is the founder's candidate 1604. v#184 asked for a slim build
    and delivered one — his own eye, at full size, and the ruler at −10.9% —
    while the caption reader called it absent, so the door refused the crop as
    `disputedDelivery` and the row was filed with no pixels. Two renders later
    v#186 read the same body and said *"slender arms and torso visible,
    consistent with a slim build"*. The branch now held a confirmation of a
    delivery whose carrier had never been minted, and nothing looked.

    So a slot the branch is still waiting on gets ONE more chance on every
    later render whose own reader confirms one of its facets. It is not the
    re-mint pass above: that one asks whether the library HOLDS something, and
    the whole point here is that it holds nothing but a refusal.

    The confirmation must come from this render's own reading of this render's
    frame — a fact about the picture in hand, not a re-reading of the dispute.
  */
  /*
    AND IT NARROWS TO THE SCOPE, through the SAME helper `collect` uses.

    This loop was written after the scope narrowing and reached the catalogue
    directly, so a per-eye render narrowed correctly in the earned pass and then
    filed the other eye here. Production v#199 on candidate 1625 is the
    specimen: `askScope` eye@left, the ask wrote `eye.shape`, the carried
    `eye.colour` was confirmed, `eye@right` was awaiting a carrier — and both
    eye rows were filed carrying one whole-face sentence, onto a face whose
    right eye is fiery red. The assembler then told her next render to keep that
    eye "pale grey with a vertical slit pupil".

    One definition of *the fan-out, cut to the instance she pointed at*, and
    every pass that files a row goes through it — which is the only version of
    this rule that a fourth pass cannot be written beside.
  */
  for (const facet of input.confirmed ?? []) {
    const catalogued = slotsForFacet(facet, { accessoryKind: input.accessoryKind ?? null });
    for (const definition of narrowToScope(catalogued, input.scope)) {
      if (seen.has(definition.slot)) continue;
      if (!input.awaitingCarrier?.has(definition.slot)) continue;
      file(definition, stackOf(definition) ?? [], false);
    }
  }

  /*
    AND THE OPEN KINDS THIS ASK WROTE — step 5b, the producer the mint's own
    open-kind door has been waiting for since step 3.

    LAST, and it needs no `seen` ordering argument to be there: an open key
    carries a prefix the closed `feature@instance` grammar cannot produce, so it
    can never collide with a slot the passes above filed. `seen` is still
    consulted, because the same kind arriving twice in one list would file the
    same words twice under one key — the duplicate this whole function's ordering
    rule exists to prevent.

    THE GATES ARE IN THIS ORDER ON PURPOSE: structure first, policy second.

    A key the catalogue cannot define, or an ask with no words, is a DEFECT — the
    normalizer's grammar and the catalogue's disagreeing, or a stored ask that
    should not exist (`readOpenKinds` refuses empty words on the way in). Judged
    after the pair ruling, such an ask would be counted as *"words-only, because
    it is a pair"*, which is a true sentence about the wrong thing: it would
    inflate the one number the promotion decision reads and hide a bug behind a
    policy. So the count of `openKindLocalityUnread` is a count over WELL-FORMED
    asks, which is what makes it worth reading.

    AND A SCOPE DOES NOT NARROW AN OPEN KIND, declared rather than omitted. A
    scope names one INSTANCE of a catalogued feature; `openSlotDefinition` sets
    `instance: null` because an open kind has none, so there is nothing for a
    scope to select or exclude. The render painted what the recipe said, and the
    recipe said this kind.
  */
  for (const ask of input.open ?? []) {
    const slot = openSlotKey(ask.kind);
    if (seen.has(slot)) continue;
    const words = ask.words.trim();
    if (words === "") {
      unfiledOpen.push({ kind: ask.kind, reason: "noWords" });
      continue;
    }
    const spec = slotSpecFor(slot, [words]);
    if (spec === null) {
      /* Should be unreachable: `readOpenKinds` and `normalizeOpenKind` mint only
         keys `openSlotDefinition` can define. Reported rather than skipped, for
         the reason `uncataloguedFeature` is — it is a disagreement between two
         grammars and it must arrive as a finding. */
      unfiledOpen.push({ kind: ask.kind, reason: "openKind" });
      continue;
    }
    if (ask.locality === null) {
      unfiledOpen.push({ kind: ask.kind, reason: "openKindLocalityUnread" });
      continue;
    }
    /*
      THE ONE DERIVATION THAT READS THE LOCALITY, and it lives beside the
      vocabulary rather than here: `cropMayCarry` answers whether ONE crop can
      hold the whole kind, and `distributed` is its only no — a no about
      GEOMETRY, since one rectangle cannot hold two things on opposite sides.

      That no used to end the ask, filed as `openKindDistributed` and carried by
      words alone. It no longer does (founder verdict fable-987 §1, shape ruled
      fable-1001): a distributed kind files the EARRING ARCHITECTURE instead —
      one slot per side, each a picture of exactly what its name says — and the
      count that proves there are two of them is bought at the mint, on the frame
      the crop would be cut from, because that is the only place the question can
      be asked of the actual delivery.

      Nothing here decides the count. This door only says WHERE the pixels would
      be filed if they exist; `referenceMint` refuses every reading but two, with
      the count in the reason, and both rows fall back to their words.
    */
    if (!cropMayCarry(ask.locality)) {
      for (const side of INSTANCES) {
        const sideSlot = openSideSlotKey(ask.kind, side);
        if (seen.has(sideSlot)) continue;
        const sideSpec = slotSpecFor(sideSlot, [words]);
        if (sideSpec === null) {
          /* The same should-be-unreachable disagreement the sideless branch
             above reports: a key `openSlotDefinition` can define without a side
             it cannot define with one is the two grammars drifting. */
          unfiledOpen.push({ kind: ask.kind, reason: "openKind" });
          continue;
        }
        seen.add(sideSlot);
        slots.push(sideSpec);
      }
      continue;
    }
    seen.add(slot);
    slots.push(spec);
  }

  return { slots, unfiled, unfiledOpen };
}
