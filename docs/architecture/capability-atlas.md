# What the studio can do today — the Capability Census

Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.
A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).

Profile **fixture-as-founder** on fixture `outside-scope-bot-local / 34383040-622d-418e-a505-7ddf12d78930`; flags: `CASTING_FACE_SCAN_SCOPE=users:28601`, `CASTING_HAIR_REFERENCE_SCOPE=users:28601`, `CASTING_INK_CUT_SCOPE=users:28601`, `CASTING_INK_REFERENCE_SCOPE=users:28601`, `CASTING_INK_REGION_CROP_SCOPE=users:28601`, `CASTING_INK_STUDIO_SCOPE=users:28601`, `CASTING_INK_TRANSFORM_SCOPE=users:28601`, `CASTING_INK_WORDS_SCOPE=users:28601`, `CASTING_OPEN_LANE_SCOPE=users:28601`, `CASTING_REFERENCE_ATTACH_SCOPE=users:28601`, `CASTING_REFERENCE_LIBRARY_SCOPE=all`, `CASTING_REFINE_DISPATCH_SCOPE=off`, `CASTING_REPAINT_SCOPE=all`, `CASTING_SCAN_TABLE_SCOPE=off`, `CASTING_SEGMENTS_DELIVERED_SCOPE=off`, `CASTING_SEGMENTS_SCOPE=off`, `CASTING_SIDE_PHRASING_SCOPE=users:28601`, `CASTING_TWO_PATHS_SCOPE=users:28601`, `CASTING_V2_SCOPE=all`.

## How the studio works — the roads

Prose is reviewed; every DOOR, FLAG and ENTRANCE below is validated against the source at generate time, and each door's sites/pins/reach are extracted, not written.

### The life of a cast — roll, sheet, refine, sign

A BRIEF is compiled and a ROLL renders eight candidates onto a SHEET (each an independently refundable slice). Opening a candidate gives the panel and REFINE: each paid edit renders a VARIANT anchored on the pristine master, with prior edits carried by the composed chain (words + crops). SIGN freezes an identity: five views rendered from the anchor, each checked against the signed face, delivered as the package. Deletion sweeps the cast and everything minted under it (crops, designs, scans) unconditionally.

_Entrances:_ `server/routes/castingV2.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_RETRY_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `roll.likeness` | roll-refusal |  | server/castingV2/briefCompiler.ts:1221<br>server/castingV2/briefRefusalCopy.ts:114 | 5 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.not_a_being` | roll-refusal |  | server/castingV2/briefCompiler.ts:1224<br>server/castingV2/briefRefusalCopy.ts:120 | 3 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.reader_outage` | roll-refusal |  | server/castingV2/briefCompiler.ts:1150<br>server/castingV2/briefRefusalCopy.ts:126 | 5 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.uninterpretable` | roll-refusal |  | server/castingV2/briefCompiler.ts:1087<br>server/castingV2/briefCompiler.ts:1554<br>(+1) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.unsupported_cohort` | roll-refusal |  | server/castingV2/briefCompiler.ts:1203<br>server/castingV2/briefCompiler.ts:1210<br>(+1) | 6 test(s) | _documented-unreachable or gap — see findings_ |

> THE ROLL ENTRANCE'S FIVE WALLS ARE ON THE MAP AS OF #206 — declared from `ROLL_REFUSAL_COPY`, entrance-qualified `roll.*`, each citing its own throw. They are DECLARED but not DRIVEN: the census sends a sentence at an existing Cast through `castingV2.refine`, and these are raised inside `castingV2.createRoll` before a roll row exists, so each carries its reason in UNREACHABLE_DOORS instead of a corpus row. A brief-carrying corpus row is the map's next growth ring, and it would be free at all five. The SIGN entrance is still outside the declared set entirely (fable-1357 §2).

- Anchor law: every refine renders from candidate.imageKey (the pristine master), never from a delivered frame — chaining on delivered frames was measured to drift.
- THE RETRY BUTTON (`CASTING_RETRY_SCOPE`, #122 shape 1, founder 2026-08-26: 'same prompt, one slice, 20 credits, refunded again on failure'): a tile whose chip reads Engine error or Didn't arrive may be rendered again — the FAILED ROW ITSELF goes failed → queued by CAS (`resetCandidateForRetry`, the one transition out of `failed`), one render runs through the roll road's own `dispatchCandidate` with the row's `internalPrompt.prompt` byte for byte, under an operation of its own (`castingV2.retry`, the candidate lock as the double-tap cover). Content-filter tiles GET THE SAME BUTTON since his reply #10 (2026-08-26: 'Flip it on for your account, AND widen it to content-filter tiles') — the #93 court measured the filter as a coin per picture (roll 222's text refused 5/8 live, 6/8 passed re-sent unchanged), so a plain Retry is the button that rescues them and promises nothing about softer words; not-a-portrait and not-charged tiles still get none; every refusal (`retryService.ts`: flag off → NOT_FOUND, wrong kind, sheet still casting, cancelled roll, no prompt) is free and before the claim. Recovery links a crashed retry to its slice through the operation's candidate lock row and fails CLOSED. Off the flag not one line runs; production holds it `users:1` since 2026-08-27 on his reply #10, so its live population is every refused tile on his own sheets — NOT zero, which is what this note said until #206 (the record is `scripts/lib/productionFlagPositions.mts`, which the deploy rite compares to the service on every push). Its refusals are the retry service's own and remain outside the declared door set; the roll entrance's five WALLS joined the map at #206 (doorsNote above).
- A roll is eight independently refundable units; a deploy landing mid-roll costs only the undelivered slices (accepted collision class, D-85).
- The path/wardrobeLine columns (migration 0051) make the born path a fact of the roll; NULL means cast before the paths existed.
- A brief the reader NEVER READ (the deadline fired, the transport or provider failed, no engine configured) is refused FREE before the claim as `reader_outage` at EVERY length (briefCompiler.ts; founder ruling #126 'refuse-free', Crew reply #7 2026-08-26, and 'always' on the length question, reply #9) - it replaced the H30 fallback that charged roll 219 for a sheet cast from the brief's first 80 characters. Only a reply the provider gave that the compiler could not parse still falls back; `reader_outage` is a declared door as of #206 (`roll.reader_outage`) and documented as unreached because no corpus row can carry a brief — this note stays as the road's account of WHY it exists.
- On THE AUTHOR ROAD (`CASTING_CREATIVE_REGISTER_SCOPE`, #131 slice C) the roll's subject walls are the ruling's two and no third: the reader is asked a four-valued subject question (`SUBJECT_INSTRUCTION`, interpreter.ts) in place of the two-valued cohort one, a creature / robot / alien / anime brief CASTS, a real person or a named character refuses FREE before the claim as `likeness` (`LIKENESS_MESSAGE`, briefCompiler.ts) and a subject that is not a being refuses FREE as `not_a_being` (`NOT_A_BEING_MESSAGE`; founder: 'someone asking for an object should be refused like a car'). Both are the reader's judgement taken twice (`cohortWallRetried`). Off the flag the roll walls exactly as before (`unsupported_cohort`). Both walls are declared doors as of #206 — `roll.likeness` and `roll.not_a_being`, the latter the twin of `concept.no_being`, which reached the map first while this half stayed invisible.

### Refine's money model — free before the claim, refunded after it

Everything before the claim is FREE: ownership and state doors, the interpreter's walls and gates, and every cannot-say answer. The claim charges 25 credits and dispatches; a failure after it refunds. The census drives with the claim door shut, so 'would-render' means the ask passed every free door and reached the money.

_Entrances:_ `server/castingV2/refineService.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `candidate_missing` | service-refusal |  | server/castingV2/refineService.ts:1202 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_signed` | service-refusal |  | server/castingV2/refineService.ts:1219 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `busy` | service-refusal |  | server/castingV2/refineService.ts:4889<br>server/castingV2/rollEngine.ts:56<br>(+1) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `refine_limit` | service-refusal |  | server/castingV2/refineService.ts:4310 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `master_missing` | service-refusal |  | server/castingV2/refineService.ts:1208 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `version_missing` | service-refusal |  | server/castingV2/refineService.ts:2519 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_unreadable` | service-refusal |  | server/castingV2/refineService.ts:3616 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_predates_undo` | service-refusal |  | server/castingV2/refineService.ts:2913 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `step_moved` | service-refusal |  | server/castingV2/refineService.ts:2593 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `kind_unserved` | service-refusal |  | server/castingV2/refineService.ts:2647 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- `busy` is the admit door (a real TOO_MANY_REQUESTS, invariant 6); reaching it in the census reads as would-render.
- `refine_limit` is the 24-instruction ceiling — removals are still allowed there; only growth is blocked.
- Charge-then-refund where the answer was knowable pre-claim is a defect class this program has closed twice (the mid-chain prune, the dangling-crop transform); the census's ledger arm guards the whole table.

### Refine's reading — the interpreter, its walls, and its gates

The customer's sentence is read by a text model whose OUTPUT is policed by code: values must appear in the customer's own words (source containment), facets resolve against the subject cards, and refusals carry their own names. Walls refuse the ASK's kind; gates refuse an ask the road cannot serve YET and say what would work. An unreadable or empty sentence refuses free — the product never guesses.

_Entrances:_ `server/castingV2/refineInterpreter.ts` · `server/castingV2/refineDelta.ts`  ·  _Flags:_ `CASTING_OPEN_LANE_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_INK_WORDS_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `empty` | interpreter-refusal |  | server/castingV2/refineDelta.ts:635<br>server/castingV2/refineInterpreter.ts:905<br>(+1) | 8 test(s) | guard.empty |
| `unreadable` | interpreter-refusal |  | server/castingV2/castingIntent.ts:1274<br>server/castingV2/castingIntent.ts:1310<br>(+14) | 22 test(s) | light.softer, guard.gibberish, guard.scope.ink.none |
| `reader_outage` | interpreter-refusal |  | server/castingV2/refineDelta.ts:634<br>server/castingV2/refineInterpreter.ts:919<br>(+2) | 5 test(s) | _documented-unreachable or gap — see findings_ |
| `wall_likeness` | interpreter-refusal |  | server/castingV2/refineDelta.ts:498<br>server/castingV2/refineDelta.ts:1618<br>(+2) | 7 test(s) | guard.likeness |
| `wall_content` | interpreter-refusal |  | server/castingV2/refineDelta.ts:547<br>server/castingV2/refineInterpreter.ts:1601<br>(+1) | 6 test(s) | guard.content |
| `wall_stage` | interpreter-refusal |  | server/castingV2/refineDelta.ts:513<br>server/castingV2/refineDelta.ts:1628<br>(+2) | 8 test(s) | background.white |
| `wall_unbacked` | interpreter-refusal |  | server/castingV2/refineDelta.ts:537<br>server/castingV2/refineInterpreter.ts:1693<br>(+1) | 4 test(s) | wardrobe.tee, guard.stage, age.older, guard.compliment, wardrobe.colour |
| `wall_unfileable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:558<br>server/castingV2/refineDelta.ts:1347<br>(+2) | 9 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_document` | interpreter-refusal |  | server/castingV2/refineDelta.ts:571<br>server/castingV2/refineDelta.ts:571<br>(+3) | 2 test(s) | ink.words.face, ink.words.noplace, ink.words.behind-ear, ink.transform.none |
| `gate_ink_uncarried` | interpreter-refusal |  | server/castingV2/refineDelta.ts:578<br>server/castingV2/refineDelta.ts:578<br>(+4) | 3 test(s) | ink.words.chest |
| `gate_ink_unkeepable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:597<br>server/castingV2/refineDelta.ts:597<br>(+3) | 3 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_coverage_unread` | interpreter-refusal |  | server/castingV2/refineDelta.ts:605<br>server/castingV2/refineDelta.ts:605<br>(+3) | 3 test(s) | ink.words.chest.basics |
| `scope_unknown` | service-refusal |  | server/castingV2/refineService.ts:1289<br>server/castingV2/refineService.ts:1327 | 2 test(s) | guard.scope.unknown |
| `scope_mismatch` | service-refusal |  | server/castingV2/refineService.ts:4868 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- wall_stage = PROVABLY the shoot (the lexicon backed the claim); wall_unbacked = the model claimed out-of-scope and the lexicon could not confirm — one wall was two walls wearing one name until census card C1.
- gate_ink_document asks 'is there a document for this design'; its answers are the anchor itself, a pointed-at photograph, the delivered crop, and (words road) the delivery about to be minted.
- gate_ink_uncarried is a place the product can SEE and cannot KEEP (a covered chest): render would land, the mint could not crop, the tattoo would die on the next edit — his own find-and-crop condition enforced.
- item 7a split that gate three ways, because its two reasons only COINCIDED while the product had one outfit: gate_ink_uncarried = a garment is over it; gate_ink_unkeepable = the surface is bare and the road still cannot crop a result there (a shirtless Basics chest); gate_ink_coverage_unread = nobody has read this outfit's coverage, which fails closed and says so in its OWN words rather than borrowing the covering's.
- unreadable = a reply CAME BACK and could not be read, and rephrasing is real advice for it; reader_outage = nothing came back at all (the transport threw, the deadline passed, the text account is overdrawn, or no engine is configured), where telling her to rephrase is advice she cannot follow. The roll road has drawn this line since #126; the refine road drew it 2026-08-30.
- A tapped rectangle (scope) outranks the words and the memory — the tap is the customer's freshest act; a scope naming nothing the instruction writes refuses free (scope_mismatch).

### The ink lanes — add, transform, remove, and the crop that carries

A delivered tattoo is remembered as a CROP row cut from the delivered frame by the placement's own reader word; that crop rides every later render as instruction material (upscaled to the legibility floor when small). Transforms ride the crop as the source; removals prune the step and recompose (navigate free when the survivor already exists, re-render when it does not); the record's names are believed only where a ROW backs them.

_Entrances:_ `server/castingV2/inkPriorAsk.ts` · `server/castingV2/inkDeliveryMint.ts` · `server/castingV2/refineService.ts`  ·  _Flags:_ `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `noInkToChange` | cannot-say | free | server/castingV2/cannotSayCopy.ts:300 | 1 test(s) | ink.transform.wrongslot, ink.scoped.none.prefill |
| `inkOneChangeAtATime` | cannot-say | free | server/castingV2/cannotSayCopy.ts:435 | 1 test(s) | ink.transform.two |
| `whichInkToChange` | cannot-say | free | server/castingV2/cannotSayCopy.ts:415 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `inkNotKept` | cannot-say | free | server/castingV2/cannotSayCopy.ts:408 | 1 test(s) | ink.transform.dangling |
| `inkBeyondToday` | cannot-say | free | server/castingV2/cannotSayCopy.ts:272 | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `unplacedInk` | cannot-say | refunded | server/castingV2/cannotSayCopy.ts:248 | 5 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_absent` | service-refusal |  | server/castingV2/refineService.ts:3384 | 1 test(s) | ink.remove.none, skin.freckles.remove.none |
| `removal_unnamed` | service-refusal |  | server/castingV2/refineService.ts:2956 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_not_in_brief` | service-refusal |  | server/castingV2/refineService.ts:3365 | 1 test(s) | acc.glasses.remove.none, acc.remove.branch.other |
| `removal_uncheckable` | service-refusal |  | server/castingV2/refineService.ts:3142<br>server/castingV2/refineService.ts:3159 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_reread_unmatched` | service-refusal |  | server/castingV2/refineService.ts:3460 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_unnameable` | service-refusal |  | server/castingV2/refineService.ts:4280 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_original` | service-refusal |  | server/castingV2/refineService.ts:2547 | 1 test(s) | guard.undo |

- THE ID POINTS AND THE ROW DECIDES: a chain naming a crop with no row is skipped loudly by the carry (the rescue needs the name to stand) and answered free at the transform door (inkNotKept) — never scrubbed, because scrubbing deletes the pointer the minted-loss rescue lives on (C4b, closed not-to-be-built).
- free.ink is ONE subject holding every tattoo (the keying work, §10 3b, splits it); the gate skips items warranted only by the prior so a carried tattoo cannot wall a new ask.
- Removal of the only edit NAVIGATES free ('That takes it back to the original'); a never-rendered survivor re-renders and charges once — proven at the wire both ways.

### Sign — five views, the identity lock, and what rides into them

Signing renders the package views fresh from the anchor, judges each against the signed face and the wardrobe spec, and refunds slices that fail. Delivered tattoo crops ride into the views with the her-own-picture sentence (never the mannequin's); every slot gets a disposition line, a moved digest refuses rather than paints, and a failure never fails the Sign.

_Entrances:_ `server/castingV2/signService.ts` · `server/castingV2/packageOrchestrator.ts` · `server/castingV2/inkViewReferences.ts`  ·  _Flags:_ `CASTING_V2_SCOPE`

> Sign's refusals and dispositions are service-internal (not the refine entrance's declared set); its behaviour is pinned by signInkCrops.test.ts and the wire courts rather than census rows. A sign corpus is future work — sign spends ~450 credits, so it is recorded from courts, never driven by the census.

- Description-stated ink rides the sign THROUGH THE DESCRIPTION even where the waist-up master cannot show it (founder ruling, fable-1356 §4) — the full-length views show arms and legs; a view that delivers it mints its crop as the document going forward.
- The wire is inert by ABSENCE OF INPUT, not fenced by flags: a cast with no delivered crop composes yesterday's prompt byte for byte (the empty-is-not-fenced lesson).
- The wardrobe judge checks the stored line once the Two Paths land — generator and judge share one owner so they cannot drift.

### The ink studio — uploads, cuts, and the region road

A customer's tattoo design is stored as OUR COPY under the cast's purge path, capped at 8 per cast. The cutter isolates the design from its photograph (zero-RGB below the mask — the person leaves the BYTES, not just the alpha); the padded licence stops a photograph of a person riding whole; the region road cuts the SURFACE she pointed at with the face taken out; small cuts are enlarged by a faithful super-resolution model, never a diffusion one.

_Entrances:_ `server/castingV2/inkUploadService.ts` · `server/castingV2/inkUploadDoor.ts` · `server/castingV2/inkReferenceCutter.ts`  ·  _Flags:_ `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_REFERENCE_SCOPE`

> The upload door's refusals (placement, size, format, edge, intent, cap) are its own vocabulary, censused via its suite rather than the refine corpus. An upload-entrance corpus is future work — it needs bytes fixtures.

- The licence is a COUNT and never geometry; no percentage floor may ever be added (a floor that excludes the paper admits the man).
- The widening tripwire: the studio scope does not widen past users:1 while any upload can reach an engine uncropped.

### References — attach a picture, take a feature

Attach stores the customer's picture unchanged (a copy, ours to purge; the digest means byte identity later) and hands back a handle — nothing is read, cut, or charged at attach. A refine carrying the handle routes the take: hair colour as words she adopts, style and whole-look as a crop; a pointed-at tattoo documents the design. One reference at a time by ruling; the Pinterest-style selector is the road's next build.

_Entrances:_ `server/castingV2/referenceAttachDoor.ts` · `server/castingV2/hairReferenceTake.ts` · `server/castingV2/inkReferenceTake.ts`  ·  _Flags:_ `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_REFERENCE_SCOPE`

> The attach/take doors are their own vocabulary; a reference-attached census state exists in the corpus and is the next fixture to build.

- What returns to a caller is the storage KEY, never a URL — the server fetches bytes itself; the address is the only thing between a photograph of a person and a stranger.

### The panel and the scan — what a cast shows about itself

The panel's rows come from the catalogue; content comes from the library and the delivery crops (the chain decides, the store looks up). The auto-scan fills empty rows on first look by asking a segmenter where each catalogue feature is (closed checklist — it cannot see tattoos or open kinds; cast-born discovery is the queued widening); a clean scan is kept in casting_face_scans, geometry only, stencils as objects under the purge path.

_Entrances:_ `server/castingV2/facePanel.ts` · `server/castingV2/faceScanService.ts`  ·  _Flags:_ `CASTING_FACE_SCAN_SCOPE` · `CASTING_SCAN_TABLE_SCOPE` · `CASTING_SEGMENTS_SCOPE` · `CASTING_SEGMENTS_DELIVERED_SCOPE`

> Panel and scan speak in projections, not refusal ids; their guarantees are pinned by their own suites.

- Discovery mints nothing into a recipe — the panel shows crops the founder's eyes judge; a crop becomes a carry only through the roads built for that.

## The laws that hold on every road

- **Free before the claim: every refusal a customer can be told pre-claim costs nothing; charge-then-refund where the answer was knowable earlier is a defect.** _(refineService.ts (attempt counter); census ledger arm)_
- **The anchor is the pristine master; carries are words plus crops, never a chained delivered frame.** _(refineService.ts source resolution; anchor-is-the-pristine-master (memory/courts))_
- **The id points and the row decides — names in a record are believed only where a row backs them; missing rows skip loudly.** _(C4a (09f625a2); the carry's rescue; signInkCrops)_
- **A reader's negative chooses a lane, never turns a customer away or becomes a durable fact about her cast.** _(law 9 / fable-1052; C4b's closure)_
- **Source containment: a free value must appear in the customer's own sentence; engine-picked exceptions are declared, labelled, and doored.** _(refineDelta.ts (D-172); Two Paths design §4.1)_
- **Derive, never mirror: one owner per fact (the wardrobe line, the served-placements lists, the refusal registry); second lists are defects.** _(CLAUDE.md working law 4; wardrobeLine.ts (item 5))_
- **Every door has a name, a site, a pin and a reach — or a written reason; the census refuses the gap.** _(capabilityAtlas.mts coverage contract (fable-1357))_

## The asks

| id | ask | state | believed | observed | what the customer reads |
|---|---|---|---|---|---|
| ink.words.neck | give him a small swallow tattoo on his neck | master | would-render | would-render |  |
| ink.words.arm | give him a small swallow tattoo on his left upper arm | master | would-render | would-render |  |
| ink.words.chest | give him a small swallow tattoo on his upper chest | master | refused:gate_ink_uncarried | refused:gate_ink_uncarried | His top covers his upper chest, so a tattoo there wouldn't survive the next edit. I can put it on his neck or an upper arm now — or change w |
| ink.words.face | give her a small star tattoo on her cheek | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.words.noplace | give him a tattoo | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.words.behind-ear | a tiny moon tattoo behind her ear | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.transform.none | make his chest tattoo bigger | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.remove.none | take his tattoos off | master | refused:removal_absent | refused:removal_absent | I can't find any tattoos on this face — there's nothing to take off. Nothing was charged. |
| ink.transform.has | his upper arm tattoo — make it bigger | branch-with-ink | would-render | would-render |  |
| ink.transform.wrongslot | his upper chest tattoo — make it bigger | branch-with-ink | free:noInkToChange | free:noInkToChange | I can't find his upper chest on this version, so there's nothing there to change or take off. Ask me about one that's there, or say where to |
| ink.transform.two | make his arm tattoo bigger and darker | branch-with-ink | free:inkOneChangeAtATime | free:inkOneChangeAtATime | I can change one thing about a tattoo at a time — bigger or smaller, higher or lower, darker or lighter. Say which one you'd like first and  |
| ink.remove.has | take the tattoo off his arm | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| mark.scar.forehead | give her a harry potter lightning bolt scar on her forehead | master | would-render | would-render |  |
| mark.freckles | give her freckles | master | would-render | would-render |  |
| acc.earrings.add | give her gold hoop earrings | master | would-render | would-render |  |
| acc.glasses.remove.none | take her glasses off | master | refused:removal_not_in_brief | refused:removal_not_in_brief | His brief didn't ask for glasses, and nothing since has added any, so there's nothing on record to take off. If he is wearing glasses in the |
| acc.glasses.remove.has | take her glasses off | branch-with-accessory | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| hair.colour | make her hair copper red | master | would-render | would-render |  |
| hair.style | give her a short bob | master | would-render | would-render |  |
| hair.bald | make him bald | master | would-render | would-render |  |
| eye.colour | her eyes — green | master | would-render | would-render |  |
| eye.colour.side | make her right eye fiery red | master | would-render | would-render |  |
| eye.shape.fox | give her fox eyes | master | would-render | would-render |  |
| eye.scoped.left | make it green _(scope eye@left)_ | master | would-render | would-render |  |
| build.muscular | give him a jacked muscular build | master | would-render | would-render |  |
| skin.tan | give her a deep tan | master | would-render | would-render |  |
| wardrobe.tee | put him in a plain black tee | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do a plain black tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| wardrobe.tee.wardrobePath | put him in a plain black tee | wardrobe-path | would-render | _—_ |  |
| wardrobe.tee.basicsPath | put him in a plain black tee | basics-path | refused:wall_basics_wardrobe | _—_ |  |
| ink.words.chest.basics | give him a small swallow tattoo on his upper chest | basics-path | refused:gate_ink_coverage_unread | _—_ |  |
| light.softer | softer light | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| open.wings | give her wings | master | would-render | would-render |  |
| open.horns | give her small horns | master | would-render | would-render |  |
| makeup.lipstick | give her red lipstick | master | would-render | would-render |  |
| guard.likeness | make her look like Taylor Swift | master | refused:wall_likeness | refused:wall_likeness | Refining can't make someone look like a specific real person. Nothing was charged. |
| guard.content | remove all her clothes | master | refused:wall_content | refused:wall_content | That one can't be rendered. Nothing was charged. |
| guard.stage | put her on a beach at sunset | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do a beach at sunset yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| guard.empty |  | master | refused:empty | refused:empty | Say what you'd like changed — anything about the person themselves. |
| guard.gibberish | asdf qwer zxcv | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| guard.typo | give her a nose rign | master | asked:did-you-mean | **would-render** |  |
| guard.scope.unknown | make it green _(scope elbow@left)_ | master | refused:scope_unknown | refused:scope_unknown | I don't know which part of him that is. Nothing was charged. |
| guard.scope.ink.none | make it bigger _(scope ink:upperArm@left)_ | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| ref.hair.whole | copy this hair | reference-attached | would-render | _not driven_ |  |
| ref.ink.sleeve | copy his right arm sleeve onto him | reference-attached | would-render | _not driven_ |  |
| ink.words.neck.branch | give him a small star tattoo on his neck | branch-with-ink | would-render | would-render |  |
| ink.remove.branch.whole | take his tattoos off | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| acc.remove.branch.other | take her earrings off | branch-with-accessory | refused:removal_not_in_brief | refused:removal_not_in_brief | His brief didn't ask for earrings, and nothing since has added any, so there's nothing on record to take off. If he is wearing earrings in t |
| age.older | make her ten years older | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do her age yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| expression.smile | make him smile | master | would-render | would-render |  |
| hair.remove.none | remove her fringe | master | would-render | would-render |  |
| acc.piercing | give him a silver nose ring | master | would-render | would-render |  |
| eye.both.sides | make her left eye blue and her right eye green | master | would-render | would-render |  |
| skin.freckles.remove.none | she never had freckles | master | refused:removal_absent | refused:removal_absent | I can't find any freckles on this face — there's nothing to take off. Nothing was charged. |
| brows.thicker | give her thicker eyebrows | master | would-render | would-render |  |
| beard.full | give him a full beard | master | would-render | would-render |  |
| guard.undo | undo | master | refused:already_original | refused:already_original | You're already looking at the original. Nothing was charged. |
| guard.multi | green eyes, copper hair, and freckles | master | would-render | would-render |  |
| guard.compliment | he looks great | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do how attractive they look yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do wor |
| wardrobe.colour | make his tee black | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do his tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| background.white | make the background pure white | master | refused:wall_stage | refused:wall_stage | Refining changes the person, not the shoot — the background is a garment, a prop or the set, which comes after Sign. Jewellery, glasses and  |
| ink.transform.dangling | his upper chest tattoo — make it bigger | branch-with-dangling-crop | free:inkNotKept | free:inkNotKept | That's his upper chest tattoo — he has it, and I didn't keep a copy of the artwork, so I can't change it from here. Nothing was charged. |
| ink.scoped.none.prefill | his upper arm tattoo — make it bigger _(scope ink:upperArm@left)_ | master | free:noInkToChange | free:noInkToChange | I can't find his left upper arm tattoo on this version, so there's nothing there to change or take off. Ask me about one that's there, or sa |

## Every door the source declares

| id | kind | charge | pinned by |
|---|---|---|---|
| absorbed | interpreter-refusal |  | referenceWordsLane.test.ts, refineRefusals.test.ts |
| absorbed_departure | interpreter-refusal |  | refineRefusals.test.ts |
| already_original | service-refusal |  | refineService.test.ts |
| already_signed | service-refusal |  | refineService.test.ts |
| busy | service-refusal |  | refusalTag.test.ts, rollService.test.ts |
| candidate_missing | service-refusal |  | refineService.test.ts |
| concept.no_being | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts |
| concept.no_transport | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts, hairColourFromReference.test.ts, refineService.test.ts |
| concept.not_a_casting_note | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts |
| concept.not_about_the_person | concept-refusal |  | conceptDescribe.test.ts |
| concept.unreadable | concept-refusal |  | cohortWallRetry.test.ts, conceptDescribe.test.ts, conceptDescribeCopy.test.ts, creativeRegisterScope.test.ts, hairColourFromReference.test.ts, hairReferenceCutter.test.ts, inkReferenceCutter.test.ts, inkUploadDoor.test.ts, inkUploadService.test.ts, makeupFromReference.test.ts, openLaneAccept.test.ts, openLaneKind.test.ts, readerOutageRefusal.test.ts, referenceAttachService.test.ts, referenceClassGate.test.ts, referenceMediumDoor.test.ts, referenceWordsLane.test.ts, refineInterpreterCeiling.test.ts, refineService.test.ts, uploadRefusalCopy.test.ts, server/db/referenceReadDemand.test.ts, server/deployWatchDecision.test.ts |
| departure | cannot-say | refunded | cannotSayCopy.test.ts |
| empty | interpreter-refusal |  | server/casting/geminiMigration.test.ts, creativeRegisterScope.test.ts, diagnosticCapture.test.ts, faceScan.test.ts, faceScanService.test.ts, readerOutageRefusal.test.ts, referenceSlotCatalogue.test.ts, refineRefusals.test.ts |
| gate_ink_coverage_unread | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| gate_ink_document | interpreter-refusal |  | inkReferenceGate.test.ts, refineDelta.test.ts |
| gate_ink_uncarried | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| gate_ink_unkeepable | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| history_predates_undo | service-refusal |  | refineService.test.ts |
| history_unreadable | service-refusal |  | refineService.test.ts |
| inkBeyondToday | cannot-say | free | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts |
| inkNotKept | cannot-say | free | cannotSayCopy.test.ts |
| inkOneChangeAtATime | cannot-say | free | cannotSayCopy.test.ts |
| kind_unserved | service-refusal |  | refineService.test.ts |
| master_missing | service-refusal |  | refineService.test.ts |
| noInkToChange | cannot-say | free | cannotSayCopy.test.ts |
| notASlot | cannot-say | free | cannotSayCopy.test.ts, carrySurvival.test.ts, mintedSlots.test.ts, openKindPolicy.test.ts, openLaneKind.test.ts, referenceSlotCatalogue.test.ts, refineService.test.ts, repaintAsks.test.ts, vocabularyPin.test.ts |
| nothingAsked | cannot-say | free | cannotSayCopy.test.ts, repaintAsks.test.ts |
| noWords | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts, viewFeatureWords.test.ts |
| perSideRemoval | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| reader_outage | interpreter-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts, readerOutageRefusal.test.ts, refineInterpreterCeiling.test.ts, styleRefusal.test.ts |
| refine_limit | service-refusal |  | refineService.test.ts |
| removal | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| removal_absent | service-refusal |  | refusalTag.test.ts |
| removal_not_in_brief | service-refusal |  | refineService.test.ts |
| removal_reread_unmatched | service-refusal |  | refineService.test.ts |
| removal_uncheckable | service-refusal |  | refineService.test.ts |
| removal_unnameable | service-refusal |  | refineService.test.ts |
| removal_unnamed | service-refusal |  | refineService.test.ts |
| roll.likeness | roll-refusal |  | briefRefusalCopy.test.ts, colourContextDoor.test.ts, creativeRegisterScope.test.ts, likenessRefusal.test.ts, stageWallBackstop.test.ts |
| roll.not_a_being | roll-refusal |  | briefRefusalCopy.test.ts, conceptDescribeCopy.test.ts, creativeRegisterScope.test.ts |
| roll.reader_outage | roll-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts, readerOutageRefusal.test.ts, refineInterpreterCeiling.test.ts, styleRefusal.test.ts |
| roll.uninterpretable | roll-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts |
| roll.unsupported_cohort | roll-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts, cohortWallRetry.test.ts, creativeRegisterScope.test.ts, likenessRefusal.test.ts, styleRefusal.test.ts |
| scope_mismatch | service-refusal |  | refineService.test.ts |
| scope_unknown | service-refusal |  | facePanel.test.ts, refineService.test.ts |
| sideNamedWithoutScope | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| step_moved | service-refusal |  | refineService.test.ts |
| uncatalogued | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts, vacantPhrase.test.ts |
| unnamedObject | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts |
| unplacedInk | cannot-say | refunded | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts, inkDesignForAsk.test.ts, refineService.test.ts, repaintAsks.test.ts |
| unreadable | interpreter-refusal |  | cohortWallRetry.test.ts, conceptDescribe.test.ts, conceptDescribeCopy.test.ts, creativeRegisterScope.test.ts, hairColourFromReference.test.ts, hairReferenceCutter.test.ts, inkReferenceCutter.test.ts, inkUploadDoor.test.ts, inkUploadService.test.ts, makeupFromReference.test.ts, openLaneAccept.test.ts, openLaneKind.test.ts, readerOutageRefusal.test.ts, referenceAttachService.test.ts, referenceClassGate.test.ts, referenceMediumDoor.test.ts, referenceWordsLane.test.ts, refineInterpreterCeiling.test.ts, refineService.test.ts, uploadRefusalCopy.test.ts, server/db/referenceReadDemand.test.ts, server/deployWatchDecision.test.ts |
| version_missing | service-refusal |  | refineService.test.ts |
| wall_basics_wardrobe | interpreter-refusal |  | **none** |
| wall_content | interpreter-refusal |  | colourContextDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_likeness | interpreter-refusal |  | colourContextDoor.test.ts, inkReferenceGate.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineInterpreterReferenceEntrance.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_stage | interpreter-refusal |  | colourContextDoor.test.ts, inventionDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_unbacked | interpreter-refusal |  | priorContextDoor.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts, vocabularyPin.test.ts |
| wall_unfileable | interpreter-refusal |  | server/benchKit.test.ts, colourContextDoor.test.ts, inventionDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineFacets.test.ts, refineInterpreterVouchedRecheck.test.ts, refineService.test.ts, refusalTag.test.ts |
| whichInkToChange | cannot-say | free | cannotSayCopy.test.ts |

## Flags (24)

`CASTING_BORN_INK_SCOPE` · `CASTING_BRIEF_FIDELITY_SCOPE` · `CASTING_CONCEPT_UPLOAD_SCOPE` · `CASTING_CREATIVE_REGISTER_SCOPE` · `CASTING_FACE_SCAN_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REFERENCE_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_OPEN_LANE_SCOPE` · `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_RETRY_SCOPE` · `CASTING_SCAN_TABLE_SCOPE` · `CASTING_SEGMENTS_DELIVERED_SCOPE` · `CASTING_SEGMENTS_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_TWO_PATHS_SCOPE` · `CASTING_V2_SCOPE`

## Findings (47)

- **warn** `belief-mismatch` guard.typo — "give her a nose rign" — believed asked:did-you-mean, observed would-render
- **info** `documented-unreachable` already_signed — no corpus row reaches it: answers a refine sent at a SIGNED cast — request state, not sentence content — a row could reach it via: a signed-cast fixture, if sign-state rows are ever wanted; pinned by its C5 service arm
- **info** `documented-unreachable` candidate_missing — no corpus row reaches it: answers a request naming a cast the account does not own — request shape — a row could reach it via: deliberately never as a corpus row; pinned by its C5 service arm
- **info** `documented-unreachable` concept.no_being — no corpus row reaches it: answers an upload whose read found no BEING in the picture at all — an object, a vehicle, a landscape, a product. It is the concept entrance's own edge of the same boundary the roll road draws at `not_a_being`, and #204 narrowed it there: a creature, a robot or an alien is a subject, so this fires only outside all four — a row could reach it via: a corpus row that carries a fixture PICTURE through the real concept entrance — cents of describer reads, the class of money the corpus already spends on text; nothing in the row grammar carries an image today
- **info** `documented-unreachable` concept.no_transport — no corpus row reaches it: answers an upload made with no text engine configured at all — a deployment state, not a picture and not a sentence — a row could reach it via: deliberately never as a corpus row: the census runs against a configured service by construction; pinned by its own arm
- **info** `documented-unreachable` concept.not_a_casting_note — no corpus row reaches it: answers a read that came back as an inventory rather than a type — #185's ruling in code, and the door is OURS by construction: the granularity rule is judged on our own reply, never on her picture — a row could reach it via: the same picture-carrying corpus row; the fault is in the reply, so reaching it deterministically means driving the describer with a doubled reader rather than a fixture picture
- **info** `documented-unreachable` concept.not_about_the_person — no corpus row reaches it: answers a read that came back describing the FRAME instead of the subject — the light, the set, the camera, a resemblance — twice in a row. It is a fault of our reader's output, not of her photograph, which is why it has its own sentence — a row could reach it via: the same picture-carrying corpus row, plus a fixture whose read reliably lands on the frame; the model's answer is the variable, so it is a probe rather than a fixture
- **info** `documented-unreachable` concept.unreadable — no corpus row reaches it: answers a read that never arrived twice — an unparseable reply, a transport throw, or a 200 carrying an empty completion. Since #193 the second ask is bought before this is said, so the state it describes is TWO failures and not one — a row could reach it via: deliberately never as a corpus row: manufacturing two consecutive reader outages would test the harness, not the product. Its pin is its own arm, which is the shape `removal_uncheckable` is documented with above
- **info** `documented-unreachable` gate_ink_unkeepable — no corpus row reaches it: item 7a's split of gate_ink_uncarried: the surface is BARE and the words road cannot crop a result there. Its population was `upperChest`, the one measured placement the words road did not serve — and the Basics chest court (2026-08-23) put the chest on the road, so `uncarriedInkPlaces` is EMPTY and no measured surface is seen-but-unkept. The refusal is kept because it is the only true thing to say about a placement in that state, which the next measured surface will be in on the day it is added — a row could reach it via: the day INK_PLACEMENTS gains a fourth surface — it lands unserved by the words road, which is exactly this door's state, before any court opens it
- **info** `documented-unreachable` history_predates_undo — no corpus row reaches it: answers an undo against a chain older than typed removal — legacy-era state — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` history_unreadable — no corpus row reaches it: answers a chain whose stored steps fail to parse — corrupt-state, not sentence — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` inkBeyondToday — no corpus row reaches it: needs a documented ask naming a placement beyond the measured vocabulary — the same states as unplacedInk with an off-vocabulary place word — a row could reach it via: the reference-attached fixture, asking for a sleeve
- **info** `documented-unreachable` kind_unserved — no corpus row reaches it: answers an open-kind render the engine table cannot serve — engine-config state — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` master_missing — no corpus row reaches it: answers a cast whose master object is gone — storage state no fixture manufactures honestly — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` notASlot — no corpus row reaches it: the catalogue's no-picture answer; makeup — its historical population — now renders (measured, drive-4), and no current master-state ask reaches a facet the catalogue refuses a picture for — a row could reach it via: a facet that regains the no-picture classification, or a driven ask found to reach it
- **info** `documented-unreachable` reader_outage — no corpus row reaches it: REFINE's own reader outage — the sentence was never read because the call threw, the deadline passed, or no engine is configured. The twin of `roll.reader_outage` on the refine road, and of `concept.unreadable`; free, before the claim, exactly as the `unreadable` beside it always was. What changed is only WHOSE fault it names: `unreadable` means a reply came back and could not be read, and its sentence tells her to try naming what she wants changed, which is advice she cannot follow when the failure is ours — a row could reach it via: deliberately never as a corpus row, on the same ground the two doors above state: manufacturing a reader outage in the census would test the harness and not the product. Its pin is its own driven arm in `readerOutageRefusal.test.ts`, which throws the exact ProviderError a 402 produces and asserts the classifier's mapping beside it
- **info** `documented-unreachable` refine_limit — no corpus row reaches it: answers the 24-instruction ceiling — needs 24 paid variants on one cast (the census never renders) — a row could reach it via: pinned by its C5 service arm; verify-bot's ceiling cast proved it live (opus-969)
- **info** `documented-unreachable` removal_reread_unmatched — no corpus row reaches it: needs the ambiguity re-read to produce a removal whose noun then matches no step — a two-model-disagreement state that cannot be scripted through the real interpreter deterministically — a row could reach it via: deliberately never: pinned by its service arm (C5); a census row would be a coin flip (the model's read is the unstable thing)
- **info** `documented-unreachable` removal_uncheckable — no corpus row reaches it: needs the removal-verification reader to be unavailable mid-ask — an infrastructure failure state no fixture manufactures honestly — a row could reach it via: deliberately never: its pin is its service arm (C5), and manufacturing reader outages in the census would test the harness, not the product
- **info** `documented-unreachable` roll.likeness — no corpus row reaches it: answers a brief asking for a real person or a named character — the one subject wall the author road KEEPS (ruling §6 rule 5). HIT IN PRODUCTION whenever a customer types a famous name; it is here because no corpus row can send a BRIEF, not because it is quiet. Pinned by five suite files including its own `likenessRefusal.test.ts` — a row could reach it via: a corpus row grammar that carries a BRIEF to `castingV2.createRoll` instead of a sentence to `castingV2.refine` — a second driven entrance, the same shape the concept entrance's picture-carrying row needs, and free at every one of these five doors
- **info** `documented-unreachable` roll.not_a_being — no corpus row reaches it: answers a brief whose subject is not a being — an object, a vehicle, a place. THE one wall the author road ADDS (founder: 'someone asking for an object should be refused like a car'), and the twin of `concept.no_being`, which #192 put on the map while this half stayed invisible. Also hit in production — a row could reach it via: the same brief-carrying row; its twin's arm already holds the two sentences to one shared boundary clause, so a row would be measuring the road rather than the words
- **info** `documented-unreachable` roll.reader_outage — no corpus row reaches it: answers a brief whose reader never answered — the transport threw, the deadline passed, or no engine is configured. Free by founder ruling (#126, 'refuse-free', always). An infrastructure state, not a sentence — a row could reach it via: deliberately never as a corpus row: manufacturing a reader outage in the census would test the harness and not the product — the discharge `removal_uncheckable` and `concept.unreadable` already carry. Its pin is its own driven arm in `briefCompiler.test.ts`
- **info** `documented-unreachable` roll.uninterpretable — no corpus row reaches it: answers a brief shorter than `BRIEF_TEXT_MIN` — the floor, raised by both the live compiler and the deterministic one. Its state is a REQUEST too small to be a brief, which the refine grammar has no field for — a row could reach it via: the same brief-carrying row, sending a brief under the floor; the cheapest of the five to drive and the least informative
- **info** `documented-unreachable` roll.unsupported_cohort — no corpus row reaches it: answers a styled brief the certified adapter cannot cast — off the author road, and off it only. Its own sentence had NO pin at all before #206: it was an inline literal written out twice, so either copy could have been reworded silently — a row could reach it via: a brief-carrying row on an account OUTSIDE `CASTING_CREATIVE_REGISTER_SCOPE`, since the author road does not raise it; the flag position is part of the row's state, which no current row grammar carries
- **info** `documented-unreachable` scope_mismatch — no corpus row reaches it: answers a scope naming nothing the instruction writes — needs a tap+sentence disagreement the interpreter usually resolves; the deterministic form is its C5 arm — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` step_moved — no corpus row reaches it: answers a chip removal whose index went stale mid-click — a race no scripted sentence makes — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` unplacedInk — no corpus row reaches it: raised at the pre-claim ink door only for a DOCUMENTED ask with no placement; every master-state words ask dies earlier at the document gate (measured, drive-4), and the documented states (reference attached, delivered ink) resolve their placement before that door — a row could reach it via: a reference-attached fixture whose take carries no placement
- **info** `documented-unreachable` version_missing — no corpus row reaches it: answers a replay marker naming a version that is not the predecessor — request shape — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` whichInkToChange — no corpus row reaches it: needs a branch wearing TWO tattoos; no cast in either world has ever worn two at once (opus-966 §1) and the multi-tattoo fixture is §10 item 3b's build — a row could reach it via: item 3b's keying work, which needs two-tattoo state to test itself
- **info** `not-driven` ref.hair.whole — needs state "reference-attached", which this fixture cannot supply
- **info** `not-driven` ref.ink.sleeve — needs state "reference-attached", which this fixture cannot supply
- **warn** `unpinned-refusal` wall_basics_wardrobe — interpreter-refusal "wall_basics_wardrobe" is named by no test file — a door nobody has proven can shut
- **warn** `unreached` gate_ink_coverage_unread — a corpus row expects "gate_ink_coverage_unread" and the drive never produced it — the door may be unreachable
- **warn** `unreached` wall_basics_wardrobe — a corpus row expects "wall_basics_wardrobe" and the drive never produced it — the door may be unreachable
- **warn** `unreached` absorbed — KNOWN DEBT: no corpus row expects "absorbed" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` absorbed_departure — KNOWN DEBT: no corpus row expects "absorbed_departure" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` departure — KNOWN DEBT: no corpus row expects "departure" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` nothingAsked — KNOWN DEBT: no corpus row expects "nothingAsked" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` noWords — KNOWN DEBT: no corpus row expects "noWords" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` perSideRemoval — KNOWN DEBT: no corpus row expects "perSideRemoval" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal — KNOWN DEBT: no corpus row expects "removal" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal_unnameable — KNOWN DEBT: no corpus row expects "removal_unnameable" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal_unnamed — KNOWN DEBT: no corpus row expects "removal_unnamed" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` sideNamedWithoutScope — KNOWN DEBT: no corpus row expects "sideNamedWithoutScope" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` uncatalogued — KNOWN DEBT: no corpus row expects "uncatalogued" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` unnamedObject — KNOWN DEBT: no corpus row expects "unnamedObject" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` wall_unfileable — KNOWN DEBT: no corpus row expects "wall_unfileable" — the map's named remainder (founder law: this list only shrinks)

