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
 * it directly. It was still the boot PARENT of `CASTING_INK_REGION_CROP_SCOPE`,
 * which `defaultCutDesign` reads below — so unsetting it would have been a
 * crash-looping deploy, and leaving it a live enabling term inside a held
 * road's AND.
 *
 * ⚠ **SLICE 4a (2026-09-24) MOVED THE CHILD RATHER THAN THE PARENT, AND THE
 * REASON IS AT THE BYTES HERE.** The only caller of `defaultCutDesign` is
 * `inkReferenceMint.ts`, and that road's own header says
 * **`CASTING_INK_CUT_SCOPE` IS NOT CONSULTED** on it — there is no not-cutting
 * position to take when the bytes are a photograph she attached. So the region
 * crop's parent is now `CASTING_INK_REFERENCE_SCOPE`: the road that produces
 * its subject is the road that gates it. Nothing moved for any account (both
 * stand at `users:1`), and the cut and studio flags are left reading nothing,
 * which is what slice 4b removes.
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
 * boot chain is what stops that being reachable in production — every scope
 * above this road ends at `CASTING_V2_SCOPE`, which refuses to boot without
 * `FAL_KEY`; this is the second half of the same posture, because a guard and
 * a fallback that disagree are how a fence gets a hole. (It named
 * `CASTING_INK_CUT_SCOPE`'s boot guard until #1158 slice 4a; that flag now
 * gates nothing, and the transport fact it was quoted for was always the
 * root's.)
 */
export function defaultCutDesign(
  input: {
    userId: number;
    candidatePublicId: string;
    bytes: Buffer;
    /* WHERE IN HER PICTURE TO LOOK — forwarded, never invented here. The one
       caller left is the attach-pointed mint, which passes a scope derived from
       the address her sentence named; the studio upload door passed none (it
       had no ask, only a picture) and is gone. Optional still, because a
       `scope` this function made up would be a narrowing nobody asked for. */
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

      It only ever matters when a `scope` arrived, and the attach-pointed mint
      is now the only caller that sends one — it derives its region word from
      the placement her sentence named. That is why #1158 slice 4a re-parented
      this flag onto `CASTING_INK_REFERENCE_SCOPE`: the road that produces its
      subject is the road that gates it, and the cut flag the fence used to name
      is one this road deliberately does not consult.
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

