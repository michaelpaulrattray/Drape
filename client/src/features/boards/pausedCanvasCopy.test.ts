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

/**
 * #2335 — the canvas no longer sends anyone to a paused road while the
 * rebuild door is shut. Naming a draft and editing its headshot both go
 * through Edit, which opens the paused card; so each line that PROMISED that
 * road now reads `REBUILD_DOOR_OPEN` (the compiled fact #2328 reads) and says
 * nothing about it while the door is shut.
 *
 * Each pair is pinned as one ternary, `REBUILD_DOOR_OPEN ? open : closed`, so
 * the arm fails if the open copy is deleted (positive), if the closed copy
 * still names the road (negative), or if the condition is dropped and the
 * open copy shows unconditionally (the pairing itself).
 */
describe("#2335 — no paused road is promised while the door is shut", () => {
  const ROAD = /environment|\bmint|\bname\b/i;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ternary = (open: string, closed: string) =>
    new RegExp(
      "REBUILD_DOOR_OPEN\\s*\\?\\s*" + escape(JSON.stringify(open)) + "\\s*:\\s*" + escape(JSON.stringify(closed)),
    );

  const PAIRS: ReadonlyArray<{ where: string; file: string; open: string; closed: string }> = [
    {
      where: "the headshot popover's out-of-sync line (draft)",
      file: CAST_NODE,
      open: "Headshot out of sync — it never refreshes. Edit it in the environment",
      closed: "Headshot out of sync — it never refreshes",
    },
    {
      where: "the headshot popover's anchor line (draft)",
      file: CAST_NODE,
      open: "The headshot anchors every view — edit it in the environment",
      closed: "The headshot anchors every view",
    },
  ];

  it.each(PAIRS)("$where: open copy and closed copy sit on one REBUILD_DOOR_OPEN branch", ({ file, open, closed }) => {
    expect(source(file)).toMatch(ternary(open, closed));
    expect(open).toMatch(ROAD); // positive control: the reader sees a road when one is named
    expect(closed).not.toMatch(ROAD);
  });

  it("the draft's Edit label promises naming only when the door is open, and never says 'mint'", () => {
    const node = source(CAST_NODE);
    expect(node).toContain('label: isDraft && REBUILD_DOOR_OPEN ? "Edit — name this draft" : "Edit",');
    expect(node).not.toContain("name and mint");
  });

  it("the draft caption is rendered only behind the open door", () => {
    const node = source(CAST_NODE);
    const at = node.indexOf("Keep exploring — name it when ready");
    expect(at, "the caption's copy still exists for when the door opens").toBeGreaterThan(-1);
    const guard = node.lastIndexOf("{REBUILD_DOOR_OPEN && isDraft && data.imageUrl && !draftHintSeen && !selected && (", at);
    expect(guard, "the caption's render condition reads the door").toBeGreaterThan(-1);
    // and that condition is the caption's own: no other JSX block opens between them
    expect(node.slice(guard, at)).not.toMatch(/\)\}\s*\{/);
  });

  it("the spawn menu points an unfilled view at the casting environment only when the door is open", () => {
    const spawn = source("client/src/features/boards/canvas/SpawnMenu.tsx");
    expect(spawn).toContain('import { REBUILD_DOOR_OPEN } from "@shared/rebuildDoor";');
    expect(spawn).toMatch(/REBUILD_DOOR_OPEN\s*\?\s*"Add in the casting environment"\s*:\s*undefined/);
    expect(spawn.match(/Add in the casting environment/g)).toHaveLength(1);
  });

  it("the door is shut today, so these are the lines a customer reads", () => {
    expect(REBUILD_DOOR_OPEN).toBe(false);
  });
});
