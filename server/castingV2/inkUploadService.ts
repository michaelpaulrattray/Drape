/**
 * THE DEFAULT DEPENDENCIES THE INK ROADS SHARE — the manifest, and the cut.
 *
 * ⚠ **THIS FILE WAS THE INK STUDIO'S UPLOAD AND IT IS NO LONGER.** His ruling,
 * 2026-09-24, Crew reply #208 on card `switch-10-ink-studio`, verbatim and
 * entire: *"It retires with N2"*. `uploadInkDesign` — the order-owning
 * orchestration this file was named for — went with #1158 slice 2, along with
 * the plate mint it called at step 5. The filename is kept deliberately: a
 * rename is a repository-wide sweep over text guards that name this path, and
 * folding one into a retirement is how a cleanup grows a second job.
 *
 * # WHAT IS LEFT, AND WHY EACH OF THE TWO SURVIVED
 *
 * Both are read by roads the founder HELD or that are live for every account,
 * and neither is kept against a future that might want it (his own rule from
 * the switch sitting). `inkReferenceMint.test.ts` asserts the identity — the
 * held road's real dependencies ARE these two functions, not doubles of them.
 *
 *   `defaultManifest`   the hold on bytes that do not yet have a row.
 *                       Read by `inkReferenceMint.ts` (the take from an
 *                       attached picture, HELD and moved to N3 — Crew reply
 *                       #213) and by `inkDeliveryMint.ts`, which `refineService`
 *                       calls on the live carry road for every account.
 *
 *   `defaultCutDesign`  taking the design out of her picture. Read by
 *                       `inkReferenceMint.ts` as its real `cut`. It is also
 *                       where `CASTING_INK_REGION_CROP_SCOPE` is read, which is
 *                       why that flag OUTLIVES the studio — see the note on it
 *                       below.
 *
 * # THE FLAG READ THAT MOVED HOUSE WITH THE STUDIO, AND THE ONE THAT DID NOT
 *
 * `CASTING_INK_CUT_SCOPE` had exactly one read in the product and it was the
 * retired upload's `cutEnabled` dependency, so after slice 2 nothing consults
 * it directly. ⚠ **It is not therefore removable**: it is the boot PARENT of
 * `CASTING_INK_REGION_CROP_SCOPE`, which `defaultCutDesign` still reads below,
 * and a child scope refuses to boot when it reaches past its parent. Unsetting
 * the parent over a live child is a crash-looping deploy. What becomes of the
 * chain is #1158 slice 4's, at the Atlas's retirement view.
 *
 * # COPY, NEVER POINTER — and never a re-encode either
 *
 * The bytes stored are the bytes given, unchanged, and that is still true of
 * every road that calls the two functions here. A copy is what makes a design
 * OURS to purge with her Cast (`candidateRetention.ts`, unconditional), and
 * leaving the bytes untouched is what makes the digest mean byte identity
 * later. The cut is the one deliberate exception and it is not a re-encode:
 * what is stored is the design CUT OUT of the picture she gave us — a
 * different object, not a recompression of the same one.
 */
import { randomUUID } from "node:crypto";

import { withTransaction } from "../db/connection";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { captureCastingInkRegionCropEnabled } from "./castingV2Scope";
import { upscaleToFloor } from "./inkReferenceUpscale";
import { createFalRegionReader } from "./falRegionReader";
import {
  cutInkDesign,
  type CutInkDesignInput,
  type CutInkDesignResult,
} from "./inkReferenceCutter";
import { refusingRegionReader } from "./maskedRefine";

/**
 * THE HOLD ON BYTES THAT DO NOT YET HAVE A ROW.
 *
 * Exported since 2026-08-20 because the attach-pointed mint
 * (`inkReferenceMint.ts`) writes into this same store under this same purge
 * path, and the two decisions inside it — a synthetic operation id, and BORN
 * HELD so the worker cannot claim the batch while the bytes are still uploading
 * — are exactly the pair that must not be re-decided by a second hand. A
 * second writer spelling them again is how one of them comes to be spelled
 * differently.
 */
export async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the mint's and the sweep's: the column is
       unique and NOT NULL, and an upload is not a generation operation. */
    operationId: randomUUID(),
    /* BORN HELD, and the synthetic id above is exactly why — the worker's
       in-flight fence tests a batch against a live operation row, and a
       synthetic id matches none. Without the hold this manifest is claimable
       the instant it is written, while the bytes it names are still uploading. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

/**
 * The real cut, exported so a suite can assert THIS — the thing the upload
 * actually calls — rather than a double that agrees with it.
 *
 * The reader is built PER UPLOAD rather than shared: `createFalRegionReader`
 * proves a frame's URL against the bytes in hand once per reader, so one reader
 * per picture is one proof per picture, and a shared one would carry another
 * picture's proof into these calls.
 *
 * `refusingRegionReader` when there is no key, which makes the missing-transport
 * case a REFUSAL rather than a photograph stored as though it had been cut. The
 * boot guard on `CASTING_INK_CUT_SCOPE` is what stops that being reachable in
 * production; this is the second half of the same posture, because a guard and
 * a fallback that disagree are how a fence gets a hole.
 */
export function defaultCutDesign(
  input: {
    userId: number;
    candidatePublicId: string;
    bytes: Buffer;
    /* WHERE IN HER PICTURE TO LOOK — forwarded, never invented here. The studio
       upload door passes none (it has no ask yet, only a picture); the
       attach-pointed mint passes one derived from the address her sentence
       named. A `scope` this function made up would be a narrowing nobody
       asked for. */
    scope?: CutInkDesignInput["scope"];
  },
): Promise<CutInkDesignResult> {
  const apiKey = process.env.FAL_KEY;
  return cutInkDesign({
    bytes: input.bytes,
    reader: apiKey ? createFalRegionReader({ apiKey }) : refusingRegionReader,
    ...(input.scope ? { scope: input.scope } : {}),
    /*
      WHETHER THE CUT MAY BE THE SURFACE — read HERE rather than injected,
      because this is the function that turns a request into the real world and
      the flag is a fact about the world. The unit under test is `cutInkDesign`
      itself, which takes the decision as an argument and is driven both ways.

      It only ever matters when a `scope` arrived: the studio upload door passes
      none (it has no ask yet, only a picture), so the region road belongs to the
      attach-pointed mint, which derives its region word from the placement her
      sentence named.
    */
    regionCrop: captureCastingInkRegionCropEnabled(input.userId),
    /*
      AND A CUT UNDER THE FLOOR IS ENLARGED RATHER THAN REFUSED — the floor
      court's verdict (opus-903, ruled fable-1210 §1), read here for the same
      reason the line above is: this is where a request meets the world.

      ⚠ **BEHIND THE REGION ROAD'S OWN FLAG, and it rescues BOTH roads' small
      cuts for a user inside it.** The floor is that flag's first flip
      precondition and the court that answered it was that road's, so this is
      where the answer belongs — but the rescue is not narrowed to a surface
      cut, because a road that enlarged the SURFACE and still refused the
      smaller ink patch inside it would admit the bigger picture and refuse the
      smaller one, which is the wrong way round.

      Absent when the flag is off or there is no transport, and absent means the
      cutter refuses `cutTooSmall` exactly as it does today — the enlarging is
      unreachable rather than merely unused.
    */
    /* The parameter's type comes FROM the contract rather than being re-listed
       beside it (law 4, and the Atlas says so mechanically): a second copy of
       `{ bytes, width, height }` here would drift by losing a field nothing can
       see. */
    ...(apiKey && captureCastingInkRegionCropEnabled(input.userId)
      ? {
        upscale: ((cut) => upscaleToFloor({
          ...cut,
          apiKey,
          about: { userId: input.userId, candidatePublicId: input.candidatePublicId },
        })) satisfies NonNullable<CutInkDesignInput["upscale"]>,
      }
      : {}),
    about: { userId: input.userId, candidatePublicId: input.candidatePublicId },
  });
}

