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
};

export function RefinePanel({
  variants,
  selectedVariantId,
  originalImageUrl,
  priceCredits,
  busy,
  onRefine,
  onSelect,
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
            </button>
          ))}
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
