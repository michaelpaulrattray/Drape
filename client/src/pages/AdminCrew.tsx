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
import { useCallback } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { readableFailure } from "@/lib/failureSentence";
import { trpc } from "@/lib/trpc";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { CrewJournal } from "@/features/admin/components/crew/CrewJournal";
import { CrewNeedsYou } from "@/features/admin/components/crew/CrewNeedsYou";
import { CrewPipeline } from "@/features/admin/components/crew/CrewPipeline";
import { CrewProblems } from "@/features/admin/components/crew/CrewProblems";
import { CrewProgramBanner } from "@/features/admin/components/crew/CrewProgramBanner";
import { useCrewState } from "@/features/admin/components/crew/useCrewState";

export default function AdminCrew() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  const stateQuery = useCrewState(isAdmin);
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

        {stateQuery.isError && (
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

            <CrewPipeline items={stateQuery.data.briefing.pipeline} />

            <CrewProblems problems={stateQuery.data.briefing.problems} />

            <CrewJournal
              journal={stateQuery.data.briefing.journal}
              replies={stateQuery.data.replies}
              cards={stateQuery.data.briefing.needsYou}
              acknowledgedReplyIds={stateQuery.data.briefing.acknowledgedReplyIds}
              sending={replyMutation.isPending}
              onSend={send}
            />

            {/* The edition number, said plainly — there is no history UI and git
                holds the old ones (design §10). */}
            <p className="pt-2 text-[11px] text-[#BBB] text-center">
              Briefing edition {stateQuery.data.briefing.edition}, written by{" "}
              {stateQuery.data.briefing.shift}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
