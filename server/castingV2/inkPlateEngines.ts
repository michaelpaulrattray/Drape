/**
 * THE TWO ENGINES A PLATE CAN BE DRAWN BY, behind one small surface — so the
 * mint is written once and the plate court (fable-936 §4) is a parameter rather
 * than a second code path.
 *
 * # Why an adapter at all, when both engines already have one
 *
 * Because they take the same job in two different currencies. GPT Image 2's
 * edit endpoint is told an exact output canvas in pixels and refuses dimensions
 * that are not multiples of 16; Nano Banana Pro is told a RESOLUTION TIER and
 * infers the shape. A mint that spoke both would be an `if` in the middle of the
 * ordering, and the court's verdict would then be a verdict about that `if` as
 * much as about the engines.
 *
 * So the mint knows one verb — `mint` — and the engine's own id is what lands in
 * the plate row's `engine` column. The court's axis is a value, not a branch.
 *
 * # THE CANVAS PROBLEM, MEASURED BEFORE IT WAS PAID FOR
 *
 * The committed templates are:
 *
 * ```
 * assets/ink/arm-{left,right}-template.png      857 x 1200   857 % 16 = 9    REFUSED
 * assets/ink/body-{female,male}-{front,back}-…  1254 x 1254  1254 % 16 = 6   REFUSED
 * ```
 *
 * `createFalMaskedEditEngine` fails BEFORE dispatch on a canvas that is not a
 * multiple of 16, so a mint that simply asked for the template's own size would
 * refuse EVERY plate in the product — and the court would have learned it at
 * its first paid call.
 *
 * **Not one of the six is legal now**, which is a change from the retired set:
 * the old arm sheet was 1536 x 1024 and legal on both edges, so this function
 * used to be exercised by one family and bypassed by the other. The single-view
 * spec ended that, and the "leaves an already legal canvas alone" control moved
 * to a constructed size rather than staying tied to whichever asset happened to
 * be legal that week.
 *
 * It does not touch the founder's artwork: the constraint is on the output size
 * ASKED FOR, not on the picture posted. `legalPlateCanvas` asks for the legal
 * canvas nearest the template's own, so the torso plate comes back the same
 * square his ruling landed on six pixels smaller, and the arm seven pixels
 * wider.
 *
 * # WHY NBP IS ASKED FOR 2K AND NOT 1K
 *
 * They cost the same. `NANO_BANANA_PRO_USD_PER_IMAGE` is $0.15 at both tiers
 * (4K is the only premium), and a plate is minted ONCE and shown to an engine on
 * every later render — so the cheaper-looking tier buys nothing and spends
 * detail the carry never gets back. It is a parameter rather than a constant
 * because the court's other axis is wall-clock, and if 2K is slow enough to hurt
 * the wait the founder named, that is a reading rather than an argument.
 *
 * # THE ENGINE IS RULED: NANO BANANA PRO (founder, fable-963 §2)
 *
 * His word, on the court's own sheet: *"NBP wins"*. The readings behind it,
 * census-measured on two specimens:
 *
 * ```
 *                     specimen A       specimen B
 * Nano Banana Pro     38.3s $0.15      36.8s $0.15     lettering crisp
 * GPT Image 2        125.7s ~$0.20    125.3s ~$0.20    lettering softer
 * ```
 *
 * Three times faster on his own latency-critical requirement, a quarter cheaper,
 * and at least equal by his eye. Both engines held the fence (no person content
 * from a face-bearing photograph) and both kept the design at the named
 * placement.
 *
 * `platesByMaskedEdit` STAYS — it is not dead code and it is not a fallback. It
 * is the other arm of a court that will be re-run whenever either engine moves,
 * and a comparison whose loser has been deleted cannot be re-run at all.
 *
 * # THE ASPECT RATIO IS A PARAMETER, AND IT STARTED AS AN ABSENCE
 *
 * The first cut sent none: nothing in the product had ever set one, and
 * inventing a ratio string nobody had measured the provider accepting would be
 * a guess arriving on a paid call. The court then measured what happens without
 * it — **NBP returned 1696x2528 for a 1536x1024 template**, i.e. it took its
 * shape from the DESIGN photograph rather than from the blank form, letterboxing
 * the plate inside a portrait canvas it invented. GPT Image 2, which is told an
 * exact canvas, returned the template's own 1536x1024 both times.
 *
 * So the ratio is an option a caller may set, defaulted to the absence the court
 * measured, and the plate's ACTUAL dimensions are still read off the result and
 * stored on the row — which is what makes "did the shape survive" a query rather
 * than a memory.
 */
import type { IdentityEngine, ImageResult, ReferenceImage } from "../providers/types";

/** A picture handed to an engine — the template, then the design. */
export type InkPlateReference = ReferenceImage;

export type InkPlateMintRequest = {
  prompt: string;
  /** PICTURE 1: the blank form. */
  template: InkPlateReference;
  /** PICTURE 2: the customer's design. */
  design: InkPlateReference;
  /** The template's own pixels — what a canvas is derived FROM, never asked for
   *  directly. */
  templateWidth: number;
  templateHeight: number;
  signal?: AbortSignal;
};

/**
 * One verb, and an id that is the row's `engine` column.
 *
 * The id comes from the provider adapter rather than from a name this file
 * invents, so a court verdict and an invoice line are about the same string.
 */
export type InkPlateEngine = {
  readonly id: string;
  mint(request: InkPlateMintRequest): Promise<ImageResult>;
};

/** What GPT Image 2's edit endpoint requires of a canvas, quoted from its own
 *  refusal rather than remembered. */
const CANVAS_MULTIPLE = 16;

/**
 * The legal canvas nearest a template's own size.
 *
 * Nearest rather than down: rounding one way on principle would shrink every
 * plate by up to fifteen pixels for no reason, and the templates are nowhere
 * near the endpoint's 3840 maximum edge. A dimension below one multiple becomes
 * one multiple rather than zero, because a zero-pixel canvas is a refusal with a
 * worse sentence than the door's.
 */
export function legalPlateCanvas(input: {
  width: number;
  height: number;
}): { width: number; height: number } {
  const legal = (value: number) => Math.max(
    CANVAS_MULTIPLE,
    Math.round(value / CANVAS_MULTIPLE) * CANVAS_MULTIPLE,
  );
  return { width: legal(input.width), height: legal(input.height) };
}

/**
 * The plate engine backed by an edit endpoint that takes an exact canvas —
 * GPT Image 2 today, through `createFalMaskedEditEngine`.
 *
 * Structurally typed rather than importing the factory's return type, so a test
 * can hand this a two-line double and drive the ordering without a provider, a
 * key or a network.
 */
export function platesByMaskedEdit(engine: {
  readonly id: string;
  edit(request: {
    prompt: string;
    references: readonly InkPlateReference[];
    width: number;
    height: number;
    signal?: AbortSignal;
  }): Promise<ImageResult>;
}): InkPlateEngine {
  return {
    id: engine.id,
    mint(request) {
      const canvas = legalPlateCanvas({
        width: request.templateWidth,
        height: request.templateHeight,
      });
      return engine.edit({
        prompt: request.prompt,
        /* PICTURE 1 then PICTURE 2, in the order the prompt names them. */
        references: [request.template, request.design],
        width: canvas.width,
        height: canvas.height,
        signal: request.signal,
      });
    },
  };
}

/**
 * The plate engine backed by the identity engine — Nano Banana Pro.
 *
 * `editWithReferences` rather than `generateView`: there is no view angle here,
 * and the view verb would fold an angle sentence into a prompt whose every line
 * is load-bearing.
 */
/**
 * THE RULED ENGINE (fable-963 §2). The wiring builds this one.
 *
 * Named as a constant rather than left to each caller to remember, because the
 * next thing to be built is the upload wiring and the ruling has to be where
 * that person will be standing.
 */
export const INK_PLATE_ENGINE = "nanoBananaPro" as const;

export function platesByIdentityEngine(
  engine: Pick<IdentityEngine, "id" | "editWithReferences">,
  options: {
    resolution?: "1K" | "2K";
    /** Sent only when a caller asks for it — see the header's measurement. */
    aspectRatio?: string;
  } = {},
): InkPlateEngine {
  return {
    id: engine.id,
    mint(request) {
      return engine.editWithReferences({
        prompt: request.prompt,
        references: [{ ...request.template }, { ...request.design }],
        resolution: options.resolution ?? "2K",
        ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
        signal: request.signal,
      });
    },
  };
}
