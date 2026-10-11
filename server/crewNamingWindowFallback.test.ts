/**
 * THE BLIND POSSIBLY-FIXED READING, DRIVEN THROUGH THE REAL RUN (issue #2290).
 *
 * `server/crewNamingWindow.test.ts` holds the predicate half — the bound's
 * relationship to the search ceiling, and when a retry is allowed. This file
 * holds the half that actually failed on production: **a RUN**.
 *
 * ⚠ **THE DEFECT, MEASURED RATHER THAN SUPPOSED (2026-10-11).** The merged-PR
 * window is derived from the oldest open card so that it *cannot expire* — and
 * it did not. What expired is the API underneath it: the oldest open card is
 * **#14, filed 2026-08-25**, **1089 of the 1089 merges in this repository
 * postdate it**, and GitHub's search road returns at most **1000**. So the
 * derived window was the whole history, the read came back exactly full, and
 * every offered card in every category was written OUT OF REACH on every shift
 * start. The flag was inert — and his own reason for wanting it (2026-09-04:
 * *"i dont want it trying to fix an irrelevant bug or somthing already
 * ordered"*) is the thing that was quietly not happening.
 *
 * Each arm hands `refreshQueueCounts` a FAKE `gh` and a connection double, so
 * nothing spawns, nothing is written and no network is touched.
 *
 * ⚠ **THE LAST ARM FOUND A REAL DEFECT IN THE FIRST SHAPE OF THIS FIX, AND IS
 * THE REASON THE RETRY HAS ITS OWN `try`.** The retry sat inside
 * `readCardNamings`'s outer `try`, whose `catch` returns `null` — and the
 * caller writes every category UNFLAGGED on `null`. A fallback that threw would
 * therefore have traded today's honest *"OUT OF REACH"* for *"nothing is ever
 * stale"*: #507's own sentence, reintroduced inside the repair meant to restore
 * it. The asymmetry between those two outcomes is the whole justification for
 * the fallback carrying a constant at all, so it is driven, not reasoned.
 */
import { describe, expect, it, vi } from "vitest";

import { SEARCH_RESULT_CEILING, WHOLE_HISTORY_PAGE_BOUND } from "../scripts/lib/crewNamingWindow.mts";
import { refreshQueueCounts, type QueueGhReader } from "../scripts/lib/crewQueueCount.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* ⚠ IN THE #548 POPULATION ONE HOP OUT, AND CORRECTLY SO. Every arm here hands
   the reading a fake `gh` and nothing in this file spawns anything — but the
   module it imports holds `execFileSync` in its real reader, which is the hop
   the deriver resolves, and an arm added later that forgot the fake would spawn
   for real inside vitest's 5s default.
   `server/crewQueueCountEmptyRead.test.ts` carries the same declaration for the
   same reason. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** The Process category's label, and the one open card every arm asks about. */
const PROCESS_LABEL = "seat:retro";
const OFFERED_CARD = 2000;

/**
 * A connection double in the count-only world (no optional migration column),
 * recording what would have been written and writing nothing.
 */
function connectionDouble() {
  const writes: Array<{ values: readonly unknown[] }> = [];
  const conn = {
    async query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]> {
      if (/SHOW TABLES LIKE/.test(sql)) return [[{}] as T, null];
      if (/SHOW COLUMNS/.test(sql)) return [[] as unknown as T, null];
      if (/INSERT INTO/i.test(sql)) writes.push({ values: values ?? [] });
      return [[] as unknown as T, null];
    },
  };
  return { conn, writes };
}

/** One open card, carrying the Process label, filed before every merge below. */
const OPEN_CARDS = [{
  number: OFFERED_CARD,
  title: "an offered process card",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  labels: [{ name: PROCESS_LABEL }],
}];

/** Filler merges that name no card — used only to reach a page bound. */
function filler(howMany: number) {
  return Array.from({ length: howMany }, (_unused, index) => ({
    number: 500000 + index,
    title: "a merge that names nothing",
    body: "no card is named here",
    mergedAt: "2026-09-02T00:00:00Z",
  }));
}

/**
 * The merge that ANSWERS the offered card. It merged after the card was filed,
 * so the rule qualifies it — the only question each arm asks is whether the
 * reading ever got to see it.
 */
const ANSWERING_MERGE = {
  number: 999999,
  title: `fix(process): the thing (Card: #${OFFERED_CARD})`,
  body: `Card: #${OFFERED_CARD}`,
  mergedAt: "2026-09-10T00:00:00Z",
};

/**
 * A `gh` double that answers the two merged-PR roads SEPARATELY, which is the
 * whole point: the defect is the search road coming back short while the other
 * road could have answered. `prCalls` is how an arm proves a retry did or did
 * not happen, rather than inferring it from the verdict.
 */
function ghWithRoads(options: {
  readonly searchRows: readonly unknown[];
  readonly wholeHistory: readonly unknown[] | "throws";
}): { gh: QueueGhReader; prCalls: string[][] } {
  const prCalls: string[][] = [];
  const gh: QueueGhReader = (args) => {
    if (args.includes("pr")) {
      /* ⚠ THREE `gh pr` ROADS, NOT TWO, AND THE FIRST SHAPE OF THIS DOUBLE
         CONFLATED THEM. The build board also reads OPEN pull requests, to hold
         a card somebody is already building off the offer (#1094) — so a bare
         `args.includes("pr")` answered that read with merged-PR rows and
         counted it as a retry. Every `prCalls` arm below was off by one, which
         is a fake teaching the suite a wrong number rather than a defect. The
         merged roads are the ones this file is about; the board's read answers
         empty and is not counted. */
      if (args.includes("--state") && args.includes("open")) return JSON.stringify([]);
      prCalls.push([...args]);
      if (args.includes("--search")) return JSON.stringify(options.searchRows);
      if (options.wholeHistory === "throws") throw new Error("gh: the whole-history road is down");
      return JSON.stringify(options.wholeHistory);
    }
    if (args.includes("sort:created-asc")) {
      return JSON.stringify([{ number: OFFERED_CARD, createdAt: "2026-09-01T00:00:00Z" }]);
    }
    return JSON.stringify(OPEN_CARDS);
  };
  return { gh, prCalls };
}

/** Every line the run said, log and warnings together. */
async function runAndCollect(gh: QueueGhReader) {
  const { conn, writes } = connectionDouble();
  const said: string[] = [];
  const outcome = await refreshQueueCounts(conn, gh, {
    log: (line) => said.push(line),
    warn: (line) => said.push(line),
  });
  return { outcome, said: said.join("\n"), writes };
}

/* The counter's own sentence for a flagged card, quoted rather than
   paraphrased: `#N may already be done — named by merged PR #M · title`.
   ⚠ A looser pattern is the trap here: the word "possibly" appears in the
   reading's OTHER lines, the blindness warning among them, so a regex built on
   it made the negative controls below green on the wrong text. */
const FLAGGED = new RegExp(`#${OFFERED_CARD} may already be done — named by merged PR #${ANSWERING_MERGE.number}`);
const OUT_OF_REACH = new RegExp(`#${OFFERED_CARD} OUT OF REACH`);

describe("a full search page no longer blinds the whole reading", () => {
  it("⚠ THE DEFECT, REPRODUCED AND FIXED — the answering merge outside the search page is still found", async () => {
    /* Exactly at the ceiling, as production is, and the answering merge sits
       OUTSIDE the search page — the case the old reader could neither see nor
       rule out, so it correctly refused to judge and said nothing useful. */
    const { gh, prCalls } = ghWithRoads({
      searchRows: filler(SEARCH_RESULT_CEILING),
      wholeHistory: [...filler(SEARCH_RESULT_CEILING), ANSWERING_MERGE],
    });

    const { outcome, said } = await runAndCollect(gh);

    expect(outcome.ok).toBe(true);
    expect(said).toMatch(FLAGGED);
    expect(said).not.toMatch(OUT_OF_REACH);
    /* Two merged-PR calls — the window, then the whole history — and the
       second one is not a search. */
    expect(prCalls).toHaveLength(2);
    expect(prCalls[1]).not.toContain("--search");
    expect(prCalls[1]).toContain(String(WHOLE_HISTORY_PAGE_BOUND));
  });

  it("⚠ POSITIVE CONTROL — an untruncated window takes ONE call and never retries", async () => {
    /* The whole-history road THROWS here, so a retry could not pass quietly:
       if this arm is green the ordinary run genuinely did not take it. That
       matters for cost — GitHub's budget is one account shared by every seat. */
    const { gh, prCalls } = ghWithRoads({ searchRows: [ANSWERING_MERGE], wholeHistory: "throws" });

    const { outcome, said } = await runAndCollect(gh);

    expect(outcome.ok).toBe(true);
    expect(prCalls).toHaveLength(1);
    expect(said).toMatch(FLAGGED);
  });

  it("⚠ NEGATIVE CONTROL — both roads full stays BLIND, and says which", async () => {
    const { gh, prCalls } = ghWithRoads({
      searchRows: filler(SEARCH_RESULT_CEILING),
      wholeHistory: filler(WHOLE_HISTORY_PAGE_BOUND),
    });

    const { outcome, said } = await runAndCollect(gh);

    expect(outcome.ok).toBe(true);
    /* The honest answer is still reachable and still taken. A repair that
       could no longer REPORT blindness would be the silent direction wearing a
       fix, and every arm above would still be green. */
    expect(said).toMatch(OUT_OF_REACH);
    expect(said).toMatch(/BOTH roads/);
    expect(said).not.toMatch(FLAGGED);
    expect(prCalls).toHaveLength(2);
  });

  it("⚠ THE ASYMMETRY ARM — a FAILING retry stays blind and is never silent", async () => {
    const { gh } = ghWithRoads({
      searchRows: filler(SEARCH_RESULT_CEILING),
      wholeHistory: "throws",
    });

    const { outcome, said, writes } = await runAndCollect(gh);

    expect(outcome.ok).toBe(true);
    /* ⚠ OUT OF REACH, not unflagged. This is the arm that caught the first
       shape of the fix letting the retry's throw reach the outer `catch`,
       which returns `null`, on which the caller writes every category
       UNFLAGGED — his panel would have read "nothing is stale" because a
       fallback failed. */
    expect(said).toMatch(OUT_OF_REACH);
    expect(said).toMatch(/whole-history re-read failed/);
    expect(said).not.toMatch(FLAGGED);
    /* And the run still COUNTED. A failed fallback costs the flag, never the
       numbers under his switches. */
    expect(writes.length).toBeGreaterThan(0);
  });
});
