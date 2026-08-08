import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A TOAST ON A CASTING SURFACE MUST JUSTIFY ITSELF.
 *
 * D-110: a toast is the fallback channel, never a second copy. Wherever a live
 * surface owns the action, the feedback renders in place; the toast is for work
 * with nowhere of its own to appear.
 *
 * That ruling decays one call site at a time. Somebody adds an action next
 * month, gives it a `toast("Saved")` because the neighbouring code used to do
 * that, and nothing objects — the screen just gets one more pill saying what it
 * already showed. So the rule is a lint, in the shape `imageGrammar.test.ts`
 * established: every `toast(` on a casting surface is enumerated below with the
 * reason it is not a duplicate. A new one fails CI until somebody writes that
 * reason down.
 *
 * **The allowlist is the argument, not the inventory.** Each entry answers one
 * question — what would the user otherwise not know? If the answer is "nothing,
 * the surface already showed them", the toast should not exist.
 */

const FEATURE = new URL("./", import.meta.url);
const COMPONENTS = new URL("./components/", import.meta.url);
const PAGES: Array<[string, URL]> = [
  ["CastingSheet.tsx", new URL("../../pages/CastingSheet.tsx", import.meta.url)],
  ["CastingV2.tsx", new URL("../../pages/CastingV2.tsx", import.meta.url)],
  ["CastingRoom.tsx", new URL("../../pages/CastingRoom.tsx", import.meta.url)],
];

/**
 * Every sanctioned toast, by the source line that raises it, with its reason.
 *
 * Failure sentences dominate the list on purpose. A refused mutation reverts
 * its optimistic paint, so the user sees that something did not happen and
 * never why — the reason has no in-place home anywhere in the product, and
 * inventing one per mutation would be a banner apparatus nobody asked for.
 */
const ALLOWED: Array<{ match: string; because: string }> = [
  // ---- CastingSheet.tsx
  {
    match: '"That didn\'t save — nothing has changed."',
    because:
      "A refused keep or discard. The optimistic paint snaps back, which shows something was refused and never why. It carries OUR sentence rather than the error's since run-9 (see failureCopy.ts) — a server refusal still speaks for itself, and a transport failure no longer speaks at all.",
  },
  {
    match: '"Discarded — undo is only available on the latest roll"',
    because:
      "Explains an ABSENCE: no Undo appeared beside the card, and a missing affordance cannot explain itself.",
  },
  {
    match: '"Restored — not kept"',
    because:
      "'Restored' is duplicated by the card returning; 'not kept' is not. The only in-place evidence is a missing ring, which looks identical to a card that was never kept.",
  },
  {
    match: '"Signing didn\'t go through. Nothing has changed — try again."',
    because:
      "A failed Sign. It navigates on success, so a failure leaves the user on a closed modal with nothing said. Ours rather than the error's since run-9; a PRECONDITION_FAILED from our own server still passes through verbatim, because that sentence names its wall.",
  },
  {
    match: "toast.error(error.message)",
    because:
      "A failed inline rename (the room). The name reverts to the old one, which is not a reason. Found by this lint rather than by the audit — the audit had missed it.",
  },
  // ---- CastingV2.tsx (the lobby)
  {
    match: '"That sheet could not be discarded."',
    because: "A sheet that stays put says nothing about why it stayed.",
  },
  {
    match: '"Sheet deleted"',
    because:
      "MEASURED, not assumed: the card takes 7.1s to leave the strip, because `openSessions` runs four queries per sheet and a lobby with two dozen sheets refetches ~100 times first. Seven seconds of silence after a destructive action is worse than a duplicate. Remove this when the removal is optimistic or the projection is one query.",
  },
  {
    match: '"Renamed"',
    because:
      "Kept conservatively — this waits on `roster` rather than `openSessions` so it may be fast, but it was never timed, and the sheet delete on this same page proved that assuming a prompt refresh is the mistake this pass exists to stop. Goes when somebody measures it.",
  },
  {
    match: "was deleted.",
    because:
      "Two sites. In the LOBBY it inherits the same awaited `openSessions.invalidate()` and therefore the same seven-second lag. In the ROOM it is the one destructive success with no surface at all — the action destroys the page that would have acknowledged it and lands the user on a lobby where she is merely absent, which is a state to audit rather than an answer.",
  },
  {
    match: '"That roll could not start."',
    because:
      "Fires BEFORE the navigation to the sheet, so the sheet's own failure banner never gets the chance. The lobby has no other channel.",
  },
  {
    match: '"Link copied"',
    because: "The clipboard has no surface at all. Nothing on screen changes.",
  },
  {
    match: '"That name could not be saved."',
    because: "The dialog stays open on the old name, which is not a reason.",
  },
  {
    match: "could not be deleted.",
    because: "She is still on the roster; that is not an explanation.",
  },
];

/** Source lines that actually raise a toast, ignoring imports and comments. */
async function toastLines(): Promise<Array<{ file: string; line: string }>> {
  const files: Array<[string, string]> = [];
  for (const dir of [FEATURE, COMPONENTS]) {
    for (const entry of await readdir(dir)) {
      if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      files.push([entry, await readFile(new URL(entry, dir), "utf8")]);
    }
  }
  for (const [name, url] of PAGES) files.push([name, await readFile(url, "utf8")]);

  const found: Array<{ file: string; line: string }> = [];
  for (const [file, source] of files) {
    /*
      Comments are stripped first. This file and the sources it reads are dense
      with prose ABOUT toasts — the word appears far more often in reasoning
      than in code — and a lint that trips over its own documentation is a lint
      people delete.
    */
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    /*
      A toast is captured WITH the two lines after it, joined.

      Several of these span lines — `toast(error instanceof Error ? … : "…")`
      puts the sentence that identifies it on the continuation. A line-based
      matcher saw only `toast(error instanceof Error` and could not tell two
      different failures apart. It found that out by failing, which is the
      right way round.
    */
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      if (!/\btoast[.(]/.test(line)) return;
      if (/^\s*import\b/.test(line)) return;
      found.push({ file, line: lines.slice(index, index + 3).join(" ").replace(/\s+/g, " ").trim() });
    });
  }
  return found;
}

describe("no toast duplicates an owned notice", () => {
  it("every casting toast is on the allowlist, with a reason", async () => {
    const unexplained = (await toastLines()).filter(
      ({ line }) => !ALLOWED.some((entry) => line.includes(entry.match)),
    );
    expect(
      unexplained,
      `A toast on a casting surface has no entry in ALLOWED.\n`
        + `Before adding one, answer the question D-110 asks: what would the user\n`
        + `NOT know without it? If the surface already showed them — a ring, a card\n`
        + `leaving, a pending span, a name changing — delete the toast instead.\n`
        + unexplained.map(({ file, line }) => `  ${file}: ${line}`).join("\n"),
    ).toEqual([]);
  });

  /*
    The other direction, and the reason this file is not just a rubber stamp:
    an allowlist nobody prunes becomes a list of things that used to exist. If
    an entry stops matching anything, the toast is gone and its row should go
    with it.
  */
  it("carries no rows for toasts that no longer exist", async () => {
    const lines = await toastLines();
    const stale = ALLOWED.filter((entry) => !lines.some(({ line }) => line.includes(entry.match)));
    expect(stale.map((entry) => entry.match)).toEqual([]);
  });

  /*
    THE REMOVALS, PINNED BY NAME.

    These nine said what the screen had already said. Naming them stops the
    pass being undone one convenient re-addition at a time — and each string is
    the thing a future author would most plausibly reach for.
  */
  it("keeps the removed duplicates removed", async () => {
    const code = (await toastLines()).map(({ line }) => line).join("\n");
    for (const gone of [
      '"Kept"',
      '"Removed from kept"',
      '"Discarded"',
      '"Change undone"',
      "unpinned — applies to your next roll",
      "— applies to your next roll",
      "Brief edited — your adjustments were cleared",
    ]) {
      expect(code, `"${gone}" came back — the surface already says this`).not.toContain(gone);
    }
  });
});
