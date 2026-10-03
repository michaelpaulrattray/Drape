/**
 * THE BRIEFING AT A COMMIT — ONE READER, A BUFFER THAT FITS IT, AND GIT'S OWN
 * REASON WHEN IT FAILS (#1867).
 *
 * # What went wrong
 *
 * `chooseBriefing` (`liveBriefing.mts`) is a pure module: it is handed a reader
 * and asks it for `server/crew/crew-briefing.json` at the deployed commit. Two
 * tools call it — `crew-read-replies.mts`, which is the ONE tool a shift reads
 * the founder with, and `crew-mirror-replies.mts`, which carries his replies
 * onto their GitHub cards — and **each wrote its own copy of that reader**.
 * Both copies used `execFileSync`'s default `maxBuffer`, which is 1 MiB.
 *
 * The briefing crossed 1 MiB and both reads have failed ever since. Measured on
 * the real file at `b5efa108`, 1,103,877 bytes, with a small-path control to
 * prove it was the size and not the sha, the path or the wrapper:
 *
 *     NEGATIVE (shipped shape, no maxBuffer): FAILED - code=ENOBUFS
 *     POSITIVE (same call + maxBuffer 32 MiB): OK - edition parses: true
 *     CONTROL  (shipped shape, small path):    OK
 *
 * The fallback to the working tree is right and deliberate (see that module's
 * header: a shift-start reader that dies costs more than the defect it
 * repairs). What was wrong is that the fallback had been the ONLY road for as
 * long as the briefing has been over a megabyte, and the sentence it printed
 * sent a shift to look at its git clone:
 *
 *     the briefing could not be read at 9c6366ca - this clone may not hold
 *     that commit
 *
 * **That cause was asserted and never checked** (law 7b, inside an instrument).
 * The clone held the commit; three shifts read the line and two of them went
 * looking. Worse, the tree it fell back to can be a shift's unfinished edition
 * mid-write, so the edition printed and the acknowledgement set that decides
 * which replies are NEW were both taken from a draft.
 *
 * ⚠ **THE CARD'S OWN PRESCRIPTION WAS WRONG, AND IT IS WORTH RECORDING WHY.**
 * #1867 said *"the fix already exists one file over"* at
 * `crew-mirror-replies.mts:301`, which passes a 32 MiB buffer. Read at the
 * bytes: line 301 is a `gh issue view` call inside the mirror's comment
 * reader. The mirror's briefing read is at line 284 and carries **no buffer at
 * all** — so both callers shipped the same defect, and "one caller learned the
 * lesson and its twin did not" was never the shape. The repair is therefore
 * wider than one line and narrower in kind: **there is one reader now, and
 * neither caller owns a copy of it.**
 *
 * # Why the number is 32 MiB and what happens at the next crossing
 *
 * 32 MiB is not a guess and not new: it is the figure `deploy-rite.mts` and
 * `briefingConformance.mts` already use for exactly this read. A limit a file
 * grew past once will be grown past again, so the honest guard is a DRIVEN arm
 * at the real file's real size (`server/briefingAtCommit.test.ts`) rather than
 * a number asserted here — the next crossing reddens a suite instead of
 * printing a wrong diagnosis for three nights.
 *
 * This module does I/O, which is why it is not inside `liveBriefing.mts` —
 * that module's injected-reader contract is what lets its arms drive the
 * original incident's exact shape, and it stays pure.
 */
import { execFileSync } from "node:child_process";

import type { BriefingRead } from "./liveBriefing.mts";
import { BRIEFING_PATH } from "./quietEdition.mts";

/**
 * The read buffer, shared by every caller.
 *
 * Exported so a suite can drive the failure road at the REAL file size by
 * asking for a buffer the real briefing cannot fit, rather than manufacturing
 * a large fixture to prove something about a number.
 */
export const BRIEFING_READ_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * SAY WHAT ACTUALLY HAPPENED — never a cause composed from the one thing the
 * caller could think of.
 *
 * Pure, so its arms can drive each road without a repository. The order is by
 * how specifically the failure identifies itself: the buffer answer first
 * because it is the one that was mistaken for a missing commit; then git's own
 * words, which are authoritative about a bad sha or a deleted path; then the
 * node-level code; then whatever the error says.
 */
export const describeGitShowFailure = (error: unknown, maxBuffer: number): string => {
  const detail = error as { code?: unknown; stderr?: unknown; message?: unknown } | null;
  const code = typeof detail?.code === "string" ? detail.code : null;

  if (code === "ENOBUFS") {
    return `git's output did not fit the ${maxBuffer}-byte read buffer (ENOBUFS)`
      + " — the briefing has outgrown it, and BRIEFING_READ_MAX_BUFFER is the one place to raise";
  }

  const stderr = typeof detail?.stderr === "string" ? detail.stderr.trim() : "";
  if (stderr !== "") return `git said: ${stderr.split(/\r?\n/)[0]}`;

  if (code !== null) return `git failed (${code})`;

  const message = typeof detail?.message === "string" ? detail.message.trim() : "";
  return message === "" ? "git failed and said nothing" : message.split(/\r?\n/)[0];
};

/**
 * The briefing as the commit `sha` holds it, or the reason it could not be read.
 *
 * `stdio` pipes stderr rather than discarding it — that is what makes git's own
 * words available to `describeGitShowFailure`, and it is still silent on the
 * screen, which a shift-start tool has to be.
 */
export const briefingAtCommit = (
  sha: string,
  maxBuffer: number = BRIEFING_READ_MAX_BUFFER,
): BriefingRead => {
  try {
    return execFileSync("git", ["show", `${sha}:${BRIEFING_PATH}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer,
    });
  } catch (error) {
    return { reason: describeGitShowFailure(error, maxBuffer) };
  }
};
