import { useState } from "react";

import { Button } from "@/foundation";

/**
 * Refining one face — the panel under the expanded picture (M8).
 *
 * **It lives in the viewer and nowhere else, on purpose.** Refining is a
 * judgement about ONE face made at a size where a face can actually be judged;
 * a refine control on a 178px tile would be asking people to adjust eyes they
 * cannot see. It is also why the viewer is the only place the stack of
 * variants appears.
 *
 * **The stack is linear, and there is no visualizer.** §14's tree is emergent
 * from prefix-sharing — every row is "this face plus these instructions" — and
 * a graph UI would be a picture of the data model rather than a thing anyone
 * needs. Selecting an earlier version and refining again branches from there;
 * that is the whole interaction.
 *
 * **The price is stated once, quietly, and never on the button** (D-15, D-109).
 * The literal never lives here — it arrives from the server's config, the same
 * way the roll and Sign prices do, so a price change is a deploy rather than a
 * client edit that gets missed.
 */
export type RefineVariant = {
  variantId: string;
  imageUrl: string | null;
  instructions: string[];
  /** Where each instruction was FILED — subject headings only (D-149). */
  filedAs?: string[];
};

export function RefinePanel({
  variants,
  selectedVariantId,
  originalImageUrl,
  priceCredits,
  busy,
  onRefine,
  onSelect,
  onRemove,
  outcome,
  onDismissOutcome,
}: {
  variants: readonly RefineVariant[];
  /** Null means the original is the face. */
  selectedVariantId: string | null;
  originalImageUrl: string | null;
  priceCredits: number;
  /** A refine is in flight — for this face or any other on the sheet. */
  busy: boolean;
  onRefine: (instruction: string) => void;
  onSelect: (variantId: string | null) => void;
  /**
   * Remove one instruction from the middle of the stack — a PAID re-render.
   *
   * D-121 requires that this and backing-up never look alike, and the founder
   * could not find it at all: back-up is free navigation between pictures that
   * already exist, while removing a mid-stack instruction is a new combination
   * and therefore a new generation. Two different things must look like two
   * different things, and the price is what says which is which.
   */
  onRemove?: (variantId: string) => void;
  /**
   * The last failure or refusal, owned BY THIS PANEL (D-154).
   *
   * D-110's own law applied here: a live surface owns its outcomes. The
   * founder's first failed refine arrived as a long unreadable toast and was
   * gone before it could be read — and refusal copy that carefully names its
   * wall is worthless at 2.1 seconds. This stays until dismissed.
   */
  outcome?: string | null;
  onDismissOutcome?: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const trimmed = instruction.trim();

  return (
    <div className="dpc-refine" onClick={(event) => event.stopPropagation()}>
      {/*
        The stack, oldest first, with the ORIGINAL always at the head. Keeping
        the original addressable is what makes backing out free rather than
        another 25 credits — and D-121 is explicit that the two must not be
        made to look alike.
      */}
      {variants.length > 0 ? (
        <div className="dpc-refine__stack" role="group" aria-label="Versions of this face">
          <button
            type="button"
            className="dpc-refine__step"
            aria-pressed={selectedVariantId === null}
            aria-label="The original"
            onClick={() => onSelect(null)}
          >
            {originalImageUrl ? <img src={originalImageUrl} alt="" /> : null}
            <span>Original</span>
          </button>
          {variants.map((variant, position) => (
            <button
              key={variant.variantId}
              type="button"
              className="dpc-refine__step"
              aria-pressed={selectedVariantId === variant.variantId}
              /* Their own words are the label — the record read back as theirs. */
              aria-label={variant.instructions.at(-1) ?? `Version ${position + 1}`}
              title={variant.instructions.join(" · ")}
              onClick={() => onSelect(variant.variantId)}
            >
              {variant.imageUrl ? <img src={variant.imageUrl} alt="" /> : null}
              <span>{variant.instructions.at(-1)}</span>
              {/*
                WHERE it was filed, shown quietly under the words (D-149).
                Filing decides what a Follow inherits, so a misfile corrupts the
                record and not just one picture — which makes it something the
                user has to be able to see before they can correct it.
              */}
              {variant.filedAs?.length ? (
                <span className="dpc-refine__filed">{variant.filedAs.join(" · ")}</span>
              ) : null}
              {/* The PAID sibling of backing up, carrying its price so the two
                  can never be mistaken for one another (D-121). */}
              {onRemove ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="dpc-refine__remove"
                  title={`Remove this instruction and re-render — ${priceCredits} credits`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(variant.variantId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onRemove(variant.variantId);
                  }}
                >
                  Remove · {priceCredits}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {outcome ? (
        <div className="dpc-refine__outcome" role="status">
          <span>{outcome}</span>
          <button
            type="button"
            className="dpc-refine__dismiss"
            aria-label="Dismiss"
            onClick={onDismissOutcome}
          >
            ×
          </button>
        </div>
      ) : null}

      <form
        className="dpc-refine__ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || busy) return;
          onRefine(trimmed);
          setInstruction("");
        }}
      >
        <input
          className="dpc-refine__field"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Change something about them…"
          maxLength={200}
          disabled={busy}
          aria-label="What to change about this person"
        />
        <Button type="submit" size="small" disabled={!trimmed || busy}>
          {busy ? "Refining…" : "Refine"}
        </Button>
      </form>

      {/*
        The quiet meta line. It says what refining can do BEFORE someone types
        something it cannot, which is worth more than a refusal after the fact —
        and it carries the price where a price belongs.
      */}
      <p className="dpc-refine__note">
        Anything about them — not their clothes or the room · {priceCredits} credits each
      </p>
    </div>
  );
}
