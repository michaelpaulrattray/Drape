import { useRef, useState } from "react";

import { Icon, P } from "@/foundation/icons";
import { trpc } from "@/lib/trpc";

/**
 * RE-IMAGINE — one quiet glyph on every brief box (#535; the spec is
 * `REIMAGINE_DESIGN_2026-09-06.md` §1, his "build it" 2026-09-06).
 *
 * Press it and the studio takes the words in the box and writes back a new
 * idea born from them — INTO the box, visibly, editable, with one level of
 * Undo. Press again for another idea. Casting always uses whatever is in the
 * box, so this control never touches a roll: it edits text the customer is
 * looking at, and the roll button beside it is still the only priced act.
 *
 * The disappearing-technology gate, answered here where the control lives:
 * nothing to learn (one icon whose hover says what it does, whose result
 * appears in their own box), one decision with a full basis (keep, edit, or
 * Undo — judged by reading their own brief), no technology showing (no engine
 * name, no level, no stage names — a wait is the glyph turning, ~7s typical,
 * measured p50 6.4s in the design report's re-measure).
 *
 * THREE SURFACES, ONE CONTROL: the casting hero, the sheet's dock, the
 * concept-review description box. Each owns its box state, so this is a hook
 * plus two small pieces of JSX rather than a component that would have to
 * reach into three different pages' state.
 *
 * The fold rides the same press (decision 11 + his read-only-sentence
 * ruling): an instruction typed into the box ("make him slim", "50s") is
 * applied by the same author call, in place, before anything rolls — never
 * appended to the sentence's end, which is the shape his ruling forbids.
 * Roll again itself stays pure (his §17: it casts what is in the box).
 */

/** What the quiet line under the box says. One owner, so the wording cannot fork per surface. */
export const REIMAGINED_LINE = "Re-imagined from your words — press again for another idea.";
export const REIMAGINE_UNDO_LABEL = "Undo";
export const NOTHING_TO_OFFER_LINE = "Nothing to offer this time — your words stand.";
/** Decision 17: while a follow chip is up, the press is dimmed with this hover. */
export const REIMAGINE_FOLLOW_HELD_TITLE = "Clear the follow to re-imagine";

export type ReimagineState = {
  /** The glyph is turning — the box should dim and refuse edits for the moment. */
  pending: boolean;
  /** The quiet line to draw under the box, or null. */
  line: "idea" | "nothing" | null;
  canUndo: boolean;
  press: () => void;
  undo: () => void;
  /** Typing clears the line and spends the undo — call from the box's onChange. */
  typed: () => void;
};

export function useReimagine(input: {
  /** What the box says right now. */
  value: string;
  /** Write the idea into the box — the surface's own state setter. */
  onValue: (text: string) => void;
  enabled: boolean;
}): ReimagineState {
  const mutation = trpc.castingV2.reimagine.useMutation();
  const [line, setLine] = useState<"idea" | "nothing" | null>(null);
  /*
    One level of undo, a ref rather than state: it is read only inside
    handlers, and it must be captured at the press — the value the customer
    was looking at — never at the reply, by which time the box already holds
    the idea.
  */
  const prior = useRef<string | null>(null);
  /*
    The press that is in flight, so a stale reply cannot write into a box the
    customer has since edited (the invalidate-cancels-refetch family: the
    reply outlives the click by ~7 measured seconds, plenty of time to type).
  */
  const flight = useRef(0);

  const press = () => {
    if (mutation.isPending || !input.enabled) return;
    const wasAt = ++flight.current;
    const was = input.value;
    mutation.mutate(
      { briefText: was.trim() },
      {
        onSuccess: (outcome) => {
          if (flight.current !== wasAt) return;
          if (outcome.kind === "idea") {
            prior.current = was;
            input.onValue(outcome.text);
            setLine("idea");
          } else {
            setLine("nothing");
          }
        },
        /* An error reads as "nothing to offer" — the customer's next act is identical, and a raw transport sentence teaches them nothing (the honest loader's rule). */
        onError: () => {
          if (flight.current !== wasAt) return;
          setLine("nothing");
        },
      },
    );
  };

  const undo = () => {
    if (prior.current === null) return;
    input.onValue(prior.current);
    prior.current = null;
    setLine(null);
  };

  const typed = () => {
    flight.current += 1;
    prior.current = null;
    if (line !== null) setLine(null);
  };

  return { pending: mutation.isPending, line, canUndo: prior.current !== null, press, undo, typed };
}

/**
 * The glyph itself — a quiet icon action in the house grammar (opacity ~.55,
 * no fill, no border, priced nothing, never a primary). The spiral is the
 * frame he passed with "build it"; it lives in `P.reimagine` beside the rest
 * of the set.
 */
export function ReimagineButton({
  state,
  followHeld,
  className,
}: {
  state: ReimagineState;
  /** Decision 17: a standing follow dims the press — the family holds the look, so there is nothing to re-imagine into it. */
  followHeld?: boolean;
  className?: string;
}) {
  const held = followHeld === true;
  return (
    <button
      type="button"
      className={["dpc-reim__btn", state.pending ? "dpc-reim__btn--turning" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="Re-imagine"
      title={held ? REIMAGINE_FOLLOW_HELD_TITLE : "Re-imagine"}
      aria-disabled={held || state.pending ? true : undefined}
      onClick={() => {
        if (held) return;
        state.press();
      }}
    >
      <Icon d={P.reimagine} size={13} className="dpc-reim__glyph" />
    </button>
  );
}

/** The one quiet line under the box, with Undo where there is something to undo. */
export function ReimagineLine({ state }: { state: ReimagineState }) {
  if (state.line === null) return null;
  return (
    <p className="dpc-reim__line" role="status">
      {state.line === "idea" ? (
        <>
          {REIMAGINED_LINE}
          {state.canUndo ? (
            <button type="button" className="dpc-reim__undo" onClick={state.undo}>
              {REIMAGINE_UNDO_LABEL}
            </button>
          ) : null}
        </>
      ) : (
        NOTHING_TO_OFFER_LINE
      )}
    </p>
  );
}
