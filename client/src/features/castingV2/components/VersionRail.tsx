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
  /**
   * WHAT SHE ASKED FOR, in her own words — the label (founder, 2026-08-15).
   *
   * For an edit it is the last thing in `instructions` and nothing changes. For
   * a REMOVAL they differ: removal deletes steps rather than appending one, so
   * the list ends with the last SURVIVING sentence and the chip read as a
   * duplicate of the version before it. *"When you undo a step it should call
   * itself whatever your prompt was."*
   *
   * Null on every version delivered before the column existed, which is what
   * the fallback is for.
   */
  requestText?: string | null;
  filedAs?: string[];
};

export type RailPending = {
  variantId: string;
  instruction: string;
  /**
   * WHICH VERSION THIS ROW IS REDRAWING (fable-703, founder shot #303).
   *
   * A refine usually adds a version and the ghost chip below stands in for it.
   * A fresh take REPLACES one — same chain, same place — so nothing new is
   * coming and there is nothing for a ghost to stand in for. The founder hit
   * Regenerate and watched the version's own thumbnail sit there in its old
   * render: *"it just stayed the same."*
   *
   * So the wait goes where the change is going: on that chip. Null on an
   * ordinary edit, and that null is what still draws a ghost.
   */
  regenerating?: string | null;
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

  /*
    THE VERSIONS BEING REDRAWN RIGHT NOW (fable-703).

    Server truth, like every other fact about a run in flight (D-161) — the row
    itself says which take it replaces, so this is a lookup rather than a guess
    at which pending sentence matches which chip. A guess is what the whole
    fable-704 class is made of.
  */
  const redrawing = new Set(
    pending.map((entry) => entry.regenerating).filter((id): id is string => Boolean(id)),
  );

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
          /* ITS FRAME TOO, for the same reason the versions carry theirs: "the
             lit chip and the photograph agree" has to be readable on EVERY chip
             or the reading skips the one selection the founder reaches for most
             — a sampler comparing them read `null` here and could not tell a
             legitimate original from a tangle (fable-581 §2). */
          data-frame={originalImageUrl ?? undefined}
          /* And its small copy, because the viewer shows that first and
             sharpens in place — a reader comparing "which version is on screen"
             has to know both spellings of the same picture. */
          data-thumb={originalThumbUrl ?? undefined}
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
            /* The ring says it to the eye; this says the same thing to a screen
               reader, which cannot see a ring. No new words either way. */
            aria-busy={redrawing.has(variant.variantId) || undefined}
            /* WHICH PICTURE THIS CHIP IS — the same URL the viewer draws when
               this version is the selected one. It makes "the lit chip and the
               photograph agree" a readable fact rather than an impression, which
               is what the founder's highlight-lag report needed to be checked
               against (fable-546). */
            data-frame={variant.imageUrl ?? undefined}
            /* And its SMALL COPY, because the viewer shows that first and
               sharpens in place (fable-503): the two are the same version, and
               a reader comparing "which version is on screen" has to know it. */
            data-thumb={variant.thumbUrl ?? undefined}
            /* Their own words are the label — the record read back as theirs. */
            aria-label={variant.requestText ?? variant.instructions.at(-1) ?? `Version ${position + 1}`}
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
            {/*
              AND THE RING, WHILE THIS ONE IS BEING REDRAWN (fable-703).

              The same treatment the founder ruled for the pending chip, on the
              version a fresh take is replacing: one state, one look, whether
              the chip is a version being born or an old one being redone. Over
              the picture rather than instead of it — the render on screen is
              still the render he has, until the new one lands.
            */}
            {redrawing.has(variant.variantId)
              ? <span className="dpc-refine__ghostSpin dpc-refine__ghostSpin--onChip" aria-hidden="true" />
              : null}
            <span>{variant.requestText ?? variant.instructions.at(-1)}</span>
          </button>
          {/*
            NO PER-CHIP ACTIONS — the founder's own ruling (2026-08-15):
            *"why is there a 3 dot menu?… navigating the left strip is the
            version history — you just click between accumulated edits and can
            fork from any you choose."*

            The rail is navigation and forking, nothing else. Taking a step back
            is TYPED, like every other ask ("remove her hair", "undo", "remove
            the earrings"), through the box that already carries the
            free-when-you-already-have-it line. The machinery that serves it
            stays where it belongs — in the service, measured — and this surface
            went back to being one thing.
          */}
        </div>
      ))}
      {/*
        THE GHOST CHIPS (D-161) — a refinement that is running, drawn from server
        truth so it survives closing and reopening the sheet. Not selectable,
        because there is nothing yet to select.
      */}
      {pending.filter((entry) => !entry.regenerating).map((entry) => (
        <div className="dpc-refine__step" key={entry.variantId}>
          {/*
            A GHOST STANDS IN FOR A VERSION THAT IS COMING (fable-703).

            A fresh take is not coming — it is replacing something already here,
            and its wait is drawn on that chip above. Drawing both would be two
            marks for one render, and the ghost would then vanish at landing
            with no new chip appearing where it stood.
          */}
          {/* Their own sentence is the label, and it is not printed: the founder
              on the pending chip (fable-702) — *"just give it a spinning ring
              centered no words why go over the top its meant to be
              minimalist."* Said to a screen reader, which has no ring. */}
          <div
            className="dpc-refine__pick dpc-refine__pick--ghost"
            aria-live="polite"
            aria-label={entry.instruction}
          >
            <div className="dpc-refine__ghost">
              {/*
                NOT AN EMPTY SLOT (D-169). It holds the base under the same
                treatment the picture above is wearing — small and dim — so the
                stack reads as continuous and the version being made has
                somewhere it obviously belongs. The word "Refining…" left with
                the box: the picture is narrating now.
              */}
              {originalImageUrl ? <img src={originalImageUrl} alt="" /> : null}
              {/*
                AND ONE THING THAT MOVES (founder, fable-619 §1): *"the blurred
                ghost chip reads as broken rather than working."* He is right —
                a still, blurred, dimmed photograph is exactly what a failed
                image looks like, and nothing else in the chip says otherwise.
                One quiet monochrome ring, no shimmer and no colour, is the
                smallest thing that turns "broken" into "working".
              */}
              <span className="dpc-refine__ghostSpin" aria-hidden="true" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
