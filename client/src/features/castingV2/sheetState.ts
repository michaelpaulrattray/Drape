import { create } from "zustand";

import type {
  AgeBand,
  AgePhase,
  Build,
  EnergyKey,
  Heritage,
  LookKey,
  Sex,
} from "@shared/castingVocabularies";

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

/**
 * What went wrong, in the terms the copy needs. A refusal is about the brief
 * and is always free; the others are about the system.
 */
export type DispatchFailureKind = "refused" | "credits" | "busy" | "unavailable";

export type UnlockableField = "sex" | "ageBand" | "heritage" | "build" | "energy" | "archetype";
/*
  Typed against the shared vocabularies rather than as `string`.

  A loose `Record<field, string>` compiles happily and then posts a value the
  server's strict enum refuses — a paid action failing validation after the
  click. The types are the check that the popover can only offer what the roll
  can accept.
*/
export type LockOverrides = {
  sex?: Sex;
  ageBand?: AgeBand;
  agePhase?: AgePhase;
  heritage?: Heritage;
  build?: Build;
  energy?: EnergyKey;
  look?: LookKey;
};
export type OverridableField = keyof LockOverrides;

type SheetState = {
  pending: Record<string, true>;
  undoable: string | null;
  unlocked: UnlockableField[];
  /**
   * Facts the user set by hand in the brief echo.
   *
   * These do NOT clear when a roll is dispatched, and that asymmetry with
   * `unlocked` is the founder's ratified precedence law rather than an
   * oversight. Unpinning is a one-shot request for variety on the next roll;
   * setting a value is a standing correction. A roll re-reads the brief every
   * time, so an override that cleared on dispatch would be silently re-derived
   * away by the interpreter on the roll after it — the adjustment would not be
   * refused, it would just evaporate.
   */
  overrides: LockOverrides;
  /**
   * The roll the user just paid for, before the server has confirmed it exists.
   *
   * D-38 applied to the CHROME, not only to the tiles. The tiles went optimistic
   * on the click and everything around them waited for the poll: the counter
   * still read the old roll, the rail grew no pill, the eyebrow stayed in its
   * resting state. One click produced two visible moments about 2.5 seconds
   * apart, which reads as a stutter rather than a response.
   *
   * Everything here is knowable in the click frame — the next index is the
   * count plus one — so it is one optimistic transaction, unwound by the same
   * classified-failure contract that unwinds the tiles.
   */
  provisionalRollIndex: number | null;
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

  /**
   * Why the last dispatch failed, if it did.
   *
   * This lives in the store rather than in a component because of the defect
   * it exists to fix: the tab fires the roll and navigates away in the same
   * tick, and React Query does NOT invoke `mutate`'s callbacks once the
   * component that called it has unmounted. So `onError` never ran, the
   * pending flag never cleared, and a server-side refusal rendered as eight
   * skeletons that waited forever. The store outlives the navigation; the
   * sheet reads this and says what happened.
   */
  dispatchFailure: { kind: DispatchFailureKind; message: string } | null;

  beginMutation: (candidateId: string) => void;
  endMutation: (candidateId: string) => void;
  isPending: (candidateId: string) => boolean;

  /**
   * Optimistic keep/discard (D-38).
   *
   * The buttons already disabled within a frame, but the *visible* result —
   * the accent ring, the card leaving — waited on the round trip plus a
   * refetch. Free actions should feel free. These hold the intended state
   * until the poll catches up, and are dropped if the mutation fails, so the
   * screen never claims something the server refused.
   */
  optimisticKept: Record<string, boolean>;
  optimisticDiscarded: Record<string, true>;
  setOptimisticKept: (candidateId: string, kept: boolean) => void;
  setOptimisticDiscarded: (candidateId: string) => void;
  clearOptimistic: (candidateId: string) => void;

  setUndoable: (candidateId: string | null) => void;
  unlock: (field: UnlockableField) => void;
  beginProvisionalRoll: (index: number) => void;
  setOverride: <F extends OverridableField>(field: F, value: NonNullable<LockOverrides[F]>) => void;
  setDraftBrief: (brief: string) => void;
  setStartingRoll: (startingRoll: boolean) => void;
  setDispatchFailure: (failure: { kind: DispatchFailureKind; message: string } | null) => void;
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
  overrides: {},
  provisionalRollIndex: null,
  draftBrief: "",
  startingRoll: false,
  dispatchFailure: null,

  beginMutation: (candidateId) =>
    set((state) => ({ pending: { ...state.pending, [candidateId]: true } })),

  endMutation: (candidateId) =>
    set((state) => {
      const pending = { ...state.pending };
      delete pending[candidateId];
      return { pending };
    }),

  isPending: (candidateId) => Boolean(get().pending[candidateId]),

  optimisticKept: {},
  optimisticDiscarded: {},

  setOptimisticKept: (candidateId, kept) =>
    set((state) => ({ optimisticKept: { ...state.optimisticKept, [candidateId]: kept } })),

  setOptimisticDiscarded: (candidateId) =>
    set((state) => ({
      optimisticDiscarded: { ...state.optimisticDiscarded, [candidateId]: true as const },
    })),

  clearOptimistic: (candidateId) =>
    set((state) => {
      const optimisticKept = { ...state.optimisticKept };
      const optimisticDiscarded = { ...state.optimisticDiscarded };
      delete optimisticKept[candidateId];
      delete optimisticDiscarded[candidateId];
      return { optimisticKept, optimisticDiscarded };
    }),

  setUndoable: (candidateId) => set({ undoable: candidateId }),

  unlock: (field) =>
    set((state) =>
      state.unlocked.includes(field) ? state : { unlocked: [...state.unlocked, field] },
    ),

  setOverride: (field, value) =>
    set((state) => ({
      overrides: { ...state.overrides, [field]: value },
      /*
        Setting a value also clears any unpin of the same field. "Let age vary"
        then "no, make it 40s" is one decision changing its mind, and leaving
        both in flight would send the server a contradiction it has to resolve
        by ordering — which works, but relies on the client and server agreeing
        about precedence forever.
      */
      unlocked: state.unlocked.filter((unlockedField) => unlockedField !== field),
    })),

  beginProvisionalRoll: (index) => set({ provisionalRollIndex: index }),

  setDraftBrief: (draftBrief) => set({ draftBrief }),

  setStartingRoll: (startingRoll) => set({ startingRoll }),

  setDispatchFailure: (dispatchFailure) =>
    // A failure ends the pending state by definition — nothing is coming.
    set(dispatchFailure
      ? { dispatchFailure, startingRoll: false, provisionalRollIndex: null }
      : { dispatchFailure: null }),

  rollDispatched: () =>
    set({
      undoable: null,
      // `overrides` is deliberately absent here — see the field's comment.
      unlocked: [],
      pending: {},
      optimisticKept: {},
      optimisticDiscarded: {},
      dispatchFailure: null,
    }),

  reset: () =>
    set({
      pending: {},
      undoable: null,
      unlocked: [],
      // Reset is leaving the sheet entirely, so the standing corrections go too.
      overrides: {},
      provisionalRollIndex: null,
      draftBrief: "",
      startingRoll: false,
      optimisticKept: {},
      optimisticDiscarded: {},
      dispatchFailure: null,
    }),
}));
