/**
 * #2408 — four canvas entrances still promised a change while editing is
 * paused (the rebuild door, `shared/rebuildDoor.ts`, shut by #2328), and each
 * landed on the paused card. One of them, Fork to edit, first wrote a copy
 * of the character nobody could then edit.
 *
 *  1. Rerun → "Fork to edit" is sealed: visible, disabled, the door's
 *     sentence, no cost, no handler. "Fork instead" is not said beside it.
 *  2. "Build comp card" / "Complete card" are not offered.
 *  3. The ghost "+ Walk"-style tiles stop inviting: no `+`, no click, the
 *     door's sentence as a tooltip.
 *  4. The signed headshot lines stop pointing at forking.
 *
 * The two shared components are RENDERED (react-dom/server, the
 * `identityChangeDialog.test.ts` pattern) at BOTH door positions: the shut
 * door is the compiled value, the open door is a module mock. The open render
 * is the positive control — it proves the reader sees a live Fork row and a
 * `+` when they are there, so the shut render's absence means something.
 * CastNode itself cannot render without React Flow, so its wiring is read at
 * the source, each arm pinned to the exact expression it protects.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REBUILD_DOOR_CLOSED, REBUILD_DOOR_OPEN } from "@shared/rebuildDoor";
import type { SheetTile } from "./canvas/CharacterSheetImageArea";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    boardOps: {
      applyModelEdit: {
        plan: { useQuery: () => ({ data: { estimatedCreditCost: 350, forkCreditCost: 0 } }) },
      },
    },
  },
}));

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const CAST_NODE = "client/src/features/boards/canvas/nodes/CastNode.tsx";

/** Load a module with the door forced open, or with the compiled (shut) door. */
async function load<T>(path: string, doorOpen: boolean): Promise<T> {
  vi.resetModules();
  if (doorOpen) {
    vi.doMock("@shared/rebuildDoor", async (orig) => ({
      ...(await orig<typeof import("@shared/rebuildDoor")>()),
      REBUILD_DOOR_OPEN: true,
    }));
  } else {
    vi.doUnmock("@shared/rebuildDoor");
  }
  return (await import(/* @vite-ignore */ path)) as T;
}

afterEach(() => {
  vi.doUnmock("@shared/rebuildDoor");
  vi.resetModules();
});

/** The <button> whose title span reads `title`, as markup. */
function rowFor(html: string, title: string): string {
  const at = html.indexOf(`>${title}<`);
  expect(at, `no row titled ${title}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<button", at);
  const end = html.indexOf("</button>", at);
  return html.slice(start, end);
}

describe("#2408 — the Fork row while editing is paused", () => {
  type Mod = typeof import("./canvas/ForkRecastPopover");
  const render = async (doorOpen: boolean, isMinted: boolean) => {
    const { ForkRecastPopoverContent } = await load<Mod>("./canvas/ForkRecastPopover", doorOpen);
    return renderToStaticMarkup(
      createElement(ForkRecastPopoverContent, {
        boardId: 2,
        itemId: 3,
        name: "Hallvard",
        isMinted,
        onFork: () => {},
        onRecast: () => {},
      }),
    );
  };

  it("the door is shut today, so the sealed rows are what a customer reads", () => {
    expect(REBUILD_DOOR_OPEN).toBe(false);
  });

  it.each([true, false])("shut door (minted=%s): Fork is disabled, says the door's sentence, and offers no copy", async (isMinted) => {
    const html = await render(false, isMinted);
    const fork = rowFor(html, "Fork to edit");
    expect(fork).toContain('disabled=""');
    expect(fork).toContain(REBUILD_DOOR_CLOSED.replace(/'/g, "&#x27;"));
    expect(fork).not.toContain("editable copy");
    expect(html).not.toContain("Fork instead");
  });

  it.each([true, false])("POSITIVE CONTROL — open door (minted=%s): Fork is live with its own copy and the Recast row points at it", async (isMinted) => {
    const html = await render(true, isMinted);
    const fork = rowFor(html, "Fork to edit");
    expect(fork).not.toContain('disabled=""');
    expect(fork).toContain("Create an independent editable copy of Hallvard.");
    expect(html).toContain("Fork instead");
  });
});

describe("#2408 — the ghost view tiles while editing is paused", () => {
  type Mod = typeof import("./canvas/CharacterSheetImageArea");
  const tile = (angle: SheetTile["angle"], filled: boolean, failed: SheetTile["failed"] = null): SheetTile => ({
    angle,
    label: angle === "sideFull" ? "Walk" : angle,
    url: filled ? "https://example.invalid/x.png" : null,
    filled,
    pinned: false,
    stale: false,
    failed,
    poppedOut: false,
    refreshing: false,
  });
  const TILES = [tile("frontClose", true), tile("sideFull", false), tile("backFull", false, { reason: "refused" })];
  const render = async (ghostClosedNote: string | undefined) => {
    const { CharacterSheetImageArea } = await load<Mod>("./canvas/CharacterSheetImageArea", false);
    return renderToStaticMarkup(
      createElement(CharacterSheetImageArea, {
        tiles: TILES,
        activeTileAngle: null,
        onTileContextMenu: () => {},
        onTileDoubleClick: () => {},
        onGhostClick: () => {},
        ghostClosedNote,
      }),
    );
  };
  const PLUS = "lucide-plus";

  it("closed: the missing view keeps its name, loses its +, and says why instead of inviting", async () => {
    const html = await render(REBUILD_DOOR_CLOSED);
    const walk = rowFor(html, "Walk");
    expect(walk).toContain('aria-disabled="true"');
    expect(walk).toContain(`title="${REBUILD_DOOR_CLOSED.replace(/'/g, "&#x27;")}"`);
    expect(walk).not.toContain("hover:text-canvas-ink-soft");
    expect(html).not.toContain(PLUS);
  });

  it("closed: a FAILED ghost keeps its right-click road (never aria-disabled), so its menu still opens", async () => {
    const html = await render(REBUILD_DOOR_CLOSED);
    const back = rowFor(html, "backFull");
    expect(back).not.toContain("aria-disabled");
  });

  it("POSITIVE CONTROL — open: the ghost invites with its + and is pressable", async () => {
    const html = await render(undefined);
    const walk = rowFor(html, "Walk");
    expect(walk).toContain(PLUS);
    expect(walk).not.toContain("aria-disabled");
    expect(walk).not.toContain("title=");
  });
});

describe("#2408 — CastNode's wiring of the door", () => {
  const node = source(CAST_NODE);

  it("the comp-card verbs are offered only behind the open door", () => {
    const at = node.indexOf('content: "Build comp card"');
    expect(at).toBeGreaterThan(-1);
    expect(node.indexOf('content: "Complete card"')).toBeGreaterThan(at);
    const head = node.lastIndexOf("const packageVerb: ControlSegment[] =", at);
    expect(head).toBeGreaterThan(-1);
    expect(node.slice(head, at)).toMatch(/=\s*REBUILD_DOOR_OPEN && modelReady && data\.imageUrl && !isView/);
  });

  it("the comp card's ghosts are told the door's sentence while it is shut", () => {
    expect(node).toContain("ghostClosedNote={REBUILD_DOOR_OPEN ? undefined : REBUILD_DOOR_CLOSED}");
  });

  it("the signed headshot lines name forking only behind the open door", () => {
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ternary = (open: string, closed: string) =>
      new RegExp(
        "sheet\\.minted\\s*\\?\\s*REBUILD_DOOR_OPEN\\s*\\?\\s*" +
          escape(JSON.stringify(open)) +
          "\\s*:\\s*" +
          escape(JSON.stringify(closed)),
      );
    const FORK = /\bfork/i;
    const pairs = [
      ["Headshot out of sync — it never refreshes. Changing this identity forks a new cast", "Headshot out of sync — it never refreshes"],
      ["The headshot is this identity — fork to change it", "The headshot is this identity"],
    ] as const;
    for (const [open, closed] of pairs) {
      expect(node).toMatch(ternary(open, closed));
      expect(open).toMatch(FORK); // positive control: the reader sees a fork when one is named
      expect(closed).not.toMatch(FORK);
    }
    // the ", or reuse" join only follows a line that named a road
    expect(node).toMatch(/slot\.version > 1\s*\?\s*REBUILD_DOOR_OPEN\s*\?\s*", or reuse/);
  });
});
