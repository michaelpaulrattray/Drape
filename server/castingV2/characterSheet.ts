import sharp from "sharp";

import type { CastViewAngle } from "../../shared/boardTypes";

/**
 * The character sheet — one image of who she is.
 *
 * Real workflows condition on a single character sheet, not on six loose files.
 * So this composes the identity pack into one turnaround: the signed anchor
 * plus every package view that actually landed, in a stable order, at a stable
 * size.
 *
 * **No generation. No credits.** It is arithmetic over pictures the customer
 * has already paid for.
 *
 * # It is DERIVED, never stored
 *
 * The founder's ruling said "stored as a Cast asset", and the storage half is
 * mechanism rather than substance — every property that ruling actually asks
 * for is better served by composing on demand:
 *
 *   - **"Regenerates when a slot fills or a revision lands"** stops being a
 *     promise anyone can break. There is no second copy to go stale, so the
 *     cache-invalidation bug cannot be written.
 *   - **D-104's "identity pack only"** holds by construction rather than by a
 *     writer remembering it. A take cannot be composited in because takes are
 *     not in the input.
 *   - **D-107's deletion** needs no new manifest entry: an artifact that does
 *     not exist cannot outlive its inputs.
 *
 * Storing it would also have cost a migration either way — `modelAssets.viewType`
 * is an enum of ANGLES and a sheet is not an angle, which the schema's own
 * comment calls the record-lies class — plus a deletion-manifest integration
 * and a filter in every reader that treats a view type as an angle.
 *
 * Engines take `{ bytes, contentType }` and never URLs, so the reference path
 * wants a buffer at generation time, not a key. If this is ever measured hot,
 * the answer is a content-addressed cache keyed on the contributing storage
 * keys plus a composer version — a cache entry readers verify against the live
 * ledger, never an authority.
 *
 * # NO TEXT IS EVER BAKED IN. Not in either rendering.
 *
 * Image models reproduce what they see in a reference — labels, captions and
 * watermarks come back out in the render — and our own framing constant forbids
 * letters in the picture. That law was first applied to the engine-facing
 * rendering only, and the founder corrected it: **the export is exactly what
 * users feed into external tools**, so a label burned into it is the same
 * hazard one step removed. Labels are page-rendered UI in the room, over the
 * image, never in it.
 *
 * # ONE bounded artifact, everywhere
 *
 * There is no separate full-native rendering. It existed briefly for our own
 * engines, on the reasoning that we control those consumers and should not
 * throw detail away — and the founder retired it, because the consumers throw
 * it away themselves:
 *
 *   - **Gemini-family models downscale every input to 3072x3072 and perceive
 *     via 768px tiles** (vendor-documented). Pixels above that are discarded by
 *     the model, not preserved by us.
 *   - **Intake budgets are often request-TOTAL** (~20MB). A 47MB reference does
 *     not merely waste bandwidth; it crowds out or refuses the companion
 *     references sent alongside it.
 *
 * So one envelope serves everything: **4096px long side, JPEG, under 10MB** —
 * the strictest common limit of the tools this gets pasted into. That is
 * Kling's; GPT Image (50MB), Seedance (~20MB practical) and Gemini (~20MB
 * payload) are all looser, so meeting the tightest means the file works
 * everywhere without asking anybody which tool they use. At 4096 wide a
 * three-column sheet gives ~1350px cells.
 *
 * **Composition still happens at native resolution internally**, so nothing is
 * pre-blurred and a larger form can be re-derived the day a consumer proves it
 * needs one by measurement. `maxLongSide` exists for exactly that: a
 * Gemini-family caller may derive a 3072 variant at call time rather than
 * sending pixels that will be resampled anyway.
 *
 * # A missing view leaves a gap. Nothing stands in for it.
 *
 * If a slot permanently failed, its cell is omitted and the sheet reflows.
 * Substituting the anchor would be worse than a record that lies: a frontal
 * face sitting in the side-profile cell of an *identity reference*
 * mis-conditions every future generation at that angle. The projection already
 * states the law — a stand-in is honest where a sentence explains it, and this
 * sheet explains nothing.
 */

/** One picture going into the sheet, already fetched. */
export type SheetCell = {
  /** `anchor` for the signed face; otherwise the view's own angle. */
  slot: "anchor" | CastViewAngle;
  bytes: Buffer;
  /** Shown in the export rendering only. Never drawn on the reference. */
  label: string;
};

/**
 * The order cells appear in, widest identity signal first.
 *
 * The anchor leads because it is the face that was signed — the one image that
 * is definitely her and definitely not a generated view. After it, the pack
 * reads as a turnaround: face, then front, then round the sides, then back.
 *
 * **Listed by name, and unknown slots are appended rather than dropped** (D-102).
 * Package composition has changed twice; a Cast signed under v3 has no
 * `threeQuarter` and a Cast signed under v2 has a `sideFull` this list has
 * never heard of. A sheet that silently omitted them would quietly stop being a
 * picture of everything she has.
 */
const SLOT_ORDER: ReadonlyArray<SheetCell["slot"]> = [
  "anchor",
  "closeUp",
  "frontClose",
  "threeQuarter",
  "frontFull",
  "sideClose",
  "sideFull",
  "backFull",
];

export function orderCells(cells: readonly SheetCell[]): SheetCell[] {
  const rank = (slot: SheetCell["slot"]) => {
    const index = SLOT_ORDER.indexOf(slot);
    return index === -1 ? SLOT_ORDER.length : index;
  };
  return [...cells].sort((left, right) => {
    const difference = rank(left.slot) - rank(right.slot);
    // Stable for anything the list does not name, so a new view type keeps a
    // deterministic position instead of moving between renders.
    return difference !== 0 ? difference : left.slot.localeCompare(right.slot);
  });
}

/**
 * The cell is the pack's own resolution, not a number chosen here.
 *
 * Views land at 1696x2528 and the signed anchor at 1024x1536 — both 2:3, so a
 * single cell shape fits everything without cropping anybody. Composing at the
 * largest native size means the engine-facing rendering throws away nothing;
 * the export's downscale happens once, at the end, on the finished sheet.
 */
const DEFAULT_CELL_WIDTH = 1696;
const CELL_ASPECT = 3 / 2;
/** Proportional, so the gutter looks the same at any cell size. */
const GUTTER_RATIO = 0.012;

/**
 * The export envelope: the strictest common limit across the tools people
 * paste this into. Asserted by test, so a future cell-size change cannot
 * silently breach it.
 */
export const EXPORT_MAX_LONG_SIDE = 4096;
export const EXPORT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * How many columns for N cells.
 *
 * Chosen so the sheet stays close to a readable rectangle rather than a strip:
 * four columns is the widest it goes, because a 1x8 line of portraits is
 * unreadable at any size a person would actually open.
 */
export function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return Math.min(4, Math.ceil(Math.sqrt(count)));
}

export type SheetGeometry = {
  columns: number;
  rows: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  /**
   * Where each cell sits, and what it is called.
   *
   * The label rides along even though nothing draws it into the picture: the
   * room renders labels as page UI over the image, and it needs to know which
   * cell is which to place them.
   */
  cells: Array<{ slot: SheetCell["slot"]; label: string; left: number; top: number }>;
};

/**
 * The layout, as arithmetic.
 *
 * Separated from the pixels so it can be asserted exactly — a composition bug
 * is otherwise only visible by looking, and "I looked at it" is not a test.
 */
export function sheetGeometry(
  cells: readonly SheetCell[],
  cellWidth: number = DEFAULT_CELL_WIDTH,
): SheetGeometry {
  const ordered = orderCells(cells);
  const columns = columnsFor(ordered.length);
  const rows = Math.ceil(ordered.length / columns);
  const cellHeight = Math.round(cellWidth * CELL_ASPECT);
  const gutter = Math.max(2, Math.round(cellWidth * GUTTER_RATIO));

  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    width: columns * cellWidth + (columns + 1) * gutter,
    height: rows * cellHeight + (rows + 1) * gutter,
    cells: ordered.map((cell, index) => ({
      slot: cell.slot,
      label: cell.label,
      left: gutter + (index % columns) * (cellWidth + gutter),
      top: gutter + Math.floor(index / columns) * (cellHeight + gutter),
    })),
  };
}

/**
 * Compose the sheet.
 *
 * Always returns JPEG bytes inside the envelope. It carries no text.
 *
 * Never throws for an empty pack: a Cast with nothing in it yields null, and
 * the caller decides what that means, because "there is no sheet yet" is a
 * different sentence in the export route than in the engine path.
 */
export async function composeCharacterSheet(
  cells: readonly SheetCell[],
  options: { maxLongSide?: number } = {},
): Promise<Buffer | null> {
  if (cells.length === 0) return null;

  const ordered = orderCells(cells);
  const geometry = sheetGeometry(cells);
  const composites: sharp.OverlayOptions[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const cell = ordered[index];
    const box = geometry.cells[index];
    const image = await sharp(cell.bytes, { failOn: "none" })
      .resize(geometry.cellWidth, geometry.cellHeight, { fit: "cover", position: "top" })
      .toBuffer();
    composites.push({ input: image, left: box.left, top: box.top });
  }

  const sheet = sharp({
    create: {
      width: geometry.width,
      height: geometry.height,
      channels: 3,
      // The surface token, so a downloaded sheet looks like the product rather
      // than like a screenshot with white edges.
      background: "#EBEBEB",
    },
  }).composite(composites);

  return boundedExport(await sheet.png().toBuffer(), options.maxLongSide ?? EXPORT_MAX_LONG_SIDE);
}

/**
 * Squeeze the finished sheet into the envelope everything accepts.
 *
 * Two constraints, applied in the order that matters: the long side first
 * (geometry is not negotiable once a tool refuses the pixels), then quality
 * until the bytes fit. Quality steps DOWN rather than being guessed once,
 * because the size of a JPEG depends on the picture — a busy sheet of six faces
 * is not the same file as a sparse one, and a fixed quality that fits today
 * would breach the cap the first time somebody signs a Cast with more hair.
 */
async function boundedExport(png: Buffer, maxLongSide: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const longSide = Math.max(meta.width ?? 0, meta.height ?? 0);
  const scaled = longSide > maxLongSide
    ? sharp(png).resize({
        width: (meta.width ?? 0) >= (meta.height ?? 0) ? maxLongSide : undefined,
        height: (meta.height ?? 0) > (meta.width ?? 0) ? maxLongSide : undefined,
        fit: "inside",
      })
    : sharp(png);
  const base = await scaled.toBuffer();

  for (const quality of [90, 82, 74, 66, 58, 50]) {
    const jpeg = await sharp(base).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= EXPORT_MAX_BYTES) return jpeg;
  }
  /*
    Nothing in this product produces a sheet that survives quality 50 and still
    exceeds ten megabytes — but returning the smallest attempt beats returning
    something that will be refused at the far end, and the test pins the bound
    so a future cell size cannot reach here quietly.
  */
  return sharp(base).jpeg({ quality: 45, mozjpeg: true }).toBuffer();
}
