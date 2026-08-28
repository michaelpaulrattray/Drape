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
import {
  INK_DESIGN_FORMATS,
  inkDesignContentType,
  type InkDesignFormat,
} from "@shared/pictureFormats";

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

/**
 * THE ONE PLACE A CHOSEN OR DROPPED FILE IS JUDGED (#196, amendment 2).
 *
 * The concept upload now has THREE entrances — the card's drop target, the
 * modal's drop zone, and the modal's file picker — and three copies of "is this
 * a picture?" is working law 4 with a UI accent: the copy that drifts is the one
 * that silently refuses a customer's photograph, and nothing anywhere says why.
 *
 * ⚠ **AN UNKNOWN TYPE IS ACCEPTED, NOT REFUSED, and that is deliberate.** This
 * check is a COURTESY — every door judges the BYTES (`pictureBytes` is only the
 * carriage), and the describer's own refusal is written for a reader. A drop
 * can arrive with an empty `file.type` (the OS told the browser nothing), and a
 * client-side guess that turns away a valid PNG is strictly worse than passing
 * it to a door that will read it properly and say something true. So the only
 * thing refused here is a file that positively declares itself something else —
 * a PDF, a text file, a video — which is the case worth catching before a
 * multi-megabyte encode.
 *
 * Extensions are deliberately NOT consulted: `jpg` is not derivable from
 * `INK_DESIGN_FORMATS` and inventing that alias here would be a second
 * vocabulary, which is the thing this module exists to avoid.
 */
export function firstPictureFrom(files: FileList | null | undefined): File | null {
  const file = files?.[0];
  if (!file) return null;
  if (!file.type) return file;
  return (INK_DESIGN_FORMATS as readonly string[])
    .map((format) => inkDesignContentType(format as InkDesignFormat))
    .includes(file.type)
    ? file
    : null;
}
