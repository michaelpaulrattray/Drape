/**
 * WHAT THE STUDIO SAYS WHEN IT WILL NOT TAKE A PICTURE — the UPLOAD entrance's
 * doors, and the map's third entrance (#209 item 1).
 *
 * # Why this module exists
 *
 * It began as the law-4 half. One customer sentence was written out INLINE
 * FIVE TIMES, exported nowhere: `inkUploadDoor.ts`, `inkUploadService.ts`,
 * `referenceAttachService.ts`, and TWICE in `server/routes/castingV2.ts`. Any
 * one of them could have been reworded and nothing would have gone red —
 * working law 4 wearing a refusal's clothes, which is the same defect
 * `briefRefusalCopy.ts` was built to cure for the roll entrance and this
 * follows its shape deliberately.
 *
 * #209 filed the two route sites as a pair. **The sweep found five** (law 7:
 * the class, not the instance), and the three it did not name are the more
 * interesting ones, because they already carry `code: "unreadable"` — so the
 * sentence was half-named and half-anonymous depending on which door you
 * arrived at.
 *
 * # ⚠ AND THE ID HALF WAS DEFERRED, FOR TWO REASONS BOTH NOW DISCHARGED
 *
 * That deferral is #209's open remainder, and its own docblock recorded the two
 * things that had to be true before it could be cut. Both are met here, so the
 * reasons are kept with their answers rather than deleted:
 *
 * 1. ⚠ **`unreadable` is ALREADY a declared door and it is a different one.**
 *    The interpreter's `unreadable` (`castingIntent.ts` / `openLaneKind.ts` /
 *    `refineInterpreter.ts`) means *a reply came back and could not be read*.
 *    Declaring these bare would auto-attach the interpreter's line to an upload
 *    door — precisely the conflation #206 qualified `roll.*` to avoid.
 *    **Answered by qualifying, which is what that sentence itself prescribed**:
 *    every id below is `upload.*` or `reference.*` on the map, so the door cites
 *    the line that speaks to the customer and the interpreter's verdict stays
 *    what it is. `duplicateDoorFindings` refuses a collision at generate time.
 *
 * 2. ⚠ **A declared id carries a same-commit obligation.** `capabilityAtlas.mts`
 *    raises a hard ERROR for a door with no corpus row, no `UNREACHABLE_DOORS`
 *    reason and no `KNOWN_DEBTS` line. **Answered with the middle one, which is
 *    the honest discharge and not the cheap one**: the corpus drives ONE
 *    entrance — it sends a SENTENCE at an existing Cast through
 *    `castingV2.refine` — and every door below is raised on bytes a customer
 *    UPLOADED, which the row grammar has no field for. That is the concept
 *    entrance's own reason, stated per door in `UNREACHABLE_DOORS`. Nothing
 *    goes on `KNOWN_DEBTS`, which is a founder-visible act and would have been
 *    the wrong answer for a door whose state is merely un-drivable here.
 *
 * # ⚠ WHAT QUALIFICATION DOES NOT FIX, STATED SO THE COUNT IS NOT MISREAD
 *
 * **Door ids are qualified; PINS are searched on the bare member name.** A test
 * quotes what the product returns (`"unreadable"`), never the atlas's own
 * `upload.unreadable`, so `pinningTests` must look for the bare word — and the
 * interpreter's door of that name therefore shares every pin these do. That is
 * not new and it is not a defect introduced here: `concept.unreadable` has had
 * exactly this property since #192, and this module's own suite was already
 * inflating the interpreter's pin count from 20 to 21 before a single id was
 * declared. Narrowing the pin reader per entrance is a change to the READER,
 * filed on #209 rather than smuggled in beside a declaration.
 *
 * # The criterion, inherited rather than re-invented
 *
 * **A refusal reason with a customer sentence is a DOOR** (#192, written into
 * `briefRefusalCopy.ts` when the wardrobe door was given its NOT-A-DOOR
 * verdict). The tables below are `Record<Code, string>` — TypeScript refuses a
 * new union member with no sentence, and the atlas sees the new key the same
 * hour because it IMPORTS them and reads their keys rather than grepping.
 *
 * That criterion is also why the ~70 `reason:`-shaped ids #206 measured are
 * still not here (#209 item 2): `renderFault.ts`'s `clean`, `viewFeatureWords`'s
 * `cropped`, `recipeAssembler`'s eleven are internal decision reasons no
 * customer is ever told, so they have no sentence and are not doors.
 *
 * # The one structural rule
 *
 * **This file imports exactly one thing, and that thing is a leaf.** The
 * capability atlas imports this table and the Atlas's charter is that it never
 * runs app code, so the sentences are declared HERE and `inkUploadDoor.ts` /
 * `referenceAttachDoor.ts` take them from here, never the other way round.
 * `./uploadLimits` is that leaf — three numbers, no imports of its own — and
 * `uploadRefusalCopy.test.ts` asserts BOTH halves: this file's import list, and
 * that the leaf is still a leaf. Writing `8MB` out beside the constant that
 * produces it would have been a second author of one number, in the module
 * whose subject is one sentence having one author.
 */
import { INK_DESIGN_MAX_BYTES, INK_DESIGN_MIN_EDGE, INK_DESIGNS_PER_CANDIDATE } from "./uploadLimits";

/**
 * The sentence, byte-identical to the five copies it replaces.
 *
 * It answers two different causes on purpose — a payload that is not base64 at
 * all, and bytes the reader could open but not recognise as an image format we
 * take. The customer's next move is the same in both cases (send a different
 * file), which is what makes them one sentence rather than two.
 */
export const BYTES_NOT_AN_IMAGE_MESSAGE = "That file isn't an image we can read.";

/**
 * EVERY DOOR THE BYTE READER PUTS UP, AND WHAT IT SAYS.
 *
 * ⚠ **ONE DOOR SET, TWO LIVE ROADS, AND THAT IS WHY THE PREFIX IS `upload.`
 * RATHER THAN `ink.` OR `reference.`.** `inkDesignBytesRefusal` is asked by
 * `castingV2.concept.describe` (on for every account) and by
 * `castingV2.reference.attach` (`CASTING_REFERENCE_ATTACH_SCOPE`, his account),
 * through `referenceAttachBytesRefusal`, which narrows to exactly these four.
 * A per-road prefix would have put one function's four answers on the map
 * twice, and `concept.unreadable` is ALREADY TAKEN by a different door — the
 * concept reader's outage, which is a fault of ours rather than of her file.
 *
 * All four are raised BEFORE anything is stored, charged or read, so every one
 * of them is free.
 */
export const UPLOAD_REFUSAL_COPY = {
  /** sharp could not open the bytes at all — or they were never base64. */
  unreadable: BYTES_NOT_AN_IMAGE_MESSAGE,
  /** Readable, and not one of the three formats we take. */
  unsupportedFormat: "Designs come as PNG, JPEG or WebP.",
  /** Over the byte ceiling, judged before the decode so a huge file is cheap. */
  tooLarge: `That file is larger than ${Math.round(INK_DESIGN_MAX_BYTES / (1024 * 1024))}MB.`,
  /** Under the edge floor: a picture that can only say there was something. */
  tooSmall: `That image is too small to draw from — ${INK_DESIGN_MIN_EDGE}px on the shortest side, at least.`,
} as const satisfies Record<string, string>;

/** The byte reader's four answers, as a type the doors are held to. */
export type UploadRefusalCode = keyof typeof UPLOAD_REFUSAL_COPY;

/**
 * THE REFERENCE ENTRANCE'S OWN DOOR — one, and it is the per-Cast cap.
 *
 * Its own table rather than a fifth key above, because it belongs to ONE road:
 * the attach is the only entrance that KEEPS what it takes, so it is the only
 * one that can run out of room. `castingV2.concept.describe` reads a picture
 * and stores nothing, and a cap on it would be a sentence about a limit that
 * does not exist.
 *
 * ⚠ **IT USED TO SAY "REMOVE ONE TO ADD ANOTHER", AND THERE IS NO REMOVAL**
 * (found in the running app 2026-08-20, ruled fable-1173 §2). `ink.remove`
 * takes a design; nothing takes an attachment — they are only ever swept with
 * the Cast. So the sentence named a move a customer cannot make, which is
 * D-180's dead end, and the only exit it left was deleting the Cast.
 *
 * **The trap worth naming is HOW it got here**: this sentence was copied from
 * the ink upload door's alongside the NUMBER it derives
 * (`REFERENCE_PICTURES_PER_CANDIDATE` comes from that door's own cap, law 4,
 * correctly). At the origin it is TRUE — a design can be removed. At the
 * destination it is false. **A derived number is safe to copy and the prose
 * around it is not**, because the prose is about what else exists there.
 *
 * So it says only what is true today. The customer-facing DETACH is filed as
 * its own chunk (fable-1173 §2); when it lands, this sentence names it.
 *
 * ⚠ **AND THIS PARAGRAPH TRAVELLED WITH THE SENTENCE, because it is about the
 * sentence's GUARD and would have been orphaned by the move** (#209 item 1).
 * It used to end "…and `referenceAttachDoor.test.ts` is where the two are kept
 * in step", present tense, about a file that has never existed (#647). The
 * refusal is driven TODAY by `inkReferenceMint.test.ts`, which is the only
 * suite that reads it. A reader who follows a pointer, finds nothing, and
 * concludes the guard was never written has just re-filed a live control as a
 * dead one — the wrong-road class `CLAUDE.md`'s law-7 section is about.
 */
export const REFERENCE_ATTACH_REFUSAL_COPY = {
  /*
    ⚠ **`pictureCap`, NOT `cap`, AND THE NAME IS LOAD-BEARING.** The atlas pins
    a door by searching test files for its BARE id as a quoted literal, so the
    obvious short name attached five unrelated suites to this door the first
    time it was generated — `wardrobeDoor.test.ts`, `varianceBudget.test.ts`
    and three others, none of which has anything to do with attaching a
    picture. A citation pointing at the right line and naming the wrong door is
    worse than an absent one (#192), and an id short enough to be an English
    word manufactures them by the handful.
  */
  pictureCap:
    `This Cast is holding all ${INK_DESIGNS_PER_CANDIDATE} pictures it can hold. `
    + "Start a new Cast to work from more.",
} as const satisfies Record<string, string>;

/** The attach entrance's own refusal ids. */
export type ReferenceAttachRefusalId = keyof typeof REFERENCE_ATTACH_REFUSAL_COPY;
