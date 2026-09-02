/**
 * THE CREW TAB — `/admin/crew` (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §6).
 *
 * The briefing the night shifts write, and the box the founder steers from. It
 * replaces the Desk artifact so that WHICH Claude account anyone is logged into
 * stops mattering: the briefing and the steering wheel live in the product he
 * already opens every day.
 *
 * His reading order: working now → background work → program → needs you →
 * NEXT UP → for your eyes → what is not done → already dealt with → problems
 * → general. Single column, restrained, no charts and no KPI tiles — this is
 * a briefing, not a dashboard.
 *
 * ⚠ **THE LAST THREE BLOCKS ARE #290/#291/#292, WORKED AS THE ONE PASS HE
 * ORDERED.** The page could say what was running and what had shipped and had
 * no state that meant QUEUED; its pipeline was a 107-row changelog with seven
 * rows claiming he was blocking things his desk said nothing about; and three
 * separate sections all meant "the past". Each is one question he asks, and
 * each now has exactly one place to be answered.
 *
 * # ⚠ BRIEF 08 (#398) CHANGED THE SURFACE AND NOTHING ELSE
 *
 * His §1 is a warning rather than an instruction: *"Crew is already built, and
 * its content architecture is better than my prototype's … where my prototype
 * and the built Crew disagree on content, the built one wins."* So every
 * section keeps its words, its order, its quotes and its one progress number;
 * what changed is the face — house section heads, mono on every measured
 * value, tokens instead of hex, no weight above 500, no italic.
 *
 * Two things worth knowing about this file in particular:
 *
 *  - **The 790px column is NOT here and never was this brief's to add.** #395
 *    gave `StaffSurface` its `measure="read"` and this page already asked for
 *    it. What `crew.css` owns is the 26px gap between sections and the ONE
 *    full-bleed exception, which is the eye gallery.
 *  - **The three state cards above were absent from the brief** — it describes
 *    the briefing, not the page's own failure states — and they held nine of
 *    the surface's colour literals between them. They are on the same grammar.
 *
 * # Two auth layers, and neither is decoration
 *
 * The route is admin-only in the client the way its neighbours are, and
 * `crew.getState` is `adminProcedure` behind `CREW_TAB_SCOPE` on the server.
 * The client guard is a redirect for the person; the server one is the boundary.
 */
import { useCallback, useEffect, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { readableFailure } from "@/lib/failureSentence";
import { trpc } from "@/lib/trpc";
import { StaffBarAdmin, StaffLoading, StaffSurface } from "@/features/staff";
import "@/features/admin/components/crew/crew.css";
import { CrewEyeGallery } from "@/features/admin/components/crew/CrewEyeGallery";
import { CrewGeneral } from "@/features/admin/components/crew/CrewGeneral";
import { CrewNeedsYou } from "@/features/admin/components/crew/CrewNeedsYou";
import { CrewPipeline } from "@/features/admin/components/crew/CrewPipeline";
import { CrewProblems } from "@/features/admin/components/crew/CrewProblems";
import { CrewBackgroundWork } from "@/features/admin/components/crew/CrewBackgroundWork";
import { CrewNextUp } from "@/features/admin/components/crew/CrewNextUp";
import { CrewProgramBanner } from "@/features/admin/components/crew/CrewProgramBanner";
import { CrewRecentHistory } from "@/features/admin/components/crew/CrewRecentHistory";
import { CrewWorkingNow } from "@/features/admin/components/crew/CrewWorkingNow";
import { useCrewState } from "@/features/admin/components/crew/useCrewState";

/**
 * The page's clock — ONE ticker, every ten seconds.
 *
 * ⚠ It is shared rather than per-component on purpose (#272): the "checked 12s
 * ago" stamp and the live shift row's "started 14 min ago" and its stalled
 * verdict are all elapsed-time readings, and two tickers would let them land on
 * two different instants and draw two different nows as one page. Working law 4
 * pointed at a clock.
 *
 * Ten seconds is enough for a stamp whose job is to say the page is alive, and
 * far too slow to read as a clock.
 */
function useNow(dataUpdatedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  /* A fresh read re-bases the clock immediately rather than waiting out the
     interval, so "checked just now" is true the moment it is true. */
  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);
  return now;
}

/** "checked 12s ago" — coarse on purpose. */
function checkedAgoOf(dataUpdatedAt: number, now: number): string {
  if (!dataUpdatedAt) return "just now";
  const seconds = Math.max(0, Math.round((now - dataUpdatedAt) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

export default function AdminCrew() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  /* Live (#133): re-read every minute while visible and on focus. A new
     edition re-renders from the new state — never a reload — and every reply
     box keeps its draft, because the boxes are keyed by card id and only
     re-render. The stamp at the foot says when the page last checked. */
  const stateQuery = useCrewState(isAdmin, { live: true });
  const now = useNow(stateQuery.dataUpdatedAt);
  const checkedAgo = checkedAgoOf(stateQuery.dataUpdatedAt, now);
  const utils = trpc.useUtils();

  const replyMutation = trpc.crew.reply.useMutation({
    /*
      OPTIMISTIC APPEND. The reply is the founder typing a ruling; making him
      watch a spinner to find out whether it landed is the wrong feel for the
      one control on this page. The rollback is the whole cache entry, restored
      from the snapshot, so a failure cannot leave a phantom reply on screen
      claiming to be a ruling.
    */
    onMutate: async (input) => {
      await utils.crew.getState.cancel();
      const previous = utils.crew.getState.getData();
      if (previous) {
        utils.crew.getState.setData(undefined, {
          ...previous,
          replies: [
            {
              /* Negative so it can never collide with a real autoincrement id,
                 and so it can never match an acknowledged id — an unsent reply
                 must not render as "seen by the crew". */
              id: -Date.now(),
              cardId: input.cardId,
              body: input.body,
              createdAt: new Date(),
              /* `auth.me` carries `name` and not the chosen display name, so
                 the optimistic row can differ from the server's for a moment.
                 That is the right trade: the alternative is widening a session
                 projection for a placeholder that lives ~200ms. */
              author: user?.name || "you",
            },
            ...previous.replies,
          ],
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) utils.crew.getState.setData(undefined, context.previous);
      /* A tRPC refusal (the strict schema, the 4,000-character bound) is a
         sentence written for him; a gateway's 502 is not. readableFailure
         keeps the first and replaces the second. The original goes to the
         console, which is not his screen. */
      console.error("[crew] reply failed", error);
      toast.error(readableFailure(error, "That didn't send — your words are still in the box. Try again."));
    },
    /* Settled rather than success: the server's row — with the database's own
       id and timestamp — replaces the optimistic one either way. */
    onSettled: () => {
      void utils.crew.getState.invalidate();
    },
  });

  /*
    HIS SWITCH. No optimistic write, deliberately — unlike the reply box beside
    it, where an optimistic append is the right feel. A switch that flips
    instantly and then silently reverts would tell him background work was off
    when it was on, which is the exact lie this feature exists to prevent. It
    waits for the server's own row and re-reads.
  */
  const workSwitchMutation = trpc.crew.setWorkSwitch.useMutation({
    onError: (error) => {
      console.error("[crew] work switch failed", error);
      toast.error(readableFailure(error, "That didn't save — the switch is unchanged. Try again."));
    },
    onSettled: () => {
      void utils.crew.getState.invalidate();
    },
  });

  /*
    HIS "NOT RELEVANT" TAP (#325). Same discipline as the switch above and for
    the same reason: no optimistic write. A mark that appeared instantly and
    silently reverted would tell him a card was on its way out when nothing had
    been recorded, and this one ends in a shift closing something.

    `flyingCard` is the ONE card mid-flight, so a slow round trip dims the
    button he pressed rather than every button on the panel.
  */
  const [flyingCard, setFlyingCard] = useState<number | null>(null);
  const cardIntentMutation = trpc.crew.setCardIntent.useMutation({
    onError: (error) => {
      console.error("[crew] card intent failed", error);
      toast.error(readableFailure(error, "That didn't save — the card is unchanged. Try again."));
    },
    onSettled: () => {
      setFlyingCard(null);
      void utils.crew.getState.invalidate();
    },
  });

  const markCard = useCallback(
    (issueNumber: number, intent: "close" | null) => {
      setFlyingCard(issueNumber);
      cardIntentMutation.mutate({ issueNumber, intent });
    },
    [cardIntentMutation],
  );

  const send = useCallback(
    (input: { cardId: string | null; body: string }) => replyMutation.mutateAsync(input),
    [replyMutation],
  );

  /* ─── auth guards, in the shape the other admin pages use ─── */
  if (authLoading) {
    return <StaffLoading />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  return (
    <StaffSurface breadcrumb="Admin / Crew" measure="read" bar={<StaffBarAdmin />}>
      <main className="dp-crew">
        {stateQuery.isLoading && (
          <div className="dp-crew__card dp-crew__body dp-crew__body--quiet">
            Loading the briefing…
          </div>
        )}

        {/* NOT_FOUND is the flag saying no — the deliberate dark state. Any
            OTHER failure is a fault this diff deliberately surfaces (a missing
            database, a malformed scope value), and telling the admin the page
            "isn't switched on" would be a configuration fault wearing the
            wrong sentence (PR #72 review, finding 3). */}
        {/* Both fault cards render only when there is NO briefing to show: a
            failed BACKGROUND poll (a deploy blip, once per new edition) keeps
            the cached briefing and must not wear the sentence written for a
            malformed scope — the stamp at the foot says the check failed and
            the next tick retries (PR #135 review, findings 1–2). */}
        {!stateQuery.data && stateQuery.isError && stateQuery.error.data?.code === "NOT_FOUND" && (
          <div className="dp-crew__card">
            <h2 className="dp-crew__title">This page isn’t switched on yet</h2>
            <p className="dp-crew__body dp-crew__body--soft dp-crew__gap--tight">
              The crew briefing is built but dark. It turns on when{" "}
              <span className="dp-crew__strong">CREW_TAB_SCOPE</span> is set — and the{" "}
              <span className="dp-crew__strong">crew_replies</span> table has to be created
              first, by running the ceremony against production.
            </p>
          </div>
        )}

        {!stateQuery.data && stateQuery.isError && stateQuery.error.data?.code !== "NOT_FOUND" && (
          <div className="dp-crew__card">
            <h2 className="dp-crew__title">Something is wrong with this page</h2>
            <p className="dp-crew__body dp-crew__body--soft dp-crew__gap--tight">
              The tab is switched on, but the briefing could not be loaded. That usually means a
              configuration fault on the server rather than anything you did — the crew will see the
              same error and fix it. Nothing you have written is lost.
            </p>
            <p className="dp-crew__mono dp-crew__gap--tight">
              {readableFailure(stateQuery.error, "The server refused the request.")}
            </p>
          </div>
        )}

        {stateQuery.data && (
          <>
            {/* FIRST ON THE PAGE, on his own instruction (#437, 2026-09-02):
                he was offered a split that would put only the one-line mission
                up here — with a recommendation FOR it — and answered "yes the
                easier fix", taking the whole banner instead.

                ⚠ **The cost is known and accepted, and is not a defect to
                report later**: this is the tallest block on the page (chips,
                mission, focus, his quote, milestone, progress, steps, rungs),
                so WORKING NOW sits below the fold on a short window. Do NOT
                "help" by shrinking, collapsing, truncating or making it sticky
                — every one of those is the split he declined wearing a
                different name. If it reads badly he will say so, and that will
                be a new instruction. */}
            <CrewProgramBanner program={stateQuery.data.briefing.program} />

            {/* ⚠ REVERSED BY HIS ORDER (#437). This said "ABOVE the program
                (#272) … the only thing on the page that outranks the briefing"
                — honest reasoning that lost to his, not clutter, and kept here
                so nobody restores the old order as a fix.

                It still leads everything that describes what the team has
                DONE. `now` comes from the same ticker the "checked" stamp
                uses, so the strip's "14 min ago" and the page's freshness can
                never disagree. */}
            <CrewWorkingNow shiftRuns={stateQuery.data.shiftRuns} now={now} />

            {/* WHAT IS PLANNED (#290) — moved directly under WORKING NOW on
                his instruction (#437, 2026-09-02: *"moving the next up card in
                the crew tab under working now"*). What is happening and what
                happens next are one question in two halves, and four sections
                used to sit between them.

                ⚠ **Its own earlier reasoning is REVERSED and kept**: it said
                "it sits under Needs You rather than above it because a
                question waiting on him outranks a queue that is merely next."
                NEXT UP is now ABOVE Needs You, which is exactly what that
                sentence argued against. A docblock left arguing the opposite
                of the code is the failure this repository keeps re-finding. */}
            <CrewNextUp
              nextUp={stateQuery.data.briefing.nextUp}
              cards={stateQuery.data.briefing.needsYou}
            />

            {/* ⚠ ITS ADJACENCY IS BROKEN BY HIS ORDER (#437), and the reason
                is kept rather than deleted: #277 put this directly under
                WORKING NOW because "the two answer one question — what is
                happening while he is not looking." NEXT UP now sits between
                them on his word. The reasoning was sound; it lost to his. */}
            <CrewBackgroundWork
              workState={stateQuery.data.workState}
              cardIntents={stateQuery.data.cardIntents}
              now={now}
              onToggle={(switchKey, enabled) =>
                workSwitchMutation.mutate({ switchKey: switchKey as never, enabled })}
              onIntent={markCard}
              pending={workSwitchMutation.isPending}
              intentPendingCard={cardIntentMutation.isPending ? flyingCard : null}
            />

            <CrewNeedsYou
              cards={stateQuery.data.briefing.needsYou}
              replies={stateQuery.data.replies}
              acknowledgedReplyIds={stateQuery.data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />

            <CrewEyeGallery
              items={stateQuery.data.briefing.eyeItems}
              replies={stateQuery.data.replies}
              acknowledgedReplyIds={stateQuery.data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />

            <CrewPipeline items={stateQuery.data.briefing.pipeline} />

            {/* ONE history block where there were three (#292): Needs You's
                "Recently answered", the gallery's "Already judged" and the
                pipeline's "Recently landed" were the same idea said three
                times — his word for it was "double ups". */}
            <CrewRecentHistory
              cards={stateQuery.data.briefing.needsYou}
              eyeItems={stateQuery.data.briefing.eyeItems}
              pipeline={stateQuery.data.briefing.pipeline}
            />

            <CrewProblems problems={stateQuery.data.briefing.problems} />

            {/* THE GENERAL BOX (#293) — this was the journal, which carried the
                shifts' own entries and his cardless replies in one list. He
                removed the shift entries ("id remove the journal because
                nights should auto park…"); asked where his cardless replies
                should then go, his whole answer was "Keep a General box." */}
            <CrewGeneral
              replies={stateQuery.data.replies}
              /* Threads render under open needs-you cards AND open eye items
                 (#75), so the General box's fall-through covers both — a
                 verdict on a closed eye item must land here, never nowhere. */
              cards={[...stateQuery.data.briefing.needsYou, ...stateQuery.data.briefing.eyeItems]}
              acknowledgedReplyIds={stateQuery.data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />

            {/* The edition number, said plainly — there is no history UI and git
                holds the old ones (design §10) — and when the page last checked
                for a new one (#133): an honest liveness signal, not a spinner. */}
            <p className="dp-crew__stamp" data-testid="crew-edition-stamp">
              Briefing edition {stateQuery.data.briefing.edition}, written by{" "}
              {stateQuery.data.briefing.shift} · checked {checkedAgo}
              {stateQuery.isError && " · the last check failed — trying again"}
            </p>
          </>
        )}
      </main>
    </StaffSurface>
  );
}
