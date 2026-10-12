/**
 * #2329 — the canvas's paused-feature copy, after #2328 shut the rebuild door.
 *
 * The door's own sentence (`REBUILD_DOOR_CLOSED`) is pinned on the server in
 * `server/rebuildDoor.test.ts`. This suite pins the words the canvas writes
 * around it, which live as literals in the components:
 *
 *  - the draft caption under a fresh draft cast card promised "add views or
 *    edit freely" while editing from the canvas is refused;
 *  - the greyed Refresh row in the tile popover said "while we rebuild it";
 *  - the paused takeover card's title said "a cast" where the customer's word
 *    is "character" (#2320, #2322).
 *
 * Each row carries the words it must now say AND the words it must no longer
 * say: the negative alone would pass on a deleted string. Source-read, like
 * `castVocabulary.test.ts` beside it, because `pnpm test` has no DOM.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REBUILD_DOOR_CLOSED, REBUILD_DOOR_OPEN } from "@shared/rebuildDoor";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const CAST_NODE = "client/src/features/boards/canvas/nodes/CastNode.tsx";
const TAKEOVER = "client/src/features/studio/takeover/CastingTakeover.tsx";
const BULK = "client/src/features/boards/canvas/BulkRefreshDialog.tsx";

const SWEPT: ReadonlyArray<{ file: string; now: string; gone: string }> = [
  {
    file: CAST_NODE,
    now: "Keep exploring — name it when ready",
    gone: "add views or edit freely",
  },
  {
    file: CAST_NODE,
    now: '" — not available right now"',
    gone: '" — unavailable while we rebuild it"',
  },
  {
    file: TAKEOVER,
    now: "'Editing a character here is paused'",
    gone: "'Editing a cast here is paused'",
  },
];

describe("#2329 — the canvas's paused copy", () => {
  it.each(SWEPT)("$file says $now", ({ file, now }) => {
    expect(source(file)).toContain(now);
  });

  it.each(SWEPT)("$file no longer says $gone", ({ file, gone }) => {
    expect(source(file)).not.toContain(gone);
  });

  it("the door is shut, so no caption on the cast card may promise editing", () => {
    /* Read off the compiled fact rather than assumed: if the door ever opens,
       this arm stops binding and the caption may say more again. */
    expect(REBUILD_DOOR_OPEN).toBe(false);
    const node = source(CAST_NODE);
    const hint = node.match(/Keep exploring[^<{]*/);
    expect(hint, "the draft caption is gone from CastNode").not.toBeNull();
    expect(hint![0]).not.toMatch(/\bedit/i);
  });

  it("every paused surface speaks through the one sentence, never a copy of it", () => {
    /* The takeover card, the greyed Refresh's tooltip and the bulk-refresh
       dialog all read REBUILD_DOOR_CLOSED; none of them carries the sentence
       as its own literal, so changing it once changes it everywhere. */
    expect(source(TAKEOVER)).toContain("{REBUILD_DOOR_CLOSED}");
    expect(source(CAST_NODE)).toContain("title={REBUILD_DOOR_OPEN ? undefined : REBUILD_DOOR_CLOSED}");
    expect(source(CAST_NODE)).toContain("closedNote={REBUILD_DOOR_OPEN ? undefined : REBUILD_DOOR_CLOSED}");
    expect(source(BULK)).toContain("{closedNote ?? (");
    for (const file of [CAST_NODE, TAKEOVER, BULK]) {
      expect(source(file)).not.toContain(REBUILD_DOOR_CLOSED);
    }
  });
});
