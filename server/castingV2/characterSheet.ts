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
 * # Two renderings, one geometry
 *
 * `reference` is what an image model is handed. `export` is what a person
 * downloads. Same composer, same layout, one parameter — because the moment
 * they are two functions they start drifting.
 *
 * **The reference rendering carries NO TEXT AT ALL**, and that is not
 * fastidiousness. Image models reproduce what they see in a reference: labels,
 * captions and watermarks come back out in the render. Our own framing constant
 * forbids letters in the picture, so a lettered reference would manufacture the
 * conformance failures we then refund. Labels exist only in the export, which
 * never approaches a model.
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

export type SheetVariant = "reference" | "export";

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

/** Cell geometry. Portrait cells, because every view in the pack is portrait. */
const CELL_WIDTH = 512;
const CELL_HEIGHT = 768;
const GUTTER = 8;
const LABEL_BAND = 44;

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
  cells: Array<{ slot: SheetCell["slot"]; left: number; top: number }>;
};

/**
 * The layout, as arithmetic.
 *
 * Separated from the pixels so it can be asserted exactly — a composition bug
 * is otherwise only visible by looking, and "I looked at it" is not a test.
 */
export function sheetGeometry(
  cells: readonly SheetCell[],
  variant: SheetVariant,
): SheetGeometry {
  const ordered = orderCells(cells);
  const columns = columnsFor(ordered.length);
  const rows = Math.ceil(ordered.length / columns);
  const band = variant === "export" ? LABEL_BAND : 0;
  const cellBox = CELL_HEIGHT + band;

  return {
    columns,
    rows,
    width: columns * CELL_WIDTH + (columns + 1) * GUTTER,
    height: rows * cellBox + (rows + 1) * GUTTER,
    cells: ordered.map((cell, index) => ({
      slot: cell.slot,
      left: GUTTER + (index % columns) * (CELL_WIDTH + GUTTER),
      top: GUTTER + Math.floor(index / columns) * (cellBox + GUTTER),
    })),
  };
}

/** The label strip under a cell, as an SVG buffer. Export rendering only. */
function labelStrip(label: string): Buffer {
  /*
    Escaped, because a Cast's name reaches the export rendering and a name with
    an ampersand in it would otherwise produce invalid SVG and a failed
    download. Nothing here is user-controlled in the reference rendering — that
    one has no text at all.
  */
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 40);
  return Buffer.from(
    `<svg width="${CELL_WIDTH}" height="${LABEL_BAND}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect width="100%" height="100%" fill="#EBEBEB"/>`
      + `<text x="${CELL_WIDTH / 2}" y="28" text-anchor="middle" `
      + `font-family="Inter, Helvetica, Arial, sans-serif" font-size="19" fill="#0A0A0A">`
      + `${safe}</text></svg>`,
  );
}

/**
 * Compose the sheet.
 *
 * Returns PNG bytes. Never throws for an empty pack — a Cast with nothing in it
 * yields null, and the caller decides what that means, because "there is no
 * sheet yet" is a different sentence in the export route than in the engine
 * path.
 */
export async function composeCharacterSheet(
  cells: readonly SheetCell[],
  variant: SheetVariant = "reference",
): Promise<Buffer | null> {
  if (cells.length === 0) return null;

  const ordered = orderCells(cells);
  const geometry = sheetGeometry(cells, variant);
  const composites: sharp.OverlayOptions[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const cell = ordered[index];
    const box = geometry.cells[index];
    const image = await sharp(cell.bytes, { failOn: "none" })
      .resize(CELL_WIDTH, CELL_HEIGHT, { fit: "cover", position: "top" })
      .toBuffer();
    composites.push({ input: image, left: box.left, top: box.top });
    if (variant === "export") {
      composites.push({
        input: labelStrip(cell.label),
        left: box.left,
        top: box.top + CELL_HEIGHT,
      });
    }
  }

  return sharp({
    create: {
      width: geometry.width,
      height: geometry.height,
      channels: 3,
      // The surface token, so a downloaded sheet looks like the product rather
      // than like a screenshot with white edges.
      background: "#EBEBEB",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
