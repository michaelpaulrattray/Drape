import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Button,
  DerivedChip,
  Dock,
  EmptyState,
  Field,
  Input,
  Instruction,
  Skeleton,
} from "@/foundation";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import "@/features/castingV2/castingV2.css";
import { CandidateTile, UndoDiscard } from "@/features/castingV2/components/CandidateTile";
import { ShortlistTray } from "@/features/castingV2/components/ShortlistTray";
import { useSheetState, type UnlockableField } from "@/features/castingV2/sheetState";

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
  } = useSheetState();
  const [brief, setBrief] = useState("");

  const config = trpc.castingV2.config.useQuery({});
  const session = trpc.castingV2.getSession.useQuery(
    { sessionId },
    { enabled: sessionId.length > 0, refetchInterval: POLL_MS },
  );

  const activeRollId = session.data?.activeRollId ?? null;
  const roll = trpc.castingV2.getRoll.useQuery(
    { rollId: activeRollId ?? "" },
    {
      enabled: Boolean(activeRollId),
      /*
        Poll only while there is something to wait for. A finished sheet polled
        forever is 24 requests a minute per tab against a 60/min limit — two
        tabs and the session poll and the user rate-limits themselves out of
        their own sheet.
      */
      refetchInterval: (query) =>
        query.state.data && TERMINAL_ROLL_STATUSES.has(query.state.data.status) ? false : POLL_MS,
    },
  );

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

  const onKeep = guardedMutation((input: { candidateId: string; kept: boolean }) =>
    keep.mutateAsync(input).then(() => {
      toast(input.kept ? "Kept" : "Removed from kept");
    }),
  );

  const onDiscard = guardedMutation((input: { candidateId: string }) =>
    discard.mutateAsync(input).then(() => {
      setUndoable(input.candidateId);
      toast("Discarded");
    }),
  );

  const onUndo = async () => {
    if (!undoable) return;
    await utils.castingV2.getRoll.cancel();
    await undo.mutateAsync({ candidateId: undoable });
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
    const clientRequestId = createClientRequestId();
    const options = {
      onError: (error: { message: string }) => {
        setStartingRoll(false);
        toast(error.message);
      },
      onSuccess: () => {
        void invalidate();
      },
      onSettled: () => setStartingRoll(false),
    };

    rollDispatched();
    setStartingRoll(true);

    if (mode === "follow" && candidateId) {
      follow.mutate(
        {
          clientRequestId,
          sessionId,
          candidateId,
          briefText: brief,
          unlock: unlocked.length > 0 ? unlocked : undefined,
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
  const isGenerating = (roll.data?.counts.casting ?? 0) > 0;
  const lineageLabel = useMemo(() => {
    const fromRoll = roll.data?.lineage.fromRollId;
    return fromRoll && roll.data ? `FROM ${String(roll.data.rollIndex - 1).padStart(2, "0")}` : null;
  }, [roll.data]);

  if (!sessionId) return null;

  return (
    <AppShell breadcrumb="Casting / Sheet" current="casting" width="working">
      <div className="dp-dock-scroll dp-stack" style={{ gap: 22 }}>
        <div className="dp-row" style={{ justifyContent: "space-between" }}>
          <Button variant="quiet" size="small" onClick={() => navigate("/casting")}>
            <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
            Casting
          </Button>
          {roll.data ? (
            <span className="dp-metadata">
              Roll {roll.data.rollIndex} · {roll.data.counts.ready} of {roll.data.counts.total}
            </span>
          ) : null}
        </div>

        {roll.data && roll.data.chips.length > 0 ? (
          <div className="dp-row">
            {roll.data.chips.map((chip) =>
              chip.removable && chip.field ? (
                <DerivedChip
                  key={`${chip.kind}:${chip.label}`}
                  label={chip.label}
                  removeLabel={`Stop pinning ${chip.label} on the next roll`}
                  onRemove={() => {
                    unlock(chip.field as UnlockableField);
                    // Rolls are immutable: this cannot change the sheet in
                    // front of them, only the next one. The toast says which.
                    toast(`${chip.label} unpinned — applies to your next roll`);
                  }}
                />
              ) : (
                <span key={`${chip.kind}:${chip.label}`} className="dp-chip dp-chip--static">
                  {chip.label}
                </span>
              ),
            )}
          </div>
        ) : null}

        {/*
          An empty sheet is a real state and gets real copy. It happens when a
          roll was refused after the user had already been moved here — and
          eight skeletons that never resolve would be a far worse answer than
          one honest line.
        */}
        {!activeRollId && !startingRoll && session.isFetched ? (
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
          {!roll.data && (startingRoll || activeRollId)
            ? // Eight skeletons the instant a roll is on its way — the sheet's
              // shape is known long before its contents are.
              Array.from({ length: config.data?.candidatesPerRoll ?? 8 }, (_, index) => (
                <Skeleton
                  key={index}
                  style={{ aspectRatio: "4 / 5" }}
                  label={`CASTING 0${index + 1}`}
                />
              ))
            : candidates.map((candidate) => (
                <CandidateTile
                  key={candidate.candidateId}
                  candidate={candidate}
                  lineageLabel={lineageLabel}
                  rollWasCancelled={rollWasCancelled}
                  busy={isPending(candidate.candidateId)}
                  onKeep={() =>
                    onKeep(candidate.candidateId, {
                      candidateId: candidate.candidateId,
                      kept: !candidate.kept,
                    })
                  }
                  onDiscard={() =>
                    onDiscard(candidate.candidateId, { candidateId: candidate.candidateId })
                  }
                  onFollow={() => dispatchRoll("follow", candidate.candidateId)}
                />
              ))}
        </div>

        <ShortlistTray entries={session.data?.shortlist ?? []} />
      </div>

      <div className="dp-dock-fade">
        <Dock>
          <div className="dp-row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <Field className="dp-split__main">
              <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
              <Input
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="a dad in his 30s in a cluttered garage, dry humour"
                aria-label="Casting brief"
              />
            </Field>
            {/*
              D-15: the price rides on the button, always visible, never behind
              a confirm step. Nudge chips carry no price of their own precisely
              because this button is next to them.
            */}
            <Button variant="primary" onClick={() => dispatchRoll("roll")}>
              Roll again · {price} cr
            </Button>
          </div>
          <div className="dp-row">
            <Instruction>Keep the ones worth a second look</Instruction>
            <span style={{ flex: 1 }} />
            {undoable ? <UndoDiscard onUndo={onUndo} busy={undo.isPending} /> : null}
            {isGenerating ? (
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
