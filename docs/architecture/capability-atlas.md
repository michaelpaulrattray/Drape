# What the studio can do today — the Capability Census

Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.
A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).

Profile **fixture-as-founder** on fixture `outside-scope-bot-local / 34383040-622d-418e-a505-7ddf12d78930`; flags: `CASTING_FACE_SCAN_SCOPE=users:28601`, `CASTING_HAIR_REFERENCE_SCOPE=users:28601`, `CASTING_INK_CUT_SCOPE=users:28601`, `CASTING_INK_REFERENCE_SCOPE=users:28601`, `CASTING_INK_REGION_CROP_SCOPE=users:28601`, `CASTING_INK_STUDIO_SCOPE=users:28601`, `CASTING_INK_TRANSFORM_SCOPE=users:28601`, `CASTING_INK_WORDS_SCOPE=users:28601`, `CASTING_OPEN_LANE_SCOPE=users:28601`, `CASTING_REFERENCE_ATTACH_SCOPE=users:28601`, `CASTING_REFERENCE_LIBRARY_SCOPE=all`, `CASTING_REFINE_DISPATCH_SCOPE=off`, `CASTING_REPAINT_SCOPE=all`, `CASTING_SCAN_TABLE_SCOPE=off`, `CASTING_SEGMENTS_DELIVERED_SCOPE=off`, `CASTING_SEGMENTS_SCOPE=off`, `CASTING_SIDE_PHRASING_SCOPE=users:28601`, `CASTING_TWO_PATHS_SCOPE=users:28601`, `CASTING_V2_SCOPE=all`.

## How the studio works — the roads

Prose is reviewed; every DOOR, FLAG and ENTRANCE below is validated against the source at generate time, and each door's sites/pins/reach are extracted, not written.

### The life of a cast — roll, sheet, refine, sign

A BRIEF is compiled and a ROLL renders eight candidates onto a SHEET (each an independently refundable slice). Opening a candidate gives the panel and REFINE: each paid edit renders a VARIANT anchored on the pristine master, with prior edits carried by the composed chain (words + crops). SIGN freezes an identity: six views rendered from the anchor, each checked against the signed face, delivered as the package. Deletion sweeps the cast and everything minted under it (crops, designs, scans) unconditionally.

_Entrances:_ `server/routes/castingV2.ts`  ·  _Flags:_ `CASTING_V2_SCOPE`

> The roll and sign entrances are not yet driven by the census — their doors are not in the declared set this map validates against. Their corpora are the map's next growth ring (fable-1357 §2).

- Anchor law: every refine renders from candidate.imageKey (the pristine master), never from a delivered frame — chaining on delivered frames was measured to drift.
- A roll is eight independently refundable units; a deploy landing mid-roll costs only the undelivered slices (accepted collision class, D-85).
- The path/wardrobeLine columns (migration 0051) make the born path a fact of the roll; NULL means cast before the paths existed.

### Refine's money model — free before the claim, refunded after it

Everything before the claim is FREE: ownership and state doors, the interpreter's walls and gates, and every cannot-say answer. The claim charges 25 credits and dispatches; a failure after it refunds. The census drives with the claim door shut, so 'would-render' means the ask passed every free door and reached the money.

_Entrances:_ `server/castingV2/refineService.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `candidate_missing` | service-refusal |  | server/castingV2/refineService.ts:1183 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_signed` | service-refusal |  | server/castingV2/refineService.ts:1200 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `busy` | service-refusal |  | server/castingV2/refineService.ts:4627<br>server/castingV2/rollEngine.ts:65<br>(+1) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `refine_limit` | service-refusal |  | server/castingV2/refineService.ts:4086 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `master_missing` | service-refusal |  | server/castingV2/refineService.ts:1189 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `version_missing` | service-refusal |  | server/castingV2/refineService.ts:2295 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_unreadable` | service-refusal |  | server/castingV2/refineService.ts:3392 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_predates_undo` | service-refusal |  | server/castingV2/refineService.ts:2689 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `step_moved` | service-refusal |  | server/castingV2/refineService.ts:2369 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `kind_unserved` | service-refusal |  | server/castingV2/refineService.ts:2423 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- `busy` is the admit door (a real TOO_MANY_REQUESTS, invariant 6); reaching it in the census reads as would-render.
- `refine_limit` is the 24-instruction ceiling — removals are still allowed there; only growth is blocked.
- Charge-then-refund where the answer was knowable pre-claim is a defect class this program has closed twice (the mid-chain prune, the dangling-crop transform); the census's ledger arm guards the whole table.

### Refine's reading — the interpreter, its walls, and its gates

The customer's sentence is read by a text model whose OUTPUT is policed by code: values must appear in the customer's own words (source containment), facets resolve against the subject cards, and refusals carry their own names. Walls refuse the ASK's kind; gates refuse an ask the road cannot serve YET and say what would work. An unreadable or empty sentence refuses free — the product never guesses.

_Entrances:_ `server/castingV2/refineInterpreter.ts` · `server/castingV2/refineDelta.ts`  ·  _Flags:_ `CASTING_OPEN_LANE_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_INK_WORDS_SCOPE`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `empty` | interpreter-refusal |  | server/castingV2/refineDelta.ts:505<br>server/castingV2/refineInterpreter.ts:862<br>(+1) | 6 test(s) | guard.empty |
| `unreadable` | interpreter-refusal |  | server/castingV2/castingIntent.ts:1165<br>server/castingV2/castingIntent.ts:1182<br>(+14) | 16 test(s) | light.softer, guard.gibberish, guard.scope.ink.none |
| `wall_likeness` | interpreter-refusal |  | server/castingV2/refineDelta.ts:417<br>server/castingV2/refineDelta.ts:1476<br>(+2) | 7 test(s) | guard.likeness |
| `wall_content` | interpreter-refusal |  | server/castingV2/refineDelta.ts:457<br>server/castingV2/refineInterpreter.ts:1488<br>(+1) | 6 test(s) | guard.content |
| `wall_stage` | interpreter-refusal |  | server/castingV2/refineDelta.ts:432<br>server/castingV2/refineDelta.ts:1486<br>(+2) | 8 test(s) | background.white |
| `wall_unbacked` | interpreter-refusal |  | server/castingV2/refineDelta.ts:456<br>server/castingV2/refineInterpreter.ts:1559<br>(+1) | 3 test(s) | wardrobe.tee, guard.stage, age.older, guard.compliment, wardrobe.colour |
| `wall_unfileable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:468<br>server/castingV2/refineDelta.ts:1209<br>(+2) | 9 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_document` | interpreter-refusal |  | server/castingV2/refineDelta.ts:481<br>server/castingV2/refineDelta.ts:481<br>(+3) | 2 test(s) | ink.words.face, ink.words.noplace, ink.words.behind-ear, ink.transform.none |
| `gate_ink_uncarried` | interpreter-refusal |  | server/castingV2/refineDelta.ts:487<br>server/castingV2/refineDelta.ts:487<br>(+3) | 3 test(s) | ink.words.chest |
| `gate_ink_unkeepable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:496<br>server/castingV2/refineDelta.ts:496<br>(+3) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_coverage_unread` | interpreter-refusal |  | server/castingV2/refineDelta.ts:503<br>server/castingV2/refineDelta.ts:503<br>(+3) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `scope_unknown` | service-refusal |  | server/castingV2/refineService.ts:1270<br>server/castingV2/refineService.ts:1308 | 2 test(s) | guard.scope.unknown |
| `scope_mismatch` | service-refusal |  | server/castingV2/refineService.ts:4606 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- wall_stage = PROVABLY the shoot (the lexicon backed the claim); wall_unbacked = the model claimed out-of-scope and the lexicon could not confirm — one wall was two walls wearing one name until census card C1.
- gate_ink_document asks 'is there a document for this design'; its answers are the anchor itself, a pointed-at photograph, the delivered crop, and (words road) the delivery about to be minted.
- gate_ink_uncarried is a place the product can SEE and cannot KEEP (a covered chest): render would land, the mint could not crop, the tattoo would die on the next edit — his own find-and-crop condition enforced.
- item 7a split that gate three ways, because its two reasons only COINCIDED while the product had one outfit: gate_ink_uncarried = a garment is over it; gate_ink_unkeepable = the surface is bare and the road still cannot crop a result there (a shirtless Basics chest); gate_ink_coverage_unread = nobody has read this outfit's coverage, which fails closed and says so in its OWN words rather than borrowing the covering's.
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
| `removal_absent` | service-refusal |  | server/castingV2/refineService.ts:3160<br>server/castingV2/refusalTag.ts:22 | 1 test(s) | ink.remove.none, skin.freckles.remove.none |
| `removal_unnamed` | service-refusal |  | server/castingV2/refineService.ts:2732 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_not_in_brief` | service-refusal |  | server/castingV2/refineService.ts:3141 | 1 test(s) | acc.glasses.remove.none, acc.remove.branch.other |
| `removal_uncheckable` | service-refusal |  | server/castingV2/refineService.ts:2918<br>server/castingV2/refineService.ts:2935 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_reread_unmatched` | service-refusal |  | server/castingV2/refineService.ts:3236 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_unnameable` | service-refusal |  | server/castingV2/refineService.ts:4056 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_original` | service-refusal |  | server/castingV2/refineService.ts:2323 | 1 test(s) | guard.undo |

- THE ID POINTS AND THE ROW DECIDES: a chain naming a crop with no row is skipped loudly by the carry (the rescue needs the name to stand) and answered free at the transform door (inkNotKept) — never scrubbed, because scrubbing deletes the pointer the minted-loss rescue lives on (C4b, closed not-to-be-built).
- free.ink is ONE subject holding every tattoo (the keying work, §10 3b, splits it); the gate skips items warranted only by the prior so a carried tattoo cannot wall a new ask.
- Removal of the only edit NAVIGATES free ('That takes it back to the original'); a never-rendered survivor re-renders and charges once — proven at the wire both ways.

### Sign — six views, the identity lock, and what rides into them

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
| light.softer | softer light | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| open.wings | give her wings | master | would-render | would-render |  |
| open.horns | give her small horns | master | would-render | would-render |  |
| makeup.lipstick | give her red lipstick | master | would-render | would-render |  |
| guard.likeness | make her look like Taylor Swift | master | refused:wall_likeness | refused:wall_likeness | Refining can't make someone look like a specific real person. Nothing was charged. |
| guard.content | remove all her clothes | master | refused:wall_content | refused:wall_content | That one can't be rendered. Nothing was charged. |
| guard.stage | put her on a beach at sunset | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do a beach at sunset yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| guard.empty |  | master | refused:empty | refused:empty | Say what you'd like changed — anything about the person themselves. |
| guard.gibberish | asdf qwer zxcv | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| guard.typo | give her a nose rign | master | would-render | would-render |  |
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
| departure | cannot-say | refunded | cannotSayCopy.test.ts |
| empty | interpreter-refusal |  | diagnosticCapture.test.ts, faceScan.test.ts, faceScanService.test.ts, referenceSlotCatalogue.test.ts, refineRefusals.test.ts, server/casting/geminiMigration.test.ts |
| gate_ink_coverage_unread | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts |
| gate_ink_document | interpreter-refusal |  | inkReferenceGate.test.ts, refineDelta.test.ts |
| gate_ink_uncarried | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| gate_ink_unkeepable | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts |
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
| refine_limit | service-refusal |  | refineService.test.ts |
| removal | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| removal_absent | service-refusal |  | refusalTag.test.ts |
| removal_not_in_brief | service-refusal |  | refineService.test.ts |
| removal_reread_unmatched | service-refusal |  | refineService.test.ts |
| removal_uncheckable | service-refusal |  | refineService.test.ts |
| removal_unnameable | service-refusal |  | refineService.test.ts |
| removal_unnamed | service-refusal |  | refineService.test.ts |
| scope_mismatch | service-refusal |  | refineService.test.ts |
| scope_unknown | service-refusal |  | facePanel.test.ts, refineService.test.ts |
| sideNamedWithoutScope | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| step_moved | service-refusal |  | refineService.test.ts |
| uncatalogued | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts, vacantPhrase.test.ts |
| unnamedObject | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts |
| unplacedInk | cannot-say | refunded | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts, inkDesignForAsk.test.ts, refineService.test.ts, repaintAsks.test.ts |
| unreadable | interpreter-refusal |  | hairColourFromReference.test.ts, hairReferenceCutter.test.ts, inkReferenceCutter.test.ts, inkUploadDoor.test.ts, inkUploadService.test.ts, makeupFromReference.test.ts, openLaneAccept.test.ts, openLaneKind.test.ts, referenceAttachService.test.ts, referenceClassGate.test.ts, referenceMediumDoor.test.ts, referenceWordsLane.test.ts, refineInterpreterCeiling.test.ts, refineService.test.ts, server/db/referenceReadDemand.test.ts, server/deployWatchDecision.test.ts |
| version_missing | service-refusal |  | refineService.test.ts |
| wall_content | interpreter-refusal |  | colourContextDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_likeness | interpreter-refusal |  | colourContextDoor.test.ts, inkReferenceGate.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineInterpreterReferenceEntrance.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_stage | interpreter-refusal |  | colourContextDoor.test.ts, inventionDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_unbacked | interpreter-refusal |  | priorContextDoor.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_unfileable | interpreter-refusal |  | server/benchKit.test.ts, colourContextDoor.test.ts, inventionDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineFacets.test.ts, refineInterpreterVouchedRecheck.test.ts, refineService.test.ts, refusalTag.test.ts |
| whichInkToChange | cannot-say | free | cannotSayCopy.test.ts |

## Flags (20)

`CASTING_BORN_INK_SCOPE` · `CASTING_FACE_SCAN_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REFERENCE_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_OPEN_LANE_SCOPE` · `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_SCAN_TABLE_SCOPE` · `CASTING_SEGMENTS_DELIVERED_SCOPE` · `CASTING_SEGMENTS_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_TWO_PATHS_SCOPE` · `CASTING_V2_SCOPE`

## Findings (33)

- **info** `documented-unreachable` already_signed — unreachable by design: answers a refine sent at a SIGNED cast — request state, not sentence content — becomes reachable via: a signed-cast fixture, if sign-state rows are ever wanted; pinned by its C5 service arm
- **info** `documented-unreachable` candidate_missing — unreachable by design: answers a request naming a cast the account does not own — request shape — becomes reachable via: deliberately never as a corpus row; pinned by its C5 service arm
- **info** `documented-unreachable` gate_ink_coverage_unread — unreachable by design: item 7a's third answer: the outfit is one nobody has read the coverage of. Only a PICKED or customer-named wardrobe line produces it, and both are written by the roll's brief stage behind CASTING_TWO_PATHS_SCOPE — with the flag absent every roll has a NULL line, which the coverage owner reads as the house tee rather than as unknown — becomes reachable via: the same fixture on the Wardrobe path with a named outfit, plus 7a-bis's reader deciding whether this door survives at all
- **info** `documented-unreachable` gate_ink_unkeepable — unreachable by design: item 7a's split of gate_ink_uncarried: the surface is BARE and the words road still cannot crop a result there. Both halves need a cast whose wardrobe leaves the chest showing, and the only line that does is the Basics one — which no roll can be cast on while CASTING_TWO_PATHS_SCOPE is absent, so every corpus roll answers the house crew tee and lands on gate_ink_uncarried instead — becomes reachable via: a Basics-path fixture asking for an upper-chest tattoo, once CASTING_TWO_PATHS_SCOPE is armed for the corpus account
- **info** `documented-unreachable` history_predates_undo — unreachable by design: answers an undo against a chain older than typed removal — legacy-era state — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` history_unreadable — unreachable by design: answers a chain whose stored steps fail to parse — corrupt-state, not sentence — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` inkBeyondToday — unreachable by design: needs a documented ask naming a placement beyond the measured vocabulary — the same states as unplacedInk with an off-vocabulary place word — becomes reachable via: the reference-attached fixture, asking for a sleeve
- **info** `documented-unreachable` kind_unserved — unreachable by design: answers an open-kind render the engine table cannot serve — engine-config state — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` master_missing — unreachable by design: answers a cast whose master object is gone — storage state no fixture manufactures honestly — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` notASlot — unreachable by design: the catalogue's no-picture answer; makeup — its historical population — now renders (measured, drive-4), and no current master-state ask reaches a facet the catalogue refuses a picture for — becomes reachable via: a facet that regains the no-picture classification, or a driven ask found to reach it
- **info** `documented-unreachable` refine_limit — unreachable by design: answers the 24-instruction ceiling — needs 24 paid variants on one cast (the census never renders) — becomes reachable via: pinned by its C5 service arm; verify-bot's ceiling cast proved it live (opus-969)
- **info** `documented-unreachable` removal_reread_unmatched — unreachable by design: needs the ambiguity re-read to produce a removal whose noun then matches no step — a two-model-disagreement state that cannot be scripted through the real interpreter deterministically — becomes reachable via: deliberately never: pinned by its service arm (C5); a census row would be a coin flip (the model's read is the unstable thing)
- **info** `documented-unreachable` removal_uncheckable — unreachable by design: needs the removal-verification reader to be unavailable mid-ask — an infrastructure failure state no fixture manufactures honestly — becomes reachable via: deliberately never: its pin is its service arm (C5), and manufacturing reader outages in the census would test the harness, not the product
- **info** `documented-unreachable` scope_mismatch — unreachable by design: answers a scope naming nothing the instruction writes — needs a tap+sentence disagreement the interpreter usually resolves; the deterministic form is its C5 arm — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` step_moved — unreachable by design: answers a chip removal whose index went stale mid-click — a race no scripted sentence makes — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` unplacedInk — unreachable by design: raised at the pre-claim ink door only for a DOCUMENTED ask with no placement; every master-state words ask dies earlier at the document gate (measured, drive-4), and the documented states (reference attached, delivered ink) resolve their placement before that door — becomes reachable via: a reference-attached fixture whose take carries no placement
- **info** `documented-unreachable` version_missing — unreachable by design: answers a replay marker naming a version that is not the predecessor — request shape — becomes reachable via: pinned by its C5 service arm
- **info** `documented-unreachable` whichInkToChange — unreachable by design: needs a branch wearing TWO tattoos; no cast in either world has ever worn two at once (opus-966 §1) and the multi-tattoo fixture is §10 item 3b's build — becomes reachable via: item 3b's keying work, which needs two-tattoo state to test itself
- **info** `not-driven` ref.hair.whole — needs state "reference-attached", which this fixture cannot supply
- **info** `not-driven` ref.ink.sleeve — needs state "reference-attached", which this fixture cannot supply
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

