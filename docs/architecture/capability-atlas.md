# What the studio can do today — the Capability Census

Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.
A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).

Profile **fixture-as-founder** on fixture `outside-scope-bot-local / 34383040-622d-418e-a505-7ddf12d78930`; flags: `CASTING_FACE_SCAN_SCOPE=users:28601`, `CASTING_HAIR_REFERENCE_SCOPE=users:28601`, `CASTING_INK_CUT_SCOPE=users:28601`, `CASTING_INK_REFERENCE_SCOPE=users:28601`, `CASTING_INK_REGION_CROP_SCOPE=users:28601`, `CASTING_INK_STUDIO_SCOPE=users:28601`, `CASTING_INK_TRANSFORM_SCOPE=users:28601`, `CASTING_INK_WORDS_SCOPE=users:28601`, `CASTING_OPEN_LANE_SCOPE=users:28601`, `CASTING_REFERENCE_ATTACH_SCOPE=users:28601`, `CASTING_REFERENCE_LIBRARY_SCOPE=all`, `CASTING_REFINE_DISPATCH_SCOPE=off`, `CASTING_REPAINT_SCOPE=all`, `CASTING_SCAN_TABLE_SCOPE=off`, `CASTING_SEGMENTS_DELIVERED_SCOPE=off`, `CASTING_SEGMENTS_SCOPE=off`, `CASTING_SIDE_PHRASING_SCOPE=users:28601`, `CASTING_V2_SCOPE=all`.

## The asks

| id | ask | state | believed | observed | what the customer reads |
|---|---|---|---|---|---|
| ink.words.neck | give him a small swallow tattoo on his neck | master | would-render | would-render |  |
| ink.words.arm | give him a small swallow tattoo on his left upper arm | master | would-render | would-render |  |
| ink.words.chest | give him a small swallow tattoo on his upper chest | master | refused:gate_ink_uncarried | refused:gate_ink_uncarried | Their top covers their upper chest, so a tattoo there wouldn't survive the next edit. I can put it on their neck or an upper arm now — or ch |
| ink.words.face | give her a small star tattoo on her cheek | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck tattoo is the one I can do from a description alone. Anywhere else needs a design to work from first, and the |
| ink.words.noplace | give him a tattoo | master | free:unplacedInk | **refused:gate_ink_document** | Tell me where it goes — a neck tattoo is the one I can do from a description alone. Anywhere else needs a design to work from first, and the |
| ink.words.behind-ear | a tiny moon tattoo behind her ear | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck tattoo is the one I can do from a description alone. Anywhere else needs a design to work from first, and the |
| ink.transform.none | make his chest tattoo bigger | master | free:noInkToChange | **refused:gate_ink_document** | Tell me where it goes — a neck tattoo is the one I can do from a description alone. Anywhere else needs a design to work from first, and the |
| ink.remove.none | take his tattoos off | master | refused:removal_absent | refused:removal_absent | I can't find any tattoos on this face — there's nothing to take off. Nothing was charged. |
| ink.transform.has | his upper chest tattoo — make it bigger | branch-with-ink | would-render | would-render |  |
| ink.transform.two | make his chest tattoo bigger and darker | branch-with-ink | free:inkOneChangeAtATime | free:inkOneChangeAtATime | I can change one thing about a tattoo at a time — bigger or smaller, higher or lower, darker or lighter. Say which one you'd like first and  |
| ink.remove.has | take his chest tattoo off | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| mark.scar.forehead | give her a harry potter lightning bolt scar on her forehead | master | would-render | would-render |  |
| mark.freckles | give her freckles | master | would-render | would-render |  |
| acc.earrings.add | give her gold hoop earrings | master | would-render | would-render |  |
| acc.glasses.remove.none | take her glasses off | master | refused:removal_absent | **refused:removal_not_in_brief** | Her brief didn't ask for glasses, and nothing since has added any, so there's nothing on record to take off. If she's wearing glasses in the |
| acc.glasses.remove.has | take her glasses off | branch-with-accessory | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| hair.colour | make her hair copper red | master | would-render | would-render |  |
| hair.style | give her a short bob | master | would-render | would-render |  |
| hair.bald | make him bald | master | would-render | would-render |  |
| eye.colour | her eyes — green | master | would-render | would-render |  |
| eye.colour.side | make her right eye fiery red | master | would-render | would-render |  |
| eye.shape.fox | give her fox eyes | master | would-render | would-render |  |
| eye.scoped.left | make it green _(scope eye@left)_ | master | would-render | **asked:which-facet** | make it green — which part? Nothing's been coloured yet, so I don't want to guess. |
| build.muscular | give him a jacked muscular build | master | would-render | would-render |  |
| skin.tan | give her a deep tan | master | would-render | would-render |  |
| wardrobe.tee | put him in a plain black tee | master | would-render | **refused:wall_stage** | Refining can't do a plain black tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| light.softer | softer light | master | would-render | **refused:unreadable** | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| open.wings | give her wings | master | would-render | would-render |  |
| open.horns | give her small horns | master | would-render | would-render |  |
| makeup.lipstick | give her red lipstick | master | free:notASlot | **would-render** |  |
| guard.likeness | make her look like Taylor Swift | master | refused:wall_likeness | refused:wall_likeness | Refining can't make someone look like a specific real person. Nothing was charged. |
| guard.content | remove all her clothes | master | refused:wall_content | refused:wall_content | That one can't be rendered. Nothing was charged. |
| guard.stage | put her on a beach at sunset | master | refused:wall_stage | refused:wall_stage | Refining can't do a beach at sunset yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| guard.empty |  | master | refused:empty | refused:empty | Say what you'd like changed — anything about the person themselves. |
| guard.gibberish | asdf qwer zxcv | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| guard.typo | give her a nose rign | master | asked:did-you-mean | **would-render** |  |
| guard.scope.unknown | make it green _(scope elbow@left)_ | master | refused:scope_unknown | refused:scope_unknown | I don't know which part of her that is. Nothing was charged. |
| guard.scope.ink.none | make it bigger _(scope ink:upperArm@left)_ | master | free:noInkToChange | **refused:unreadable** | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| ref.hair.whole | copy this hair | reference-attached | would-render | _not driven_ |  |
| ref.ink.sleeve | copy his right arm sleeve onto him | reference-attached | would-render | _not driven_ |  |
| ink.words.neck.branch | give him a small star tattoo on his neck | branch-with-ink | would-render | would-render |  |
| ink.remove.branch.whole | take his tattoos off | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| acc.remove.branch.other | take her earrings off | branch-with-accessory | refused:removal_absent | **refused:removal_not_in_brief** | Her brief didn't ask for earrings, and nothing since has added any, so there's nothing on record to take off. If she's wearing earrings in t |
| age.older | make her ten years older | master | would-render | **refused:wall_stage** | Refining can't do her age yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| expression.smile | make him smile | master | would-render | would-render |  |
| hair.remove.none | remove her fringe | master | refused:removal_not_in_brief | **would-render** |  |
| acc.piercing | give him a silver nose ring | master | would-render | would-render |  |
| eye.both.sides | make her left eye blue and her right eye green | master | would-render | would-render |  |
| skin.freckles.remove.none | she never had freckles | master | refused:removal_not_in_brief | **refused:removal_absent** | I can't find any freckles on this face — there's nothing to take off. Nothing was charged. |
| brows.thicker | give her thicker eyebrows | master | would-render | would-render |  |
| beard.full | give him a full beard | master | would-render | would-render |  |
| guard.undo | undo | master | refused:removal_unnamed | **refused:already_original** | You're already looking at the original. Nothing was charged. |
| guard.multi | green eyes, copper hair, and freckles | master | would-render | would-render |  |
| guard.compliment | he looks great | master | refused:unreadable | **refused:wall_stage** | Refining can't do how attractive they look yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do wor |
| wardrobe.colour | make his tee black | master | refused:wall_stage | refused:wall_stage | Refining can't do his tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| background.white | make the background pure white | master | refused:wall_stage | refused:wall_stage | Refining changes the person, not the shoot — the background is a garment, a prop or the set, which comes after Sign. Jewellery, glasses and  |

## Every door the source declares

| id | kind | charge | pinned by |
|---|---|---|---|
| already_original | service-refusal |  | **none** |
| already_signed | service-refusal |  | **none** |
| busy | service-refusal |  | refusalTag.test.ts, rollService.test.ts |
| candidate_missing | service-refusal |  | **none** |
| departure | cannot-say | refunded | cannotSayCopy.test.ts |
| empty | interpreter-refusal |  | diagnosticCapture.test.ts, faceScan.test.ts, faceScanService.test.ts, referenceSlotCatalogue.test.ts, refineRefusals.test.ts, server/casting/geminiMigration.test.ts |
| gate_ink_document | interpreter-refusal |  | inkReferenceGate.test.ts, refineDelta.test.ts |
| gate_ink_uncarried | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts |
| history_predates_undo | service-refusal |  | **none** |
| history_unreadable | service-refusal |  | **none** |
| inkBeyondToday | cannot-say | free | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts |
| inkOneChangeAtATime | cannot-say | free | cannotSayCopy.test.ts |
| inkRemovalNotYet | cannot-say | free | cannotSayCopy.test.ts |
| kind_unserved | service-refusal |  | **none** |
| master_missing | service-refusal |  | **none** |
| noInkToChange | cannot-say | free | cannotSayCopy.test.ts |
| notASlot | cannot-say | free | cannotSayCopy.test.ts, mintedSlots.test.ts, openKindPolicy.test.ts, openLaneKind.test.ts, referenceSlotCatalogue.test.ts, refineService.test.ts, repaintAsks.test.ts, vocabularyPin.test.ts |
| nothingAsked | cannot-say | free | cannotSayCopy.test.ts, repaintAsks.test.ts |
| noWords | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts, viewFeatureWords.test.ts |
| perSideRemoval | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| refine_limit | service-refusal |  | **none** |
| removal | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| removal_absent | service-refusal |  | refusalTag.test.ts |
| removal_not_in_brief | service-refusal |  | **none** |
| removal_reread_unmatched | service-refusal |  | refineService.test.ts |
| removal_uncheckable | service-refusal |  | **none** |
| removal_unnameable | service-refusal |  | refineService.test.ts |
| removal_unnamed | service-refusal |  | **none** |
| scope_mismatch | service-refusal |  | refineService.test.ts |
| scope_unknown | service-refusal |  | refineService.test.ts |
| sideNamedWithoutScope | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| step_moved | service-refusal |  | **none** |
| uncatalogued | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts, vacantPhrase.test.ts |
| unnamedObject | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts |
| unplacedInk | cannot-say | refunded | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts, inkDesignForAsk.test.ts, refineService.test.ts, repaintAsks.test.ts |
| unreadable | interpreter-refusal |  | hairColourFromReference.test.ts, hairReferenceCutter.test.ts, inkReferenceCutter.test.ts, inkUploadDoor.test.ts, inkUploadService.test.ts, makeupFromReference.test.ts, openLaneAccept.test.ts, openLaneKind.test.ts, referenceAttachService.test.ts, referenceClassGate.test.ts, referenceMediumDoor.test.ts, referenceWordsLane.test.ts, refineInterpreterCeiling.test.ts, refineService.test.ts, server/db/referenceReadDemand.test.ts, server/deployWatchDecision.test.ts |
| version_missing | service-refusal |  | **none** |
| wall_content | interpreter-refusal |  | colourContextDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_likeness | interpreter-refusal |  | colourContextDoor.test.ts, inkReferenceGate.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineInterpreterReferenceEntrance.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_stage | interpreter-refusal |  | colourContextDoor.test.ts, inventionDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| whichInkToChange | cannot-say | free | cannotSayCopy.test.ts |

## Flags (18)

`CASTING_FACE_SCAN_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REFERENCE_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_OPEN_LANE_SCOPE` · `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_SCAN_TABLE_SCOPE` · `CASTING_SEGMENTS_DELIVERED_SCOPE` · `CASTING_SEGMENTS_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_V2_SCOPE`

## Findings (63)

- **warn** `belief-mismatch` acc.glasses.remove.none — "take her glasses off" — believed refused:removal_absent, observed refused:removal_not_in_brief
- **warn** `belief-mismatch` acc.remove.branch.other — "take her earrings off" — believed refused:removal_absent, observed refused:removal_not_in_brief
- **warn** `belief-mismatch` age.older — "make her ten years older" — believed would-render, observed refused:wall_stage
- **warn** `belief-mismatch` eye.scoped.left — "make it green" — believed would-render, observed asked:which-facet
- **warn** `belief-mismatch` guard.compliment — "he looks great" — believed refused:unreadable, observed refused:wall_stage
- **warn** `belief-mismatch` guard.scope.ink.none — "make it bigger" — believed free:noInkToChange, observed refused:unreadable
- **warn** `belief-mismatch` guard.typo — "give her a nose rign" — believed asked:did-you-mean, observed would-render
- **warn** `belief-mismatch` guard.undo — "undo" — believed refused:removal_unnamed, observed refused:already_original
- **warn** `belief-mismatch` hair.remove.none — "remove her fringe" — believed refused:removal_not_in_brief, observed would-render
- **warn** `belief-mismatch` ink.transform.none — "make his chest tattoo bigger" — believed free:noInkToChange, observed refused:gate_ink_document
- **warn** `belief-mismatch` ink.words.noplace — "give him a tattoo" — believed free:unplacedInk, observed refused:gate_ink_document
- **warn** `belief-mismatch` light.softer — "softer light" — believed would-render, observed refused:unreadable
- **warn** `belief-mismatch` makeup.lipstick — "give her red lipstick" — believed free:notASlot, observed would-render
- **warn** `belief-mismatch` skin.freckles.remove.none — "she never had freckles" — believed refused:removal_not_in_brief, observed refused:removal_absent
- **warn** `belief-mismatch` wardrobe.tee — "put him in a plain black tee" — believed would-render, observed refused:wall_stage
- **error** `route-changed` hair.remove.none — "remove her fringe" — committed refused:removal_absent, now would-render
- **error** `route-changed` ink.words.neck.branch — "give him a small star tattoo on his neck" — committed refused:gate_ink_uncarried, now would-render
- **error** `route-changed` light.softer — "softer light" — committed refused:wall_stage, now refused:unreadable
- **info** `not-driven` ref.hair.whole — needs state "reference-attached", which this fixture cannot supply
- **info** `not-driven` ref.ink.sleeve — needs state "reference-attached", which this fixture cannot supply
- **warn** `unpinned-refusal` already_original — service-refusal "already_original" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` already_signed — service-refusal "already_signed" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` candidate_missing — service-refusal "candidate_missing" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` history_predates_undo — service-refusal "history_predates_undo" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` history_unreadable — service-refusal "history_unreadable" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` kind_unserved — service-refusal "kind_unserved" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` master_missing — service-refusal "master_missing" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` refine_limit — service-refusal "refine_limit" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` removal_not_in_brief — service-refusal "removal_not_in_brief" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` removal_uncheckable — service-refusal "removal_uncheckable" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` removal_unnamed — service-refusal "removal_unnamed" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` step_moved — service-refusal "step_moved" is named by no test file — a door nobody has proven can shut
- **warn** `unpinned-refusal` version_missing — service-refusal "version_missing" is named by no test file — a door nobody has proven can shut
- **warn** `unreached` noInkToChange — a corpus row expects "noInkToChange" and the drive never produced it — the door may be unreachable
- **warn** `unreached` notASlot — a corpus row expects "notASlot" and the drive never produced it — the door may be unreachable
- **warn** `unreached` removal_unnamed — a corpus row expects "removal_unnamed" and the drive never produced it — the door may be unreachable
- **warn** `unreached` unplacedInk — a corpus row expects "unplacedInk" and the drive never produced it — the door may be unreachable
- **info** `unreached` already_original — no corpus row expects "already_original" — the census cannot say whether any ask reaches it
- **info** `unreached` already_signed — no corpus row expects "already_signed" — the census cannot say whether any ask reaches it
- **info** `unreached` busy — no corpus row expects "busy" — the census cannot say whether any ask reaches it
- **info** `unreached` candidate_missing — no corpus row expects "candidate_missing" — the census cannot say whether any ask reaches it
- **info** `unreached` departure — no corpus row expects "departure" — the census cannot say whether any ask reaches it
- **info** `unreached` history_predates_undo — no corpus row expects "history_predates_undo" — the census cannot say whether any ask reaches it
- **info** `unreached` history_unreadable — no corpus row expects "history_unreadable" — the census cannot say whether any ask reaches it
- **info** `unreached` inkBeyondToday — no corpus row expects "inkBeyondToday" — the census cannot say whether any ask reaches it
- **info** `unreached` inkRemovalNotYet — no corpus row expects "inkRemovalNotYet" — the census cannot say whether any ask reaches it
- **info** `unreached` kind_unserved — no corpus row expects "kind_unserved" — the census cannot say whether any ask reaches it
- **info** `unreached` master_missing — no corpus row expects "master_missing" — the census cannot say whether any ask reaches it
- **info** `unreached` nothingAsked — no corpus row expects "nothingAsked" — the census cannot say whether any ask reaches it
- **info** `unreached` noWords — no corpus row expects "noWords" — the census cannot say whether any ask reaches it
- **info** `unreached` perSideRemoval — no corpus row expects "perSideRemoval" — the census cannot say whether any ask reaches it
- **info** `unreached` refine_limit — no corpus row expects "refine_limit" — the census cannot say whether any ask reaches it
- **info** `unreached` removal — no corpus row expects "removal" — the census cannot say whether any ask reaches it
- **info** `unreached` removal_reread_unmatched — no corpus row expects "removal_reread_unmatched" — the census cannot say whether any ask reaches it
- **info** `unreached` removal_uncheckable — no corpus row expects "removal_uncheckable" — the census cannot say whether any ask reaches it
- **info** `unreached` removal_unnameable — no corpus row expects "removal_unnameable" — the census cannot say whether any ask reaches it
- **info** `unreached` scope_mismatch — no corpus row expects "scope_mismatch" — the census cannot say whether any ask reaches it
- **info** `unreached` sideNamedWithoutScope — no corpus row expects "sideNamedWithoutScope" — the census cannot say whether any ask reaches it
- **info** `unreached` step_moved — no corpus row expects "step_moved" — the census cannot say whether any ask reaches it
- **info** `unreached` uncatalogued — no corpus row expects "uncatalogued" — the census cannot say whether any ask reaches it
- **info** `unreached` unnamedObject — no corpus row expects "unnamedObject" — the census cannot say whether any ask reaches it
- **info** `unreached` version_missing — no corpus row expects "version_missing" — the census cannot say whether any ask reaches it
- **info** `unreached` whichInkToChange — no corpus row expects "whichInkToChange" — the census cannot say whether any ask reaches it

