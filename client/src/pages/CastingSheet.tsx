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
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import "@/features/castingV2/castingV2.css";
import { CandidateTile, UndoDiscard } from "@/features/castingV2/components/CandidateTile";
import { useSheetSession, type UnlockableField } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import { classifyDispatchFailure, failureActionLabel } from "@/features/castingV2/dispatchFailure";
import { cancelStory } from "@/features/castingV2/cancelNotice";
import { sheetExpiryNotice } from "@/features/castingV2/retentionCopy";
import {
  CandidateViewer,
  type ViewerFrame,
} from "@/features/castingV2/components/CandidateViewer";
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
  const [brief, setBrief] = useState("");
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
    { enabled: sessionId.length > 0, refetchInterval: POLL_MS },
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
   * The brief field starts as the roll's own sentence, so "roll again" is an
   * edit of what they asked for rather than a blank box to retype.
   *
   * ONCE PER ROLL, not whenever the box happens to be empty. The first version
   * keyed on `brief === ""` as a stand-in for "not filled yet", and those are
   * not the same thing: clearing the box by hand looks identical to a fresh
   * sheet, so the sentence sprang straight back and the field could not be
   * emptied at all. The founder found it by holding backspace.
   *
   * Keyed on the roll instead. Clearing stays cleared, because the roll has
   * already had its turn. Walking to another roll seeds that roll's sentence,
   * but only into an empty box — arriving somewhere new should never overwrite
   * words the user has already typed.
   */
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    const rollId = roll.data?.rollId;
    const text = roll.data?.briefText;
    if (!rollId || !text || prefilledFor.current === rollId) return;
    prefilledFor.current = rollId;
    if (brief === "") setBrief(text);
  }, [roll.data?.rollId, roll.data?.briefText, brief]);

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

  const onKeep = (candidateId: string, kept: boolean) => {
    // Paint first, ask second (D-38). The ring appears on the click, not on
    // the round trip.
    setOptimisticKept(candidateId, kept);
    void guardedMutation((input: { candidateId: string; kept: boolean }) =>
      keep
        .mutateAsync(input)
        .then(() => toast(input.kept ? "Kept" : "Removed from kept"))
        .catch((error: Error) => {
          // The server said no. Drop the optimistic paint rather than leaving
          // the screen claiming something that did not happen.
          clearOptimistic(candidateId);
          toast(error.message);
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
          toast("Discarded — undo is only available on the latest roll");
          return;
        }
        setUndoable(input.candidateId);
        toast("Discarded");
      })
      .catch((error: Error) => {
        clearOptimistic(input.candidateId);
        toast(error.message);
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
    // Undo restores the candidate, not its kept state — a discard clears kept
    // and this deliberately does not put it back. Say so rather than let the
    // user discover it.
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
      url: candidate.imageUrl as string,
      label: candidate.indexLabel,
      personaLine: candidate.personaLine,
      downloadName: `candidate-${candidate.indexLabel}`,
      candidateId: candidate.candidateId,
    }));
  const viewerIndex = viewerFrames.findIndex(
    (frame) => frame.candidateId === viewerCandidateId,
  );

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
          THE SHEET SAYS WHEN IT IS ABOUT TO GO.

          One sentence, once, at the top of the sheet it concerns — and only
          inside the last two days, because a retention line on a sheet nobody
          is at risk of losing is noise. It names the deadline and the action
          and stops there.
        */}
        {expiryNotice ? <p className="dpc-expiry-note">{expiryNotice}</p> : null}

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
              if (adjustment.kind === "undo") {
                undoOverride(adjustment.field);
                toast("Change undone");
                return;
              }
              if (adjustment.kind === "vary") {
                unlock(adjustment.field as UnlockableField);
                // Rolls are immutable: this cannot change the sheet in front of
                // them, only the next one. The copy says which.
                toast(`${adjustment.field === "energy" ? "presence" : adjustment.field} unpinned — applies to your next roll`);
                return;
              }
              setOverride(adjustment.field, adjustment.value as never);
              toast(`${adjustment.value} — applies to your next roll`);
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
          */}
          {!visibleFailure && (awaitingNewRoll || (!roll.data && (startingRoll || shownRollId)))
            ? // Eight skeletons the instant a roll is on its way — the sheet's
              // shape is known long before its contents are.
              Array.from({ length: config.data?.candidatesPerRoll ?? 8 }, (_, index) => (
                <Skeleton
                  key={index}
                  style={{ aspectRatio: "4 / 5" }}
                  label={`CASTING 0${index + 1}`}
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
            <Field className="dp-split__main">
              <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
              <Input
                value={brief}
                onChange={(event) => {
                  const next = event.target.value;
                  setBrief(next);
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
                  const diverged = next.trim() !== (roll.data?.briefText ?? "").trim();
                  if (diverged && Object.keys(overrides).length > 0) {
                    clearOverrides();
                    toast("Brief edited — your adjustments were cleared");
                  }
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
              {awaitingNewRoll ? "Rolling…" : `Roll again · ${price} cr`}
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
            {/*
              THE PRICE, ONCE (founder ruling, 2026-08-02). Rolls and follows
              cost the same thing, so they state it in one persistent place
              adjacent to both rather than on every tile. No tap is unpriced;
              no tap shouts.
            */}
            {price ? (
              <span className="dpc-dock__price">Rolls and follows · {price} cr</span>
            ) : null}
            <span style={{ flex: 1 }} />
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
                Sign to roster{signPrice ? ` · ${signPrice} cr` : ""}
              </Button>
            ) : (
              /*
                The drawn empty state, kept rather than hiding the affordance:
                someone who has not kept anything should learn what Sign wants
                from them, not wonder where it went.

                Archivo, not mono — mono is for machine facts and this is a
                sentence.
              */
              <span className="dp-secondary">Keep the one you want, then sign her</span>
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
          onIndexChange={(next) => setViewerCandidateId(viewerFrames[next]?.candidateId ?? null)}
          onClose={() => setViewerCandidateId(null)}
        />
      ) : null}

      {signing ? (
        <SignConfirm
          indexLabel={signing.indexLabel}
          imageUrl={signing.imageUrl}
          personaLine={signing.personaLine}
          priceCredits={signPrice}
          viewCount={config.data?.packageViewCount ?? 0}
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
                  toast.error(error.message);
                },
              },
            );
          }}
        />
      ) : null}
    </AppShell>
  );
}
