/**
 * A QUIET EDITION DOES NOT DEPLOY (#159).
 *
 * The standing orders say a quiet shift — nothing merged, nothing courted, no
 * reply acted on, no card moved — ships NO briefing edition and runs NO rite:
 * the previous edition already says nothing waits on the founder, and a
 * production deploy for a repeated journal line is waste. The founder felt it
 * directly on the morning of 2026-08-27: quiet shifts were burning his Fable
 * credits, and TWO quiet shifts after the orders were rewritten (09:45, 10:23)
 * deployed anyway — each a full production deploy for one journal line.
 *
 * An order the model does not follow needs a mechanical guard (working law 7:
 * a control that is only a sentence is not a control). This is that guard,
 * read at the COMMITTED bytes of the push rather than at the shift's report:
 * what is being pushed, and what it changes in the briefing.
 *
 * # The verdict, stated exactly
 *
 * A push is a QUIET EDITION when ALL of these hold:
 *   1. the commits being pushed touch ONLY the briefing (and, tolerated
 *      alongside it, the generated atlas files — the hooks regenerate those on
 *      every commit, so their presence says nothing about the shift);
 *   2. with `edition`, `updatedAt` and `shift` set aside, everything in the
 *      briefing OUTSIDE `journal` is byte-for-byte what the previous edition
 *      held — no card, no step, no chip, no eye item, no acknowledged reply
 *      moved;
 *   3. every journal entry the edition ADDS matches the quiet pattern (a
 *      header-only bump that adds nothing at all is quieter still and is
 *      refused the same way).
 *
 * Anything else PASSES: a quiet line beside a real change is a working shift
 * that happened to say so, and a journal line with news in it is news. The
 * pattern tolerates wrapped text (`nothing\nneeded doing`) because the runner's
 * own line-by-line reading missed exactly that on the 10:23 shift; this guard
 * is the belt to that brace, and a belt with the same hole is not a belt.
 *
 * Under-refusal is the safe direction (the worst case is today's behaviour);
 * over-refusal on the only push path is how a control gets `--anyway`'d out of
 * existence — so the generated-file tolerance is DERIVED from `.gitattributes`
 * (the `merge=atlas` lines), never listed here (working law 4).
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */

export const BRIEFING_PATH = "server/crew/crew-briefing.json";

/** The runner's own pattern, with `\s+` so a report wrapped at 80 columns still matches. */
export const QUIET_PATTERN = /quiet\s+(night|shift)|nothing\s+needed\s+doing/i;

/** The refusal the rite prints — the card's sentence, verbatim. */
export const QUIET_REFUSAL =
  "a quiet edition does not deploy — the previous edition already says nothing waits on him (standing orders §2)";

/** The header fields an edition bumps by construction; they say nothing about the shift. */
const HEADER_FIELDS = new Set(["edition", "updatedAt", "shift"]);

export type QuietVerdict = { quiet: boolean; why: string };

/**
 * The generated files a briefing commit may carry alongside itself: every path
 * `.gitattributes` gives the `atlas` merge driver.
 */
export const generatedFilesFrom = (gitattributes: string): string[] =>
  gitattributes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .filter((line) => /\bmerge=atlas\b/.test(line))
    .map((line) => line.split(/\s+/)[0]!)
    .filter((file) => file !== "");

/** JSON with keys sorted at every level, so two editions compare by CONTENT and not by key order. */
const stable = (value: unknown): string => JSON.stringify(sortKeys(value));
const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

export const judgeQuietEdition = (input: {
  /** Every path the push changes on `main` — `git diff --name-only <origin/main> HEAD`. */
  changedFiles: string[];
  /** From `generatedFilesFrom(.gitattributes)`. */
  generatedFiles: string[];
  /** The briefing as `origin/main` holds it; `null` when it does not exist there. */
  parentBriefing: string | null;
  /** The briefing as the pushed commit holds it. */
  headBriefing: string;
}): QuietVerdict => {
  const changed = input.changedFiles.map((file) => file.trim().replace(/\\/g, "/")).filter((file) => file !== "");
  if (changed.length === 0) return { quiet: false, why: "nothing to push — origin/main already holds this commit" };
  if (!changed.includes(BRIEFING_PATH)) return { quiet: false, why: "the push does not touch the briefing" };
  const tolerated = new Set([BRIEFING_PATH, ...input.generatedFiles]);
  const substantive = changed.filter((file) => !tolerated.has(file));
  if (substantive.length > 0) {
    return { quiet: false, why: `the push carries ${substantive.length} file(s) beyond the briefing (${substantive.slice(0, 3).join(", ")}${substantive.length > 3 ? ", …" : ""})` };
  }
  if (input.parentBriefing === null) return { quiet: false, why: "the briefing is new on origin/main" };

  let parent: Record<string, unknown>;
  let head: Record<string, unknown>;
  try {
    parent = JSON.parse(input.parentBriefing);
    head = JSON.parse(input.headBriefing);
  } catch (error) {
    /* A briefing that does not parse is a broken deploy, not a quiet one — the
       surface reads this file at runtime. Let the push carry it to the gate
       that says so; this guard answers one question only. */
    return { quiet: false, why: `the briefing does not parse (${String(error).split("\n")[0]})` };
  }

  const body = (briefing: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(briefing).filter(([key]) => !HEADER_FIELDS.has(key) && key !== "journal"));
  const parentBody = body(parent);
  const headBody = body(head);
  const moved = [...new Set([...Object.keys(parentBody), ...Object.keys(headBody)])]
    .filter((key) => stable(parentBody[key]) !== stable(headBody[key]))
    .sort();
  if (moved.length > 0) return { quiet: false, why: `the edition changes ${moved.join(", ")}` };

  const journalOf = (briefing: Record<string, unknown>): unknown[] =>
    Array.isArray(briefing.journal) ? briefing.journal : [];
  const before = new Set(journalOf(parent).map(stable));
  const added = journalOf(head).filter((entry) => !before.has(stable(entry)));
  if (added.length === 0) return { quiet: true, why: "the edition adds no journal entry and changes nothing else" };
  const textOf = (entry: unknown): string =>
    entry && typeof entry === "object" && typeof (entry as { text?: unknown }).text === "string"
      ? (entry as { text: string }).text
      : "";
  const loud = added.filter((entry) => !QUIET_PATTERN.test(textOf(entry)));
  if (loud.length > 0) return { quiet: false, why: `the edition adds ${loud.length} journal entr${loud.length === 1 ? "y" : "ies"} with news in ${loud.length === 1 ? "it" : "them"}` };
  return {
    quiet: true,
    why: `the edition adds only ${added.length} quiet journal line${added.length === 1 ? "" : "s"} and changes nothing else`,
  };
};
