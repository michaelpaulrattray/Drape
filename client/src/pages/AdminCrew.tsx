/**
 * THE CREW TAB — `/admin/crew` (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §6).
 *
 * The briefing the night shifts write, and the box the founder steers from. It
 * replaces the Desk artifact so that WHICH Claude account anyone is logged into
 * stops mattering: the briefing and the steering wheel live in the product he
 * already opens every day.
 *
 * His reading order, mirroring the Desk: program → needs you → pipeline →
 * problems → journal. Single column, restrained, no charts and no KPI tiles —
 * this is a briefing, not a dashboard.
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
import { AdminHeader } from "@/features/admin/AdminHeader";
import { CrewEyeGallery } from "@/features/admin/components/crew/CrewEyeGallery";
import { CrewJournal } from "@/features/admin/components/crew/CrewJournal";
import { CrewNeedsYou } from "@/features/admin/components/crew/CrewNeedsYou";
import { CrewPipeline } from "@/features/admin/components/crew/CrewPipeline";
import { CrewProblems } from "@/features/admin/components/crew/CrewProblems";
import { CrewProgramBanner } from "@/features/admin/components/crew/CrewProgramBanner";
import { useCrewState } from "@/features/admin/components/crew/useCrewState";

/**
 * "checked 12s ago" — coarse on purpose. It re-renders every ten seconds,
 * which is enough for a stamp whose job is to say the page is alive, and
 * far too slow to read as a clock.
 */
function useCheckedAgo(dataUpdatedAt: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);
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
  const checkedAgo = useCheckedAgo(stateQuery.dataUpdatedAt);
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

  const send = useCallback(
    (input: { cardId: string | null; body: string }) => replyMutation.mutateAsync(input),
    [replyMutation],
  );

  /* ─── auth guards, in the shape the other admin pages use ─── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0A0A0A]" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/studio" />;
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      <AdminHeader title="Crew" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {stateQuery.isLoading && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 text-sm text-[#999]">
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
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">This page isn’t switched on yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              The crew briefing is built but dark. It turns on when{" "}
              <span className="font-medium text-[#0A0A0A]">CREW_TAB_SCOPE</span> is set — and the{" "}
              <span className="font-medium text-[#0A0A0A]">crew_replies</span> table has to be
              created first, by running the ceremony against production.
            </p>
          </div>
        )}

        {!stateQuery.data && stateQuery.isError && stateQuery.error.data?.code !== "NOT_FOUND" && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">Something is wrong with this page</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              The tab is switched on, but the briefing could not be loaded. That usually means a
              configuration fault on the server rather than anything you did — the crew will see the
              same error and fix it. Nothing you have written is lost.
            </p>
            <p className="mt-2 text-[11px] text-[#999]">
              {readableFailure(stateQuery.error, "The server refused the request.")}
            </p>
          </div>
        )}

        {stateQuery.data && (
          <>
            <CrewProgramBanner program={stateQuery.data.briefing.program} />

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

            <CrewProblems problems={stateQuery.data.briefing.problems} />

            <CrewJournal
              journal={stateQuery.data.briefing.journal}
              replies={stateQuery.data.replies}
              /* Threads render under open needs-you cards AND open eye items
                 (#75), so the journal's fall-through covers both — a verdict
                 on a closed eye item must land here, never nowhere. */
              cards={[...stateQuery.data.briefing.needsYou, ...stateQuery.data.briefing.eyeItems]}
              acknowledgedReplyIds={stateQuery.data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />

            {/* The edition number, said plainly — there is no history UI and git
                holds the old ones (design §10) — and when the page last checked
                for a new one (#133): an honest liveness signal, not a spinner. */}
            <p className="pt-2 text-[11px] text-[#BBB] text-center" data-testid="crew-edition-stamp">
              Briefing edition {stateQuery.data.briefing.edition}, written by{" "}
              {stateQuery.data.briefing.shift} · checked {checkedAgo}
              {stateQuery.isError && " · the last check failed — trying again"}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
