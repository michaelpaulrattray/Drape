/**
 * THE CREW TAB — `/admin/crew` (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §6).
 *
 * The briefing the night shifts write, and the box the founder steers from. It
 * replaces the Desk artifact so that WHICH Claude account anyone is logged into
 * stops mattering: the briefing and the steering wheel live in the product he
 * already opens every day.
 *
 * His reading order: **the program → needs you → for your eyes →
 * happening now (working now → in flight → next up) → since you last looked →
 * background work → problems.** Single column, restrained, no charts and no
 * KPI tiles — this is a briefing, not a dashboard.
 *
 * ⚠ **#1201 (2026-09-25) put WORKING NOW, IN FLIGHT and NEXT UP on one card
 * and removed the GENERAL box, both on his word**: *"shouldnt next up card
 * and in flight card and working now card be together or on the same card
 * for an easy visual overlook?"* and *"remove the general card from the crew
 * tab i literally never use it"*. His rulings arrive as replies on cards, or
 * in the terminal through the relay. PROBLEMS now draws only actionable
 * faults (`problemsFor`).
 *
 * ⚠ **THAT ORDER IS #1193's (2026-09-25) AND IT REPLACES #437's.** His words:
 * *"the feedback on the crew page is so delayed and disoganised in terms of
 * the Ui/UX like its difficult for me to decipher what is actually going on …
 * i must be able to see the main program we are working on which milestones
 * we are on etc still thats important for me"*. So the program stays first
 * (his "still"), and after it the page runs in order of his attention: what
 * needs HIM, then what is happening, what just happened, what is next, and
 * only then the switches. #437 had NEXT UP and BACKGROUND WORK above NEEDS
 * YOU; that reasoning is kept in git and lost to his.
 *
 * **AND THE PAGE IS LIVE.** Every list drawn from the queue — the ladder's
 * cards, next up, in flight, since you last looked — is derived on the server
 * from GitHub every 30 s (`server/crew/liveQueue.ts`), never copied from the
 * edition, and each block stamps where its reading came from. The edition
 * keeps what only a shift can write: the mission, focus, milestone, rung
 * states, the card explanations, eye items and problems.
 *
 * ⚠ **`ALREADY DEALT WITH` WAS THE TENTH AND HE DELETED IT (#438, 2026-09-02),
 * verbatim: *"do you think already dealt with and not done yet are card we even
 * need? i can see progress in working now it shows me whats shipped i can also
 * see how my features are travelling under the program?"*** He was right about
 * one and inverted on the other, and the measurement is why the two answers
 * differ: at edition 209 that block rendered **281 rows** while `THE PIPELINE`
 * rendered **none**. It was the fourth telling of *done* — `WORKING NOW` names
 * the shifts and what each shipped, `THE PROGRAM` ticks the steps as they land,
 * and this listed all 281 forever.
 *
 * ⚠ **THIS IS #292 CARRIED TO ITS END, NOT A REVERSAL OF IT.** #292 collapsed
 * three history lists into one because he called them *"double ups"*; the
 * merged pipeline rows were MOVED here rather than retired, and the changelog
 * grew back. Brief 08 §7's *"do not split history back apart"* is answered
 * rather than broken — one list did not become two, it became none, and the
 * rows themselves are untouched in `crew-briefing.json`, in git, and in
 * `WORKING NOW`'s closed runs. `section08-guard.test.ts` now asserts the
 * section is GONE where it used to assert it was single.
 *
 * ⚠ **THAT ORDER CHANGED ON HIS WORD (#437, 2026-09-02) AND THE OLD ONE IS
 * KEPT HERE**, because a reader who knows only the new one cannot tell a
 * deliberate ruling from a drift. It used to read *working now → background
 * work → program → needs you → NEXT UP → …*; he moved THE PROGRAM to the top
 * whole (*"yes the easier fix"*, over a split that would have lifted only the
 * mission line) and NEXT UP up under WORKING NOW (*"moving the next up card in
 * the crew tab under working now"*). The mount sites below carry the same
 * reversal beside each element, and `section08-guard.test.ts` pins the list.
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
import {
  StaffBarAdmin,
  StaffLoading,
  StaffSurface,
  useStaffAutoRefresh,
  useStaffRefresh,
} from "@/features/staff";
/* The foundation stylesheet must precede crew.css in the cascade: crew's
   machine-fact classes are stacked on `.dp-chrome` at equal specificity, so
   source order is what lets `.dp-crew__mono` tune the size (#524). Until now
   that order held only through `@/features/staff` happening to import the
   barrel first; `registerStack-guard.test.ts` pins it, so it is said here. */
import "@/foundation";
import "@/features/admin/components/crew/crew.css";
import { CrewEyeGallery } from "@/features/admin/components/crew/CrewEyeGallery";
import { CrewNeedsYou } from "@/features/admin/components/crew/CrewNeedsYou";
import { CrewPipeline } from "@/features/admin/components/crew/CrewPipeline";
import { CrewSinceYouLooked } from "@/features/admin/components/crew/CrewSinceYouLooked";
import { eyeItemsFor, ladderCardsFor, needsYouFor, nextUpFor, problemsFor, queueReadOf } from "@/features/admin/components/crew/crewTypes";
import { useLastSeen } from "@/features/admin/components/crew/useLastSeen";
import { CrewProblems } from "@/features/admin/components/crew/CrewProblems";
import { CrewBackgroundWork } from "@/features/admin/components/crew/CrewBackgroundWork";
import { CrewNextUp } from "@/features/admin/components/crew/CrewNextUp";
import { CrewSkeleton } from "@/features/admin/components/crew/CrewSkeleton";
import { CrewProgramBanner } from "@/features/admin/components/crew/CrewProgramBanner";
import { staffDateTime } from "@/foundation/staffDate";
import { CrewHappeningNow } from "@/features/admin/components/crew/CrewHappeningNow";
import { CrewNav } from "@/features/admin/components/crew/CrewNav";
import { landedSince } from "@/features/admin/components/crew/CrewSinceYouLooked";
import { useCrewState } from "@/features/admin/components/crew/useCrewState";

/**
 * The page's clock — ONE ticker, every ten seconds.
 *
 * ⚠ It is shared rather than per-component on purpose (#272): every elapsed-
 * time reading on the page comes off it, so two of them can never land on two
 * different instants and draw two different nows as one page. Working law 4
 * pointed at a clock.
 *
 * ⚠ **It used to have TWO consumers and now has one.** The other was the
 * *"checked 12s ago"* stamp, which #415 moved into the staff bar on his word
 * (*"even thought crew has its own refresh principles should we just fold it
 * into the same as overview so everything is consistent"*). What is left is
 * `WORKING NOW`'s *"started 14 min ago"* and its stalled verdict — still two
 * readings that must agree, so the ticker keeps its reason to exist.
 *
 * It still re-bases on `dataUpdatedAt` because that is when the shift rows it
 * ages are replaced: a fresh read must not leave a run reading "14 min ago"
 * from the previous instant.
 *
 * Ten seconds is enough for an elapsed reading whose job is to say the page is
 * alive, and far too slow to read as a clock.
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

export default function AdminCrew() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  /*
    ⚠ CREW IS IN THE SHARED REFRESH CLUSTER NOW (#415), ON HIS WORD: *"even
    thought crew has its own refresh principles should we just fold it into the
    same as overview so everything is consistent"*.

    What that changes, said plainly because it is a real trade and not a
    tidy-up: the page's live re-read (#133) used to be unconditional at 60s
    while the tab was visible. It is now the panel-wide `AUTO 30s` switch —
    **on by default (#453), so the live behaviour he asked for in #133 is
    unchanged out of the box**, but a founder who turns the switch off gets a
    Crew page that stops polling like every other staff page, with the manual
    button beside the stamp. Thirty seconds rather than sixty because the bar's
    label SAYS thirty, and a switch that reads `AUTO 30s` over a page polling
    at 60s is a control lying about itself.

    A new edition still re-renders from the new state — never a reload — and
    every reply box keeps its draft, because the boxes are keyed by card id.
  */
  const [autoRefresh, setAutoRefresh] = useStaffAutoRefresh();
  // staff-poll: watched — the briefing is written by a shift, never by this page; the switch reaches the hook as `live`
  const stateQuery = useCrewState(isAdmin, { live: autoRefresh });
  const now = useNow(stateQuery.dataUpdatedAt);
  const lastSeenAt = useLastSeen();
  const refreshControls = useStaffRefresh({
    autoRefresh,
    setAutoRefresh,
    dataUpdatedAt: stateQuery.dataUpdatedAt,
    isRefetching: stateQuery.isFetching,
    onRefresh: () => {
      void stateQuery.refetch();
    },
  });
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
    <StaffSurface
      breadcrumb="Admin / Crew"
      measure="read"
      bar={<StaffBarAdmin refreshControls={refreshControls} />}
    >
      <main className="dp-crew">
        {/* ⚠ **SKELETONS AT THE REAL HEIGHT, NOT A SENTENCE (#414 item 8).**
            This was one quiet line reading `Loading the briefing…` — the
            shortest possible stand-in for the longest page in the product, so
            the whole column jumped when the briefing landed. His own card
            names the loading state explicitly and calls it the one item that
            is not cosmetic. `CrewSkeleton`'s docblock carries the argument,
            including why the spinner that was one import away is declined. */}
        {stateQuery.isLoading && <CrewSkeleton />}

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
            {/* readableFailure returns OUR sentence, written for a reader (its own
                contract) — so it takes the reading face, not the machine one
                (#524's class: a sentence set in mono reads as output). */}
            <p className="dp-crew__body dp-crew__body--quiet dp-crew__gap--tight">
              {readableFailure(stateQuery.error, "The server refused the request.")}
            </p>
          </div>
        )}

        {stateQuery.data && (() => {
          const data = stateQuery.data;
          const live = data.live;
          const queueRead = queueReadOf(live, data.briefing.program.ladderCards.readAt);
          const intentPending = cardIntentMutation.isPending ? flyingCard : null;
          /* A card GitHub has closed stops asking him, whatever the edition
             still says about it (#1193). */
          const needsYou = needsYouFor(live, data.briefing.needsYou);
          const problems = problemsFor(live, data.briefing.problems);
          const nextUp = nextUpFor(live, data.briefing);
          /* And a card GitHub has closed stops asking for his eye (his question, 2026-09-25). */
          const eyeItems = eyeItemsFor(live, data.briefing.eyeItems);
          const eyes = eyeItems.length;
          const landed = live.available ? landedSince(live.desk.recent, lastSeenAt) : 0;
          const inFlight = live.available ? live.desk.pullRequests.length : 0;
          return (
          <>
            {/* FIRST ON THE PAGE, on his own instruction (#437, 2026-09-02),
                re-stated 2026-09-25 (#1193): *"i must be able to see the main
                program we are working on which milestones we are on etc
                still"*. The rung counts it draws are LIVE now — the ladder's
                cards come from GitHub through `ladderCardsFor`, the edition's
                own list only when GitHub has not answered — and the stamp on
                the ladder head says which. */}
            {/* THE SECTION MENU (#1201) — jumps and counts; it replaces the
                readings block he barely read. */}
            <CrewNav
              items={[
                { id: "crew-section-program", label: "Program" },
                { id: "crew-section-needs-you", label: "Needs you", count: needsYou.length + eyes },
                { id: "crew-section-happening", label: "Happening now", count: inFlight },
                { id: "crew-section-since", label: "Since you looked", count: landed, fresh: true },
                { id: "crew-section-next-up", label: "Next up", count: nextUp.items.length },
                { id: "crew-section-background", label: "Background work" },
                { id: "crew-section-problems", label: "Problems", count: problems.length },
              ]}
            />
            <div id="crew-section-program" />
            <CrewProgramBanner
              program={data.briefing.program}
              ladderCards={ladderCardsFor(live, data.briefing)}
              finished={live.available ? live.desk.finishedLadder : []}
              closedCards={live.available ? live.desk.closedCards : []}
              queueRead={queueRead}
              now={now}
              cardIntents={data.cardIntents}
              onIntent={markCard}
              intentPendingCard={intentPending}
            />
            {/* WHAT NEEDS HIM, before anything the team is doing — #1193's
                order. A question waiting on him outranks a queue that is
                merely running (#277's own argument, which #437 overrode and
                his 2026-09-25 word restores). */}
            <div id="crew-section-needs-you" />
            <CrewNeedsYou
              cards={needsYou}
              replies={data.replies}
              acknowledgedReplyIds={data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />
            <CrewEyeGallery
              items={eyeItems}
              replies={data.replies}
              acknowledgedReplyIds={data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />
            {/* WHAT IS HAPPENING, ON ONE CARD (#1201): the live shift strip,
                every open PR, then the ordered band — the three blocks his
                word put together. `now` is one ticker for all of them, so
                "started 14 min ago" and "touched 2 min ago" cannot disagree
                (#272). */}
            <div id="crew-section-happening" />
            <div id="crew-section-next-up" />
            <CrewHappeningNow
              shiftRuns={data.shiftRuns}
              live={live}
              pipelineSnapshot={data.briefing.pipeline}
              nextUp={nextUp}
              cards={needsYou}
              queueRead={queueRead}
              now={now}
            />
            {/* WHAT JUST HAPPENED (#1193) — merged and closed in the last two
                days, with a mark on what landed after his previous visit. */}
            <div id="crew-section-since" />
            <CrewSinceYouLooked live={live} queueRead={queueRead} now={now} lastSeenAt={lastSeenAt} />
            <div id="crew-section-background" />
            <CrewBackgroundWork
              workState={data.workState}
              cardIntents={data.cardIntents}
              now={now}
              onToggle={(switchKey, enabled) =>
                workSwitchMutation.mutate({ switchKey: switchKey as never, enabled })}
              onIntent={markCard}
              pending={workSwitchMutation.isPending}
              intentPendingCard={intentPending}
            />
            {/* Actionable faults only, retired live when their card closes (#1201). */}
            <div id="crew-section-problems" />
            <CrewProblems problems={problems} />
            {/* The edition stamp — WHO wrote the crew's notes and WHEN (#415,
                #329) — and beside it the live half's own reading, because the
                two are different facts: a shift last wrote at 09:01 and
                GitHub was read twelve seconds ago. The bar above still says
                when the PAGE last checked. */}
            <p className="dp-chrome dp-crew__stamp" data-testid="crew-edition-stamp">
              Briefing edition {stateQuery.data.briefing.edition}, written{" "}
              {staffDateTime(stateQuery.data.briefing.updatedAt)} by{" "}
              {stateQuery.data.briefing.shift}
              {live.available
                ? ` · GitHub read ${staffDateTime(live.desk.readAt)}${live.stale ? " and not answering since" : ""}`
                : " · GitHub has not answered yet"}
              {stateQuery.isError && " · the last check failed — trying again"}
            </p>
          </>
          );
        })()}
      </main>
    </StaffSurface>
  );
}
