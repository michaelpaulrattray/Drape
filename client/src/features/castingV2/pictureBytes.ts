/**
 * A CHOSEN FILE AS BASE64 — one copy, because two surfaces now send a picture.
 *
 * The makeup read carries its bytes in the request (it looks once and keeps
 * nothing); the attach door carries them to a copy under the Cast's own purge
 * path. Same encoding, same failure, and a second implementation of it would
 * drift on the detail below — which is not obvious and was found the hard way.
 *
 * `FileReader` rather than `arrayBuffer()` + a manual encode: the manual loop
 * blows the stack on a large image through `String.fromCharCode(...bytes)`, and
 * a customer's photograph is exactly the size that finds it.
 */
import { INK_DESIGN_FORMATS, inkDesignContentType } from "@shared/pictureFormats";

/**
 * THE FORMATS A PICKER OFFERS — DERIVED from the door's own vocabulary.
 *
 * The server is the truth, and every door judges the BYTES rather than the
 * filename, so this string is only a courtesy: it spares her choosing a file
 * that will be refused. What it must not be is a second author of the list —
 * the refine panel's attach input and the concept card were each writing the
 * same literal, and a format added server-side would have needed both edited,
 * with the missed one failing SILENTLY (the picker simply filters the file
 * away, and nothing anywhere says why).
 *
 * Until #27 this was a MIRROR and said so: the list lived in a server module
 * the client cannot import, so one copy was the best available. The vocabulary
 * now lives in `shared/pictureFormats.ts` and this composes the `accept`
 * attribute from it — a fourth format reaches both pickers with no client edit
 * at all. `server/clientInputCaps.test.ts` bans re-typing it.
 */
export const ACCEPTED_PICTURE_FILES = INK_DESIGN_FORMATS.map(inkDesignContentType).join(",");

export function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}
