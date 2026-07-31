import { create } from "zustand";

/**
 * Ephemeral sheet state — everything the server is not the authority on.
 *
 * The sheet's data comes from the 2.5s `getRoll` poll, which is the truth. This
 * store holds the three things that poll cannot know, and they exist for one
 * reason each:
 *
 *   **`pending`** — candidates with a mutation in flight. A poll response
 *   snapshotted *before* a keep resolves will arrive *after* it, and re-render
 *   the tile in its old state ~2.5s later. The server is race-proof (keep is a
 *   desired-state CAS); the screen is not. Tiles listed here ignore poll data
 *   for their own state until their mutation settles.
 *
 *   **`undoable`** — the id of the last discard. Undo is one step by design
 *   (plan §F), and the affordance holds the id it just discarded rather than
 *   reading it back from a projection, because a discarded candidate is gone
 *   from the projection entirely.
 *
 *   **`unlocked`** — chips the user removed. Rolls are immutable, so removing
 *   a chip cannot edit the sheet in front of them; it can only stop that fact
 *   being pinned on the *next* roll. Keeping this client-side until the next
 *   roll is dispatched is what makes that true rather than merely stated.
 */

export type UnlockableField = "sex" | "ageBand" | "heritage" | "build" | "energy" | "archetype";

type SheetState = {
  pending: Record<string, true>;
  undoable: string | null;
  unlocked: UnlockableField[];
  draftBrief: string;
  /**
   * A roll was dispatched and its rows have not appeared yet.
   *
   * `castingV2.createRoll` does not return until all eight candidates have
   * landed — it awaits the whole roll, which M3 measured at 66–82 seconds. So
   * the sheet is navigated to *while the request is still in flight*, and this
   * flag is how it knows the difference between "eight are coming" and "this
   * sheet has nothing on it". Without it, a session whose roll failed would
   * show eight skeletons forever, which is the most patient possible lie.
   */
  startingRoll: boolean;

  beginMutation: (candidateId: string) => void;
  endMutation: (candidateId: string) => void;
  isPending: (candidateId: string) => boolean;

  setUndoable: (candidateId: string | null) => void;
  unlock: (field: UnlockableField) => void;
  setDraftBrief: (brief: string) => void;
  setStartingRoll: (startingRoll: boolean) => void;
  /**
   * Called when a roll is dispatched. The undo stack clears because the server
   * anchors undo to the active roll — leaving the affordance up would offer a
   * button whose only outcome is a refusal — and the unlocks clear because
   * they have now been spent on the roll being created.
   */
  rollDispatched: () => void;
  reset: () => void;
};

export const useSheetState = create<SheetState>((set, get) => ({
  pending: {},
  undoable: null,
  unlocked: [],
  draftBrief: "",
  startingRoll: false,

  beginMutation: (candidateId) =>
    set((state) => ({ pending: { ...state.pending, [candidateId]: true } })),

  endMutation: (candidateId) =>
    set((state) => {
      const pending = { ...state.pending };
      delete pending[candidateId];
      return { pending };
    }),

  isPending: (candidateId) => Boolean(get().pending[candidateId]),

  setUndoable: (candidateId) => set({ undoable: candidateId }),

  unlock: (field) =>
    set((state) =>
      state.unlocked.includes(field) ? state : { unlocked: [...state.unlocked, field] },
    ),

  setDraftBrief: (draftBrief) => set({ draftBrief }),

  setStartingRoll: (startingRoll) => set({ startingRoll }),

  rollDispatched: () => set({ undoable: null, unlocked: [], pending: {} }),

  reset: () =>
    set({ pending: {}, undoable: null, unlocked: [], draftBrief: "", startingRoll: false }),
}));
