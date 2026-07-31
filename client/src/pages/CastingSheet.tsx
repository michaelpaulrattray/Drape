import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
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
import { useSheetState, type UnlockableField } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import { classifyDispatchFailure, failureActionLabel } from "@/features/castingV2/dispatchFailure";

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
    provisionalRollIndex,
    beginProvisionalRoll,
  } = useSheetState();
  const [brief, setBrief] = useState("");

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
        THE ROLL ARRIVING PROVES THE FAILURE WRONG.

        `createRoll` does not return until all eight candidates land — about
        seventy seconds — and rows commit BEFORE dispatch. So a gateway that
        gives up on that request leaves the server working normally while the
        client's mutation rejects, and the sheet said "the roll didn't start"
        above eight tiles that were visibly casting.

        The poll is the authority here, not the mutation's outcome. Once the
        roll exists, the client's opinion about whether it started is simply
        out of date, and the banner has to go — the design law that skeletons
        never sit under a failure message was written for precisely this, and
        it was the failure that was wrong rather than the skeletons.
      */
      setDispatchFailure(null);
    }
  }, [activeRollId, latch, setStartingRoll, beginProvisionalRoll, setDispatchFailure]);

  /**
   * A dispatch is in flight and its roll has not appeared yet.
   *
   * Drives both halves of the fix: the paid affordances disable, and the grid
   * swaps to skeletons in the same frame as the click, so Follow and Roll
   * again answer as immediately as Cast it does.
   */
  const awaitingNewRoll = startingRoll && latch.held && !dispatchFailure;

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
      refetchInterval: (query) =>
        query.state.data && TERMINAL_ROLL_STATUSES.has(query.state.data.status) ? false : POLL_MS,
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

  // The brief field starts as the roll's own sentence, so "roll again" is an
  // edit of what they asked for rather than a blank box.
  useEffect(() => {
    if (roll.data?.briefText && brief === "") setBrief(roll.data.briefText);
  }, [roll.data?.briefText, brief]);

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

    const clientRequestId = createClientRequestId();
    const release = () => {
      latch.release();
      setStartingRoll(false);
    };
    const onFailure = (error: unknown) => {
      release();
      setDispatchFailure(classifyDispatchFailure(error));
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
    setStartingRoll(true);
    // Rolling from a historical view jumps you to what you just paid for.
    setViewedRollId(null);

    if (mode === "follow" && candidateId) {
      follow.mutate(
        {
          clientRequestId,
          sessionId,
          candidateId,
          briefText: brief,
          unlock: unlocked.length > 0 ? unlocked : undefined,
          overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
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
          overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        },
        options,
      );
    }
    void invalidate();
  };

  const onCancel = async () => {
    if (!activeRollId) return;
    const result = await cancel.mutateAsync({ rollId: activeRollId });
    /*
      A point-in-time number, and worded as one. Candidates already with the
      provider land seconds or minutes later and refund then, under the
      generosity rule — so a total stated here as final would be wrong by the
      time the user reads their balance.
    */
    toast(
      result.refundRecorded
        ? `Cancelled · ${result.refundedCredits} credits back so far`
        : "Cancelled — part of the refund could not be recorded. Support has the details.",
    );
    await invalidate();
  };

  const price = config.data?.rollPriceCredits ?? 0;
  const candidates = roll.data?.candidates ?? [];
  const rollWasCancelled = roll.data?.status === "cancelled";

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
    return parent ? `roll ${String(parent.rollIndex).padStart(2, "0")}` : null;
  }, [roll.data?.lineage.fromRollId, rolls]);

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
        {dispatchFailure ? (
          <EmptyState
            title={
              dispatchFailure.kind === "refused"
                ? "That brief can't be cast"
                : /*
                    "The roll didn't start" is a claim, and on a transport
                    failure it is one we cannot make: we never heard back, and
                    the roll commits its rows before it dispatches. The other
                    kinds ARE refusals the server told us about, so they can
                    keep the definite title.
                  */
                  dispatchFailure.kind === "unavailable"
                  ? "We lost contact"
                  : "The roll didn't start"
            }
            body={dispatchFailure.message}
            action={
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  setDispatchFailure(null);
                  navigate("/casting");
                }}
              >
                {failureActionLabel(dispatchFailure.kind)}
              </Button>
            }
          />
        ) : null}

        {/*
          An empty sheet is a real state and gets real copy — a session that
          exists with nothing cast on it yet.
        */}
        {!shownRollId && !startingRoll && !dispatchFailure && session.isFetched ? (
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
          {!dispatchFailure && (awaitingNewRoll || (!roll.data && (startingRoll || shownRollId)))
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
                  candidate={{
                    ...candidate,
                    kept: optimisticKept[candidate.candidateId] ?? candidate.kept,
                  }}
                  lineageLabel={lineageLabel}
                  rollWasCancelled={rollWasCancelled}
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
                onChange={(event) => setBrief(event.target.value)}
                placeholder="a fitness creator in their 30s, close-cropped hair"
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
            {shortlist.length > 0 ? (
              <span
                className="dpc-keptstack"
                title={`${shortlist.length} kept across this sheet`}
              >
                {shortlist.slice(0, 4).map((entry) =>
                  entry.thumbUrl || entry.imageUrl ? (
                    <img
                      key={entry.candidateId}
                      className="dpc-keptstack__chip"
                      src={entry.thumbUrl ?? entry.imageUrl ?? undefined}
                      alt=""
                    />
                  ) : (
                    <span key={entry.candidateId} className="dpc-keptstack__chip" />
                  ),
                )}
              </span>
            ) : null}
            {/*
              The eyebrow flips on the click too. "Keep the ones worth a second
              look" is an instruction for a sheet you can act on; while eight
              are being cast there is nothing to keep yet, and leaving it up was
              part of what made the chrome feel a beat behind the tiles.
            */}
            {awaitingNewRoll ? (
              <Instruction>Casting {config.data?.candidatesPerRoll ?? 8}…</Instruction>
            ) : shortlist.length > 0 ? (
              <span className="dp-small" style={{ marginLeft: 12 }}>
                {shortlist.length} kept
              </span>
            ) : (
              <Instruction>Keep the ones worth a second look</Instruction>
            )}
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
    </AppShell>
  );
}
