/**
 * THE SMALL COPY OF A SIGNED CAST'S VIEW (#1389).
 *
 * # What it is for
 *
 * A signed cast's thumbnail strip draws six pictures at 72x90 CSS pixels and,
 * until this module existed, downloaded the FULL-SIZE file for each one and
 * shrank it in the browser. Measured on real renders the day #1389 was filed:
 * a view is 5.8 MB today and 19.0 MB once #1373's 4K tier lands, so the strip
 * alone is ~30 MB now and ~95 MB after. The customer pays that in wait.
 *
 * # ⚠ THE ROAD THAT WOULD HAVE MADE THIS UNNECESSARY IS CLOSED, AND IT WAS
 * DRIVEN RATHER THAN ASSUMED
 *
 * #1389 asked the right question first: if the bucket were served through a
 * CDN that resizes on the way out, this is a URL change and not a storage one.
 * Production serves from the plain `pub-<id>.r2.dev` domain
 * (`.claude/skills/deploy-railway/SKILL.md`: *"that bucket's public r2.dev
 * URL"*), and that domain was asked, on 2026-09-26:
 *
 *   GET /cdn-cgi/image/width=256/assets/eye-colors/ice.png   404, 151 bytes
 *   GET /assets/eye-colors/ice.png                           200, 271,348 bytes
 *   GET /assets/eye-colors/ice.png?width=256                 200, 271,348 bytes
 *
 * ⚠ **The third line is the one worth keeping.** A naive "just append a width
 * parameter" fix returns `200 OK` and renders a correct-looking picture, and
 * the byte count is IDENTICAL to the unresized object — so it would have read
 * as working while changing nothing at all. Cloudflare Image Resizing needs a
 * custom domain on a zone with the feature enabled; `r2.dev` is not one.
 *
 * # THE SHAPE: A DERIVED KEY, NOT A STORED ONE
 *
 * The small copy lives at the full object's own key plus a suffix. Nothing is
 * recorded in the database, so there is no column, no migration, no backfill of
 * rows, and no second list to drift from the first (working law 4).
 *
 * ⚠ **It grants no access the full object did not already grant.** A cast's
 * views sit at permanently public, unguessable R2 URLs by design
 * (`server/storage.ts`'s header; CLAUDE.md's *"protected only by the URL being
 * hard to guess"*). The derived key is guessable only from the full key — and
 * anyone holding the full key already holds the full picture. The posture is
 * unchanged, which is why this needs no new authenticated route.
 *
 * # ONE FUNCTION, TWO CALLERS, ON PURPOSE
 *
 * The server derives a KEY and the client derives a URL, and a second copy of
 * the suffix in either place is the mirror this repository keeps being bitten
 * by. Both call {@link withViewThumbnailSuffix}; `server/viewThumbnails.test.ts`
 * asserts that the URL of the derived key equals the derived URL of the key, so
 * the two readings cannot answer differently.
 */

/**
 * ⚠ **The suffix ends in `.jpg` because the small copy IS a JPEG**, whatever the
 * full object is. A view is minted as PNG; a {@link VIEW_THUMBNAIL_WIDTH}-wide
 * PNG of a photograph is several times a JPEG of the same picture for no visible
 * gain at this size.
 */
export const VIEW_THUMBNAIL_SUFFIX = ".thumb.jpg";

/**
 * How wide the small copy is rendered.
 *
 * Height is not constrained: the full object's aspect is preserved and
 * `object-cover` does the cropping it already did.
 *
 * # ⚠ IT WAS 288 AND THAT NUMBER WAS TRUE OF ONE CONSUMER (#1456)
 *
 * 288 was four times the strip's 72 CSS pixel tile, and this docblock said
 * *"wider is not the lever … a 72px box at device-pixel-ratio 4 asks for 288
 * device pixels, and no display asks for more."* **That was correct while the
 * strip was the only consumer and false the moment #1447 added three more.**
 * The sentence is kept here because the shape of the mistake outlives it: a
 * constant justified against the surface that happened to be asking, in a
 * docblock that reads as a general ruling.
 *
 * # THE CONSUMERS, MEASURED IN THE RUNNING APP RATHER THAN DERIVED FROM THE CSS
 *
 * Driven at real viewports on 2026-09-27, reading each picture's own box rather
 * than the CSS — because the roster's track is
 * `repeat(auto-fill, minmax(178px, 1fr))`, a STRETCHING track whose width is a
 * function of the viewport and not a constant anybody can quote. The last
 * column is how many source pixels the picture is asked to cover:
 *
 *   surface                     picture    asks       at 288    at 576
 *   rename dialog thumb          46 CSS    138 (d3)     0.48x     0.24x
 *   signed cast's strip tile     72 CSS    216 (d3)     0.75x     0.38x
 *   roster card, laptop 1440    181 CSS    361 (d2)    >1.25x<     0.63x
 *   modal portrait (max-width)  238 CSS    714 (d3)     2.48x     1.24x
 *   roster card, phone 390      288 CSS    876 (d3)    >3.00x<     1.52x
 *   roster card, phone 430      288 CSS    996 (d3)    >3.00x<     1.73x
 *
 * **The two rows in angle brackets are the defect #1456 was filed about**, and
 * the laptop one is the half that is now finished: at 576 a desktop card is
 * DOWNSAMPLED (0.63x) rather than blown up, which is the same relationship the
 * strip has always had. The phone is halved rather than fixed — see the
 * remainder below.
 *
 * # ⚠ THIS CONSTANT SETS THE PHONE CARD'S WIDTH, SO WIDENING IT MOVES THE LAYOUT
 *
 * `.dpc-castcard` is a `<button>`, so it shrink-wraps rather than filling its
 * grid track, and its max-content width comes from the picture inside it. On a
 * phone the track is 294-334 CSS px and the card drew at **288** — the small
 * copy's own pixel width — leaving the rest of its track empty, and leaving the
 * cast cards visibly NARROWER than the dashed *New cast member* tile above
 * them, which is a plain `<div>` and does stretch.
 *
 * ⚠ **So the widen moves the layout, it was looked at before it shipped, and it
 * moves it toward what the grid always specified**: measured at the same drive,
 * the card goes 290 -> 294 CSS px at a 390px viewport and 290 -> 334 at 430,
 * where it now lines up with the create tile. The ragged right edge was the
 * asset width leaking into the layout, which is the coupling this whole
 * docblock is about; the CSS fix for it is filed on #1456 rather than folded in
 * here, because a card is not the place to also re-lay-out a grid.
 *
 * ⚠ **And the coupling is why the `asks` column moves when this number does.**
 * A wider copy lets the card grow, which asks for more pixels again — 876 at a
 * 390px viewport rather than the 864 it asked at 288. That treadmill stops only
 * when the tile's width stops being a function of its picture.
 *
 * # ⚠ AND THE REMAINDER IS DECLARED RATHER THAN QUIET (the fidelity law)
 *
 * One stored width cannot serve a 72px strip tile and a 294px phone card well
 * at once, and this is the single-class step rather than the finished answer.
 * Per view, at `VIEW_THUMBNAIL_QUALITY`, over six real signed views (32.9 MB of
 * full files):
 *
 *   288px  15.7 KB each   ·  576px  56.0 KB each  ·  864px  120.7 KB each
 *
 * Covering the phone card at DPR 3 at 1:1 means ~1000-1152px, which costs the
 * strip — the consumer that needs 216 — eight to thirteen times its bytes for
 * nothing. **So the strip over-pays 2.7x at 576, and a second size class is the
 * real answer if his eye still reads the phone card as soft.** It is named on
 * #1456 rather than smuggled in here, and the frames his eye closes this on are
 * on that card's PR.
 */
export const VIEW_THUMBNAIL_WIDTH = 576;

/**
 * JPEG quality.
 *
 * ⚠ **Measured at the rendered frames, and the first reading of it was WRONG in
 * the flattering direction.** Looking at the tiles blown up 4x beside the
 * full-size ones, 72 read as softer in hair and skin micro-contrast — so this
 * comment was first written to say that 85 fixed it. Diffing the actual frames
 * says otherwise: against the full-size render, **q72 differs on 1.342% of
 * subpixels (mean delta 2.9/255) and q85 on 1.304% (mean 2.8/255)** — the two
 * are the same distance from the picture. What the eye was seeing at 4x is
 * RESAMPLING, not the encoder: a 288-pixel source downscaled to a 70-pixel tile
 * keeps less high-frequency detail than a 1,696-pixel one, whatever the quality.
 *
 * 85 is kept anyway, and for the honest reason rather than the first one.
 *
 * ⚠ **The four figures below were measured at the 288px this constant's
 * neighbour then was, and #1456 widened it to 576** — so they are the shape of
 * the quality curve, which is what they were taken for, and NOT what a strip
 * costs today. The current cost per width is in
 * {@link VIEW_THUMBNAIL_WIDTH}'s own docblock. Nothing in the reading below
 * turns on the width: it compares four qualities against each other at one
 * width, and the conclusion — the encoder is not the lever — is the same at 576.
 *
 * The whole strip of five on a real signed cast, 2026-09-26:
 *
 *   q72   36.5 KB     q80   46.2 KB     q85   54.2 KB     q90   70.9 KB
 *
 * against **20.51 MB** of full-size files for the same five tiles. 85 costs
 * 17.7 KB more than 72 out of a saving of twenty megabytes and takes the
 * encoder out of the question entirely; 90 costs 16.7 KB more again and the
 * measurement says there is nothing left for it to buy.
 */
export const VIEW_THUMBNAIL_QUALITY = 85;

/**
 * The prefix whose objects carry a small copy.
 *
 * ⚠ **This is a declared, narrow rule rather than "every object".** It is read
 * in three places that must agree — the two mints (`packageOrchestrator.ts` for
 * a rendered view, `signService.ts` for the anchor) and the sweep
 * (`storage.ts`'s `storageDelete`) — and a blanket rule would make every
 * deletion in the product issue a second request for a derivative that does not
 * exist, including the cleanup worker's bulk sweeps.
 *
 * ⚠ **`anchor` IS IN HERE AND IT WAS NOT AT FIRST — the gap was found by
 * looking at a real signed cast rather than at the code.** The strip's FIRST
 * tile is `frontClose`, and its object does not live under `views/` at all: a
 * cast's headshot is a byte-exact copy of the signed candidate and lands at
 * `casting-v2/casts/<op>/anchor/<uuid>.png` (`signService.ts`). A rule written
 * from the rendered views alone left the one tile he looks at most on the
 * full-size file, and every test would still have passed. Read at the dev
 * fixture 2026-09-26: 6 assets on a signed cast, 5 under `views/` and the
 * headshot under `anchor/`.
 */
const VIEW_KEY_PATTERN = /^casting-v2\/casts\/[^/]+\/(views|anchor)\/[^/]+$/;

/**
 * Append the suffix, once.
 *
 * ⚠ **It refuses to stack.** Handed a key that already carries the suffix it
 * returns it unchanged, so a sweep deriving from a derivative cannot walk off
 * into `x.thumb.jpg.thumb.jpg` — the shape that turns a best-effort cleanup
 * into an unbounded one.
 */
export function withViewThumbnailSuffix(value: string): string {
  return value.endsWith(VIEW_THUMBNAIL_SUFFIX) ? value : `${value}${VIEW_THUMBNAIL_SUFFIX}`;
}

/** True when this key names a signed cast's view — the objects that carry a
 *  small copy. A derivative itself answers false, so a sweep cannot recurse. */
export function isViewThumbnailBearingKey(key: string): boolean {
  return !key.endsWith(VIEW_THUMBNAIL_SUFFIX) && VIEW_KEY_PATTERN.test(key.replace(/^\/+/, ""));
}

/**
 * THE SMALL COPY'S URL FOR A PICTURE THAT HAS ONE — and the picture's own URL
 * for every other kind.
 *
 * # Why the question has to be asked, when the strip never asked it
 *
 * The strip (#1389) only ever draws a signed cast's views, so it could append
 * the suffix unconditionally and be right every time. The surfaces #1447 moves
 * onto the small copy cannot: the modal shell that draws a cast's portrait also
 * draws a **concept upload's local preview** (a `blob:`/`data:` URL with no
 * object behind it) and an **unsigned candidate's frame** (a key outside the
 * views prefix, so no derivative was ever minted for it). Appending blindly
 * there would ask for an object that cannot exist and pay a 404 per open to
 * learn it.
 *
 * So the predicate that already decides which objects CARRY a small copy
 * decides which URLs may ask for one. One rule, three readers — the mint, the
 * sweep and now the picture — rather than a second list of "surfaces where it is
 * safe" that drifts the first time a surface is added (working law 4).
 *
 * ⚠ **It answers about the URL's PATH, not about the surface asking.** A caller
 * cannot get this wrong by using it on the wrong picture, which is the whole
 * reason it is shaped as a total function over URLs rather than a boolean a call
 * site has to remember to check.
 *
 * ⚠ **The append is deliberately the same append `withViewThumbnailSuffix`
 * performs on a key**, so `server/viewThumbnails.test.ts`'s equality — the URL
 * of the derived key IS the derived URL of the key — still holds through this
 * door. These URLs are `R2_PUBLIC_URL` + key and carry no query string; a URL
 * that did would break here exactly as it already breaks in the strip, so this
 * introduces no case that did not exist.
 */
export function viewSmallCopyUrl(url: string): string {
  return namesAViewObject(url) ? withViewThumbnailSuffix(url) : url;
}

/**
 * Does this URL address one of the objects that carries a small copy?
 *
 * The key is the URL's PATH. `new URL` is used rather than a substring search
 * because a `data:`/`blob:` preview must answer false rather than accidentally
 * matching on its payload, and a bare key (no origin) must still answer for
 * itself — which is why an unparseable value falls back to the string.
 */
function namesAViewObject(url: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* Not absolute — treat the value as the key it appears to be. */
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    /* A malformed escape is not a view key; leave it as it came. */
  }
  return isViewThumbnailBearingKey(path);
}
