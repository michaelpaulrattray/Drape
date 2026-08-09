import { useState } from "react";

import { Button } from "@/foundation";
import { SegmentsOnFace, type FaceRow } from "./SegmentsOnFace";

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
  /**
   * Where each instruction was FILED — subject headings only (D-149, as amended
   * by D-162).
   *
   * It shipped printed under every chip and the founder's own reaction settled
   * it: filing is the SYSTEM explaining itself, and a permanent row of
   * "HAIR COLOUR · HAIR WORN" under someone's own sentence competes with the
   * sentence for a job nobody does daily. Kept — a misfile corrupts the record
   * and not just one picture, so it has to stay inspectable — but moved to the
   * hover tooltip, where it is there when someone goes looking and absent when
   * they are not.
   */
  filedAs?: string[];
};

/**
 * A refinement that is still running, read from the SERVER (D-161).
 *
 * The panel used to know this only from its own mutation state, so closing the
 * sheet erased it — and the founder, seeing nothing in flight, bought the same
 * edit again. Both renders arrived and both charges stand; the defect was the
 * false belief, so the fix is that the fact outlives the component.
 */
export type PendingRefine = {
  variantId: string;
  instruction: string;
  startedAt: string | Date;
  /**
   * How far along it is, from the row rather than from a guess (D-169).
   *
   * Two states and no third: `queued` is claimed-not-yet-sent, `dispatched` is
   * the image model has it. After that there is silence until the picture
   * lands, which is the whole reason this surface shows no percentage.
   */
  stage?: "queued" | "dispatched";
};

/**
 * A question the panel is waiting on an answer to (D-178/179/180).
 *
 * The chips are the fast path and never the only one: each carries the exact
 * label the server resolves, so tapping one and typing it are the same request.
 */
export type RefineReask = {
  question: string;
  options: ReadonlyArray<{ label: string; resolves: string }>;
};

/**
 * When a wait stops being ordinary and starts needing a sentence.
 *
 * The roll's own number, and the same reasoning: past this point the honest
 * thing is to say the wait is long and name the outcome, so it reads as
 * supervised rather than broken.
 */
const LONG_WAIT_MS = 2 * 60 * 1000;

export function RefinePanel({
  variants,
  pending = [],
  selectedVariantId,
  originalImageUrl,
  priceCredits,
  busy,
  onRefine,
  onSelect,
  onRemove,
  outcome,
  reask,
  onDismissOutcome,
  kept = [],
  keptPossessive = "their",
}: {
  variants: readonly RefineVariant[];
  /** Refinements still running, from server truth — survives remount (D-161). */
  pending?: readonly PendingRefine[];
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
  /**
   * The answers to the outstanding question, as chips (D-180).
   *
   * Present only while a question is open. The sentence itself arrives through
   * `outcome`, because a question is an outcome that happens to end in a
   * question mark — same frame, same voice, same dismiss.
   */
  reask?: RefineReask | null;
  onDismissOutcome?: () => void;
  /**
   * What this version is keeping — read-only, and empty until the segment store
   * is armed for this account. Absent or empty renders nothing at all.
   */
  kept?: readonly FaceRow[];
  /**
   * This face's own possessive, from the server — see `SegmentsOnFace`.
   *
   * Defaults to "their", which is the honest word for a face whose record
   * cannot say, and is never seen anyway: with no kept rows the panel does not
   * render at all.
   */
  keptPossessive?: string;
}) {
  const [instruction, setInstruction] = useState("");
  const trimmed = instruction.trim();
  /*
    ARE THEY ABOUT TO BUY THE SAME EDIT TWICE? (D-161)

    This is exactly what happened: a slow "copper hair", a closed sheet, no
    visible pending state, and the founder typed it again. The ghost chip is the
    main fix; this is the one that speaks up at the moment the money would move.
    It WARNS and never blocks — asking for the same thing twice is a legitimate
    thing to want, and a product that refuses it is guessing at intent.
  */
  const duplicateOf = pending.find(
    (entry) => entry.instruction.trim().toLowerCase() === trimmed.toLowerCase() && trimmed,
  );
  return (
    <div className="dpc-refine" onClick={(event) => event.stopPropagation()}>
      {/*
        The stack, oldest first, with the ORIGINAL always at the head. Keeping
        the original addressable is what makes backing out free rather than
        another 25 credits — and D-121 is explicit that the two must not be
        made to look alike.
      */}
      {variants.length > 0 || pending.length > 0 ? (
        <div
          className="dpc-refine__stack"
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
              {originalImageUrl ? <img src={originalImageUrl} alt="" /> : null}
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
                  The whole stack, and WHERE it was filed, on hover (D-162).
                  Filing decides what a Follow inherits, so a misfile corrupts
                  the record and not just one picture — it stays inspectable,
                  and stops competing with the user's own words for the eye.
                */
                title={variant.filedAs?.length
                  ? `${variant.instructions.join(" · ")}\nFiled as: ${variant.filedAs.join(" · ")}`
                  : variant.instructions.join(" · ")}
                onClick={() => onSelect(variant.variantId)}
              >
                {variant.imageUrl ? <img src={variant.imageUrl} alt="" /> : null}
                <span>{variant.instructions.at(-1)}</span>
              </button>
              {/*
                REMOVE'S HOME IS DESIGNED AND NOT YET BUILT (D-162).

                D-121 and D-155 both ruled how removing a mid-stack instruction
                should look, and the founder could not find it in the product
                because it was never implemented — there is no server procedure
                and this handler has never been passed. The affordance belongs
                in the shared `CardMenu`, not in a second hand-rolled menu
                (`cardMenuAnatomy.test` enforces exactly one), and it should
                arrive with the action it opens rather than before it: a visible
                control that does nothing is worse than the one nobody found.
              */}
            </div>
          ))}
          {/*
            THE GHOST CHIPS (D-161) — a refinement that is running, drawn from
            server truth so it survives closing and reopening the sheet. Not
            selectable, because there is nothing yet to select.
          */}
          {pending.map((entry) => (
            <div className="dpc-refine__step" key={entry.variantId}>
              <div className="dpc-refine__pick dpc-refine__pick--ghost" aria-live="polite">
  <div className="dpc-refine__ghost">
                  {/*
                    NOT AN EMPTY SLOT (D-169). It holds the base under the same
                    treatment the picture above is wearing — small and dim — so
                    the stack reads as continuous and the version being made has
                    somewhere it obviously belongs. The word "Refining…" left
                    with the box: the picture is narrating now.
                  */}
                  {originalImageUrl ? <img src={originalImageUrl} alt="" /> : null}
                </div>
                <span>{entry.instruction}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/*
        A LONG WAIT SAYS SO, AND NAMES THE OUTCOME.

        The roll's own law: past about two minutes the honest thing is to admit
        the wait is unusual and say what happens if it never lands, so it reads
        as supervised rather than broken. Credits genuinely do come back.
      */}
      {pending.some((entry) => Date.now() - new Date(entry.startedAt).getTime() > LONG_WAIT_MS) ? (
        <p className="dpc-refine__note">
          This one is taking longer than usual. It'll appear here when it lands, and if it
          doesn't arrive your credits come back on their own.
        </p>
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

      {/*
        THE ANSWERS, AND THEY ARE THE TYPED PATH (D-180).

        A chip submits its own LABEL, which is exactly what someone typing the
        answer would send — so the two routes are one code path on the server
        and neither can drift from the other. The box stays live beside them:
        chips are the fast way to answer, never the only way.
      */}
      {reask && reask.options.length > 0 ? (
        <div className="dpc-refine__answers">
          {reask.options.map((option) => (
            <button
              key={option.label}
              type="button"
              className="dpc-refine__answer"
              disabled={busy}
              onClick={() => onRefine(option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        WHAT SHE IS KEEPING, immediately above the box it writes into (fable-113).

        Placed here rather than beside the stack on purpose: tapping a row
        prefills the ask, so the row and the field it fills are adjacent and the
        cause of the text appearing is visible in one glance.
      */}
      <SegmentsOnFace
        rows={kept}
        possessive={keptPossessive}
        onPrefill={(prefill) => setInstruction(prefill)}
      />

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
      {/* Said BEFORE the money moves, not after — the one moment it helps. */}
      {duplicateOf ? (
        <p className="dpc-refine__note dpc-refine__note--warn">
          You already have this one running. Refining again buys a second version of it.
        </p>
      ) : null}

      {/*
        It says what the box can do BEFORE someone types something it cannot,
        which is worth more than a refusal after the fact — and taking something
        back belongs here, because Remove has no other home (D-163). Undoing is
        free and the line says so, or nobody types it.
      */}
      <p className="dpc-refine__note">
        Anything about them — not their clothes or the room · {priceCredits} credits each
      </p>
      <p className="dpc-refine__note">
        Or take something back — "undo", "remove the earrings" · free when you already have it
      </p>
    </div>
  );
}
