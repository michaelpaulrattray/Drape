import type { ModelAsset } from "../../drizzle/schema";
import { fetchTrustedImage } from "../security/trustedImageFetch";
import { createModuleLogger } from "../logging/logger";
import { storagePublicUrl } from "../storage";
import { castPackageView } from "./castViewPackage";
import type { CastViewAngle } from "../../shared/boardTypes";
import type { SheetCell } from "./characterSheet";

const log = createModuleLogger("castingV2/characterSheetPack");

/**
 * Turning a Cast's rows into the pictures the sheet composes from.
 *
 * The one job here is deciding WHAT goes in, and the rule is D-104's: **the
 * identity pack only.** The signed anchor and the package views answer *who she
 * is*; a take answers *how she looked that time*, and a take composited into an
 * identity reference would make a moment canonical. Takes are not read here —
 * not filtered out, never fetched — so the rule holds by construction rather
 * than by a predicate somebody could widen later.
 */

/**
 * The anchor is stamped, not inferred.
 *
 * `frontClose` is ambiguous on purpose: the free 1K anchor and the paid 2K
 * Portrait share the view type, and telling them apart by resolution would be
 * reading a coincidence. The Sign path stamps `role` into provenance for
 * exactly this, so that is what gets read.
 */
function roleOf(asset: ModelAsset): string | null {
  const provenance = asset.provenance;
  if (!provenance || typeof provenance !== "object") return null;
  /*
    `identityRole`, not `role`. `identityStampFor({ role })` renames it on the
    way in, and reading the argument's name instead of the column's cost the
    anchor its cell — the sheet composed without the one image D-104 names
    first, while every unit test passed because they build cells directly and
    never come through here.

    Found by composing a real Cast and counting: six assets in, five cells out.
  */
  const role = (provenance as { identityRole?: unknown }).identityRole;
  return typeof role === "string" ? role : null;
}

/** The most recent asset per slot — a revision supersedes what it replaced. */
export function selectPackAssets(assets: readonly ModelAsset[]): ModelAsset[] {
  const anchors = assets.filter((asset) => roleOf(asset) === "anchor");
  const views = assets.filter((asset) => roleOf(asset) !== "anchor");

  const newestPerSlot = new Map<string, ModelAsset>();
  for (const view of views) {
    const seen = newestPerSlot.get(view.viewType);
    // `listCastAssets` returns newest first, so the first sighting wins.
    if (!seen) newestPerSlot.set(view.viewType, view);
  }

  const newestAnchor = anchors[0];
  return [...(newestAnchor ? [newestAnchor] : []), ...Array.from(newestPerSlot.values())];
}

/**
 * Fetch the pack's pictures.
 *
 * A view that cannot be fetched is DROPPED, not substituted — the sheet reflows
 * around it, exactly as it does for a slot that permanently failed. Putting the
 * anchor in a missing view's place would mis-condition every downstream
 * generation at that angle, and the sheet carries no sentence to explain a
 * stand-in.
 */
export async function loadSheetCells(
  assets: readonly ModelAsset[],
  options: { fetchImage?: typeof fetchTrustedImage } = {},
): Promise<SheetCell[]> {
  const fetchImage = options.fetchImage ?? fetchTrustedImage;
  const cells: SheetCell[] = [];

  for (const asset of selectPackAssets(assets)) {
    const key = asset.storageKey;
    if (!key) continue;
    try {
      const image = await fetchImage(storagePublicUrl(key));
      cells.push({
        slot: roleOf(asset) === "anchor" ? "anchor" : (asset.viewType as CastViewAngle),
        bytes: image.bytes,
        label: labelFor(asset),
      });
    } catch (error) {
      /*
        Logged rather than thrown. One unreachable object must not cost the
        customer the whole sheet — the honest sheet is the one showing what
        could actually be read.
      */
      log.warn(
        { modelId: asset.modelId, viewType: asset.viewType, err: error },
        "[characterSheet] a pack image could not be fetched — omitting its cell",
      );
    }
  }
  return cells;
}

/**
 * The cell's caption, in the EXPORT rendering only.
 *
 * Read from the package definition so a view is called on the sheet what it is
 * called in the room. D-106's historical-record law applies: a Cast from an
 * older composition keeps her own slot names, so an angle this build's profile
 * no longer sells still gets a name rather than a blank.
 */
function labelFor(asset: ModelAsset): string {
  if (roleOf(asset) === "anchor") return "Signed";
  try {
    return castPackageView(asset.viewType as CastViewAngle).label;
  } catch {
    // An angle from an era this build does not model. Its own name beats
    // nothing at all.
    return asset.viewType;
  }
}
