import { useMemo } from "react";
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
 * store holds the things that poll cannot know, and they exist for one reason
 * each:
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
 *
 * # EVERY FIELD BELONGS TO ONE SHEET
 *
 * This was one flat singleton, and that was a defect with money attached.
 * Reproduced by the founder: an age adjustment set on one sheet appeared in a
 * DIFFERENT sheet's echo — and a roll fired there would have posted a lock the
 * user never set on that sheet. A paid action carrying foreign state.
 *
 * So the state is a map keyed by session public id and every action is
 * addressed. Two consequences worth stating, because they are the reason this
 * shape rather than a `switchSession()` reset:
 *
 *   1. **The lobby's cross-component handoff survives.** `startingRoll` and
 *      `dispatchFailure` exist because the lobby fires the roll and unmounts in
 *      the same tick — React Query drops a mutation's callbacks once its caller
 *      is gone, so a refusal used to render as eight skeletons waiting forever.
 *      The lobby knows the session id before it dispatches, so its late
 *      callback writes into THAT sheet's slice no matter which sheet the user
 *      is standing on when it resolves. A reset-on-switch would land it on
 *      whatever sheet happened to be open — the same ambient-state bug in new
 *      clothes.
 *   2. **A new sheet is clean by construction**, not by remembering to call
 *      `reset()`. Absence of a slice is the empty state.
 *
 * The standing-corrections law is unchanged and now says what it always meant:
 * an override survives roll dispatch WITHIN its sheet, and never leaves it.
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

/** One sheet's worth of ephemeral state. Nothing here outlives its session. */
export type SheetSlice = {
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
   *
   * "Standing" was always bounded by the sheet. It reaching a different sheet
   * was the bug, not the feature.
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
   */
  provisionalRollIndex: number | null;
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
   * Lives in the store rather than in a component because of the defect it
   * fixes: the tab fires the roll and navigates away in the same tick, and
   * React Query does NOT invoke `mutate`'s callbacks once the component that
   * called it has unmounted. The store outlives the navigation; the sheet reads
   * this and says what happened.
   */
  dispatchFailure: { kind: DispatchFailureKind; message: string } | null;
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
  /**
   * Candidates the user just cancelled, before the poll agrees (D-38).
   *
   * Only ever holds candidates that were still QUEUED at the click. Work
   * already in flight is not cancelled — it lands and refunds on arrival under
   * the generosity rule — so painting it cancelled would be the screen claiming
   * something that is not true.
   */
  optimisticCancelled: Record<string, true>;
  /**
   * The outcome of a cancel, said where the action happened (D-40).
   *
   * A toast was wrong twice over: sonner is global, so a cancel awaited across
   * a navigation delivered its notice onto a different sheet; and the sheet is
   * right there, which is exactly when D-40 says the toast is the fallback
   * rather than the answer.
   */
  cancelNotice: string | null;
  /**
   * The user dismissed the FOLLOWING chip on this sheet.
   *
   * §F: "dismissing only affects future rolls" — existing rolls are immutable
   * versions and the sheet on screen still IS a follow family, so this cannot
   * and must not rewrite anything. It is pre-dispatch intent, exactly the class
   * `overrides` and `unlocked` already occupy, which is why it lives here
   * rather than as a server fact: whether the latest roll is a follow is
   * already server truth (`lineage`), and the only thing the client owns is
   * whether the NEXT one should be.
   */
  followDismissed: boolean;
};

/**
 * A shared empty slice, so a sheet with no state yet subscribes to a STABLE
 * reference. Returning a fresh `{}` from the selector re-renders on every store
 * write and, with an object-returning selector, loops.
 */
const EMPTY_SLICE: SheetSlice = {
  pending: {},
  undoable: null,
  unlocked: [],
  overrides: {},
  provisionalRollIndex: null,
  startingRoll: false,
  dispatchFailure: null,
  optimisticKept: {},
  optimisticDiscarded: {},
  optimisticCancelled: {},
  cancelNotice: null,
  followDismissed: false,
};

type SheetState = {
  sessions: Record<string, SheetSlice>;

  beginMutation: (sessionId: string, candidateId: string) => void;
  endMutation: (sessionId: string, candidateId: string) => void;

  setOptimisticKept: (sessionId: string, candidateId: string, kept: boolean) => void;
  setOptimisticDiscarded: (sessionId: string, candidateId: string) => void;
  setOptimisticCancelled: (sessionId: string, candidateIds: string[]) => void;
  clearOptimistic: (sessionId: string, candidateId: string) => void;

  setUndoable: (sessionId: string, candidateId: string | null) => void;
  unlock: (sessionId: string, field: UnlockableField) => void;
  beginProvisionalRoll: (sessionId: string, index: number) => void;
  clearOverrides: (sessionId: string) => void;
  /** Drop one queued change, keeping whatever the sheet already cast. */
  undoOverride: (sessionId: string, field: OverridableField) => void;
  setOverride: <F extends OverridableField>(
    sessionId: string,
    field: F,
    value: NonNullable<LockOverrides[F]>,
  ) => void;
  setStartingRoll: (sessionId: string, startingRoll: boolean) => void;
  setDispatchFailure: (
    sessionId: string,
    failure: { kind: DispatchFailureKind; message: string } | null,
  ) => void;
  setCancelNotice: (sessionId: string, notice: string | null) => void;
  setFollowDismissed: (sessionId: string, dismissed: boolean) => void;
  /**
   * Called when a roll is dispatched. The undo stack clears because the server
   * anchors undo to the active roll — leaving the affordance up would offer a
   * button whose only outcome is a refusal — and the unlocks clear because
   * they have now been spent on the roll being created.
   */
  rollDispatched: (sessionId: string) => void;
  /** Forget a sheet entirely — on delete or abandon, so the map stays bounded. */
  dropSession: (sessionId: string) => void;
};

/** Write into one sheet's slice, creating it on first touch. */
function patch(
  sessions: Record<string, SheetSlice>,
  sessionId: string,
  change: (slice: SheetSlice) => Partial<SheetSlice>,
): Record<string, SheetSlice> {
  const current = sessions[sessionId] ?? EMPTY_SLICE;
  return { ...sessions, [sessionId]: { ...current, ...change(current) } };
}

export const useSheetState = create<SheetState>((set) => ({
  sessions: {},

  beginMutation: (sessionId, candidateId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => ({
        pending: { ...slice.pending, [candidateId]: true },
      })),
    })),

  endMutation: (sessionId, candidateId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => {
        const pending = { ...slice.pending };
        delete pending[candidateId];
        return { pending };
      }),
    })),

  setOptimisticKept: (sessionId, candidateId, kept) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => ({
        optimisticKept: { ...slice.optimisticKept, [candidateId]: kept },
      })),
    })),

  setOptimisticDiscarded: (sessionId, candidateId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => ({
        optimisticDiscarded: { ...slice.optimisticDiscarded, [candidateId]: true as const },
      })),
    })),

  setOptimisticCancelled: (sessionId, candidateIds) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => {
        const optimisticCancelled = { ...slice.optimisticCancelled };
        for (const id of candidateIds) optimisticCancelled[id] = true as const;
        return { optimisticCancelled };
      }),
    })),

  clearOptimistic: (sessionId, candidateId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => {
        const optimisticKept = { ...slice.optimisticKept };
        const optimisticDiscarded = { ...slice.optimisticDiscarded };
        delete optimisticKept[candidateId];
        delete optimisticDiscarded[candidateId];
        return { optimisticKept, optimisticDiscarded };
      }),
    })),

  setUndoable: (sessionId, candidateId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ undoable: candidateId })),
    })),

  unlock: (sessionId, field) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) =>
        slice.unlocked.includes(field) ? {} : { unlocked: [...slice.unlocked, field] },
      ),
    })),

  setOverride: (sessionId, field, value) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => ({
        overrides: { ...slice.overrides, [field]: value },
        /*
          Setting a value also clears any unpin of the same field. "Let age vary"
          then "no, make it 40s" is one decision changing its mind, and leaving
          both in flight would send the server a contradiction it has to resolve
          by ordering — which works, but relies on the client and server agreeing
          about precedence forever.
        */
        unlocked: slice.unlocked.filter((unlockedField) => unlockedField !== field),
      })),
    })),

  beginProvisionalRoll: (sessionId, index) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ provisionalRollIndex: index })),
    })),

  /* Spent when the brief itself is rewritten — see `dispatchRoll`. */
  clearOverrides: (sessionId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ overrides: {} })),
    })),

  undoOverride: (sessionId, field) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, (slice) => {
        const overrides = { ...slice.overrides };
        delete overrides[field];
        return { overrides };
      }),
    })),

  setStartingRoll: (sessionId, startingRoll) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ startingRoll })),
    })),

  setDispatchFailure: (sessionId, dispatchFailure) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () =>
        // A failure ends the pending state by definition — nothing is coming.
        dispatchFailure
          ? { dispatchFailure, startingRoll: false, provisionalRollIndex: null }
          : { dispatchFailure: null },
      ),
    })),

  setCancelNotice: (sessionId, cancelNotice) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ cancelNotice })),
    })),

  setFollowDismissed: (sessionId, followDismissed) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({ followDismissed })),
    })),

  rollDispatched: (sessionId) =>
    set((state) => ({
      sessions: patch(state.sessions, sessionId, () => ({
        undoable: null,
        // `overrides` is deliberately absent here — see the field's comment.
        unlocked: [],
        pending: {},
        optimisticKept: {},
        optimisticDiscarded: {},
        optimisticCancelled: {},
        cancelNotice: null,
        dispatchFailure: null,
        // `followDismissed` is deliberately absent: the chip STANDS across
        // rolls, which is the whole point of §F's standing follow. It is
        // cleared only by the × or by starting a new follow.
      })),
    })),

  dropSession: (sessionId) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return { sessions };
    }),
}));

/**
 * One sheet's state and its actions, pre-addressed to that sheet.
 *
 * The binding is the point: a caller cannot forget to pass the session id,
 * which is the only way this class of bug comes back. Actions are memoized on
 * the id so they keep stable identities across renders.
 */
export function useSheetSession(sessionId: string) {
  const slice = useSheetState((state) => state.sessions[sessionId] ?? EMPTY_SLICE);
  const store = useSheetState;

  const actions = useMemo(() => {
    const state = () => store.getState();
    return {
      isPending: (candidateId: string) =>
        Boolean((store.getState().sessions[sessionId] ?? EMPTY_SLICE).pending[candidateId]),
      beginMutation: (candidateId: string) => state().beginMutation(sessionId, candidateId),
      endMutation: (candidateId: string) => state().endMutation(sessionId, candidateId),
      setOptimisticKept: (candidateId: string, kept: boolean) =>
        state().setOptimisticKept(sessionId, candidateId, kept),
      setOptimisticDiscarded: (candidateId: string) =>
        state().setOptimisticDiscarded(sessionId, candidateId),
      setOptimisticCancelled: (candidateIds: string[]) =>
        state().setOptimisticCancelled(sessionId, candidateIds),
      clearOptimistic: (candidateId: string) => state().clearOptimistic(sessionId, candidateId),
      setUndoable: (candidateId: string | null) => state().setUndoable(sessionId, candidateId),
      unlock: (field: UnlockableField) => state().unlock(sessionId, field),
      beginProvisionalRoll: (index: number) => state().beginProvisionalRoll(sessionId, index),
      clearOverrides: () => state().clearOverrides(sessionId),
      undoOverride: (field: OverridableField) => state().undoOverride(sessionId, field),
      setOverride: <F extends OverridableField>(field: F, value: NonNullable<LockOverrides[F]>) =>
        state().setOverride(sessionId, field, value),
      setStartingRoll: (startingRoll: boolean) => state().setStartingRoll(sessionId, startingRoll),
      setDispatchFailure: (failure: { kind: DispatchFailureKind; message: string } | null) =>
        state().setDispatchFailure(sessionId, failure),
      setCancelNotice: (notice: string | null) => state().setCancelNotice(sessionId, notice),
      setFollowDismissed: (dismissed: boolean) => state().setFollowDismissed(sessionId, dismissed),
      rollDispatched: () => state().rollDispatched(sessionId),
    };
  }, [sessionId, store]);

  return { ...slice, ...actions };
}
