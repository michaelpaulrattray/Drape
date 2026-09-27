import { useState } from "react";
import { viewSmallCopyUrl } from "@shared/viewThumbnails";

/**
 * A PICTURE DRAWN FROM ITS SMALL COPY, WITH THE FULL ONE AS ITS FALLBACK
 * (#1389's component, promoted by #1447).
 *
 * # Why it is here rather than in casting
 *
 * It was `ThumbnailImage`, private to the signed cast's thumbnail strip
 * (`features/casting/.../ViewTabs.tsx`). #1447 found the same defect one door
 * earlier — the casting home grid drawing every cast card from the full-size
 * front picture, 5.8 MB each today and 19.0 MB once #1373's 4K tier lands — and
 * the surfaces that need it now are the roster card, the rename dialog's thumb
 * and the modal shell's portrait, none of which is casting's to import from.
 *
 * Four real consumers on the day it moves, which is what
 * `PROMOTION-PASS.md` asks of a foundation addition: two or more promotes, one
 * stays. It is **renamed on the way in** (the pass's rule) because "thumbnail"
 * says a size and this says a thing — the small copy, which is the vocabulary
 * `shared/viewThumbnails.ts` already uses.
 *
 * # ⚠ THE FALLBACK IS THE WHOLE DESIGN, NOT A SAFETY NET
 *
 * The small copy lives at a DERIVED key rather than a recorded one, so nothing
 * in any response says whether it exists — and for a cast signed before #1389
 * it does not. Asking and falling back is what makes those casts keep working
 * with no backfill, no migration and no column; the cost is one 404 per picture,
 * once, against the megabytes it is avoiding.
 *
 * # ⚠ IT IS SAFE ON A PICTURE THAT HAS NO SMALL COPY
 *
 * `viewSmallCopyUrl` asks the shared predicate about the URL's path, so a
 * concept upload's local preview and an unsigned candidate's frame are handed
 * straight through and never pay a 404. That is what lets the modal shell use
 * this for all three of the pictures it draws rather than growing a flag its
 * call sites have to remember.
 *
 * # ⚠ `key` AT THE CALL SITE IS LOAD-BEARING
 *
 * `useState` initialised from a prop does not re-read it, so a picture that had
 * fallen back to the full file would stay fallen back for a brand-new object
 * that has a perfectly good small copy — permanently, and invisibly. A caller
 * whose URL can change (the strip, after a view is refreshed) passes
 * `key={url}`; remounting is what resets the question.
 */
export function SmallCopyImage({
  fullSrc,
  alt = "",
  className,
  style,
  loading,
  draggable,
}: {
  fullSrc: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  draggable?: boolean;
}) {
  const [src, setSrc] = useState(() => viewSmallCopyUrl(fullSrc));
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      draggable={draggable}
      decoding="async"
      onError={() => setSrc(fullSrc)}
    />
  );
}
