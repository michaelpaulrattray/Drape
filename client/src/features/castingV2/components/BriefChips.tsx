import { trpc } from "@/lib/trpc";

import type { ReimagineState } from "./Reimagine";

/**
 * GENERATED CHIPS — a few directions in the brief's own world, under the box
 * (#535 decision 12; the generator and its guards are
 * `server/castingV2/briefChips.ts`).
 *
 * # What the customer sees
 *
 * Under the sheet's brief box, three or four short phrases in the register
 * their own brief is written in — on an ogre chieftain, *"weathered by a hard
 * country"* rather than the *"slim build"* the old fixed list offered him
 * (his named defect, Crew reply #144). Tap one and the brief comes back with
 * that direction written INTO it, editable, with the same Undo as a press.
 *
 * # The disappearing-technology gate, answered where the control lives
 *
 *   1. **What must they learn?** Nothing. They are short phrases in their own
 *      words' register; tapping one changes their brief in front of them and
 *      Undo puts it back. No axis names, no counts, no vocabulary.
 *   2. **What decision, and on what basis?** *"Do I want this direction?"* —
 *      read in their own register, answered by reading, reversible in one
 *      tap. That is a full basis.
 *   3. **Where does the technology show?** Nowhere by construction: the axis
 *      each chip came from stays inside the instruction, there is no engine
 *      name, no confidence number, and nothing here is a required step —
 *      Cast it and Roll again never consult it.
 *
 * # Nothing is a legitimate answer
 *
 * His own sentence: *"A brief that pins everything shows no taste chips."* So
 * a pinned brief, a refused draft and an outage all draw NOTHING — no empty
 * state, no apology, no skeleton row that promises something is coming. The
 * strip simply is not there, which is also why it never reserves height (a
 * row that appears late would push the dock, and the dock's reachability is
 * D-15's whole subject).
 */

/** Never rendered as a heading — this is the invisible label a screen reader needs for a bare row of buttons. */
export const BRIEF_CHIPS_GROUP_LABEL = "Directions you could take this brief";

/**
 * Whether to spend a house text call at all. A policy function rather than an
 * inline condition so the suite can DRIVE it — this client has no render
 * harness, and a rule that can only be grepped is a rule nobody has tested.
 */
export function chipsAsked(input: { enabled: boolean; briefText: string }): boolean {
  return input.enabled && input.briefText.trim().length > 0;
}

/**
 * The directions to draw — the ONE place "there is nothing to show" is
 * decided, so a pinned brief, a refusal and an outage cannot come to be drawn
 * three different ways.
 */
export function chipsShown(input: { enabled: boolean; chips?: readonly string[] }): string[] {
  if (!input.enabled) return [];
  return (input.chips ?? []).map((chip) => chip.trim()).filter((chip) => chip.length > 0);
}

export function BriefChips({
  /** The brief the SHEET was cast from — not the box's live text (see below). */
  briefText,
  reimagine,
  enabled,
}: {
  briefText: string;
  reimagine: ReimagineState;
  enabled: boolean;
}) {
  /*
    KEYED ON THE ROLL'S OWN BRIEF, NEVER ON THE BOX.

    The box is a live text field; keying the query on it would fire a house
    text call on a keystroke debounce and hand the customer a list that
    twitches while they type. The roll's brief is fixed for the sheet, so the
    directions are the sheet's directions — his "stored on the roll", reached
    by deriving rather than by writing a row (the door's own docblock declares
    that reading).
  */
  const chips = trpc.castingV2.briefChips.useQuery(
    { briefText },
    {
      enabled: chipsAsked({ enabled, briefText }),
      /* House money per miss, and the answer is a function of the brief alone — so a session asks once. */
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  /*
    Nothing while it is being written, and nothing when there is nothing.
    A loading row here would be a promise the empty case cannot keep — and it
    would reserve height that appears late and pushes the dock (D-15).
  */
  const offered = chipsShown({ enabled, chips: chips.data?.chips });
  if (offered.length === 0) return null;

  return (
    <div className="dpc-chips" role="group" aria-label={BRIEF_CHIPS_GROUP_LABEL}>
      {offered.map((chip) => {
        /*
          THE ONE THAT IS ALREADY IN THE BRIEF GOES INERT — driven, not
          designed in the abstract: tapping the same chip twice folds the
          same direction in twice, which reads as the studio not having
          noticed the first one.

          ⚠ **Read off `reimagine.written`, which is the direction actually
          STANDING in the box, and NOT off local state gated on `canUndo`**
          (review of PR #601, finding 1). That first shape marked the chip
          taken on the click and asked a shared undo slot whether it had
          landed, so a tap that FAILED dimmed its chip on the strength of an
          earlier press, and a press after a successful tap left the chip
          dimmed over a direction it had just written over. Both are the
          component promising something the box does not hold.

          Dimmed rather than REMOVED, because removing it reflows the row
          under a finger that is still on it.
        */
        const inert = reimagine.pending || reimagine.written === chip;
        return (
          <button
            key={chip}
            type="button"
            className="dpc-chips__chip"
            /* Dimmed rather than hidden while the studio is writing — the row must not move under a finger mid-tap. */
            aria-disabled={inert ? true : undefined}
            onClick={() => {
              if (inert) return;
              reimagine.tap(chip);
            }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
