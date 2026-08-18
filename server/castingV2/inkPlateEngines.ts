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
 * assets/ink/arm-template.png    1536 x 1024   both multiples of 16   LEGAL
 * assets/ink/body-template.png   1254 x 1254   1254 % 16 = 6          REFUSED
 * ```
 *
 * `createFalMaskedEditEngine` fails BEFORE dispatch on a canvas that is not a
 * multiple of 16, so a mint that simply asked for the template's own size would
 * refuse every neck and upper-chest plate — two placements of three — and the
 * court would have learned it at its first paid call.
 *
 * It does not touch the founder's artwork: the constraint is on the output size
 * ASKED FOR, not on the picture posted. `legalPlateCanvas` asks for the legal
 * canvas nearest the template's own, so the body plate comes back the same
 * square his ruling landed on, six pixels smaller.
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
 * # WHAT IS NOT DECIDED HERE
 *
 * No aspect ratio is sent. Nothing in the product has ever set one, the shape is
 * the posted template's own, and inventing a ratio string this file has not
 * measured the provider accepting would be a guess arriving on a paid call. The
 * plate's ACTUAL dimensions are read off the result and stored on the row, which
 * is what makes "did the shape survive" a query at the court rather than a
 * memory.
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
export function platesByIdentityEngine(
  engine: Pick<IdentityEngine, "id" | "editWithReferences">,
  resolution: "1K" | "2K" = "2K",
): InkPlateEngine {
  return {
    id: engine.id,
    mint(request) {
      return engine.editWithReferences({
        prompt: request.prompt,
        references: [{ ...request.template }, { ...request.design }],
        resolution,
        signal: request.signal,
      });
    },
  };
}
