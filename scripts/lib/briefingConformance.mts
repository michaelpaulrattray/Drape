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
 *
 * ⚠ **AND PARSING IS NOT THE ONLY WAY AN EDITION BREAKS SOMETHING — #1679 is
 * the second instance of #169's exact shape, two years of editions later.**
 * Edition 599's `shift` field was written as five paragraphs. It PARSED
 * perfectly, so this judge said yes and the push fired; what it broke was
 * `client/src/features/admin/components/crew/crewBodyWhitespace.test.ts`,
 * which holds that a briefing field carrying a blank line is rendered by a
 * class that keeps one. **`main` went red at 06:15Z, and the first PR to merge
 * main forward — #1678, a pricing PR — failed its gate for a reason that had
 * nothing to do with its diff.** Same cause as #169 word for word: the arm
 * exists and runs on PRs, and an edition push never rides a PR.
 *
 * `briefingReadingSuites` below is the other half of the gate, and it is
 * DERIVED rather than named: any CLIENT suite that reads the briefing file is
 * judging the edition, so a third one joins by construction. The server-side
 * readers are deliberately out — the schema half of their job is this judge's,
 * and the rest run under `pnpm check` and the PR gate.
 */
import { execFileSync } from "node:child_process";

import { crewBriefingSchema } from "../../server/crew/crewBriefing";

export type BriefingConformance = { ok: boolean; why: string };

/** The briefing path every reader agrees on, declared once. */
export const BRIEFING_FILE = "server/crew/crew-briefing.json";

/**
 * The CLIENT suites that read the briefing off disk, AT THE COMMIT (#1679).
 *
 * Read at the commit for the same reason `grepAtCommit` is: the suites that run
 * and the list that selected them must see one tree, wherever the desk stands.
 *
 * It returns a list and never throws on an empty one — the caller decides what
 * an empty population means, and the rite treats it as a refusal, because a
 * step that silently checks nothing is the shape invariant 7 is about.
 */
export const briefingReadingSuites = (root: string, commit: string): string[] => {
  const prefix = `${commit}:`;
  let out = "";
  try {
    out = execFileSync(
      "git",
      ["grep", "-l", "-e", BRIEFING_FILE, commit, "--", "client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
      { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (error: any) {
    /* git grep exits 1 with no stderr when nothing matched — not an error. */
    if (error?.status === 1 && String(error?.stderr ?? "").trim() === "") return [];
    throw error;
  }
  return out
    .split(/\r?\n/)
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .filter((line) => line.trim() !== "")
    .sort();
};

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
