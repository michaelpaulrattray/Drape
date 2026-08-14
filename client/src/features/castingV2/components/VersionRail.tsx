/**
 * THE VERSIONS OF THIS FACE — the stack, extracted so it can stand where the
 * founder put it.
 *
 * His sentence is one ruling with two halves (2026-08-10, via fable-206):
 * *"thumbnails to appear on the LEFT side and the segments to appear on the
 * RIGHT, only the chatbox is at the bottom."* The panel took the right; this is
 * the left. It was a horizontal row under the picture, which is the same silent
 * structural deviation the panel's below-dock was, one size smaller.
 *
 * # It is the same control, moved — not a second one
 *
 * Every rule the stack already carried travels with it and none is restated
 * here: the ORIGINAL stays at the head and stays addressable, because that is
 * what makes backing out free rather than another 25 credits (D-121); a
 * refinement still running shows as a ghost chip drawn from server truth, so it
 * survives closing and reopening the sheet (D-161); the label is their own
 * sentence and the filing is on hover, never printed (D-162).
 *
 * The direction is the only thing that changed, and it is CSS: the rail lays
 * the same steps in a column and scrolls itself when the chain is long.
 */
import { chipSrc } from "../railThumb";

export type RailVariant = {
  variantId: string;
  imageUrl: string | null;
  /** The small copy the rail draws; null on versions delivered before it existed. */
  thumbUrl?: string | null;
  instructions: string[];
  filedAs?: string[];
};

export type RailPending = {
  variantId: string;
  instruction: string;
};

export function VersionRail({
  variants,
  pending,
  selectedVariantId,
  originalImageUrl,
  originalThumbUrl,
  onSelect,
  /** `column` beside the picture, `row` under it — the same steps either way. */
  layout,
}: {
  variants: readonly RailVariant[];
  pending: readonly RailPending[];
  selectedVariantId: string | null;
  originalImageUrl: string | null;
  /** The master's small copy, when it has one. */
  originalThumbUrl?: string | null;
  onSelect: (variantId: string | null) => void;
  layout: "column" | "row";
}) {
  if (variants.length === 0 && pending.length === 0) return null;

  return (
    <div
      className="dpc-refine__stack"
      data-layout={layout}
      role="group"
      aria-label="Versions of this face"
    >
      <div className="dpc-refine__step">
        <button
          type="button"
          className="dpc-refine__pick"
          aria-pressed={selectedVariantId === null}
          aria-label="The original"
          onClick={() => onSelect(null)}
        >
          {chipSrc({ thumbUrl: originalThumbUrl, imageUrl: originalImageUrl })
            ? <img src={chipSrc({ thumbUrl: originalThumbUrl, imageUrl: originalImageUrl })!} alt="" />
            : null}
          <span>Original</span>
        </button>
      </div>
      {variants.map((variant, position) => (
        <div className="dpc-refine__step" key={variant.variantId}>
          <button
            type="button"
            className="dpc-refine__pick"
            aria-pressed={selectedVariantId === variant.variantId}
            /* Their own words are the label — the record read back as theirs. */
            aria-label={variant.instructions.at(-1) ?? `Version ${position + 1}`}
            /*
              The whole stack, and WHERE it was filed, on hover (D-162). Filing
              decides what a Follow inherits, so a misfile corrupts the record
              and not just one picture — it stays inspectable, and stops
              competing with the user's own words for the eye.
            */
            title={variant.filedAs?.length
              ? `${variant.instructions.join(" · ")}\nFiled as: ${variant.filedAs.join(" · ")}`
              : variant.instructions.join(" · ")}
            onClick={() => onSelect(variant.variantId)}
          >
            {/*
              THE SMALL COPY, FALLING BACK TO THE FRAME (fable-503).

              A 90-pixel chip used to download a ~2.6 MB PNG, eight times a
              sheet, because `thumbKey` was a column nothing wrote. Versions
              delivered before that have no thumbnail and must keep drawing —
              the fallback is the arm, not the assumption.
            */}
            {chipSrc(variant) ? <img src={chipSrc(variant)!} alt="" /> : null}
            <span>{variant.instructions.at(-1)}</span>
          </button>
          {/*
            REMOVE'S HOME IS DESIGNED AND NOT YET BUILT (D-162).

            D-121 and D-155 both ruled how removing a mid-stack instruction
            should look, and the founder could not find it in the product because
            it was never implemented — there is no server procedure and the
            handler has never been passed. The affordance belongs in the shared
            `CardMenu`, not in a second hand-rolled menu, and it should arrive
            with the action it opens rather than before it: a visible control
            that does nothing is worse than the one nobody found.
          */}
        </div>
      ))}
      {/*
        THE GHOST CHIPS (D-161) — a refinement that is running, drawn from server
        truth so it survives closing and reopening the sheet. Not selectable,
        because there is nothing yet to select.
      */}
      {pending.map((entry) => (
        <div className="dpc-refine__step" key={entry.variantId}>
          <div className="dpc-refine__pick dpc-refine__pick--ghost" aria-live="polite">
            <div className="dpc-refine__ghost">
              {/*
                NOT AN EMPTY SLOT (D-169). It holds the base under the same
                treatment the picture above is wearing — small and dim — so the
                stack reads as continuous and the version being made has
                somewhere it obviously belongs. The word "Refining…" left with
                the box: the picture is narrating now.
              */}
              {originalImageUrl ? <img src={originalImageUrl} alt="" /> : null}
            </div>
            <span>{entry.instruction}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
