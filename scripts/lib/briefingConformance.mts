/**
 * THE BRIEFING PARSES, OR THE PUSH DOES NOT FIRE (#169).
 *
 * On 2026-08-27 edition 55 shipped two pipeline rows with `status: "done"` —
 * a value `crewBriefing.ts`'s enum does not hold — and a journal past its
 * 40-entry cap. The rite passed everything it checks (atlas, capability,
 * script guards; deploy SUCCESS, health ×3 200) and production served the
 * founder the DEGRADED Crew page for ~15 minutes, because none of the rite's
 * checks parses the briefing — the one file every edition push changes. The
 * parse arm exists (`server/crew/crewBriefing.test.ts` parses the real file
 * against the real schema) but runs only in `pnpm test` and the PR gate, and
 * editions go straight to main through the rite, never through a PR.
 * `quietEdition.mts` meets an unparseable briefing and steps aside by design
 * ("Let the push carry it to the gate that says so") — on this path there was
 * no gate that says so. This is that gate. Invariant 7.
 *
 * The schema is IMPORTED from `server/crew/crewBriefing.ts` — the module the
 * page itself reads through — never copied here (law 4): a value the page
 * would refuse is a value this judge refuses, by construction. The input is
 * the briefing AT THE COMMIT BEING PUSHED (`git show <sha>:<path>`), not the
 * working tree, so the bytes judged and the bytes deployed are the same by
 * construction.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */
import { crewBriefingSchema } from "../../server/crew/crewBriefing";

export type BriefingConformance = { ok: boolean; why: string };

export const judgeBriefingConformance = (headBriefing: string): BriefingConformance => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(headBriefing);
  } catch (error) {
    return { ok: false, why: `not JSON — ${String(error).split("\n")[0]}` };
  }
  const verdict = crewBriefingSchema.safeParse(parsed);
  if (!verdict.success) {
    const issues = verdict.error.issues.slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    const more = verdict.error.issues.length - issues.length;
    return {
      ok: false,
      why: `${issues.join(" · ")}${more > 0 ? ` · and ${more} more issue${more === 1 ? "" : "s"}` : ""}`,
    };
  }
  return { ok: true, why: "parses against server/crew/crewBriefing.ts" };
};
