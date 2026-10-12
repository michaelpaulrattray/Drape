/**
 * #2405 — a failed canvas save tells the customer, and their text comes back.
 *
 * Two halves. The DECISION (what to say, whether to hand text back) is a pure
 * function and is driven directly with real-shaped tRPC errors. The WIRING is
 * source-read, because `pnpm test` has no DOM: the mutation must route its
 * failures through that decision, and every canvas node that opens a text
 * editor on the rename event must read the draft back and cap its box at the
 * server's own constant. That population is DERIVED from the listeners on
 * disk, so a fifth editable node joins this suite on the day it is written.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readableFailure } from "@/lib/failureSentence";
import { itemSaveFailure, renameEventDraft, RENAME_NODE_EVENT } from "./itemSaveFailure";

const LENGTH_REFUSAL = {
  message: "That's longer than we can take — please keep it to 256 characters or fewer.",
  data: { code: "BAD_REQUEST" },
};
const NETWORK_FAILURE = new TypeError("Failed to fetch");

/** What the toast shows, composed exactly as `BoardPage`'s `onError` composes it. */
function say(error: unknown, variables: Parameters<typeof itemSaveFailure>[0]) {
  const failure = itemSaveFailure(variables);
  return { ...failure, message: readableFailure(error, failure.fallback) };
}

describe("#2405 — what a failed canvas save says", () => {
  it("a refused note hands back EXACTLY what was typed, with our server's own sentence", () => {
    const typed = "Shot list: ".padEnd(359, "a");
    const failure = say(LENGTH_REFUSAL, { itemId: 42, label: typed });
    expect(failure.message).toBe(LENGTH_REFUSAL.message);
    expect(failure.reopen).toEqual({ itemId: 42, draft: typed });
  });

  it("a dropped text save says so in plain words, never the transport's text, and still hands it back", () => {
    const failure = say(NETWORK_FAILURE, { itemId: 7, label: "Character 1" });
    expect(failure.message).toBe("Your text didn't save. It's still there, so you can try again.");
    expect(failure.message).not.toContain("fetch");
    expect(failure.reopen).toEqual({ itemId: 7, draft: "Character 1" });
  });

  it("an empty string is still text the customer sent — it is handed back, not dropped", () => {
    expect(say(NETWORK_FAILURE, { itemId: 1, label: "" }).reopen).toEqual({ itemId: 1, draft: "" });
  });

  it("a failed MOVE is told, and opens no editor (negative control)", () => {
    const failure = say(NETWORK_FAILURE, { itemId: 3, positionX: 10, positionY: 20 });
    expect(failure.message).toBe("That move didn't save. Try again in a moment.");
    expect(failure.reopen).toBeNull();
  });

  it("a failed RESIZE is told, and opens no editor", () => {
    const failure = say(NETWORK_FAILURE, { itemId: 3, width: 300, height: 200 });
    expect(failure.message).toBe("That resize didn't save. Try again in a moment.");
    expect(failure.reopen).toBeNull();
  });

  it("each kind of save has its own toast id, so a burst of one kind reads as one message", () => {
    const ids = new Set([
      say(NETWORK_FAILURE, { itemId: 1, label: "a" }).toastId,
      say(NETWORK_FAILURE, { itemId: 1, positionX: 1 }).toastId,
      say(NETWORK_FAILURE, { itemId: 1, width: 60 }).toastId,
    ]);
    expect(ids.size).toBe(3);
    expect(say(NETWORK_FAILURE, { itemId: 9, positionX: 1 }).toastId)
      .toBe(say(NETWORK_FAILURE, { itemId: 2, positionY: 5 }).toastId);
  });

  it("the node reads the draft off the event, and a plain rename event carries none", () => {
    expect(renameEventDraft(new CustomEvent(RENAME_NODE_EVENT, { detail: { itemId: 1, draft: "kept" } }))).toBe("kept");
    expect(renameEventDraft(new CustomEvent(RENAME_NODE_EVENT, { detail: { itemId: 1 } }))).toBeNull();
    expect(renameEventDraft(new CustomEvent(RENAME_NODE_EVENT, { detail: { itemId: 1, draft: 5 } }))).toBeNull();
  });
});

const BOARDS = resolve(process.cwd(), "client/src/features/boards");
const read = (path: string) => readFileSync(path, "utf8");

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("#2405 — the wiring", () => {
  it("updateItemMutation routes every failure through the decision and hands text back", () => {
    const page = read(join(BOARDS, "BoardPage.tsx"));
    const start = page.indexOf("const updateItemMutation = trpc.boards.updateItem.useMutation(");
    expect(start, "the mutation moved — re-anchor this arm").toBeGreaterThan(-1);
    expect(page.indexOf("const updateItemMutation = trpc.boards.updateItem.useMutation(", start + 1)).toBe(-1);
    const block = page.slice(start, page.indexOf("\n  });", start));
    expect(block).toMatch(/onError:\s*\(err, variables\)/);
    expect(block).toContain("const failure = itemSaveFailure(variables)");
    expect(block).toContain("toast.error(readableFailure(err, failure.fallback), { id: failure.toastId })");
    expect(block).toContain("new CustomEvent(RENAME_NODE_EVENT, { detail: failure.reopen })");
  });

  /* The population: every canvas node that opens a text editor on the rename
     event. Derived from the listeners rather than listed. */
  const listeners = sourcesUnder(BOARDS).filter((path) =>
    /addEventListener\(\s*(RENAME_NODE_EVENT|['"]board-rename-node['"])/.test(read(path)),
  );

  it("finds the editable nodes — the instrument before its finding", () => {
    expect(listeners.length).toBeGreaterThanOrEqual(4);
    expect(listeners.some((p) => p.endsWith("NoteNode.tsx"))).toBe(true);
    expect(listeners.some((p) => p.endsWith("CastNode.tsx"))).toBe(true);
  });

  it.each(listeners.map((path) => ({ file: path.slice(BOARDS.length + 1) })))(
    "$file reads the unsaved draft back and caps its box at the server's constant",
    ({ file }) => {
      const source = read(join(BOARDS, file));
      expect(source, "listens on the hand-typed event name instead of the constant")
        .not.toMatch(/addEventListener\(\s*['"]board-rename-node['"]/);
      expect(source, "a failed save's words are not read back into the editor").toContain("renameEventDraft(e)");
      expect(source, "the text box has no cap, or a hand-typed one")
        .toContain("maxLength={BOARD_ITEM_LABEL_MAX_LENGTH}");
    },
  );
});
