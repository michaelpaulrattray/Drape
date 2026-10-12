/**
 * #2405 — THE TEXT ON A CANVAS ITEM HAS ONE CAP, AND EVERY SCHEMA THAT TAKES
 * IT ENFORCES THAT ONE.
 *
 * A note longer than the server's cap was refused on click-away and snapped
 * back without a word. The client boxes now stop typing at
 * `BOARD_ITEM_LABEL_MAX_LENGTH`, which only helps if it is the number the
 * server actually refuses at — so this suite PARSES through the real routers'
 * own zod parsers (no handler runs, no database) rather than reading the
 * constant back against itself. `server/clientInputCaps.test.ts` already holds
 * the constant to having a reader on both sides; this holds the server side
 * to MEANING it, on all five schemas that take a label.
 */
import { describe, expect, it } from "vitest";
import { BOARD_ITEM_LABEL_MAX_LENGTH } from "../shared/inputLimits";
import { boardsRouter } from "./routes/boards";
import { boardOpsRouter } from "./routes/boardOps";

/** The zod parser tRPC holds for a procedure, reached without running a handler. */
function parserOf(router: unknown, name: string): { safeParse: (input: unknown) => { success: boolean } } {
  const procedure = (router as Record<string, any>)._def.procedures[name];
  if (!procedure) throw new Error(`no procedure named ${name} on this router`);
  const inputs = procedure._def.inputs as Array<{ safeParse: (input: unknown) => { success: boolean } }>;
  if (inputs?.length !== 1) throw new Error(`${name} declares ${inputs?.length ?? 0} input parsers`);
  return inputs[0]!;
}

const SCHEMAS: ReadonlyArray<{ id: string; router: unknown; name: string; withLabel: (label: string) => unknown }> = [
  { id: "boards.addItem", router: boardsRouter, name: "addItem", withLabel: (label) => ({ boardId: 1, type: "note", label }) },
  {
    id: "boards.addItems",
    router: boardsRouter,
    name: "addItems",
    withLabel: (label) => ({ boardId: 1, items: [{ type: "note", label }] }),
  },
  { id: "boards.updateItem", router: boardsRouter, name: "updateItem", withLabel: (label) => ({ itemId: 1, label }) },
  {
    id: "boardOps.createNode.execute",
    router: boardOpsRouter,
    name: "createNode.execute",
    withLabel: (label) => ({ boardId: 1, kind: "note", provenance: null, position: { x: 0, y: 0 }, label }),
  },
  {
    id: "boardOps.updateNodeMetadata",
    router: boardOpsRouter,
    name: "updateNodeMetadata",
    withLabel: (label) => ({ boardId: 1, itemId: 1, metadata: {}, label }),
  },
];

describe("#2405 — a canvas item's text is capped at BOARD_ITEM_LABEL_MAX_LENGTH, everywhere", () => {
  it("the cap is the column's width — 256, which is varchar(256) on board_items.label", () => {
    /* Not a mirror of the number for its own sake: the column is the reason it
       is 256, and a cap raised past it would be refused by the database
       instead of by a sentence. */
    expect(BOARD_ITEM_LABEL_MAX_LENGTH).toBe(256);
  });

  it.each(SCHEMAS)("$id ACCEPTS a label exactly at the cap (positive control)", ({ router, name, withLabel }) => {
    expect(parserOf(router, name).safeParse(withLabel("x".repeat(BOARD_ITEM_LABEL_MAX_LENGTH))).success).toBe(true);
  });

  it.each(SCHEMAS)("$id REFUSES a label one past the cap", ({ router, name, withLabel }) => {
    expect(parserOf(router, name).safeParse(withLabel("x".repeat(BOARD_ITEM_LABEL_MAX_LENGTH + 1))).success).toBe(false);
  });

  it("the reader can tell a missing procedure from a parse — the instrument before its finding", () => {
    expect(() => parserOf(boardsRouter, "aProcedureNobodyWrote")).toThrow(/no procedure named/);
  });
});
