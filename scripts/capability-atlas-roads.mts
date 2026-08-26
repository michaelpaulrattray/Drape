/**
 * THE ROADS — how the casting studio works, as DATA the generator validates.
 *
 * Founder order (fable-1357, chat 2026-08-22): *"it needs to be easy for our
 * agent to look at it and fully understand how the entire casting system
 * works"* — and his addendum, *"double check your work against the codebase."*
 *
 * # How this file stays true
 *
 * A hand-written architecture narrative rots. So this file is DATA, and the
 * generator holds it to the source at every run:
 *
 *   - every door id here must exist in the DECLARED set (extracted from
 *     source); an unknown id is an error finding, not a typo that ships;
 *   - every flag here must exist in the declared flag set, same rule;
 *   - the RENDER joins each door to its extracted file:line sites, its pinning
 *     tests and the corpus rows that reach it — none of that is written here,
 *     all of it is derived, so the per-door facts cannot drift from the code.
 *
 * What IS hand-written is the connective prose (`summary`, `notes`) and the
 * grouping — reviewed like any prose, kept short, and never the only source
 * for a checkable fact. `doorsNote` exists for roads whose doors are not yet
 * in the census's declared set (other entrances): an honest "not yet mapped"
 * beats an invented list.
 *
 * # Reading order for an agent
 *
 * Road 1 is the life of a cast (roll → sheet → refine → sign). Roads 2–4 are
 * the refine entrance in depth — the money model, the walls and gates, and the
 * ink lanes. Roads 5–8 are the other entrances at survey depth with their
 * flags. The LAWS section at the end is the invariants that hold everywhere.
 */

export type Road = {
  id: string;
  title: string;
  /** The entrance's own file(s) — verified to exist at generate time. */
  entrances: string[];
  summary: string;
  /** Declared door ids this road can answer with — validated against source. */
  doors: string[];
  /** For roads whose doors are outside the censused entrance: the honest note. */
  doorsNote?: string;
  /** Scope flags gating this road — validated against the declared flag set. */
  flags: string[];
  notes: string[];
};

export const ROADS: readonly Road[] = [
  {
    id: "life-of-a-cast",
    title: "The life of a cast — roll, sheet, refine, sign",
    entrances: ["server/routes/castingV2.ts"],
    summary:
      "A BRIEF is compiled and a ROLL renders eight candidates onto a SHEET (each an independently refundable slice). "
      + "Opening a candidate gives the panel and REFINE: each paid edit renders a VARIANT anchored on the pristine master, "
      + "with prior edits carried by the composed chain (words + crops). SIGN freezes an identity: five views rendered from "
      + "the anchor, each checked against the signed face, delivered as the package. Deletion sweeps the cast and "
      + "everything minted under it (crops, designs, scans) unconditionally.",
    doors: [],
    doorsNote:
      "The roll and sign entrances are not yet driven by the census — their doors are not in the declared set this map "
      + "validates against. Their corpora are the map's next growth ring (fable-1357 §2).",
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "Anchor law: every refine renders from candidate.imageKey (the pristine master), never from a delivered frame — chaining on delivered frames was measured to drift.",
      "A roll is eight independently refundable units; a deploy landing mid-roll costs only the undelivered slices (accepted collision class, D-85).",
      "The path/wardrobeLine columns (migration 0051) make the born path a fact of the roll; NULL means cast before the paths existed.",
      "A brief the reader NEVER READ (the deadline fired, the transport or provider failed, no engine configured) is refused FREE before the claim as `reader_outage` at EVERY length (briefCompiler.ts; founder ruling #126 'refuse-free', Crew reply #7 2026-08-26, and 'always' on the length question, reply #9) - it replaced the H30 fallback that charged roll 219 for a sheet cast from the brief's first 80 characters. Only a reply the provider gave that the compiler could not parse still falls back; the roll entrance is outside this map's declared door set (doorsNote above), so this note is the entry until the roll corpus lands.",
    ],
  },
  {
    id: "refine-money",
    title: "Refine's money model — free before the claim, refunded after it",
    entrances: ["server/castingV2/refineService.ts"],
    summary:
      "Everything before the claim is FREE: ownership and state doors, the interpreter's walls and gates, and every "
      + "cannot-say answer. The claim charges 25 credits and dispatches; a failure after it refunds. The census drives "
      + "with the claim door shut, so 'would-render' means the ask passed every free door and reached the money.",
    doors: [
      "candidate_missing", "already_signed", "busy", "refine_limit", "master_missing", "version_missing",
      "history_unreadable", "history_predates_undo", "step_moved", "kind_unserved",
    ],
    flags: ["CASTING_V2_SCOPE", "CASTING_REPAINT_SCOPE", "CASTING_REFINE_DISPATCH_SCOPE"],
    notes: [
      "`busy` is the admit door (a real TOO_MANY_REQUESTS, invariant 6); reaching it in the census reads as would-render.",
      "`refine_limit` is the 24-instruction ceiling — removals are still allowed there; only growth is blocked.",
      "Charge-then-refund where the answer was knowable pre-claim is a defect class this program has closed twice (the mid-chain prune, the dangling-crop transform); the census's ledger arm guards the whole table.",
    ],
  },
  {
    id: "refine-reading",
    title: "Refine's reading — the interpreter, its walls, and its gates",
    entrances: ["server/castingV2/refineInterpreter.ts", "server/castingV2/refineDelta.ts"],
    summary:
      "The customer's sentence is read by a text model whose OUTPUT is policed by code: values must appear in the "
      + "customer's own words (source containment), facets resolve against the subject cards, and refusals carry their "
      + "own names. Walls refuse the ASK's kind; gates refuse an ask the road cannot serve YET and say what would work. "
      + "An unreadable or empty sentence refuses free — the product never guesses.",
    doors: [
      "empty", "unreadable", "wall_likeness", "wall_content", "wall_stage", "wall_unbacked", "wall_unfileable",
      "gate_ink_document", "gate_ink_uncarried", "gate_ink_unkeepable",
      "gate_ink_coverage_unread", "scope_unknown", "scope_mismatch",
    ],
    flags: ["CASTING_OPEN_LANE_SCOPE", "CASTING_SIDE_PHRASING_SCOPE", "CASTING_INK_WORDS_SCOPE"],
    notes: [
      "wall_stage = PROVABLY the shoot (the lexicon backed the claim); wall_unbacked = the model claimed out-of-scope and the lexicon could not confirm — one wall was two walls wearing one name until census card C1.",
      "gate_ink_document asks 'is there a document for this design'; its answers are the anchor itself, a pointed-at photograph, the delivered crop, and (words road) the delivery about to be minted.",
      "gate_ink_uncarried is a place the product can SEE and cannot KEEP (a covered chest): render would land, the mint could not crop, the tattoo would die on the next edit — his own find-and-crop condition enforced.",
      "item 7a split that gate three ways, because its two reasons only COINCIDED while the product had one outfit: gate_ink_uncarried = a garment is over it; gate_ink_unkeepable = the surface is bare and the road still cannot crop a result there (a shirtless Basics chest); gate_ink_coverage_unread = nobody has read this outfit's coverage, which fails closed and says so in its OWN words rather than borrowing the covering's.",
      "A tapped rectangle (scope) outranks the words and the memory — the tap is the customer's freshest act; a scope naming nothing the instruction writes refuses free (scope_mismatch).",
    ],
  },
  {
    id: "refine-ink",
    title: "The ink lanes — add, transform, remove, and the crop that carries",
    entrances: ["server/castingV2/inkPriorAsk.ts", "server/castingV2/inkDeliveryMint.ts", "server/castingV2/refineService.ts"],
    summary:
      "A delivered tattoo is remembered as a CROP row cut from the delivered frame by the placement's own reader word; "
      + "that crop rides every later render as instruction material (upscaled to the legibility floor when small). "
      + "Transforms ride the crop as the source; removals prune the step and recompose (navigate free when the survivor "
      + "already exists, re-render when it does not); the record's names are believed only where a ROW backs them.",
    doors: [
      "noInkToChange", "inkOneChangeAtATime", "whichInkToChange", "inkNotKept", "inkBeyondToday", "unplacedInk",
      "removal_absent", "removal_unnamed", "removal_not_in_brief", "removal_uncheckable", "removal_reread_unmatched",
      "removal_unnameable", "already_original",
    ],
    flags: ["CASTING_INK_STUDIO_SCOPE", "CASTING_INK_TRANSFORM_SCOPE", "CASTING_INK_WORDS_SCOPE", "CASTING_REFERENCE_LIBRARY_SCOPE"],
    notes: [
      "THE ID POINTS AND THE ROW DECIDES: a chain naming a crop with no row is skipped loudly by the carry (the rescue needs the name to stand) and answered free at the transform door (inkNotKept) — never scrubbed, because scrubbing deletes the pointer the minted-loss rescue lives on (C4b, closed not-to-be-built).",
      "free.ink is ONE subject holding every tattoo (the keying work, §10 3b, splits it); the gate skips items warranted only by the prior so a carried tattoo cannot wall a new ask.",
      "Removal of the only edit NAVIGATES free ('That takes it back to the original'); a never-rendered survivor re-renders and charges once — proven at the wire both ways.",
    ],
  },
  {
    id: "sign-views",
    title: "Sign — five views, the identity lock, and what rides into them",
    entrances: ["server/castingV2/signService.ts", "server/castingV2/packageOrchestrator.ts", "server/castingV2/inkViewReferences.ts"],
    summary:
      "Signing renders the package views fresh from the anchor, judges each against the signed face and the wardrobe "
      + "spec, and refunds slices that fail. Delivered tattoo crops ride into the views with the her-own-picture "
      + "sentence (never the mannequin's); every slot gets a disposition line, a moved digest refuses rather than "
      + "paints, and a failure never fails the Sign.",
    doors: [],
    doorsNote:
      "Sign's refusals and dispositions are service-internal (not the refine entrance's declared set); its behaviour is "
      + "pinned by signInkCrops.test.ts and the wire courts rather than census rows. A sign corpus is future work — "
      + "sign spends ~450 credits, so it is recorded from courts, never driven by the census.",
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "Description-stated ink rides the sign THROUGH THE DESCRIPTION even where the waist-up master cannot show it (founder ruling, fable-1356 §4) — the full-length views show arms and legs; a view that delivers it mints its crop as the document going forward.",
      "The wire is inert by ABSENCE OF INPUT, not fenced by flags: a cast with no delivered crop composes yesterday's prompt byte for byte (the empty-is-not-fenced lesson).",
      "The wardrobe judge checks the stored line once the Two Paths land — generator and judge share one owner so they cannot drift.",
    ],
  },
  {
    id: "ink-studio",
    title: "The ink studio — uploads, cuts, and the region road",
    entrances: ["server/castingV2/inkUploadService.ts", "server/castingV2/inkUploadDoor.ts", "server/castingV2/inkReferenceCutter.ts"],
    summary:
      "A customer's tattoo design is stored as OUR COPY under the cast's purge path, capped at 8 per cast. The cutter "
      + "isolates the design from its photograph (zero-RGB below the mask — the person leaves the BYTES, not just the "
      + "alpha); the padded licence stops a photograph of a person riding whole; the region road cuts the SURFACE she "
      + "pointed at with the face taken out; small cuts are enlarged by a faithful super-resolution model, never a "
      + "diffusion one.",
    doors: [],
    doorsNote:
      "The upload door's refusals (placement, size, format, edge, intent, cap) are its own vocabulary, censused via its "
      + "suite rather than the refine corpus. An upload-entrance corpus is future work — it needs bytes fixtures.",
    flags: ["CASTING_INK_STUDIO_SCOPE", "CASTING_INK_CUT_SCOPE", "CASTING_INK_REGION_CROP_SCOPE", "CASTING_INK_REFERENCE_SCOPE"],
    notes: [
      "The licence is a COUNT and never geometry; no percentage floor may ever be added (a floor that excludes the paper admits the man).",
      "The widening tripwire: the studio scope does not widen past users:1 while any upload can reach an engine uncropped.",
    ],
  },
  {
    id: "references",
    title: "References — attach a picture, take a feature",
    entrances: ["server/castingV2/referenceAttachDoor.ts", "server/castingV2/hairReferenceTake.ts", "server/castingV2/inkReferenceTake.ts"],
    summary:
      "Attach stores the customer's picture unchanged (a copy, ours to purge; the digest means byte identity later) and "
      + "hands back a handle — nothing is read, cut, or charged at attach. A refine carrying the handle routes the take: "
      + "hair colour as words she adopts, style and whole-look as a crop; a pointed-at tattoo documents the design. One "
      + "reference at a time by ruling; the Pinterest-style selector is the road's next build.",
    doors: [],
    doorsNote: "The attach/take doors are their own vocabulary; a reference-attached census state exists in the corpus and is the next fixture to build.",
    flags: ["CASTING_REFERENCE_ATTACH_SCOPE", "CASTING_HAIR_REFERENCE_SCOPE", "CASTING_INK_REFERENCE_SCOPE"],
    notes: [
      "What returns to a caller is the storage KEY, never a URL — the server fetches bytes itself; the address is the only thing between a photograph of a person and a stranger.",
    ],
  },
  {
    id: "panel-scan",
    title: "The panel and the scan — what a cast shows about itself",
    entrances: ["server/castingV2/facePanel.ts", "server/castingV2/faceScanService.ts"],
    summary:
      "The panel's rows come from the catalogue; content comes from the library and the delivery crops (the chain "
      + "decides, the store looks up). The auto-scan fills empty rows on first look by asking a segmenter where each "
      + "catalogue feature is (closed checklist — it cannot see tattoos or open kinds; cast-born discovery is the queued "
      + "widening); a clean scan is kept in casting_face_scans, geometry only, stencils as objects under the purge path.",
    doors: [],
    doorsNote: "Panel and scan speak in projections, not refusal ids; their guarantees are pinned by their own suites.",
    flags: ["CASTING_FACE_SCAN_SCOPE", "CASTING_SCAN_TABLE_SCOPE", "CASTING_SEGMENTS_SCOPE", "CASTING_SEGMENTS_DELIVERED_SCOPE"],
    notes: [
      "Discovery mints nothing into a recipe — the panel shows crops the founder's eyes judge; a crop becomes a carry only through the roads built for that.",
    ],
  },
];

/**
 * THE LAWS — invariants that hold across every road. Each cites where it is
 * enforced or proven; the render carries them as the map's closing section.
 */
export const LAWS: ReadonlyArray<{ law: string; where: string }> = [
  { law: "Free before the claim: every refusal a customer can be told pre-claim costs nothing; charge-then-refund where the answer was knowable earlier is a defect.", where: "refineService.ts (attempt counter); census ledger arm" },
  { law: "The anchor is the pristine master; carries are words plus crops, never a chained delivered frame.", where: "refineService.ts source resolution; anchor-is-the-pristine-master (memory/courts)" },
  { law: "The id points and the row decides — names in a record are believed only where a row backs them; missing rows skip loudly.", where: "C4a (09f625a2); the carry's rescue; signInkCrops" },
  { law: "A reader's negative chooses a lane, never turns a customer away or becomes a durable fact about her cast.", where: "law 9 / fable-1052; C4b's closure" },
  { law: "Source containment: a free value must appear in the customer's own sentence; engine-picked exceptions are declared, labelled, and doored.", where: "refineDelta.ts (D-172); Two Paths design §4.1" },
  { law: "Derive, never mirror: one owner per fact (the wardrobe line, the served-placements lists, the refusal registry); second lists are defects.", where: "CLAUDE.md working law 4; wardrobeLine.ts (item 5)" },
  { law: "Every door has a name, a site, a pin and a reach — or a written reason; the census refuses the gap.", where: "capabilityAtlas.mts coverage contract (fable-1357)" },
];
