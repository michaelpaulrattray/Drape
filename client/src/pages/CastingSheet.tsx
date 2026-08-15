import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Button,
  Dock,
  EmptyState,
  Field,
  Input,
  Instruction,
  Skeleton,
} from "@/foundation";
import { BriefEcho } from "@/features/castingV2/components/BriefEcho";
import { BriefField } from "@/features/castingV2/components/BriefField";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import "@/features/castingV2/castingV2.css";
import { CandidateTile, UndoDiscard } from "@/features/castingV2/components/CandidateTile";
import { readableFailure, refineFailureMessage } from "@/features/castingV2/failureCopy";
import { useSheetSession, type UnlockableField } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import {
  displayText,
  sameBrief,
  shownRollChanged,
  typed,
  type BriefDraft,
} from "@/features/castingV2/briefDraft";
import { classifyDispatchFailure, failureActionLabel } from "@/features/castingV2/dispatchFailure";
import { cancelStory } from "@/features/castingV2/cancelNotice";
import { refineOutcomeNote } from "@/features/castingV2/refineOutcomeNote";
import { inFlightCandidate, refineBusy, refineWait } from "@/features/castingV2/refineBusy";
import { bridgeWithinCandidate } from "@/features/castingV2/panelBridge";
import { sheetExpiryNotice } from "@/features/castingV2/retentionCopy";
import { sheetNotice } from "@/features/castingV2/sheetNotice";
import {
  CandidateViewer,
  type ViewerFrame,
} from "@/features/castingV2/components/CandidateViewer";
import { RefinePanel } from "@/features/castingV2/components/RefinePanel";
import { FacePanel } from "@/features/castingV2/components/FacePanel";
import { VersionRail } from "@/features/castingV2/components/VersionRail";
import { frameUrlFor, selectedVariantFor, type ChosenFrame } from "@/features/castingV2/chosenFrame";
import { FaceRegions } from "@/features/castingV2/components/FaceRegions";
import { useFaceSelection } from "@/features/castingV2/components/faceSelection";
import { KeptTray } from "@/features/castingV2/components/KeptTray";
import { SignConfirm } from "@/features/castingV2/components/SignConfirm";

/**
 * The casting sheet (plan §J, handoff chapter 07).
 *
 * A route rather than a mode on `/casting`, because a session is a durable
 * seven-day object: closing the tab cancels nothing, the back button means
 * what it says, and the sheet resumes from server truth rather than from
 * whatever the last render happened to hold.
 *
 * Everything here is server-owned except the three things in `sheetState`. The
 * poll is the truth; the store only protects the tiles with a mutation in
 * flight from being re-rendered stale by a response that was already on its
 * way when the user clicked.
 */

const POLL_MS = 2_500;
/**
 * WHAT A QUIET SHEET COSTS.
 *
 * The session poll ran at `POLL_MS` for as long as the page was open, whether
 * or not anything was happening — 24 requests a minute, forever. On
 * 2026-08-10 that budget refused the founder's own click: five `getSession`
 * polls and one `selectVariant` came back "Too many requests" while he was
 * reading a sheet from the day before, with nothing rendering at all.
 *
 * `getRoll` had already been given an arrival gate, and its comment predicted
 * this exact failure ("two tabs and the session poll and the user rate-limits
 * themselves out of their own sheet"). The sibling was never swept — so this
 * is that fix applied to the instance it named.
 *
 * Slow rather than OFF, deliberately: a session can change from another tab or
 * from the recovery sweep, and a sheet that stopped asking would sit stale
 * until a remount. Twelve seconds is invisible to someone reading, and it
 * takes an idle tab from 24 requests a minute to five.
 */
const IDLE_POLL_MS = 12_000;
const TERMINAL_ROLL_STATUSES = new Set(["complete", "partial", "failed", "cancelled"]);

export default function CastingSheet() {
  const [, params] = useRoute("/casting/s/:sessionId");
  const [, navigate] = useLocation();
  /*
    `?focus=<candidatePublicId>` — arriving from a sibling tile in someone's
    room (founder ruling, 2026-08-02: siblings navigate by state).

    A query param rather than router state, because it has to survive a reload:
    the whole point of sending someone here is that they can look around, and a
    focus that evaporates on refresh is a focus that was never really an
    address. The KEPT TRAY is the target rather than the roll grid — siblings
    are kept by definition, and the tray is cross-roll, so she is there
    regardless of which roll she came from.
  */
  const focusCandidateId = new URLSearchParams(useSearch()).get("focus");
  const sessionId = params?.sessionId ?? "";
  const utils = trpc.useUtils();

  const {
    isPending,
    beginMutation,
    endMutation,
    undoable,
    setUndoable,
    unlocked,
    unlock,
    rollDispatched,
    startingRoll,
    setStartingRoll,
    dispatchFailure,
    setDispatchFailure,
    optimisticKept,
    optimisticDiscarded,
    setOptimisticKept,
    setOptimisticDiscarded,
    clearOptimistic,
    overrides,
    setOverride,
    clearOverrides,
    undoOverride,
    provisionalRollIndex,
    beginProvisionalRoll,
    optimisticCancelled,
    setOptimisticCancelled,
    cancelRefundRecorded,
    setCancelRefundRecorded,
    cancelRequested,
    requestCancel,
    followDismissed,
    setFollowDismissed,
    /*
      Addressed to THIS sheet. The store was one flat singleton, so an
      adjustment made here appeared in another sheet's echo — and a roll fired
      there would have posted a lock the user never set on that sheet. The hook
      binds every action to the session id so a caller cannot forget it.
    */
  } = useSheetSession(sessionId);
  /*
    The user's unspent typing, or nothing at all. The box itself is DERIVED —
    see `briefDraft.ts` for the defect that shape deletes, and why a seeded
    string could not.
  */
  const [draft, setDraft] = useState<BriefDraft>(null);
  /*
    Its own state rather than borrowing the cancel line, which it was doing.
    A followed face can be discarded, purged or signed, and when that happens
    the chip falls away — but it is not a cancel and must not be told through
    the cancel's sentence.
  */
  const [parentGone, setParentGone] = useState(false);
  /*
    The candidate a Sign confirmation is open for.

    Component state rather than the sheet store: it is a dialog, it belongs to
    this screen, and it must not survive navigating to another sheet — the
    store's global-singleton bleed is exactly the class of bug that cost a
    paid lock once already.
  */
  /** Which candidate the viewer is open on. Null when it is closed. */
  const [viewerCandidateId, setViewerCandidateId] = useState<string | null>(null);
  /*
    THE VERSION THEY JUST CLICKED, drawn before the server has been asked
    (fable-501). Measured first: the photograph was waiting 27 seconds on a
    tRPC batch that carried the face scan, and none of it was image bytes —
    the rail's own thumbnails are the full pictures, already cached. The rule
    for how long this claim survives is `chosenFrame`'s, and it expires by
    arithmetic rather than by an effect.
  */
  const [chosenFrame, setChosenFrame] = useState<ChosenFrame | null>(null);
  /* The refine panel owns its own outcomes (D-154) — never a toast. */
  const [refineOutcome, setRefineOutcome] = useState<string | null>(null);
  /*
    The instruction a question is still waiting on (D-180).

    A ref rather than state: nothing renders from it — the question itself is
    the outcome sentence — and it must not schedule a paint of its own.
  */
  const pendingReask = useRef<string | null>(null);
  /* The answers, which DO render: chips under the sentence (D-180). */
  const [reaskOptions, setReaskOptions] = useState<
    ReadonlyArray<{ label: string; resolves: string }> | null
  >(null);
  /* Balance context for the cost line — the question a price actually raises. */
  const balance = trpc.credits.getBalance.useQuery(undefined, {
    staleTime: 30_000,
  }).data?.balance;
  const [signing, setSigning] = useState<
    {
      candidateId: string;
      indexLabel: string;
      personaLine: string | null;
      imageUrl: string | null;
    } | null
  >(null);
  /*
    Which kept candidate the dock's Sign acts on.

    Null means "the most recent keep", which is the answer nine times out of
    ten and costs the user nothing to change. Held here rather than in the sheet
    store for the same reason the dialog is: it belongs to this screen and must
    not follow anyone to another sheet.
  */
  const [signSelectionId, setSignSelection] = useState<string | null>(null);

  const config = trpc.castingV2.config.useQuery({});
  const session = trpc.castingV2.getSession.useQuery(
    { sessionId },
    {
      enabled: sessionId.length > 0,
      /*
        Fast while something is arriving, slow while nothing is — the same
        shape `getRoll` uses, for the same reason (see `IDLE_POLL_MS`).

        THE SECOND CLAUSE IS THE DEADLOCK GUARD, and it is the lesson the
        variants poll already paid for: gated on server data alone, a sheet
        that has just dispatched sees no non-terminal roll YET, so it would
        drop to the idle cadence in the one moment the user is actually
        waiting. `startingRoll` is the client's own knowledge that a roll is
        out, and it is the only thing available before the first refetch.
      */
      refetchInterval: (query) => {
        if (startingRoll) return POLL_MS;
        const rolls = query.state.data?.rolls;
        if (!rolls) return POLL_MS;
        const arriving = rolls.some((roll) => !TERMINAL_ROLL_STATUSES.has(roll.status));
        return arriving ? POLL_MS : IDLE_POLL_MS;
      },
    },
  );

  const activeRollId = session.data?.activeRollId ?? null;
  const rolls = session.data?.rolls ?? [];

  /*
    Which roll the user is LOOKING at, which is not the same thing as which
    roll is live.

    This is pure client state and performs no server mutation, deliberately.
    `activeRollId` means "the newest dispatched roll" and nothing else: undo is
    anchored to it server-side so that "undo clears on the next roll" is a
    server fact rather than a client convention (§F), and the retention sweep
    exempts the active roll's discards from purging (§G.6). If navigating
    repointed it, walking back to roll 2 would resurrect roll-2 discards past
    the next-roll boundary and would quietly change what the cleanup worker is
    allowed to delete. Navigation must never do either — a view is not an
    event.
  */
  const [viewedRollId, setViewedRollId] = useState<string | null>(null);
  const shownRollId = viewedRollId ?? activeRollId;
  const viewingHistory = Boolean(shownRollId && activeRollId && shownRollId !== activeRollId);

  /** Closes synchronously on click; see `dispatchRoll` and `singleFlight.ts`. */
  const latchRef = useRef<DispatchLatch | null>(null);
  if (!latchRef.current) latchRef.current = createDispatchLatch();
  const latch = latchRef.current;

  /*
    The roll we paid for now exists. Open the latch and let the dock work
    again. Together with the error path's `release()`, this is what stops a
    dispatch locking the sheet forever.
  */
  useEffect(() => {
    if (latch.settleIfArrived(activeRollId)) {
      setStartingRoll(false);
      // The real row has landed, so the provisional pill hands over to it.
      beginProvisionalRoll(0);
      /*
        NOTE: this deliberately no longer clears the failure banner.

        It used to, and that was the bug. `settleIfArrived` returns false when
        the latch is not held — and the failure handler calls `release()`
        BEFORE raising the banner, so by the time a roll arrived the only
        mechanism that could dismiss it had already been torn down by the
        handler that raised it. The founder watched "We lost contact" sit above
        a roll rendering normally until they refreshed the page.

        The banner is derived now (see `staleFailure`), from the same source
        the sheet renders from. Two mechanisms for one rule is how they drift
        apart, and this pair had already drifted.
      */
    }
  }, [activeRollId, latch, setStartingRoll, beginProvisionalRoll]);

  /*
    THE BANNER IS DEFINITIONALLY STALE ONCE A NEWER ROLL RENDERS.

    `createRoll` commits its rows and charges while the request is still open,
    so a transport failure means we never heard the answer — not that nothing
    happened. The roll may be running right now, and the founder has now seen
    that twice: a "didn't start" banner above eight tiles casting normally, and
    a "lost contact" banner above a roll that had plainly arrived.

    So the sheet does not keep a second opinion about whether a roll exists. If
    the roll it is RENDERING is not the one the failed dispatch fired on top
    of, then a roll arrived after that failure, and the failure is describing a
    world that no longer exists. No predicate to keep in step, no latch to tear
    down: the banner reads what the sheet reads.
  */
  const staleFailure =
    dispatchFailure !== null
    && activeRollId !== null
    && activeRollId !== dispatchFailure.afterRollId;

  /*
    A ROLL THE USER CANCELLED IS NOT A FAILURE TO REPORT BACK TO THEM.

    `createRoll` stays open for the whole roll, so cancelling makes it reject —
    a minute or two later — carrying the server's "That roll was cancelled.
    160 credits were refunded." The money is right and the sentence is true,
    but it arrives long after the fact, describing something the user did on
    purpose and has already been told about.

    The cancel line owns that story now, live and in the dock. A second notice
    is noise at best; arriving late and out of context it reads as a new
    problem. So a dispatch failure is suppressed on a sheet whose roll the user
    cancelled.
  */
  // `cancelRequested` alone here: it is owned from the click and needs no poll,
  // and the roll query is not in scope this early in the render.
  const cancelledByUser = cancelRequested;
  const visibleFailure = staleFailure || cancelledByUser ? null : dispatchFailure;

  /**
   * A dispatch is in flight and its roll has not appeared yet.
   *
   * Drives both halves of the fix: the paid affordances disable, and the grid
   * swaps to skeletons in the same frame as the click, so Follow and Roll
   * again answer as immediately as Cast it does.
   */
  const awaitingNewRoll = startingRoll && latch.held && !visibleFailure;

  /**
   * The roll being paid for, or nothing.
   *
   * Gated on `awaitingNewRoll` rather than read raw, so the provisional chrome
   * cannot outlive the dispatch it belongs to: a failure clears the flag and
   * the pill goes with it, through the same classified-failure contract that
   * unwinds the tiles.
   */
  const provisionalIndex = awaitingNewRoll ? provisionalRollIndex || null : null;

  const roll = trpc.castingV2.getRoll.useQuery(
    { rollId: shownRollId ?? "" },
    {
      enabled: Boolean(shownRollId),
      /*
        Poll only while there is something to wait for. A finished sheet polled
        forever is 24 requests a minute per tab against a 60/min limit — two
        tabs and the session poll and the user rate-limits themselves out of
        their own sheet.

        Keyed on the roll being terminal, not on it being the active one: rolls
        can generate concurrently, so a previous roll may still be landing
        candidates after a newer one was dispatched.
      */
      /*
        A CANCELLED ROLL IS NOT NECESSARILY A FINISHED ONE.

        `cancelled` is terminal for the ROLL, so stopping here on status alone
        froze the screen the instant the user clicked cancel — and the
        candidates already with the provider were still coming. They land, they
        refund under the generosity rule, and the sheet showed none of it. The
        user was told refunds complete as work lands and then watched nothing
        happen.

        So the roll's status opens the question and its candidates close it:
        keep polling while any candidate is still in flight, whatever the roll
        is called.
      */
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return POLL_MS;
        if (!TERMINAL_ROLL_STATUSES.has(data.status)) return POLL_MS;
        const stillArriving = data.candidates.some(
          (candidate) => candidate.status === "casting",
        );
        return stillArriving ? POLL_MS : false;
      },
    },
  );

  /*
    The active roll's own status, read from the session poll rather than from a
    third query — `castingPoll` allows 60/min and the session plus viewed-roll
    polls already cost 48. The dock's operational state comes from here so that
    cancelling and the generating indicator keep describing the live roll while
    the user reads an old one.
  */
  const shortlist = session.data?.shortlist ?? [];
  const activeRollStatus = rolls.find((entry) => entry.rollId === activeRollId)?.status ?? null;
  const activeIsGenerating = activeRollStatus !== null && !TERMINAL_ROLL_STATUSES.has(activeRollStatus);

  /**
   * The brief box, derived rather than seeded.
   *
   * `shownBrief` is the sentence that produced the roll on screen, and with no
   * draft that IS what the box says — so a reload, a history walk and a landing
   * roll are all right without any of them being a case somebody remembered to
   * handle. The rule for what happens to a draft when the viewed roll changes
   * lives in `briefDraft.ts`, along with the paid-input bug it deletes.
   *
   * The effect fires on the roll's IDENTITY, not on its text: two rolls can
   * share a sentence, and walking between them is still arriving somewhere new.
   */
  const shownBrief = roll.data?.briefText ?? "";
  const brief = displayText(draft, shownBrief);
  const draftAnchor = useRef<string | null>(null);
  useEffect(() => {
    const rollId = roll.data?.rollId;
    const text = roll.data?.briefText;
    if (!rollId || text === undefined || draftAnchor.current === rollId) return;
    draftAnchor.current = rollId;
    setDraft((current) => shownRollChanged(current, text));
  }, [roll.data?.rollId, roll.data?.briefText]);

  const invalidate = async () => {
    await Promise.all([
      utils.castingV2.getRoll.invalidate(),
      utils.castingV2.getSession.invalidate(),
    ]);
  };

  /**
   * Every candidate mutation follows the same three steps, and the order is
   * what keeps the screen honest: mark the tile in-flight, cancel any poll
   * already in the air so its stale snapshot cannot land on top of the answer,
   * then invalidate once the server has spoken.
   */
  const guardedMutation = <TInput,>(run: (input: TInput) => Promise<unknown>) =>
    async (candidateId: string, input: TInput) => {
      beginMutation(candidateId);
      await utils.castingV2.getRoll.cancel();
      try {
        await run(input);
        await invalidate();
      } finally {
        endMutation(candidateId);
      }
    };

  const keep = trpc.castingV2.keep.useMutation();
  const discard = trpc.castingV2.discard.useMutation();
  const undo = trpc.castingV2.undo.useMutation();
  const cancel = trpc.castingV2.cancel.useMutation();
  const createRoll = trpc.castingV2.createRoll.useMutation();
  const follow = trpc.castingV2.follow.useMutation();
  const sign = trpc.castingV2.sign.useMutation();
  const refine = trpc.castingV2.refine.useMutation();
  const chooseVariant = trpc.castingV2.selectVariant.useMutation();

  const onKeep = (candidateId: string, kept: boolean) => {
    // Paint first, ask second (D-38). The ring appears on the click, not on
    // the round trip.
    setOptimisticKept(candidateId, kept);
    /*
      No success toast (D-110). The ring appears on the click, the face moves
      into or out of the tray, and the kept count changes — three in-place
      acknowledgements of one action, all of them on the thing the user just
      clicked. A fourth, in a pill at the bottom of the screen, is the second
      copy the ruling forbids.

      The FAILURE keeps its toast: the optimistic ring snaps back, which shows
      that something was refused but never why.
    */
    void guardedMutation((input: { candidateId: string; kept: boolean }) =>
      keep
        .mutateAsync(input)
        .catch((error: Error) => {
          // The server said no. Drop the optimistic paint rather than leaving
          // the screen claiming something that did not happen.
          clearOptimistic(candidateId);
          toast(readableFailure(error, "That didn't save — nothing has changed."));
        }),
    )(candidateId, { candidateId, kept });
  };

  const discardMutation = guardedMutation((input: { candidateId: string }) =>
    discard
      .mutateAsync(input)
      .then(() => {
        /*
          Discarding from a historical roll is legal, and it is immediately
          un-undoable: the undo CAS is anchored to the active roll, so it would
          refuse. Say that instead of setting an undo the user cannot spend.
        */
        if (viewingHistory) {
          /*
            KEPT, and not a duplicate: this explains an ABSENCE. The card
            leaving says "discarded"; nothing on the screen says why no Undo
            appeared beside it, and a missing affordance cannot explain itself.
          */
          toast("Discarded — undo is only available on the latest roll");
          return;
        }
        // No success toast (D-110): the card leaves the grid on the click and
        // the Undo affordance appears in its place. Both are the answer.
        setUndoable(input.candidateId);
      })
      .catch((error: Error) => {
        clearOptimistic(input.candidateId);
        toast(readableFailure(error, "That didn't save — nothing has changed."));
      }),
  );

  const onDiscard = (candidateId: string) => {
    // The card leaves on the click. If the server refuses, the catch above
    // puts it back and says why.
    setOptimisticDiscarded(candidateId);
    void discardMutation(candidateId, { candidateId });
  };

  const onUndo = async () => {
    if (!undoable) return;
    await utils.castingV2.getRoll.cancel();
    await undo.mutateAsync({ candidateId: undoable });
    // The card returns on the click too — drop the optimistic removal rather
    // than waiting for the poll to contradict it.
    clearOptimistic(undoable);
    setUndoable(null);
    /*
      KEPT, and not a duplicate. The card returning is the "restored" half and
      the toast does not need to repeat it — but "not kept" is a fact nothing
      on screen states: a discard clears kept, undo deliberately does not put it
      back, and the only in-place evidence is the ABSENCE of a ring, which is
      indistinguishable from a card that was never kept.
    */
    toast("Restored — not kept");
    await invalidate();
  };

  /**
   * Roll again, or follow one candidate.
   *
   * Fired and not awaited, for the same reason the tab does it: the mutation
   * does not resolve until all eight have landed, and a sheet that waits for
   * that shows nothing for a minute and then everything at once. Dispatching
   * without awaiting lets the poll pick up the new roll's rows within a tick
   * and stream them in.
   *
   * Refusals from this path are always free — compilation and queue admission
   * both run before the claim — so the message can say so plainly.
   */
  const dispatchRoll = (mode: "roll" | "follow", candidateId?: string) => {
    if (!sessionId || brief.trim().length === 0) return;

    /*
      SINGLE FLIGHT. This latch is a ref, not React state, and that is the
      whole point: `setState` does not take effect until the next render, so a
      guard written as `if (starting) return` can be sailed straight through by
      a second click in the same frame. A ref closes synchronously, on the
      click that opened it.

      This is the defect the founder hit — Follow showed nothing for the ~2.5s
      until the next session poll, so they clicked again, and each click was a
      separate paid roll. Four extra rolls, 640 credits, and every one of them
      did exactly what the code said to do.

      The latch opens again when the new roll actually EXISTS (below), not when
      it finishes generating — a roll takes over a minute, and locking the dock
      for that long would be a second bug wearing the first one's clothes.
    */
    if (!latch.tryAcquire(activeRollId)) return;

    /*
      The whole chrome goes optimistic here, not only the tiles.

      The next index is knowable from the count, so the counter, the rail's
      pill and the eyebrow can all move on this frame rather than on the poll
      2.5 seconds later. One click, one visible moment — the founder's report
      was that the tiles answered instantly and everything around them waited,
      which reads as a stutter rather than as a response.
    */
    beginProvisionalRoll(rolls.length + 1);

    /*
      A REWRITTEN BRIEF BEATS A STANDING ADJUSTMENT.

      Overrides persist across rolls on purpose: a roll re-reads the brief each
      time, so an adjustment that did not persist would be silently re-derived
      away by the interpreter. That is right while the sentence is unchanged.

      It is wrong the moment the user edits the sentence. The founder typed
      "a young ... model" and the sheet cast men in their 50s, because an
      earlier age adjustment was still standing and, by design, ran last and
      won. Their own freshly typed word lost to a control they had touched
      minutes before and could no longer see.

      So the rule gains its other half: an adjustment outranks the
      interpreter's RE-READING of the same sentence, not a new one. Rewrite the
      brief and the adjustments are spent — the sentence is the statement of
      intent, and it was just restated.
    */
    /*
      Nothing to reconcile here any more.

      Editing the sentence spends the adjustments, and that now happens on the
      keystroke rather than at dispatch — so by the time a roll is fired, the
      store already holds the truth. Clearing again here would be a second
      mechanism for one rule, which is how the two halves drift apart later.
    */
    const sendOverrides = overrides;

    /*
      The chip decides which paid mutation fires.

      This is §F's actual shape and the reason the one-dispatch follow was the
      deviation: while the chip is up, Roll again CONTINUES the family rather
      than dropping back to open casting. Same price, same procedure
      server-side, same claim keyed on a fresh `clientRequestId` — the only
      difference is whether a parent rides along.
    */
    const anchorId = mode === "follow" ? candidateId : (standingFollowId ?? undefined);

    const clientRequestId = createClientRequestId();
    const release = () => {
      latch.release();
      setStartingRoll(false);
    };
    const onFailure = (error: unknown) => {
      release();
      /*
        THE PARENT CAN GO AWAY, and a standing chip is what makes that reachable
        in ordinary use for the first time. A followed candidate can be
        discarded, purged past its retention floor, or signed — and then the
        family it anchored no longer exists.

        Nothing was charged: the parent is resolved before the claim. So this
        is not a failure screen, it is the chip quietly falling away with a
        sentence saying why. Turning a normal end-of-life into a red banner
        would be the screen blaming the user for time passing.
      */
      const message = error instanceof Error ? error.message : "";
      if (anchorId && /not found/i.test(message)) {
        setFollowDismissed(true);
        setParentGone(true);
        return;
      }
      setDispatchFailure({ ...classifyDispatchFailure(error), afterRollId: activeRollId });
    };
    const options = {
      onError: onFailure,
      onSuccess: () => {
        void invalidate();
      },
      // Deliberately no onSettled release: settling means "all eight landed",
      // which is a minute away. The latch is released by the new roll
      // appearing, which is the thing the user is actually waiting to see.
    };

    rollDispatched();
    // Clicking Follow on a tile is an explicit request to start a family, so
    // it re-arms a chip the user had previously dismissed.
    if (mode === "follow") setFollowDismissed(false);
    setStartingRoll(true);
    // Rolling from a historical view jumps you to what you just paid for.
    setViewedRollId(null);

    if (anchorId) {
      follow.mutate(
        {
          clientRequestId,
          sessionId,
          candidateId: anchorId,
          briefText: brief,
          unlock: unlocked.length > 0 ? unlocked : undefined,
          overrides: Object.keys(sendOverrides).length > 0 ? sendOverrides : undefined,
        },
        options,
      );
    } else {
      createRoll.mutate(
        {
          clientRequestId,
          sessionId,
          briefText: brief,
          unlock: unlocked.length > 0 ? unlocked : undefined,
          overrides: Object.keys(sendOverrides).length > 0 ? sendOverrides : undefined,
        },
        options,
      );
    }
    void invalidate();
  };

  const onCancel = async () => {
    if (!activeRollId) return;
    // Owned from the click. The poll confirms it; it does not decide it.
    requestCancel();
    /*
      D-38, honestly.

      The click frame flips every still-casting tile to "Cancelling…" — that is
      `cancel.isPending`, read by the tiles, so the sheet answers instantly. It
      does NOT say "cancelled", because the sheet cannot know which tiles are
      cancellable: §J's projection collapses queued and dispatched into one
      status on purpose, and work already with the provider runs to completion
      and refunds on arrival. Painting all eight cancelled would have the user
      watch "cancelled" tiles fill with faces.

      The server then names the ones it actually stopped, which is a fast CAS
      with no image work — so the exact truth lands within a frame or two of the
      optimistic state, and nothing was claimed in between.
    */
    const result = await cancel.mutateAsync({ rollId: activeRollId });
    setOptimisticCancelled(result.cancelledCandidateIds);
    /*
      Said in the sheet rather than in a toast (D-40: feedback renders where the
      action happened). Two reasons it was wrong as a toast: sonner is global,
      so a cancel awaited across a navigation delivered its notice onto a
      DIFFERENT sheet; and the sheet is right here, which is when the toast is
      the fallback rather than the answer.

      The copy is conditional because R6's refund-honesty law requires the
      recorded amount to reach the user verbatim. "0 credits back" alone reads
      as a failure when it is often the honest description of a cancel that
      caught nothing queued — so the zero case says what IS happening instead.
    */
    /*
      Only the fact the projection cannot supply. The sentence itself is
      derived every render from the tiles — see `cancelLine` — so there is no
      stored copy to go stale while the arc plays out.
    */
    setCancelRefundRecorded(result.refundRecorded);
    await invalidate();
  };

  /*
    THE STANDING FOLLOW (§F): "the sheet header shows FOLLOWING <index> with a
    dismissible chip; dismissing only affects future rolls."

    Derived, not stored. Whether the roll on screen is a follow is already
    server truth — `lineage.fromCandidateId` — and the only thing the client
    owns is whether the NEXT roll should continue that family. So a reload
    still shows FOLLOWING, because the sheet genuinely still is one, and no new
    server fact had to be invented to say so.

    Hidden while reading history: the chip is a statement about what Roll again
    will do, and Roll again always applies to the live sheet.
  */
  const standingFollowId =
    !viewingHistory && !followDismissed ? (roll.data?.lineage.fromCandidateId ?? null) : null;

  const price = config.data?.rollPriceCredits ?? 0;
  const signPrice = config.data?.signPriceCredits ?? 0;
  const refinePrice = config.data?.refinePriceCredits ?? 0;

  /*
    WHO THE DOCK'S SIGN IS ABOUT.

    The kept set, minus anyone already signed — a spent candidate is still part
    of the sheet's story and stays in the tray, but she can never be a target.
    Newest keep first, because the last thing you kept is almost always the one
    you mean.
  */
  const keptTiles = [...shortlist].reverse().filter((entry) => !entry.signed);
  const signTarget =
    keptTiles.find((entry) => entry.candidateId === signSelectionId) ?? keptTiles[0] ?? null;
  const candidates = roll.data?.candidates ?? [];
  const rollWasCancelled = roll.data?.status === "cancelled";

  /*
    THE VIEWER LIVES HERE, not on the tile (founder ruling, 2026-08-02 — one
    image grammar, arrows walk the set).

    A tile cannot own it: arrows that step from one face to the next need state
    that outlives any single tile. The sheet holds the roll, so the sheet holds
    the viewer, and the tiles just say which face was clicked.

    Built from the VISIBLE tiles so an optimistically discarded face is not
    something the arrows walk back into.
  */
  const viewerFrames: ViewerFrame[] = candidates
    .filter((candidate) =>
      !optimisticDiscarded[candidate.candidateId] && candidate.imageUrl)
    .map((candidate) => ({
      url: frameUrlFor({
        candidateId: candidate.candidateId,
        serverUrl: candidate.imageUrl as string,
        chosen: chosenFrame,
      }),
      /* Only the picked version's own small copy — a thumbnail of the frame
         BEFORE the switch would be the previous picture wearing this one's
         name, which is the error the decode gate exists to avoid. */
      previewUrl: chosenFrame?.candidateId === candidate.candidateId
        && candidate.imageUrl === chosenFrame.insteadOf
        ? chosenFrame.previewUrl ?? null
        : null,
      label: candidate.indexLabel,
      personaLine: candidate.personaLine,
      downloadName: `candidate-${candidate.indexLabel}`,
      candidateId: candidate.candidateId,
    }));
  const viewerIndex = viewerFrames.findIndex(
    (frame) => frame.candidateId === viewerCandidateId,
  );

  /*
    Only a READY, unsigned candidate of THIS sheet can be refined — the same
    predicate the server enforces, mirrored here so the panel never appears
    over a face it could only fail on.
  */
  const viewerCandidate = candidates.find(
    (candidate) => candidate.candidateId === viewerCandidateId,
  );
  const viewerRefinable = Boolean(
    viewerCandidateId && viewerCandidate?.status === "ready",
  );
  /*
    IS OUR OWN REQUEST OUT, AND IS IT ABOUT THIS FACE (fable-465)?

    One mutation hook serves every face in the sheet, so `refine.isPending`
    alone says "somebody's edit is running" — and the founder walked the viewer
    onto a different cast and found its boxes gone and its button reading
    "Refining…" about a render that had nothing to do with it. The request
    carries its own subject in `variables`; asking it is a derivation rather
    than a second copy of the fact.
  */
  const refineIsOutForViewer = viewerCandidateId !== null
    && inFlightCandidate(refine) === viewerCandidateId;
  /* The stack is fetched only while a refinable face is open — there is
     nothing to show otherwise, and eight idle queries per sheet is a cost
     nobody sees and everybody pays. */
  const variants = trpc.castingV2.variants.useQuery(
    { candidateId: viewerCandidateId ?? "" },
    {
      enabled: viewerRefinable,
      /*
        POLL WHILE SOMETHING IS RUNNING — AND WHILE ONE IS BEING STARTED.

        The ghost chip and the wait treatment are both read from the SERVER, so
        something has to ask again for either to appear; a permanent interval on
        eight faces is a cost nobody sees and everybody pays, which is why this
        is gated on the viewer being open.

        THE SECOND CLAUSE IS NOT AN OPTIMISATION, it is the bug the production
        walk found. Gated on `pending` alone this deadlocks on itself: pending
        is empty when a refine is submitted, so the query never re-asks, so
        pending never becomes non-empty, so the loader never appears for the
        one person who is actually waiting — the person who pressed the button.
        `refine.isPending` is the client's own knowledge that a request is out,
        and it is the only thing available before the first refetch.
      */
      refetchInterval: (query) => (
        query.state.data?.pending?.length || refineIsOutForViewer ? 4000 : false
      ),
    },
  );

  /*
    WHAT THIS VERSION IS KEEPING (fable-113).

    Asked for the SELECTED version, because "what is kept" is a question about a
    branch and never about the candidate — going back to an earlier version and
    forking from it shows that version's layers, not the newest one's
    (fable-091, the founder's own semantics).

    No polling. Kept segments change only when a refinement lands, and that is
    exactly when `variants` refetches, so this rides the same cadence rather
    than adding an interval of its own.
  */
  const kept = trpc.castingV2.segmentsOnFace.useQuery(
    {
      candidateId: viewerCandidateId ?? "",
      variantId: variants.data?.selectedVariantId ?? null,
    },
    { enabled: viewerRefinable && Boolean(viewerCandidateId) },
  );

  /*
    PANEL v2 — everything about this face, from the reference library.

    Dark until `CASTING_REFERENCE_LIBRARY_SCOPE` names this account: off, the
    server answers `enabled: false` with no rows and the panel above stays
    exactly as it is today. Same cadence as the v1 read and the variants list —
    what a face holds changes only when a refinement lands.
  */
  const face = trpc.castingV2.facePanel.useQuery(
    {
      candidateId: viewerCandidateId ?? "",
      variantId: variants.data?.selectedVariantId ?? null,
    },
    {
      enabled: viewerRefinable && Boolean(viewerCandidateId),
      /* Kept for the sitting, like the scan beside it: a version she looked at
         ten minutes ago should not have to be asked for again. */
      gcTime: 60 * 60 * 1000,
      /*
        THE PANEL DOES NOT BLINK OUT WHEN A VERSION LANDS (fable-461/462).

        The founder watched it: the panel was there mid-render, VANISHED the
        moment the edit landed, and came back a few seconds later. The version
        id is part of this query's key, so a landing is a NEW KEY — and a new
        key has no data, so `facePanelData` fell to null and the whole column
        unmounted. Nothing was broken; the panel was being asked a question it
        had not answered yet, in front of somebody.

        Holding the previous version's answer is the honest bridge: her face is
        still her face while the new one is read, and the working line below
        says a read is in flight. The alternative — an empty column for the
        seconds a scan takes — is what he actually saw.

        AND IT MAY ONLY CROSS ONE FACE (fable-491). Shipped as a plain
        `keepPreviousData`, it held the previous answer whatever changed in the
        key — so clicking from one cast into another drew HER rows and HER boxes
        on the next woman's photograph until the new scan landed. Across
        versions of one face the bridge is true; across casts it is the quieter
        version of the same lie this comment was written about.
      */
      placeholderData: bridgeWithinCandidate(viewerCandidateId),
    },
  );

  /*
    ONE SELECTION, TWO VIEWS OF IT (fable-200): the panel's rows and the regions
    laid over the picture. Held here because they are rendered by two different
    children — and held ONCE, because a fact stored twice drifts.
  */
  /*
    THE SAME PANEL, AFTER HER FACE HAS BEEN READ.

    A scan is fourteen segmenter calls and takes seconds, so it cannot ride the
    first paint — the panel above renders from the library immediately and this
    swaps in when it lands. Same shape, so the swap is one `??` rather than a
    merge in the browser: the server is the only place that knows how a scanned
    row differs from a minted one.

    Fired only when the panel says a scan is available for this account
    (`scanning`), so a user outside `CASTING_FACE_SCAN_SCOPE` pays no round
    trip. Idempotent per (candidate, version) on the server, so the retries and
    refocus refetches TanStack does for free cost nothing.
  */
  const faceScan = trpc.castingV2.faceScan.useQuery(
    {
      candidateId: viewerCandidateId ?? "",
      variantId: variants.data?.selectedVariantId ?? null,
    },
    {
      enabled: viewerRefinable && Boolean(viewerCandidateId) && Boolean(face.data?.scanning),
      /* It never changes for a version — a new version is a new key. */
      staleTime: Infinity,
      /*
        AND IT IS KEPT FOR THE WHOLE SESSION (fable-520 §2, the client half).

        `staleTime: Infinity` says a cached answer is never refetched; it says
        nothing about how long the answer is KEPT. TanStack's default drops an
        inactive query after five minutes, so his own case — *"jump back three
        edits"* in a long session — re-asked the server for a version he had
        already looked at, and paid the scan's seconds again. An hour holds a
        whole sitting.

        What it costs: a scanned panel is rows plus one small stencil per row
        (~7 KB), so twenty versions is a couple of megabytes of memory in the
        tab. That is the right trade against a seven-second wait for an answer
        we already had.
      */
      gcTime: 60 * 60 * 1000,
      /*
        AND IT ASKS AGAIN WHILE THE READING IS STILL RUNNING (fable-521 §3).

        The scan asks fourteen questions in parallel and answers with whichever
        have landed, so a first look comes back part-filled and says so. Asking
        again a second later is what makes the panel fill a row at a time
        instead of appearing all at once when the slowest question returns.

        It stops the moment the server says `done`, which a warm version says on
        the first answer — so a face she has already looked at costs exactly one
        request, as it always did.
      */
      refetchInterval: (query) => (query.state.data?.done === false ? 1_000 : false),
      /* And the same bridge as the library read, with the same boundary: the
         scanned rows of the version she was looking at stay while this
         version's are read, and NOTHING crosses from another face. */
      placeholderData: bridgeWithinCandidate(viewerCandidateId),
    },
  );

  const faceSelection = useFaceSelection();
  /*
    THE WAIT, MADE VISIBLE (founder, fable-397: *"it usually takes about 5-10
    seconds — but currently it looks like nothing is even happening"*).

    Derived from the query rather than tracked beside it, which is what makes it
    unable to outlive its work: `isPending` is false the moment the scan lands
    OR errors, so a failed scan leaves the panel showing what the library alone
    knows — today's behaviour — and never a "reading…" that never ends. A flag
    set when the scan starts and cleared when it succeeds would have exactly one
    path that forgets to clear it, and that path is the failure.

    `face.data?.scanning` gates it too: outside the scan's scope the query never
    fires, so there is nothing to wait for and nothing to say.
  */
  /*
    AND IT SAYS SO WHILE IT IS BRIDGING (fable-461/462).

    `placeholderData` keeps the last version's rows on screen across a landing,
    which is the fix for the blink — and rows from the version before this one,
    shown silently, would be the quieter version of the same lie. Either query
    holding a placeholder means what is on screen was read of a different frame,
    and the working line is exactly the sentence for that.
  */
  const faceScanWorking = (Boolean(face.data?.scanning) && faceScan.isPending)
    || face.isPlaceholderData
    || faceScan.isPlaceholderData
    /*
      AND WHILE THIS FACE HAS NO ANSWER AT ALL YET (fable-491).

      Stepping from one cast to another leaves the panel with nothing to show —
      the bridge refuses to carry another woman's rows — so what is on screen is
      the heading and this line, rather than a blank column for the seconds a
      scan takes. `enabled` keeps this false whenever no refinable face is open.
    */
    || (viewerRefinable && face.isPending);
  const scannedFaceData = faceScan.data?.enabled ? faceScan.data : null;
  const facePanelData = scannedFaceData ?? (face.data?.enabled ? face.data : null);
  const faceRows = facePanelData?.groups.flatMap((group) => group.rows) ?? [];
  /*
    ONE DRAFT, THREE DOORS. The ask box under the picture, a row tapped in the
    panel beside it, and the feature clicked on the picture itself all write the
    same sentence — so the sentence is held here, where all three can reach it,
    rather than inside whichever component happened to own the field.
  */
  const [askDraft, setAskDraft] = useState("");
  /*
    CHOOSING A VERSION, from either column that draws them.

    Named rather than inlined now that the rail beside the picture and the stack
    under it are the same control in two layouts — a second copy of this handler
    is a second answer to what selecting a version does.
  */
  const selectVariant = (variantId: string | null): Promise<unknown> | undefined => {
    if (!viewerCandidateId) return undefined;
    /*
      PAINT FIRST, ASK SECOND (D-38), and here it is not a nicety: the URL of
      the version they clicked is already in hand — it is the picture the rail
      just drew them — while the server's answer arrives inside a batch that
      also carries the face scan. Claiming it now takes the photograph off that
      batch's critical path entirely.
    */
    const chosen = variantId === null
      ? { url: variants.data?.originalImageUrl ?? null, thumb: variants.data?.originalThumbUrl ?? null }
      : (() => {
        const entry = variants.data?.variants.find((row) => row.variantId === variantId);
        return { url: entry?.imageUrl ?? null, thumb: entry?.thumbUrl ?? null };
      })();
    const picked = chosen.url;
    const showing = candidates.find(
      (candidate) => candidate.candidateId === viewerCandidateId,
    )?.imageUrl ?? null;
    if (picked && showing && picked !== showing) {
      setChosenFrame({
        candidateId: viewerCandidateId,
        /* The version this pick IS — the rail's highlight reads it, so the chip
           and the photograph are one claim (fable-546). */
        variantId,
        url: picked,
        /* The chip they clicked is already in the browser, so the viewer can
           show the right picture immediately and sharpen in place. */
        previewUrl: chosen.thumb,
        insteadOf: showing,
      });
    }
    /* Returned rather than fired and forgotten, because ONE caller has to wait
       for it: taking a step back prunes the SELECTED face's chain, so the
       selection must have landed before the prune is sent. Every other caller
       ignores the promise exactly as before. */
    return chooseVariant
      .mutateAsync({ candidateId: viewerCandidateId, variantId })
      .then(async () => {
        await variants.refetch();
        await invalidate();
      })
      /*
        OUR SENTENCE, NEVER THE ERROR'S (run-9). This was `error.message`, so a
        gateway's plain-text 502 reached the panel as "Unexpected token 'u',
        "upstream error" is not valid JSON" — the same string already fixed once
        for roll dispatch, kept alive here because that fix was never swept.
      */
      .catch((error: unknown) => setRefineOutcome(refineFailureMessage(error)));
  };
  /*
    v1 AND v2 ARE NEVER BOTH ON SCREEN. They answer different questions — what
    this version KEEPS versus everything that can be changed — so two lists would
    be two answers. Derived, not mirrored: v2 armed means v1 is handed nothing.
  */
  const keptRows = facePanelData ? [] : (kept.data?.rows ?? []);

  /*
    The refinement the picture narrates while it runs (D-169).

    Newest first, because the newest is the one they just asked for; the others
    are counted rather than listed, since a picture cannot narrate two things
    and pretending otherwise would be the overclaim this whole treatment avoids.
  */
  /*
    THE ONE PAID EDIT, called from two places (fable-200).

    The ask box under the picture and the box that opens ON the picture are two
    views of the same request, so they are one handler rather than two that look
    alike — a second copy of this closure is the drift this codebase keeps
    meeting, and here it would drift on the thing that spends money.
  */
  /**
   * `scope` is the one instance she clicked, when she clicked one — the picture's
   * rectangles are the only thing that sends it, and the ask box below sends
   * nothing, because a typed sentence with no rectangle behind it is about the
   * whole feature (fable-444, ruling C).
   */
  function askRefine(instruction: string, scope?: string) {
    if (!viewerCandidateId) return;

    /*
      THE LAST OUTCOME GOES WHEN A NEW ONE IS ASKED FOR.

      D-154 keeps an outcome until it is dismissed, which is right
      for reading a refusal — and wrong the moment the next
      instruction is submitted: the walk found a refusal about a
      necklace sitting above a live "Refining…" for something else
      entirely, so the panel was describing the wrong request. Until
      dismissed means until superseded, too.
    */
    setRefineOutcome(null);
    setReaskOptions(null);
    /*
      THE ANSWER GOES BACK THROUGH THE BOX (D-180).

      The outstanding question travels as the sentence that raised
      it, and the server re-derives what was asked. Cleared here
      whatever happens next: if this submission is not an answer it
      is a new instruction, and one question cannot stay open across
      two of them.
    */
    const answering = pendingReask.current;
    pendingReask.current = null;
    void refine
      .mutateAsync({
        clientRequestId: crypto.randomUUID(),
        candidateId: viewerCandidateId,
        instruction,
        ...(answering ? { answering } : {}),
        ...(scope ? { scope } : {}),
      })
      .then(async (result) => {
        /*
          A QUESTION, NOT AN OUTCOME — and it costs nothing.

          Rendered as a plain sentence in the panel that already
          carries refusals and confessions (D-180): same voice, same
          place, no modal. Answering it is typing, because the box
          is the interface.
        */
        if (result?.kind === "asked" && result.reask) {
          /*
            THE QUESTION'S OWN SUBJECT, when it has one.

            `answering` is how the server re-derives which question is open, and
            for every question about the WORDS that is the sentence they typed.
            The same-again offer is about the sentence that made the version,
            which may be worded differently from the repeat that raised it — so
            the question carries `about` and this echoes it back. A question
            that cannot be answered because the wording drifted is a dead end.
          */
          pendingReask.current = result.reask.about ?? instruction;
          setRefineOutcome(result.reask.question);
          setReaskOptions(result.reask.options);
          return;
        }
        /* Bought HERE, so its arrival is not a late lander (D-161). */
        if (result?.variantId) boughtHere.current.add(result.variantId);
        /*
          AN OUTCOME THAT NEEDS A SENTENCE SAYS IT — free or paid.

          A FREE one because silence would leave someone assuming
          they had just spent 25 credits on a face they were already
          looking at (D-163 rule 4). A PAID one that could only be
          served in part because naming the part left out is the
          whole of D-181. This line used to read `kind === "selected"`
          and threw the paid half away — see `refineOutcomeNote`,
          which owns the rule now and is driven both ways.
          The panel owns the saying, like every other outcome (D-154).
        */
        const said = refineOutcomeNote(result);
        if (said) setRefineOutcome(said);
        await variants.refetch();
        await invalidate();
      })
      /*
        The refusal IS the product surface here (§13). It arrives as
        a toast because the panel has no other place to say
        something — and it says "nothing was charged" itself, which
        is the only part a user needs immediately.
      */
      /*
        IN THE PANEL, not a toast (D-154). The founder's first
        failure was a long unreadable pill that vanished before it
        could be read, and a refusal that names its wall is
        worthless at 2.1 seconds.
      */
      /*
        OUR SENTENCE, NEVER THE ERROR'S (run-9). This was
        `error.message`, so a gateway's plain-text 502 reached the
        panel as "Unexpected token 'u', "upstream error" is not
        valid JSON" — the same string already fixed once for roll
        dispatch, kept alive here because that fix was never swept.
      */
      .catch((error: unknown) => setRefineOutcome(refineFailureMessage(error)));
  }

  const pendingForViewer = variants.data?.pending ?? [];
  /*
    BUSY IS ABOUT THIS FACE, AND ABOUT A ROW SOMEBODY IS ACTUALLY RENDERING.

    The whole rule lives in `refineBusy` with both of its arms driven — another
    cast's request must not mute this one (fable-465), and a row whose lease
    has passed must give the customer their hands back (fable-466/467).
  */
  const viewerBusy = refineBusy({
    viewerCandidateId,
    inFlightCandidateId: inFlightCandidate(refine),
    pending: pendingForViewer,
  });
  /*
    WHAT THE PICTURE IS WAITING FOR — one derivation, three rules.

    A live row narrates before a dead one (with two out, the picture describes
    the render still coming rather than the one the sweep is refunding); the
    CLICK narrates before either, so the photograph and the button stop
    disagreeing for the length of a round trip (fable-582); and a settling row
    still narrates even though the controls have come back.
  */
  const viewerWait = refineWait({
    viewerCandidateId,
    mutation: refine,
    pending: pendingForViewer,
  });


  /*
    THE LATE LANDER ANNOUNCES ITSELF (D-161).

    A refine the founder had given up on landed and appended silently, so two
    copper chips appeared in the lineage with no explanation of where the second
    came from. A variant that arrives without this panel having just bought it
    says so.
  */
  const knownVariantIds = useRef<Set<string> | null>(null);
  const boughtHere = useRef<Set<string>>(new Set());
  useEffect(() => {
    const rows = variants.data?.variants;
    if (!rows) return;
    const ids = new Set(rows.map((row) => row.variantId));
    /* The first read after opening a face is the baseline, never an arrival. */
    if (!knownVariantIds.current) {
      knownVariantIds.current = ids;
      return;
    }
    const arrived = rows.filter(
      (row) => !knownVariantIds.current?.has(row.variantId) && !boughtHere.current.has(row.variantId),
    );
    knownVariantIds.current = ids;
    const last = arrived.at(-1);
    if (last) {
      const words = last.instructions.at(-1);
      setRefineOutcome(
        words
          ? `The edit you started earlier — "${words}" — just arrived and was added to this face.`
          : "An edit you started earlier just arrived and was added to this face.",
      );
    }
  }, [variants.data]);

  /* Opening a different face starts a new baseline. */
  useEffect(() => {
    knownVariantIds.current = null;
    boughtHere.current = new Set();
    /*
      AND A NEW SENTENCE. `RefinePanel` used to be keyed by the face, so its own
      state died with it; the draft is held here now, so the clearing has to be
      too — or walking the viewer with ←/→ carries a half-typed instruction onto
      the next candidate and the box spends 25 credits on whoever you landed on.
    */
    setAskDraft("");
    faceSelection.select(null);
  }, [viewerCandidateId]);

  /*
    THE CANCEL LINE, derived every render from the projection the tiles are
    drawn from — so it counts down as landings refund, cannot go stale, and
    survives navigating away and back without a stored sentence to age.
  */
  /*
    COUNTED FROM `counts`, NOT FROM THE TILE ARRAY — and this is the correction
    a paid roll forced.

    `expired` candidates are deliberately absent from the projection: they
    landed after the cancel and were refunded under the generosity rule, and
    showing them would make cancelling a way to buy images for nothing. But
    that means they vanish from `candidates` entirely — so counting the array
    watched the total shrink 8 → 5 → 0 and then announced "this roll had
    already finished, so there was nothing to refund" while 160 credits were on
    their way back. Exactly the wrong sentence, in the direction that matters.

    `counts.total` is taken from the raw rows before that filter, so the
    denominator holds. Refunded is everything that is neither delivered nor
    still coming — failed, cancelled and expired alike, which is precisely the
    set that gets money back.
  */
  /*
    A roll takes 66–82 seconds. Past roughly two minutes, a tile that is still
    casting is either unusually slow or its operation is dead — and the user
    cannot tell those apart from a caption that says "Casting…".

    Measured off the ROLL's own timestamp rather than the candidate's: the
    projection carries no per-candidate clock, and the honest statement is
    about this roll's age either way. Re-evaluated on every poll tick, which is
    already running while anything is non-terminal, so it needs no timer.
  */
  const rollStartedAt = roll.data?.createdAt ? Date.parse(roll.data.createdAt) : null;
  const rollIsOverdue =
    rollStartedAt !== null && Number.isFinite(rollStartedAt) && Date.now() - rollStartedAt > 120_000;

  /*
    Seven quiet days is idle time, not age: `expiresAt` is pushed out every
    time the session is touched. So this only ever appears on a sheet the user
    has genuinely left alone, which is the only case where it is news.
  */
  const expiryNotice = sheetExpiryNotice(session.data?.expiresAt ?? null);

  /*
    One slot, one line. Both new facts are properties of the ROLL being viewed,
    so walking the history rail correctly changes what the sheet confesses —
    the sheet you are looking at is the one it describes.
  */
  const notice = sheetNotice({
    fellBack: roll.data?.fellBack === true,
    statedWardrobe: roll.data?.statedWardrobe === true,
    expiryNotice,
  });

  const counts = roll.data?.counts;
  const cancelLine = cancelStory({
    cancelled: rollWasCancelled || cancelRequested,
    refunded: counts ? Math.max(0, counts.total - counts.ready - counts.casting) : 0,
    finishing: counts?.casting ?? 0,
    total: counts?.total ?? 0,
    /*
      One candidate's share of the roll price. Derived rather than sent because
      the per-slice cost is internal — and it is only ever used to STATE a
      total the server already refunded, never to decide one.
    */
    sliceCredits:
      counts && counts.total > 0 ? Math.round((roll.data?.priceCredits ?? 0) / counts.total) : 0,
    // Unknown after a hard reload; see the field's own note.
    refundRecorded: cancelRefundRecorded ?? true,
  });


  /*
    "FROM 04" — the roll this one followed.

    Resolved through the session's roll list rather than by arithmetic. The
    parent is whichever roll the followed candidate belonged to, which is not
    necessarily the one before this: follow a candidate from roll 2 while
    sitting on roll 5 and the parent is 2. M5 computed `rollIndex - 1` and was
    simply wrong whenever the user reached backwards — and it never rendered
    at all, because the projection's lineage was empty until M6 populated it.

    Keyed on the roll, not the candidate: a discarded parent candidate can be
    purged after its 24h floor while its roll survives the session, so the
    candidate id is allowed to be absent here.
  */
  const lineageLabel = useMemo(() => {
    const fromRollId = roll.data?.lineage.fromRollId;
    if (!fromRollId) return null;
    const parent = rolls.find((entry) => entry.rollId === fromRollId);
    return parent ? `FROM ${String(parent.rollIndex).padStart(2, "0")}` : null;
  }, [roll.data?.lineage.fromRollId, rolls]);

  /*
    The same lineage, said in the echo's register rather than the pill's.
    "FROM 02" is a mono tag on a tile; a sentence says "the roll before this
    one". Both point at the same parent — they are not two facts.
  */
  const followLabel = useMemo(() => {
    const fromRollId = roll.data?.lineage.fromRollId;
    if (!fromRollId) return null;
    const parent = rolls.find((entry) => entry.rollId === fromRollId);
    if (!parent) return null;
    const rollLabel = `roll ${String(parent.rollIndex).padStart(2, "0")}`;
    /*
      Name the FACE, not just the roll. "The eight follow roll 01" is true and
      useless — a roll holds eight faces and the user pointed at exactly one.
      The candidate's own index is the thing they clicked, and it was already
      being computed server-side for the lineage pill; it simply never reached
      the sentence.
    */
    const face = roll.data?.lineage.fromCandidateLabel;
    return face ? `${face} on ${rollLabel}` : rollLabel;
  }, [roll.data?.lineage.fromRollId, roll.data?.lineage.fromCandidateLabel, rolls]);

  if (!sessionId) return null;

  return (
    <AppShell breadcrumb="Casting / Sheet" current="casting" width="working">
      <div className="dp-dock-scroll dp-stack" style={{ gap: 22 }}>
        <div className="dp-row" style={{ justifyContent: "space-between" }}>
          <Button variant="quiet" size="small" onClick={() => navigate("/casting")}>
            <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
            Casting
          </Button>
          {/*
            The header goes optimistic on the same latch as the button. It used
            to read the roll query, which still holds the PREVIOUS roll until
            the next poll — so the sheet showed "Roll 1" above the skeletons of
            roll 2. The index and the skeletons now change together, because
            they are driven by the same fact: a roll was dispatched.
          */}
          {awaitingNewRoll ? (
            <span className="dp-metadata">
              Roll {provisionalIndex ?? rolls.length + 1} · casting{" "}
              {config.data?.candidatesPerRoll ?? 8}
            </span>
          ) : roll.data ? (
            <span className="dp-metadata">
              Roll {roll.data.rollIndex} · {roll.data.counts.ready} of {roll.data.counts.total}
            </span>
          ) : null}
        </div>

        {/*
          The roll rail. Rolls are immutable versions, so this is navigation
          and nothing more — no server call, no state change, no cost. Every
          roll a session has paid for stays reachable for its whole life.
        */}
        {rolls.length > 1 || provisionalIndex ? (
          <div className="dpc-rollrail" role="tablist" aria-label="Rolls in this sheet">
            {rolls.map((entry) => {
              const shown = entry.rollId === shownRollId;
              const generating = !TERMINAL_ROLL_STATUSES.has(entry.status);
              return (
                <button
                  key={entry.rollId}
                  type="button"
                  role="tab"
                  aria-selected={shown}
                  className={`dpc-rollrail__item${shown ? " is-shown" : ""}`}
                  onClick={() => setViewedRollId(entry.rollId)}
                >
                  {String(entry.rollIndex).padStart(2, "0")}
                  {/* A live dot, not a spinner — the rail is a map, not a status board. */}
                  {generating ? <span className="dpc-rollrail__live" aria-label="still casting" /> : null}
                </button>
              );
            })}
            {/*
              The roll being paid for, before its row exists.

              Quiet rather than loud: it is the active pill, but dashed and
              non-interactive, because navigating to a roll that has no rows yet
              would show an empty sheet. It becomes the real pill when the row
              lands, and disappears with the classified-failure contract if
              creation fails — the same unwind the tiles use.
            */}
            {provisionalIndex ? (
              <span
                className="dpc-rollrail__item is-shown dpc-rollrail__item--provisional"
                aria-label={`Roll ${String(provisionalIndex).padStart(2, "0")}, still being created`}
              >
                {String(provisionalIndex).padStart(2, "0")}
                <span className="dpc-rollrail__live" aria-hidden="true" />
              </span>
            ) : null}
            {viewingHistory ? (
              <button
                type="button"
                className="dpc-rollrail__back"
                onClick={() => setViewedRollId(null)}
              >
                Back to the latest roll
              </button>
            ) : null}
          </div>
        ) : null}

        {/*
          THE SHEET'S ONE QUIET LINE.

          Three things can want this space — a lost interpretation, a stated
          outfit the sheet did not render, an expiry two days out — and they
          are all true at once often enough that stacking them was never an
          option. The precedence lives in `sheetNotice`, next to the reasoning,
          rather than as three conditionals here that drift apart.
        */}
        {notice ? <p className="dpc-expiry-note">{notice}</p> : null}

        {/*
          THE SHEET SAYS WHEN IT COULD NOT VARY.

          Every rule that produced the eight-way tie was individually correct —
          the follow anchored sex, heritage and colour, the captured direction
          locked the look, the stated age locked the band, the category put hair
          at silhouette tier. Their intersection left nothing alive that
          separates two faces at arm's length, and the sheet cost the same as a
          good one.

          Said plainly rather than hidden: a user looking at eight near-copies
          should be told it was the locks, not the engine having a bad day.
        */}
        {roll.data?.varianceHeld ? (
          <p className="dpc-variance-note">
            Most of this sheet is held — the eight will differ mainly in expression.
          </p>
        ) : null}

        {/*
          FOLLOWING — the standing follow chip (§F).

          It says what the next roll will do, which is the only thing about it
          the user can still change. Rolls are immutable, so dismissing cannot
          and does not touch the sheet on screen: the eight in front of them
          really are a family, and the × means "the next eight need not be".

          Beside the rail rather than in the dock: the dock is where you act,
          and this is state — the same register as which roll you are reading.
        */}
        {standingFollowId ? (
          <div className="dpc-following">
            <span className="dpc-following__chip">
              FOLLOWING {roll.data?.lineage.fromCandidateLabel ?? "—"}
              <button
                type="button"
                className="dpc-following__clear"
                onClick={() => setFollowDismissed(true)}
                aria-label="Stop following — the next roll casts openly"
                title="Stop following — the next roll casts openly"
              >
                ×
              </button>
            </span>
            <span className="dpc-following__note">
              Roll again keeps this family. Clear it to cast openly.
            </span>
          </div>
        ) : null}

        {/*
          The brief echo, in place of the row of pills the founder called
          tokenized. One sentence, the pinned facts adjustable in place.

          `terse` on the second and later rolls of a session: a returning user
          has already read which axes are free, and the pins are what they are
          checking.
        */}
        {roll.data ? (
          <BriefEcho
            facts={roll.data.facts}
            followLabel={followLabel}
            terse={rolls.length > 1}
            // What the user has queued but the sheet in front of them cannot
            // show, because rolls are immutable.
            pending={{ overrides, unlocked }}
            onAdjust={(adjustment) => {
              /*
                NONE OF THESE TOAST ANY MORE (D-110), and this is the clearest
                case in the product: the echo renders the queued change in
                place, in the sentence it belongs to — "20s → 50s · next roll"
                for a set, "→ varying · next roll" for an unpin, and the span
                reverting to an ordinary fact for an undo.

                The toasts were saying the same words a few inches lower.
                "20s → 50s · next roll" and "50s — applies to your next roll"
                are one sentence twice, and only one of them is attached to the
                fact it describes.
              */
              if (adjustment.kind === "undo") {
                undoOverride(adjustment.field);
                return;
              }
              if (adjustment.kind === "vary") {
                unlock(adjustment.field as UnlockableField);
                return;
              }
              setOverride(adjustment.field, adjustment.value as never);
            }}
          />
        ) : null}

        {/*
          A failed dispatch says so, here, where the skeletons would have been.

          This is the state that did not exist when the founder's anime brief
          was refused: the refusal was correct and free, and the sheet showed
          eight skeletons that waited forever. Nothing may ever hang.
        */}
        {visibleFailure ? (
          <EmptyState
            title={
              visibleFailure.kind === "refused"
                ? "That brief can't be cast"
                : /*
                    "The roll didn't start" is a claim, and on a transport
                    failure it is one we cannot make: we never heard back, and
                    the roll commits its rows before it dispatches. The other
                    kinds ARE refusals the server told us about, so they can
                    keep the definite title.
                  */
                  visibleFailure.kind === "unavailable"
                  ? "We lost contact"
                  : "The roll didn't start"
            }
            body={visibleFailure.message}
            action={
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  setDispatchFailure(null);
                  navigate("/casting");
                }}
              >
                {failureActionLabel(visibleFailure.kind)}
              </Button>
            }
          />
        ) : null}

        {/*
          An empty sheet is a real state and gets real copy — a session that
          exists with nothing cast on it yet.
        */}
        {!shownRollId && !startingRoll && !visibleFailure && session.isFetched ? (
          <EmptyState
            title="Nothing cast on this sheet yet"
            body="Describe who you need in the box below and roll."
          />
        ) : null}

        {/*
          Four across, so eight read as one sheet rather than a row of six and
          an orphaned pair. Still an intrinsic grid — it drops to three, two and
          one as the window narrows, never a pinned column count.
        */}
        <div className="dp-grid" style={{ ["--dp-grid-min" as string]: "252px" }}>
          {/*
            Skeletons the instant a dispatch starts — not only on first load.
            Before this, Follow left the previous roll's eight faces on screen
            with no sign anything had happened.

            AND ON A COLD OPEN, BEFORE THE SESSION ITSELF HAS ANSWERED
            (founder, 2026-08-15, on the outsider walk's measurement).

            `shownRollId` comes from the session query, so on a cold load every
            clause above was false and the grid rendered NOTHING — the page
            painted its chrome, its brief box and its price line in 4ms and her
            faces arrived 3,878ms later, with no skeleton, no spinner and no
            word in between. Every instrument called that page finished; the
            thing she opened it for was not on it.

            `session.isPending` is the honest fact for that window: the sheet's
            SHAPE is known long before its contents, and a sheet reached by URL
            or by the unsigned-sheets card has a roll on it. The one case this
            over-promises — a session created but never rolled — resolves to
            "Nothing cast on this sheet yet" as soon as the query lands, and
            that state is reachable for about a second in a flow where the
            client already knows it is rolling (`startingRoll`).
          */}
          {!visibleFailure
            && (awaitingNewRoll || session.isPending || (!roll.data && (startingRoll || shownRollId)))
            ? // Eight skeletons the instant a roll is on its way — the sheet's
              // shape is known long before its contents are.
              Array.from({ length: config.data?.candidatesPerRoll ?? 8 }, (_, index) => (
                <Skeleton
                  key={index}
                  style={{ aspectRatio: "4 / 5" }}
                  /*
                    THE LABEL IS A CLAIM AND ONLY ONE OF THESE STATES CAN MAKE
                    IT. "CASTING 01" says work is happening at the provider; on
                    a cold open of a finished sheet nothing is being cast and
                    the faces already exist. A placeholder that says nothing is
                    the panel's own rule (fable-521) and it is the honest shape
                    for a page that is only fetching.
                  */
                  label={awaitingNewRoll || startingRoll ? `CASTING 0${index + 1}` : undefined}
                />
              ))
            : candidates
                // Optimistically discarded cards leave now, not on the next
                // poll. The server is still the authority — a refusal puts
                // them straight back.
                .filter((candidate) => !optimisticDiscarded[candidate.candidateId])
                .map((candidate) => (
                <CandidateTile
                  key={candidate.candidateId}
                  onOpenViewer={() => setViewerCandidateId(candidate.candidateId)}
                  candidate={{
                    ...candidate,
                    kept: optimisticKept[candidate.candidateId] ?? candidate.kept,
                    /*
                      D-38 for cancel. A cancelled tile flips in the click frame
                      rather than up to 2.5s later — and only tiles that were
                      genuinely still queued are in this map, so the screen
                      never says "cancelled" above work that is about to land.
                    */
                    status: optimisticCancelled[candidate.candidateId]
                      ? "failed-refunded"
                      : candidate.status,
                  }}
                  lineageLabel={lineageLabel}
                  rollWasCancelled={
                    rollWasCancelled || Boolean(optimisticCancelled[candidate.candidateId])
                  }
                  // The click frame, before the server has named which tiles it
                  // stopped. Says "Cancelling…", never "Cancelled".
                  cancelling={cancel.isPending}
                  /*
                    Still with the provider on a cancelled roll. Sticky, because
                    it derives from the roll's own status — so this tile stays
                    acknowledged until it lands and refunds, and never drops
                    back to plain "Casting…".
                  */
                  windingDown={(rollWasCancelled || cancelRequested) && !cancel.isPending}
                  overdue={rollIsOverdue}
                  busy={isPending(candidate.candidateId)}
                  // Follow is a paid roll. Every tile's Follow locks the
                  // moment any one of them is clicked, or the sheet offers
                  // eight ways to buy the same thing twice.
                  paidBusy={awaitingNewRoll}
                  rollPriceCredits={price}
                  onKeep={() =>
                    onKeep(
                      candidate.candidateId,
                      !(optimisticKept[candidate.candidateId] ?? candidate.kept),
                    )
                  }
                  onDiscard={() => onDiscard(candidate.candidateId)}
                  onFollow={() => dispatchRoll("follow", candidate.candidateId)}
                  onOpenCast={(castId) => navigate(`/casting/cast/${castId}`)}
                />
              ))}
        </div>

      </div>

      <div className="dp-dock-fade">
        <Dock>
          <div className="dp-row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <Field className="dp-split__main dpc-briefrow">
              <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
              <BriefField
                value={brief}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft(typed(next));
                  /*
                    THE ECHO REVERTS THE MOMENT YOU START TYPING.

                    Editing the sentence spends the queued adjustments — that
                    part was already true, but it only happened when the roll
                    was dispatched. So the echo went on promising "20s → 50s ·
                    next roll" throughout the typing, for a change that was
                    already condemned. It described a future that was not going
                    to happen.

                    Doing it on the keystroke makes the rule teach itself:
                    touch the sentence and you watch the adjustments fall away,
                    which is the whole precedence law demonstrated rather than
                    documented.
                  */
                  /*
                    Divergence asks the same question the draft's spend rule
                    asks, so it asks it the same way. Two notions of "the same
                    sentence" is how the box and the adjustments would come to
                    disagree about whether the brief had been rewritten.
                  */
                  const diverged = !sameBrief(next, shownBrief);
                  // Silent by design (D-110). The comment above is the whole
                  // reason: the user WATCHES the adjustments fall out of the
                  // echo as they type. A toast announcing it is a caption on
                  // something already happening in front of them.
                  if (diverged && Object.keys(overrides).length > 0) clearOverrides();
                }}
                /*
                  THE BRIEF BOX STILL STEERS DURING A FOLLOW, and the founder
                  did not know that — a confirmed discoverability gap, not a
                  preference. A follow inherits the parent's face; the sentence
                  is still read on top of it, so anything stated here overrides
                  and everything unstated stays theirs. Saying so where the
                  typing happens is the only place it can be learned.
                */
                placeholder={
                  followLabel
                    ? "Add anything that should change — the rest stays theirs"
                    : "a fitness creator in their 30s, close-cropped hair"
                }
                aria-label="Casting brief"
              />
            </Field>
            {/*
              D-15: the price rides on the button, always visible, never behind
              a confirm step. Nudge chips carry no price of their own precisely
              because this button is next to them.
            */}
            {/*
              Disabled from the first click until the roll exists, and it says
              what it is doing rather than going quiet — silence is what made
              the founder click again.
            */}
            <Button
              variant="primary"
              onClick={() => dispatchRoll("roll")}
              disabled={awaitingNewRoll}
            >
              {awaitingNewRoll ? "Rolling…" : "Roll again"}
            </Button>
          </div>
          <div className="dp-row">
            {/*
              The shortlist lives here now, as a small stack where Sign will
              sit in M7. It used to be a section of its own below the grid —
              unprototyped, and tall enough to push the dock off-screen, which
              is what made Roll again unreachable without scrolling.
            */}
            <KeptTray
              shortlist={shortlist}
              selectedId={signTarget?.candidateId ?? null}
              onSelect={setSignSelection}
              focusCandidateId={focusCandidateId}
            />
            {/*
              The eyebrow flips on the click too. "Keep the ones worth a second
              look" is an instruction for a sheet you can act on; while eight
              are being cast there is nothing to keep yet, and leaving it up was
              part of what made the chrome feel a beat behind the tiles.
            */}
            {/*
              The cancel's outcome, said where the cancel happened (D-40).

              It outranks the resting instruction because it is the answer to
              the thing the user just did, and it stays until the next roll
              clears it — a refund story that completes over the following
              minute should not evaporate on a timer the way a toast does.
            */}
            {cancelLine ? (
              /*
                THE MONEY HAS EXACTLY ONE HOME.

                Tiles say what they are doing; this line is the only place the
                total is counted, and it outranks everything else on the dock
                while a cancel is resolving. It is derived, so it counts down
                on its own as landings refund and finishes on the recorded
                figure rather than on a number captured at the click.
              */
              <Instruction>{cancelLine}</Instruction>
            ) : parentGone ? (
              <Instruction>
                That face is no longer on this sheet — back to open casting. Nothing was charged.
              </Instruction>
            ) : awaitingNewRoll ? (
              <Instruction>Casting {config.data?.candidatesPerRoll ?? 8}…</Instruction>
            ) : followLabel ? (
              /*
                Said in words, not only in a placeholder — a placeholder is gone
                the moment you type, which is exactly when this matters. It
                outranks the kept count while a follow is on screen because the
                founder did not know the box still steered, and a count they
                already understand is the cheaper thing to lose.
              */
              <Instruction>
                Your words steer this family — anything you state overrides, everything else
                stays theirs
              </Instruction>
            ) : shortlist.length > 0 ? (
              <span className="dp-small" style={{ marginLeft: 12 }}>
                {shortlist.length} kept
              </span>
            ) : (
              <Instruction>Keep the ones worth a second look</Instruction>
            )}
            <span style={{ flex: 1 }} />
            {/*
              THE COST LINE — the whole pricing doctrine in one string.

              Cost is METADATA, never button text (founder ruling, 2026-08-03).
              Immediate-fire actions — Roll again, Follow — carry no price;
              this line carries it once for both, right-aligned and in mono
              because it is a machine fact and the mono law says so. The
              balance rides along BECAUSE THIS ACTION REPEATS: you roll, look,
              roll again, and the number is genuinely moving. That is the whole
              rule for whether it appears — the lobby's Cast it happens once and
              shows the cost alone, since "how much is left" answers a question
              nobody is asking yet (founder ruling, 2026-08-03).

              Ceremony-gated actions are absent from it: Sign's price belongs
              to its confirm, which is where the commitment happens.
            */}
            {price ? (
              <span className="dpc-dock__cost">
                {/*
                  The tilde carries the same meaning it does in the sign modal:
                  generation cost varies, and a number presented as exact that
                  then differs is worse than one that never claimed to be. It
                  qualifies the COST only — the balance beside it is exact.
                */}
                <span className="dpc-signm__tilde">~</span> {price} credits
                {typeof balance === "number" ? ` · ${balance.toLocaleString()} left` : ""}
              </span>
            ) : null}
            {/*
              Undo is offered only on the live roll. The server already refuses
              it elsewhere — the CAS is anchored to `activeRollId`, which is
              what makes "undo clears on the next roll" true rather than
              merely intended — so hiding it here is affordance honesty, not a
              second enforcement layer. Offering a button whose only outcome is
              a refusal is the thing invariant 7 is about, read backwards.
            */}
            {undoable && !viewingHistory ? (
              <UndoDiscard onUndo={onUndo} busy={undo.isPending} />
            ) : null}
            {/*
              SIGN LIVES HERE (founder ruling, 2026-08-02, and it is where the
              drawing always put it).

              It was a quiet text button under each tile, which the founder
              could not find on his first look at his own product — a 450-credit
              action hiding in the same visual weight as "Discard". The drawing
              puts it bottom-right in the dock, filled, acting on the current
              selection, and that is where a decision of this size belongs.

              The selection is the KEPT set: keeping is already how you say "this
              one matters", so the dock does not invent a second idea. The most
              recent keep is selected; clicking another thumb moves it. F2 rules
              one candidate per ceremony, so the CTA always names exactly one —
              the prototype's "Sign 3 to roster" is a confirmed seam.
            */}
            {keptTiles.length > 0 ? (
              /*
                ONE CEREMONY, ONE SELECTION.

                The dock used to carry its own cluster of kept thumbs beside
                this button, and that cluster read as multi-sign — an F2
                violation in the UI's grammar even though the ceremony was
                always single. The choice now lives on the kept tray, where the
                faces already are, with an accent ring on the selected one. So
                the button names no number: the ring says who, and the confirm
                shows her face before any money moves.

                The prototype draws "Sign N to roster" with a stacked cluster.
                That is the seam F2 already settled; this is reconciliation, not
                invention (docs/specs/CASTING_V2_ROOM_RECONCILIATION.md).
              */
              <Button
                variant="primary"
                disabled={!signTarget || sign.isPending}
                onClick={() =>
                  signTarget
                    ? setSigning({
                        candidateId: signTarget.candidateId,
                        indexLabel: signTarget.indexLabel,
                        personaLine: signTarget.personaLine ?? null,
                        imageUrl: signTarget.imageUrl ?? signTarget.thumbUrl ?? null,
                      })
                    : undefined
                }
              >
                Sign to roster
              </Button>
            ) : (
              /*
                The drawn empty state, kept rather than hiding the affordance:
                someone who has not kept anything should learn what Sign wants
                from them, not wonder where it went.

                Archivo, not mono — mono is for machine facts and this is a
                sentence.
              */
              <span className="dp-secondary">Keep the one you want, then sign them</span>
            )}
            {/*
              Cancel follows the ACTIVE roll, not the viewed one: reading roll
              2 while roll 5 generates must still let you stop roll 5, and must
              never offer to cancel a roll that finished days ago.
            */}
            {activeIsGenerating ? (
              <Button variant="quiet" onClick={onCancel} disabled={cancel.isPending}>
                Cancel · refunds what you haven't seen
              </Button>
            ) : null}
          </div>
        </Dock>
      </div>

      {viewerCandidateId && viewerIndex >= 0 ? (
        <CandidateViewer
          frames={viewerFrames}
          index={viewerIndex}
          /*
            THE PICTURE BECOMES THE LOADER (D-169), from SERVER truth.

            Drawn from the same `pending` list the ghost chips are, so it
            survives closing and reopening the sheet exactly as they do (D-161)
            — a wait that vanished when the panel unmounted is the defect that
            got one edit bought twice.

            The newest one narrates. The picture can only be one thing at a
            time, so with more than one running it means "this face has work
            out" and the count says the rest.
          */
          wait={viewerWait}
          /*
            THE FACE'S OWN REGIONS, over the picture (fable-200). Only where a
            box was actually measured — a rectangle over the wrong pixels is a
            promise that clicking there edits that thing.
          */
          overlay={facePanelData && viewerRefinable ? (
            <FaceRegions
              rows={faceRows}
              selection={faceSelection}
              priceCredits={refinePrice}
              busy={viewerBusy}
              onAsk={askRefine}
            />
          ) : null}
          /*
            EVERYTHING ABOUT THIS FACE, BESIDE THE PICTURE — not under it.

            Under it, the catalogue's sixteen rows took the whole viewport and
            the photograph rendered at 0×0 (shift 27's render check, measured).
            Beside it is also the founder's own mock: versions left, picture
            centre, the panel docked right, only the ask box across the bottom.
          */
          /*
            THE VERSIONS ON THE LEFT — the other half of his sentence
            (fable-206). Three columns arrive together with the panel, and only
            with it: off the flag the viewer keeps exactly today's shape, so a
            dark deploy changes nothing anybody sees.
          */
          before={facePanelData && viewerRefinable ? (
            <VersionRail
              variants={variants.data?.variants ?? []}
              pending={variants.data?.pending ?? []}
              /*
                ONE SOURCE OF TRUTH FOR THE SELECTION (founder bug, fable-546).

                This read the server-confirmed value while the photograph rode
                the optimistic override, so for the length of a round trip the
                picture was the new version and the lit chip was the old one.
                Same claim, same expiry, same scope — the override answers both.
              */
              selectedVariantId={selectedVariantFor({
                candidateId: viewerCandidateId ?? "",
                serverUrl: viewerCandidate?.imageUrl ?? "",
                serverSelected: variants.data?.selectedVariantId ?? null,
                chosen: chosenFrame,
              })}
              originalImageUrl={variants.data?.originalImageUrl ?? null}
              originalThumbUrl={variants.data?.originalThumbUrl ?? null}
              onSelect={selectVariant}
              /*
                REMOVE IS OFFERED ONLY WHERE IT CAN HAPPEN.

                The prune renders through the repaint road — it is the road
                that assembles a declarative recipe and the only one measured
                for it — so a chip menu on any other account would be a control
                that refuses, which is the dead control the menu itself
                forbids. `refinable` is the sheet's own word for "this face can
                be refined here", and the panel beside it uses the same gate.
              */
              layout="column"
            />
          ) : null}
          beside={(facePanelData || faceScanWorking) && viewerRefinable ? (
            <FacePanel
              groups={facePanelData?.groups ?? []}
              possessive={facePanelData?.possessive ?? "their"}
              working={faceScanWorking}
              /*
                EVERY ROW HERE IS ANOTHER VERSION'S ANSWER (fable-520 §1).

                The bridge holds the previous version's panel while this one is
                fetched, which is what stops the column blinking — and it was
                ratified when the photograph was slow too, so everything moved
                together. The photo is instant now, so for a moment the panel
                describes a frame that is no longer on screen. His versions
                genuinely differ (a slim build, an icy-blue eye), so those rows
                are falsehoods rather than harmless placeholders.

                The layout still does not blink. The rows just stop claiming.
              */
              carried={face.isPlaceholderData || faceScan.isPlaceholderData}
              selection={faceSelection}
              onScope={setAskDraft}
            />
          ) : null}
          onIndexChange={(next) => setViewerCandidateId(viewerFrames[next]?.candidateId ?? null)}
          onClose={() => setViewerCandidateId(null)}
          /*
            Refining only appears on a READY candidate of this sheet. A tile
            that is still casting, refunded or already signed has nothing to
            refine, and a panel offering to spend on one would be a control
            that can only fail.
          */
          below={viewerRefinable ? (
            <RefinePanel
              /*
                Keyed by the face. Without it, walking the viewer with ←/→
                carries a half-typed instruction from one candidate to the next,
                and the box then spends 25 credits on whoever you landed on.
              */
              key={viewerCandidateId}
              variants={variants.data?.variants ?? []}
              pending={variants.data?.pending ?? []}
              selectedVariantId={variants.data?.selectedVariantId ?? null}
              originalImageUrl={variants.data?.originalImageUrl ?? null}
              originalThumbUrl={variants.data?.originalThumbUrl ?? null}
              /*
                WHAT A FRESH TAKE WOULD ASK FOR — the version ON SCREEN's own
                words, or null on the original.

                Through `selectedVariantFor`, the same override the lit chip
                rides (fable-546). Reading the server-confirmed selection
                instead left the control on screen after a click to the original
                — measured, both themes: the picture was the master and the
                button still offered to re-roll an edit that was no longer in
                front of anybody. One source of truth for what is on screen, and
                everything about the screen follows it.

                Derived rather than remembered: the rail already has every
                version's `requestText`, so a second copy of "what did this
                version ask for" would be the parallel list law 4 forbids.
              */
              regenerates={
                (variants.data?.variants ?? [])
                  .find((entry) => entry.variantId === selectedVariantFor({
                    candidateId: viewerCandidateId ?? "",
                    serverUrl: viewerCandidate?.imageUrl ?? "",
                    serverSelected: variants.data?.selectedVariantId ?? null,
                    chosen: chosenFrame,
                  }))
                  ?.requestText ?? null
              }
              priceCredits={refinePrice}
              /*
                BUSY IS SERVER TRUTH TOO (D-161). `refine.isPending` alone dies
                with the component, which is how a running edit became invisible
                and got bought twice.
              */
              busy={viewerBusy}
              outcome={refineOutcome}
              /* Empty until the segment store is armed for this account — and
                 empty by construction whenever panel v2 is, since v2 replaces v1
                 rather than joining it. An empty list renders nothing at all. */
              kept={keptRows}
              /* The heading's one derived word — his/her/their, from the server,
                 which is the only side that may read a face's sex. */
              keptPossessive={kept.data?.possessive ?? "their"}
              /* The one sentence all three doors write into. */
              draft={askDraft}
              onDraft={setAskDraft}
              /* Drawn in the rail beside the picture whenever the three-column
                 shape is on — the same component, not a second stack. */
              stackHoisted={Boolean(facePanelData)}
              reask={reaskOptions ? { question: refineOutcome ?? "", options: reaskOptions } : null}
              onDismissOutcome={() => {
                // Dismissing the question withdraws it. The next sentence is a
                // fresh instruction, not a late answer to something gone from
                // the screen.
                pendingReask.current = null;
                setReaskOptions(null);
                setRefineOutcome(null);
              }}
              onRefine={askRefine}
              onSelect={selectVariant}
            />
          ) : null}
        />
      ) : null}

      {signing ? (
        <SignConfirm
          indexLabel={signing.indexLabel}
          imageUrl={signing.imageUrl}
          personaLine={signing.personaLine}
          priceCredits={signPrice}
          busy={sign.isPending}
          onCancel={() => setSigning(null)}
          onConfirm={(name) => {
            /*
              The room opens on the signed master and the views stream in
              behind it (§F), so this navigates as soon as the Cast exists
              rather than waiting out six 2K generations on a spinner.

              One request id per ceremony, minted here: a retry of the SAME
              ceremony must replay rather than sign a second candidate, and two
              deliberate Signs are two ids.
            */
            sign.mutate(
              {
                clientRequestId: createClientRequestId(),
                candidateId: signing.candidateId,
                // Required now: no Cast is born "Unnamed".
                name,
              },
              {
                onSuccess: (result) => {
                  setSigning(null);
                  navigate(`/casting/cast/${result.castPublicId}`);
                },
                onError: (error) => {
                  setSigning(null);
                  toast.error(readableFailure(error, "Signing didn't go through. Nothing has changed — try again."));
                },
              },
            );
          }}
        />
      ) : null}
    </AppShell>
  );
}
