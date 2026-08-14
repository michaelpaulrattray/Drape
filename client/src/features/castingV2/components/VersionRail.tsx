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
import { useState } from "react";

import { CardMenu } from "./CardMenu";
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

/**
 * WOULD TAKING THIS CHIP'S STEP BACK BE FREE?
 *
 * The service's own rule, read from the list the rail already has: a removal
 * whose surviving chain matches a version that already exists is a SELECTION
 * (free), and anything else is a new combination and therefore a paid render
 * (D-121). Compared as sentences in order, which is how the service compares
 * them too.
 */
function stepBackIsFree(
  all: readonly RailVariant[],
  step: RailVariant,
  selectedStack: readonly string[] = [],
): boolean {
  /* The same rule the click uses: the step comes out of the chain she is
     looking at when that chain still contains it, so the survivor is the
     selection MINUS this step rather than this version minus its own. */
  const here = selectedStack.indexOf(step.instructions.at(-1) ?? "");
  const inSelection = here !== -1
    && step.instructions.every((line, at) => selectedStack[at] === line);
  const surviving = inSelection
    ? selectedStack.filter((_, at) => at !== here)
    : step.instructions.slice(0, -1);
  /* Nothing left means the ORIGINAL, which always exists. */
  if (surviving.length === 0) return true;
  return all.some((other) => other.variantId !== step.variantId
    && other.instructions.length === surviving.length
    && other.instructions.every((line, at) => line === surviving[at]));
}

export function VersionRail({
  variants,
  pending,
  selectedVariantId,
  originalImageUrl,
  originalThumbUrl,
  onSelect,
  onRemoveStep,
  removePriceCredits,
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
  /**
   * TAKE THIS STEP BACK — absent where the road cannot do it (V3(c)).
   *
   * D-155 put remove on the chips carrying its price, and the rail's own note
   * said the affordance must arrive WITH the action it opens. It does now. It
   * is a prop rather than a flag read in here because whether a prune can
   * happen is the sheet's knowledge, not the rail's — and an item that always
   * refuses is the dead control `CardMenu` already forbids.
   */
  onRemoveStep?: (step: { variantId: string; at: number; instruction: string }) => void;
  /** What a removal costs, from the server's own config — never typed here. */
  removePriceCredits?: number;
  layout: "column" | "row";
}) {
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  /* The chain she is looking at — the one a step is taken OUT of. */
  const selectedStack = variants.find((one) => one.variantId === selectedVariantId)?.instructions ?? [];
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
        <div className="dpc-refine__step dpc-menuhost" key={variant.variantId}>
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
            REMOVE'S HOME, BUILT (D-121, D-155, and the rail's own note).

            The step this chip stands for is the LAST of its own instruction
            list, and its index is therefore one before the length — the same
            arithmetic the label above uses, from the same list, so the sentence
            she reads and the step the server prunes cannot come apart.

            Backing up stays the chip itself: free navigation between pictures
            that already exist. Removing is in the menu, priced. Two different
            things, two different controls (D-155).
          */}
          {onRemoveStep && variant.instructions.length > 0 ? (
            <CardMenu
              label={variant.instructions.at(-1) ?? "this step"}
              open={menuOpenFor === variant.variantId}
              onToggle={() => setMenuOpenFor(
                menuOpenFor === variant.variantId ? null : variant.variantId,
              )}
              onCancel={() => setMenuOpenFor(null)}
              items={[{
                label: "Take this step back",
                danger: true,
                /*
                  THE PRICE IS DERIVED, NOT ASSUMED — D-121's own distinction,
                  said before the click.

                  Taking a step back is a paid re-render because a new
                  combination is a new generation — UNLESS what is left is a
                  version she already has, in which case the service moves her
                  selection and charges nothing. The client can tell which:
                  the chain without this step either matches a version in this
                  list or it does not.

                  Driven, and it is why this is here: the first run of the chip
                  said "25 credits" and the removal came back "that takes it
                  back to the original — nothing charged". A price promised
                  before a click that does not happen is the prices law broken
                  in the direction people forgive and nobody should.
                */
                meta: stepBackIsFree(variants, variant, selectedStack)
                  ? "free · you already have that version"
                  : removePriceCredits
                    ? `${removePriceCredits} credits · a new render without it`
                    : undefined,
                onSelect: () => {
                  setMenuOpenFor(null);
                  /*
                    THE STEP IS TAKEN OUT OF THE CHAIN SHE IS LOOKING AT, so the
                    steps AFTER it survive.

                    Every chip is a version, and a version's own chain ends with
                    the step the chip names. Sending "the last step of THIS
                    version" would take her back to that version minus its step
                    and silently drop everything she did afterwards — a
                    different thing from what a column of chips invites, which
                    is *take that one out and keep the rest*. So the index sent
                    is the step's place in the SELECTED chain when the selection
                    still contains it, and the chip's own version otherwise
                    (which is what backing up to an older branch means).

                    The service was measured on exactly this shape: a prune with
                    a later step standing on top of it, the later step surviving
                    (the mid-chain arm).
                  */
                  const here = selectedStack.indexOf(variant.instructions.at(-1)!);
                  const inSelection = here !== -1
                    && variant.instructions.every((line, at) => selectedStack[at] === line);
                  onRemoveStep(inSelection
                    ? {
                      variantId: selectedVariantId ?? variant.variantId,
                      at: here,
                      instruction: variant.instructions.at(-1)!,
                    }
                    : {
                      variantId: variant.variantId,
                      at: variant.instructions.length - 1,
                      instruction: variant.instructions.at(-1)!,
                    });
                },
              }]}
            />
          ) : null}
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
