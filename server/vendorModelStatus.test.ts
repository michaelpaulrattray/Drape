/**
 * THE ARM #1537 ASKED FOR: every model id the registry ships is dated and
 * sourced, and a shut-down one cannot be silent.
 *
 * # What went wrong that this refuses
 *
 * Two image ids sat in `shared/modelRegistry.ts` for three months after Google
 * shut them down. No test failed, no error was thrown, and
 * `MODEL_CHANGELOG.md` described one of them as "Active". The watching was
 * prose; prose does not watch.
 *
 * # What this asserts, and what it deliberately does not
 *
 * It cannot know what Google's page says today — nothing in this repository
 * can, and a suite that reached the network would be a suite that fails when
 * the network does. What it CAN hold is the thing that was actually missing:
 * **that every id we ship has a dated reading behind it, and that a reading
 * saying "shut down" is enumerated rather than ordinary.** So the vendor's
 * answer stays a human act with a date on it, and the tree's job is to make
 * sure nobody adds a sixth id without one.
 *
 * # Two readers, not sharing a resolver
 *
 * CLAUDE.md's house rule, paid for four times over by the Atlas collectors: a
 * fold and a parse must not share a resolver. So the id set is taken twice —
 * once from the module TypeScript actually evaluates (`MODELS`), once by
 * parsing the registry's source text — and a disagreement is a RED. Each
 * catches what the other cannot: the parse catches a slot dropped from
 * `MODELS` while its const still exists, the import catches a const the parse
 * cannot see.
 *
 * # Its own controls (working law 2)
 *
 * The checker is a pure function over an injected table, so every arm in the
 * second block drives it directly with a fixture — an undated row, a missing
 * row, an unacknowledged shutdown, a debt line outliving its debt. A guard
 * whose only test is the real tree passing is a guard nobody has proven can
 * fail. Both real-tree arms were additionally driven RED by sabotage before
 * this was pushed (a sixth undated id in the registry; a deleted debt line).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { MODELS } from "@shared/modelRegistry";
import {
  STATUS_UNCLEAR_AT_SOURCE,
  VENDOR_MODEL_STATUS,
  WIRED_DESPITE_SHUTDOWN,
  type AcknowledgedModelDebt,
  type VendorModelRow,
} from "@shared/vendorModelStatus";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_PATH = resolve(ROOT, "shared", "modelRegistry.ts");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface StatusAuditInputs {
  readonly ids: readonly string[];
  readonly table: Readonly<Record<string, VendorModelRow>>;
  readonly shutdownDebt: readonly AcknowledgedModelDebt[];
  readonly unclearDebt: readonly AcknowledgedModelDebt[];
}

/**
 * The whole judgement, as a pure function so it can be driven with fixtures.
 * Returns every complaint it has; an empty array is the pass.
 */
function auditVendorStatus(inputs: StatusAuditInputs): string[] {
  const { ids, table, shutdownDebt, unclearDebt } = inputs;
  const problems: string[] = [];

  if (ids.length === 0) {
    // A reader that came up empty must refuse rather than report a clean tree
    // (CLAUDE.md: every collector that can come up empty THROWS).
    problems.push("no model ids were found at all — the reader is broken, not the tree clean");
  }

  for (const id of ids) {
    const row = table[id];
    if (!row) {
      problems.push(
        `${id}: shipped by the registry with no row in VENDOR_MODEL_STATUS — its status has never been read`,
      );
      continue;
    }
    if (!ISO_DATE.test(row.readOn)) {
      problems.push(`${id}: readOn "${row.readOn}" is not an ISO YYYY-MM-DD date`);
    }
    if (row.source.trim() === "") {
      problems.push(`${id}: has no source — a status nobody can re-check is not a reading`);
    }
    if (row.status === "shutdown" && !ISO_DATE.test(row.shutdownOn ?? "")) {
      problems.push(`${id}: status is shutdown but shutdownOn is missing or not an ISO date`);
    }
    if (row.status !== "shutdown" && row.shutdownOn !== undefined) {
      problems.push(`${id}: carries shutdownOn "${row.shutdownOn}" while status is "${row.status}"`);
    }
  }

  const shipped = new Set(ids);
  const acknowledgedShutdown = new Set(shutdownDebt.map((d) => d.id));
  const acknowledgedUnclear = new Set(unclearDebt.map((d) => d.id));

  // A shut-down id we still ship must be enumerated with its card.
  for (const id of ids) {
    if (table[id]?.status === "shutdown" && !acknowledgedShutdown.has(id)) {
      problems.push(
        `${id}: is shut down and still shipped by the registry, but is not in WIRED_DESPITE_SHUTDOWN — ` +
          `add it with the card carrying the decision, or re-point the slot`,
      );
    }
  }

  // ...and the line may not outlive the debt, in either list.
  const checkDebtStillOwed = (
    debts: readonly AcknowledgedModelDebt[],
    listName: string,
    stillOwed: (row: VendorModelRow | undefined) => boolean,
  ) => {
    for (const debt of debts) {
      if (debt.card.trim() === "") {
        problems.push(`${debt.id}: ${listName} entry names no card`);
      }
      if (debt.why.trim() === "") {
        problems.push(`${debt.id}: ${listName} entry gives no reason`);
      }
      if (!shipped.has(debt.id)) {
        problems.push(
          `${debt.id}: ${listName} names an id the registry no longer ships — delete the line, the debt is paid`,
        );
        continue;
      }
      if (!stillOwed(table[debt.id])) {
        problems.push(
          `${debt.id}: ${listName} names an id whose row no longer carries that status — delete the line`,
        );
      }
    }
  };

  checkDebtStillOwed(shutdownDebt, "WIRED_DESPITE_SHUTDOWN", (row) => row?.status === "shutdown");
  checkDebtStillOwed(unclearDebt, "STATUS_UNCLEAR_AT_SOURCE", (row) => row !== undefined);

  for (const id of [...acknowledgedShutdown].filter((candidate) => acknowledgedUnclear.has(candidate))) {
    problems.push(`${id}: enumerated in both debt lists — a shut-down id's status is not unclear`);
  }

  return problems;
}

/**
 * Second reader: the registry's source text, not the module TypeScript
 * evaluated. Matches `export const NAME = "id" as const;` and returns the ids.
 */
function parseRegistryIds(source: string): string[] {
  const ids: string[] = [];
  const pattern = /export const [A-Z0-9_]+ = "([^"]+)" as const;/g;
  for (const match of source.matchAll(pattern)) ids.push(match[1]);
  return ids;
}

/**
 * THE PATHS A DEBT ENTRY CITES MUST EXIST (#1785).
 *
 * A `why` is prose, and the only part of prose a machine can hold is its
 * citations. This list's whole promise is that *"an entry whose row no longer
 * carries that status is a RED rather than a line nobody deletes"* — but a
 * cited FILE that moves rots in silence, and the reader who most needs these
 * addresses is the one deciding whether a shut-down id is still reachable.
 *
 * ⚠ **It earned itself on its first run, on a line it did not write.** The
 * 2026-10-01 correction to the `gemini-3-pro-image-preview` entry cited
 * `features/boards/canvas/nodes/useSheetController.ts:137` — a path relative
 * to `client/src/`, not to the repository, so it resolved to nothing. Repaired
 * in the commit that added this arm, which is the positive control the real
 * population could not otherwise give.
 *
 * **The rule is narrow on purpose, and its limit is stated rather than left to
 * be assumed:** a backticked token is a path when it contains a `/` AND ends
 * in a known source extension, optionally followed by `:<line>`. A BARE
 * filename (`CastNode.tsx`) is NOT checked — resolving one needs a tree walk,
 * and this arm's green must not be read as covering them. Symbols
 * (`IMAGE_PRO`), dotted members (`CREDIT_COSTS.castingImage`), procedure ids
 * (`generation.refreshSlots`) and routes (`/app/canvas/:id`) are not paths and
 * are not collected — driven as a negative control below, because an
 * extractor that quietly collected one of them would redden the real-population
 * arm for a reason that has nothing to do with rot, and point the diagnosis at
 * the tree.
 */
const CITED_PATH = /`([^`]*\/[^`]*\.(?:ts|tsx|mts|cts|js|mjs|cjs|md|sh|yml|yaml|json|css))(?::\d+)?`/g;

export function citedRepoPaths(why: string): string[] {
  const found: string[] = [];
  for (const match of why.matchAll(CITED_PATH)) found.push(match[1]);
  return [...new Set(found)];
}

/** Which of a debt list's cited paths are not in the tree, with the citer named. */
function missingCitedPaths(
  debts: readonly AcknowledgedModelDebt[],
  exists: (path: string) => boolean,
): string[] {
  const problems: string[] = [];
  for (const debt of debts) {
    for (const path of citedRepoPaths(debt.why)) {
      if (!exists(path)) problems.push(`${debt.id}: cites \`${path}\`, which is not in the tree`);
    }
  }
  return problems;
}

const existsInTree = (path: string): boolean =>
  statSync(resolve(ROOT, path), { throwIfNoEntry: false }) !== undefined;

describe("vendor model status — the registry's ids are dated and sourced (#1537)", () => {
  const registrySource = readFileSync(REGISTRY_PATH, "utf8");
  const importedIds = Object.values(MODELS) as string[];
  const parsedIds = parseRegistryIds(registrySource);

  it("finds the registry's ids at all, by both readers", () => {
    // The floor. Without this, a reader that silently found nothing would turn
    // every arm below green by making it vacuous (invariant 7).
    expect(importedIds.length).toBeGreaterThanOrEqual(5);
    expect(parsedIds.length).toBeGreaterThanOrEqual(5);
  });

  it("the two readers agree on which ids the registry ships", () => {
    expect([...new Set(parsedIds)].sort()).toEqual([...new Set(importedIds)].sort());
  });

  it("every id the registry ships is dated, sourced, and its shutdown acknowledged", () => {
    const problems = auditVendorStatus({
      ids: importedIds,
      table: VENDOR_MODEL_STATUS,
      shutdownDebt: WIRED_DESPITE_SHUTDOWN,
      unclearDebt: STATUS_UNCLEAR_AT_SOURCE,
    });
    expect(problems).toEqual([]);
  });

  it("every file path a debt entry cites is in the tree — and the citations exist at all (#1785)", () => {
    const cited = [...WIRED_DESPITE_SHUTDOWN, ...STATUS_UNCLEAR_AT_SOURCE]
      .flatMap((debt) => citedRepoPaths(debt.why));
    // The floor first: an extractor that silently found nothing would make the
    // assertion below vacuous and green (invariant 7), and this suite's own
    // "finds the registry's ids at all" arm is the precedent for saying so.
    expect(cited.length).toBeGreaterThanOrEqual(5);
    expect(missingCitedPaths([...WIRED_DESPITE_SHUTDOWN, ...STATUS_UNCLEAR_AT_SOURCE], existsInTree))
      .toEqual([]);
  });

  it("carries no row for an id the registry does not ship", () => {
    // Not a correctness defect, but a table that accumulates dead rows stops
    // being readable as "what we ship", which is the only thing it is for.
    const shipped = new Set(importedIds);
    expect(Object.keys(VENDOR_MODEL_STATUS).filter((id) => !shipped.has(id))).toEqual([]);
  });

  it("records the shutdown this card was filed about, so a re-point cannot leave a stale row", () => {
    expect(VENDOR_MODEL_STATUS["gemini-3-pro-image-preview"]).toMatchObject({
      status: "shutdown",
      shutdownOn: "2026-06-25",
    });
    expect(VENDOR_MODEL_STATUS["gemini-3.1-flash-image-preview"]).toMatchObject({
      status: "shutdown",
      shutdownOn: "2026-06-25",
    });
  });
});

describe("vendor model status — the checker's own controls (working law 2)", () => {
  const ok: VendorModelRow = { status: "current", readOn: "2026-09-30", source: "https://example.test" };
  const dead: VendorModelRow = {
    status: "shutdown",
    shutdownOn: "2026-06-25",
    readOn: "2026-09-30",
    source: "https://example.test",
  };

  it("PASSES a table that is complete and acknowledged (the positive control)", () => {
    expect(
      auditVendorStatus({
        ids: ["a", "b"],
        table: { a: ok, b: dead },
        shutdownDebt: [{ id: "b", card: "#1537", why: "reason" }],
        unclearDebt: [],
      }),
    ).toEqual([]);
  });

  it("REFUSES an id with no row", () => {
    const problems = auditVendorStatus({ ids: ["a"], table: {}, shutdownDebt: [], unclearDebt: [] });
    expect(problems.join("\n")).toContain("never been read");
  });

  it("REFUSES a row whose readOn is not a date", () => {
    const problems = auditVendorStatus({
      ids: ["a"],
      table: { a: { ...ok, readOn: "recently" } },
      shutdownDebt: [],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("not an ISO");
  });

  it("REFUSES a row with no source", () => {
    const problems = auditVendorStatus({
      ids: ["a"],
      table: { a: { ...ok, source: "  " } },
      shutdownDebt: [],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("no source");
  });

  it("REFUSES a shut-down id nobody acknowledged — the #1537 defect itself", () => {
    const problems = auditVendorStatus({ ids: ["b"], table: { b: dead }, shutdownDebt: [], unclearDebt: [] });
    expect(problems.join("\n")).toContain("not in WIRED_DESPITE_SHUTDOWN");
  });

  it("REFUSES a shutdown row with no shutdown date", () => {
    const problems = auditVendorStatus({
      ids: ["b"],
      table: { b: { status: "shutdown", readOn: "2026-09-30", source: "https://example.test" } },
      shutdownDebt: [{ id: "b", card: "#1537", why: "reason" }],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("shutdownOn is missing");
  });

  it("REFUSES a debt line that outlived its debt (the list only shrinks)", () => {
    const problems = auditVendorStatus({
      ids: ["a"],
      table: { a: ok },
      shutdownDebt: [{ id: "a", card: "#1537", why: "reason" }],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("no longer carries that status");
  });

  it("REFUSES a debt line naming an id the registry dropped", () => {
    const problems = auditVendorStatus({
      ids: ["a"],
      table: { a: ok },
      shutdownDebt: [{ id: "gone", card: "#1537", why: "reason" }],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("no longer ships");
  });

  it("REFUSES a debt line with no card", () => {
    const problems = auditVendorStatus({
      ids: ["b"],
      table: { b: dead },
      shutdownDebt: [{ id: "b", card: "", why: "reason" }],
      unclearDebt: [],
    });
    expect(problems.join("\n")).toContain("names no card");
  });

  it("REFUSES an empty id set rather than reporting a clean tree", () => {
    const problems = auditVendorStatus({ ids: [], table: {}, shutdownDebt: [], unclearDebt: [] });
    expect(problems.join("\n")).toContain("the reader is broken");
  });

  it("REFUSES a debt entry citing a path that is not in the tree (#1785)", () => {
    const problems = missingCitedPaths(
      [{ id: "b", card: "#1", why: "reached from `server/does/not/exist.ts:12`" }],
      () => false,
    );
    expect(problems.join("\n")).toContain("not in the tree");
  });

  it("CONTROL: says nothing about a debt entry whose cited path IS in the tree", () => {
    const problems = missingCitedPaths(
      [{ id: "b", card: "#1", why: "reached from `server/lib/boardOps.ts`" }],
      (path) => path === "server/lib/boardOps.ts",
    );
    expect(problems).toEqual([]);
  });

  it("the path extractor collects a path, and nothing that merely looks like one", () => {
    // Negative control. Without it, a symbol or a route collected by accident
    // would redden the real-population arm for a reason that has nothing to do
    // with a citation rotting — and the diagnosis would point at the tree.
    expect(
      citedRepoPaths(
        "`server/lib/boardOps.ts` and `client/src/a/b.tsx:4` and `shared/x.mts` — " +
          "but not `IMAGE_PRO`, `CREDIT_COSTS.castingImage`, `generation.refreshSlots`, " +
          "`CastNode.tsx`, `/app/canvas/:id` or `geminiViews`",
      ),
    ).toEqual(["server/lib/boardOps.ts", "client/src/a/b.tsx", "shared/x.mts"]);
  });

  it("the second reader collects a declaration, and nothing that is not one", () => {
    // Negative control for the parse: an array const and a non-exported const
    // must not be collected, or the two readers would disagree for the wrong
    // reason and the agreement arm would be noise.
    const ids = parseRegistryIds(
      [
        'export const IMAGE_PRO = "some-model-id" as const;',
        "export const IMAGE_FALLBACK = [IMAGE_PRO] as const;",
        'const NOT_EXPORTED = "hidden-id" as const;',
      ].join("\n"),
    );
    expect(ids).toEqual(["some-model-id"]);
  });
});
