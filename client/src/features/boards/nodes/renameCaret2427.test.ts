/**
 * #2427 — after a failed rename, the customer's recovered words are NOT
 * selected when the box reopens, so one stray keystroke cannot wipe them a
 * second time. A plain rename still selects the whole label, as before.
 *
 * `pnpm test` has no DOM, so this is source-read, the way #2405's wiring arm
 * is. The population is DERIVED: every canvas node that reads a failed save's
 * draft back (`renameEventDraft(e)`) — so CastNode, NoteNode, BoardItemNode,
 * FrameNode today, and any fifth on the day it is written. The rule is
 * CastNode's own: `select()` only when there is no draft, and
 * `setSelectionRange(len, len)` when there is.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BOARDS = resolve(process.cwd(), "client/src/features/boards");

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** What is wrong with a node's caret handling, or [] when nothing is. */
function caretFaults(source: string): string[] {
  const faults: string[] = [];
  const selects = source.match(/\.select\(\)/g)?.length ?? 0;
  const guarded = source.match(/if\s*\(\s*draft\s*===\s*null\s*\)\s*[\w.]+\??\.select\(\)/g)?.length ?? 0;
  if (selects !== guarded) faults.push(`${selects - guarded} select() not guarded by a null draft`);
  if (!/setSelectionRange\(/.test(source)) faults.push("no caret placed at the end of a recovered draft");
  // Where the draft is carried to a focus effect on a ref, every road that
  // opens the box must set that ref, or a plain rename inherits a stale draft
  if (/recoveredDraftRef/.test(source)) {
    const opens = source.match(/setIsEditing\(true\)/g)?.length ?? 0;
    const sets = source.match(/recoveredDraftRef\.current\s*=(?!=)/g)?.length ?? 0;
    if (opens !== sets) faults.push(`${opens} roads open the box, ${sets} set the recovered draft`);
  }
  return faults;
}

const readers = sourcesUnder(BOARDS).filter((path) => readFileSync(path, "utf8").includes("renameEventDraft(e)"));

describe("#2427 — a recovered rename keeps the caret at the end", () => {
  it("the instrument: finds the four editable nodes", () => {
    expect(readers.length).toBeGreaterThanOrEqual(4);
    for (const name of ["CastNode.tsx", "NoteNode.tsx", "BoardItemNode.tsx", "FrameNode.tsx"]) {
      expect(readers.some((p) => p.endsWith(name)), name).toBe(true);
    }
  });

  it("the instrument: refuses the shape #2427 found, and passes CastNode's", () => {
    const before = `
      setEditLabel(renameEventDraft(e) ?? data.label ?? '');
      setIsEditing(true);
      inputRef.current?.focus();
      inputRef.current?.select();`;
    expect(caretFaults(before).length).toBeGreaterThan(0);
    const right = `
      const draft = renameEventDraft(e);
      input?.focus();
      if (draft === null) input?.select();
      else input?.setSelectionRange(draft.length, draft.length);`;
    expect(caretFaults(right)).toEqual([]);
    const staleRoad = `${right}
      recoveredDraftRef.current = draft; setIsEditing(true);
      onDoubleClick={() => { setIsEditing(true); }}`;
    expect(caretFaults(staleRoad)).toEqual(["2 roads open the box, 1 set the recovered draft"]);
  });

  it.each(readers.map((path) => ({ file: path.slice(BOARDS.length + 1) })))(
    "$file selects only a plain rename and leaves a recovered draft unselected",
    ({ file }) => {
      expect(caretFaults(readFileSync(join(BOARDS, file), "utf8"))).toEqual([]);
    },
  );
});
