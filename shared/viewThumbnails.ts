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
 * full object is. A view is minted as PNG; a 288px PNG of a photograph is
 * several times a JPEG of the same picture for no visible gain at this size.
 */
export const VIEW_THUMBNAIL_SUFFIX = ".thumb.jpg";

/**
 * How wide the small copy is rendered.
 *
 * The strip draws at 72 CSS pixels wide (`ViewTabs.tsx`), so 288 is four times
 * that — every device pixel ratio in use, with headroom. Height is not
 * constrained: the full object's aspect is preserved and `object-cover` does
 * the cropping it already did.
 *
 * ⚠ **Wider is not the lever and was measured before being ruled out.** 432px
 * at the same quality costs 103.3 KB against 288's 54.2 KB for a strip, and
 * buys nothing: a 72px box at device-pixel-ratio 4 asks for 288 device pixels,
 * and no display asks for more. Softness at this size comes from the encoder,
 * which is what `VIEW_THUMBNAIL_QUALITY` answers.
 */
export const VIEW_THUMBNAIL_WIDTH = 288;

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
 * 85 is kept anyway, and for the honest reason rather than the first one. The
 * whole strip of five on a real signed cast, 2026-09-26:
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
