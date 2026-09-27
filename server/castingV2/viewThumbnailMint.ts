/**
 * MINT THE SMALL COPY OF A SIGNED VIEW (#1389).
 *
 * `shared/viewThumbnails.ts` holds the shape and the reason; this is the half
 * that makes the bytes. It is called once, from the one place a signed view's
 * bytes reach storage (`packageOrchestrator.ts`'s `defaultStoreImage`) — which
 * is why this is a small change rather than one spread over the twenty-odd
 * sites that INSERT a `model_assets` row.
 *
 * # ⚠ IT CAN NEVER FAIL A PAID VIEW
 *
 * A view costs the customer credits and takes 40-120 seconds to render. A
 * thumbnail is a convenience built from a picture that already exists, so every
 * failure here — sharp refusing the bytes, the bucket refusing the write — is
 * caught, logged and swallowed, and the caller gets its full object back
 * exactly as before. The customer's fallback is the picture itself: the strip
 * asks for the small copy and falls back to the full one when it is not there,
 * which is the same road every cast signed before this shipped already takes.
 *
 * That is the whole reason this returns `void` rather than the key it wrote.
 * A caller that could branch on success would eventually be written to treat a
 * missing thumbnail as an error, and it is not one.
 */
import sharp from "sharp";
import { createModuleLogger } from "../logging/logger";
import { storagePut } from "../storage";
import {
  VIEW_THUMBNAIL_QUALITY,
  VIEW_THUMBNAIL_WIDTH,
  isViewThumbnailBearingKey,
  withViewThumbnailSuffix,
} from "../../shared/viewThumbnails";

const log = createModuleLogger("castingV2/viewThumbnailMint");

export type ViewThumbnailDependencies = {
  put?: typeof storagePut;
  shrink?: (bytes: Buffer) => Promise<Buffer>;
  /**
   * WRITE ONLY IF THE FRESH COPY IS WIDER THAN THIS MANY PIXELS (#1456).
   *
   * The product's own mint never passes it: on the render road there is nothing
   * beside the object yet, so every mint is the first one. It exists for the
   * BACKFILL, which meets copies minted under an earlier, narrower constant and
   * has to tell two cases apart that look identical from the outside — a copy
   * that is narrow because the constant was, and one that is narrow because its
   * SOURCE is. Only the first can be improved.
   *
   * ⚠ **It lives here rather than in the ceremony so that the comparison is made
   * against the bytes this module produces.** A ceremony deciding for itself
   * would need its own resize and its own quality, which is the mirrored
   * constant this module exists to not have (working law 4).
   */
  onlyWiderThan?: number;
};

/**
 * The picture, small.
 *
 * `withoutEnlargement` matters and is not a default: a view that is already
 * narrower than the target must come back at its own size rather than being
 * blown up, which would make the "small" copy LARGER than the original — the
 * one outcome that turns this fix into the defect it was written to remove.
 */
async function defaultShrink(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .resize({ width: VIEW_THUMBNAIL_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: VIEW_THUMBNAIL_QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * Write the small copy beside the full object, best effort.
 *
 * ⚠ **It refuses a key that is not a signed view's.** The suffix rule is narrow
 * on purpose (see the shared module), and a caller reaching this with a garment
 * or an evidence crop would quietly widen it — so the predicate is asserted
 * here rather than trusted at the one call site.
 */
export async function mintViewThumbnail(
  key: string,
  bytes: Buffer,
  dependencies: ViewThumbnailDependencies = {},
): Promise<void> {
  if (!isViewThumbnailBearingKey(key)) {
    log.warn({ reason: "not-a-view-key" }, "Refused to mint a thumbnail for a key outside the views prefix");
    return;
  }
  const shrink = dependencies.shrink ?? defaultShrink;
  const put = dependencies.put ?? storagePut;
  try {
    const small = await shrink(bytes);
    /*
      THE BACKFILL'S QUESTION, ASKED OF THE REAL BYTES (#1456). A source
      narrower than the target comes back at its own width (`withoutEnlargement`
      above), so a copy that is still narrow after a re-mint is telling us the
      SOURCE is the limit — and re-writing it every run would be churn that
      looks like work. Reading the width off what was actually produced is the
      only honest way to know, because a HEAD gives a byte count and no width.
    */
    if (dependencies.onlyWiderThan !== undefined) {
      const width = (await sharp(small).metadata()).width ?? 0;
      if (width <= dependencies.onlyWiderThan) {
        log.info(
          { storedWidth: dependencies.onlyWiderThan, freshWidth: width },
          "Left a small copy alone: a fresh one would be no wider",
        );
        return;
      }
    }
    /*
      A shrink that came back BIGGER than the source is not written. It cannot
      happen for a 4K view and a 288px JPEG, and that is exactly why it is worth
      the two lines: the case it guards is a future view minted small, where
      serving the "thumbnail" would cost the customer more than serving the
      picture, and nothing downstream would ever say so.
    */
    if (small.length >= bytes.length) {
      log.info(
        { fullBytes: bytes.length, smallBytes: small.length },
        "Skipped a thumbnail that was not smaller than its source",
      );
      return;
    }
    await put(withViewThumbnailSuffix(key), small, "image/jpeg");
    log.info(
      { fullBytes: bytes.length, smallBytes: small.length },
      "Minted the small copy of a view",
    );
  } catch (error) {
    // Classification only — never the key, which names a customer's object.
    log.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "Could not mint a view thumbnail; the strip will fall back to the full picture",
    );
  }
}
