/**
 * THE NEW COMPOSITOR — and the honest name for it is that there is no compositor.
 *
 * D-241 retires the paste-back entirely. The old path rendered a region and
 * pasted the delivered pixels onto the master with a blended join; this one
 * **repaints the whole frame** from the pristine master plus a cropped
 * reference of every delivered feature, one generation deep, forever. Masks
 * scope the CROP and the VERIFICATION. Nothing is pasted back as delivery.
 *
 * So this module is thin on purpose, and its thinness is the design: it takes an
 * assembled recipe, fetches the exact bytes each reference names, dispatches ONE
 * paint, and hands back what came out. **The frame the engine returned is the
 * delivered frame** — there is no seam to blend, no boundary to measure, no
 * composite fault to refuse on, because nothing is cut in.
 *
 * # What it proves at the wire
 *
 * A contract about what gets sent is proven on the outgoing request, not on a
 * constant near it (working law 5). Two things are therefore checked here
 * rather than trusted:
 *
 *  - **The array that goes out is the recipe's array, in the recipe's order.**
 *    "Reference 3 is her hair" is a claim about position 3 of `image_urls`. The
 *    assembler builds the sentence and the array in one pass; this module is
 *    the last place they could come apart, so it does not rebuild either.
 *  - **A carried crop rides byte-identical.** *"Her earrings did not move when I
 *    changed her hair"* is true only if the bytes that ride are the bytes that
 *    were minted. When a reference names its digest, the loaded bytes are hashed
 *    and a mismatch REFUSES the render rather than painting from something the
 *    library did not mint.
 *
 * # The degenerate case is the most-travelled road
 *
 * A cast with no library and a words-only ask sends the master alone plus the
 * words (fable-171's condition 1). It is not special-cased here or in the
 * assembler: it is what the general path does when the library is empty, and it
 * is the first fixture in the test file for that reason.
 *
 * Nothing calls this yet. It lands dark by having no call site.
 */
import { createHash } from "node:crypto";

import type { ImageResult } from "../providers/types";

import type { Recipe, ReferenceImage } from "./recipeAssembler";

/** Bytes for one reference. Injected, so the fixture path never touches R2. */
export type ReferenceLoader = (image: ReferenceImage) => Promise<ReferenceBytes>;

export type ReferenceBytes = {
  bytes: Buffer;
  contentType: string;
};

/**
 * The one capability this needs, named as a capability rather than as a vendor
 * (`providers/types.ts` rule 1). `createFalMaskedEditEngine` satisfies it.
 */
export type RepaintEngine = {
  readonly id: string;
  edit(request: {
    prompt: string;
    references: readonly ReferenceBytes[];
    width: number;
    height: number;
    signal?: AbortSignal;
  }): Promise<ImageResult>;
};

export type RepaintInput = {
  recipe: Recipe;
  engine: RepaintEngine;
  load: ReferenceLoader;
  /** The master's exact pixels. The repaint returns a frame of the same size. */
  width: number;
  height: number;
  signal?: AbortSignal;
  /**
   * CALLED WITH THE REQUEST AT THE MOMENT IT GOES OUT, AND BEFORE IT DOES.
   *
   * `sent` is returned to the caller on success, which is the record of every
   * render that LANDED — and therefore of no render that failed. The five-ask
   * proof met that hole from the wrong side: two refused renders left no account
   * of what they had sent, and those were precisely the two anybody would want
   * to inspect. A hook here is the only place the true sent request exists
   * before the outcome is known: the bytes are loaded, the digests are taken,
   * and the engine has not been asked yet.
   *
   * It is awaited, so a caller can persist. A throw from it aborts the render
   * rather than being swallowed — a record we could not write is a render we
   * should not be able to deny making.
   */
  onDispatch?: (sent: SentRequest) => void | Promise<void>;
};

/**
 * Exactly what went out, kept for the record.
 *
 * The evidence pack, the verification stage and any later dispute all ask the
 * same question — *what did we actually send?* — and answering it from a
 * reconstruction is how a report becomes a claim instead of a fact.
 */
export type SentRequest = {
  prompt: string;
  /** In send order, element 0 the master. */
  keys: readonly string[];
  /** Digest of the bytes actually dispatched, in the same order. */
  digests: readonly string[];
  engineId: string;
};

export type RepaintDelivery = {
  ok: true;
  /** The engine's own frame, untouched. Nothing is composited into it. */
  frame: ImageResult;
  sent: SentRequest;
};

export type RepaintRefusal = {
  ok: false;
  reason: "referenceBytesChanged" | "referenceMissing";
  key: string;
  detail: string;
};

export type RepaintResult = RepaintDelivery | RepaintRefusal;

const digestOf = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

/**
 * A recorded digest may be a prefix — the library stores a short form for
 * reading, and a short form still proves the bytes did not change.
 */
function digestMatches(recorded: string, actual: string): boolean {
  const normalized = recorded.trim().toLowerCase();
  return normalized.length > 0 && actual.startsWith(normalized);
}

export async function repaint(input: RepaintInput): Promise<RepaintResult> {
  const loaded: ReferenceBytes[] = [];
  const keys: string[] = [];
  const digests: string[] = [];

  for (const reference of input.recipe.references) {
    let bytes: ReferenceBytes;
    try {
      bytes = await input.load(reference.image);
    } catch (cause) {
      /*
        A reference the library named and storage cannot produce is not a
        degraded render to paint anyway — it is a feature about to be silently
        forgotten, which is the whole class D-244 exists to close.
      */
      return {
        ok: false, reason: "referenceMissing", key: reference.image.key,
        detail: `${reference.image.key} could not be loaded: ${(cause as Error)?.message ?? "unknown"}`,
      };
    }
    const digest = digestOf(bytes.bytes);
    if (reference.image.sha !== undefined && !digestMatches(reference.image.sha, digest)) {
      /*
        The pixel-frozen promise, checked rather than assumed. A carried crop
        whose bytes moved means the library's mint and the object in storage
        have diverged, and painting from the newer one would quietly redraw a
        feature this render promised not to touch.
      */
      return {
        ok: false, reason: "referenceBytesChanged", key: reference.image.key,
        detail: `${reference.image.key} was minted as ${reference.image.sha} and loaded as ${digest.slice(0, 12)}`,
      };
    }
    loaded.push(bytes);
    keys.push(reference.image.key);
    digests.push(digest);
  }

  const sent: SentRequest = {
    prompt: input.recipe.prompt, keys, digests, engineId: input.engine.id,
  };
  await input.onDispatch?.(sent);

  const frame = await input.engine.edit({
    /*
      The recipe's own prompt and the recipe's own order. Rebuilding either
      here would be the second list, and its drift is invisible in every output
      except the picture.

      Read off `sent` rather than off the recipe a second time (fable-320 §4):
      that object is what the dispatch record is written from, so the string
      that is RECORDED and the string that is SENT are now one read of one
      field. Two reads would be a second list of exactly the kind this comment
      warns about, one line down from it.
    */
    prompt: sent.prompt,
    references: loaded,
    width: input.width,
    height: input.height,
    signal: input.signal,
  });

  /* The same object the hook was handed — one record, two readers, so the
     landing cannot describe a different request from the one it announced. */
  return { ok: true, frame, sent };
}
