/**
 * THE ZERO THAT COMES BACK FROM A `gh` THAT DID NOT FAIL (#725).
 *
 * `countOpen`'s docblock has promised since #285 that *"a failed count is
 * `null`, never `0`"*, and it was careful in exactly two directions: a `gh`
 * that THREW, and a payload that was not an array. There is a third road and it
 * is the one that actually happened — **`gh` exiting 0 and returning `[]`**.
 * That is a successful read of nothing, so it went through as a fact, with a
 * FRESH `countedAt`.
 *
 * ⚠ **THE FRESHNESS IS WHY IT MATTERS, NOT THE WRONG NUMBER.**
 * `.agents/foreman/check-park.ps1` condition 3 keys on these very counts, and
 * its only guard against a bad zero is a STALENESS ceiling — which a zero
 * written this way sails through, being genuinely new. Seven categories are
 * seven `gh` calls across about fifteen seconds; a blip wide enough to cover
 * several of them writes several fresh zeros, and with NEXT UP empty that is
 * the one-shift park road (#504). It fails in the direction that HIDES work.
 *
 * Observed once on production, at the shift start of `foreman-20260910-0105`:
 * `process` stored 0 at 15:00:11 and 8 forty seconds later, `written 20,
 * skipped 0`. It was not reproduced, which is why the repair is read at the
 * code and driven here rather than caught in the act.
 *
 * The arms, and the third is the one that keeps this honest:
 *
 *   1. a category reading empty while the run's own whole-queue read holds
 *      cards with that label is REFUSED — the old row and its older timestamp
 *      stand;
 *   2. an empty read that cannot be cross-examined at all is refused too;
 *   3. ⚠ **POSITIVE CONTROL — a genuinely empty category still stores 0.**
 *      Without it every arm above would pass on a counter that had simply lost
 *      the ability to say zero, which is a different wrong panel;
 *   4. ⚠ **`offered` 0 is NOT the same fact as an empty read.** A category
 *      whose every card is excluded stores 0 legitimately (`security` reads
 *      `0 open · 1 parked` on production today), and refusing that would empty
 *      his panel of a true number;
 *   5. the cross-check reads the population from the SAME response as the
 *      pipeline groups, not a second `gh` round trip.
 */
import { describe, expect, it, vi } from "vitest";

import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { refreshQueueCounts, type QueueGhReader } from "../scripts/lib/crewQueueCount.mts";

/* ⚠ IN THE #548 POPULATION ONE HOP OUT, AND CORRECTLY SO. Every arm here hands
   the reading a FAKE `gh` and nothing in this file spawns anything — but the
   module it imports holds `execFileSync` in its real reader, which is the hop
   the deriver resolves, and an arm added later that forgot the fake would spawn
   for real inside vitest's 5s default. `server/crewCloseCounts.test.ts` carries
   the same declaration for the same reason. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** The label the observed incident was on, and a second one to hold beside it. */
const PROCESS = "seat:retro";
const BUGS = "bug";

/**
 * A connection double that records what was written, in the count-only world
 * (no optional migration column), which is the road that has worked since
 * before any of the three migrations existed.
 */
function connectionThat() {
  const writes: Array<{ values: readonly unknown[] }> = [];
  const conn = {
    async query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]> {
      if (/SHOW TABLES LIKE 'users'/.test(sql)) return [[{}] as T, null];
      if (/SHOW TABLES LIKE/.test(sql)) return [[{}] as T, null];
      if (/SHOW COLUMNS/.test(sql)) return [[] as unknown as T, null];
      if (/INSERT INTO/i.test(sql)) writes.push({ values: values ?? [] });
      return [[] as unknown as T, null];
    },
  };
  return { conn, writes };
}

/** What was stored for one category key, or `null` if the row was never written. */
function storedFor(writes: ReadonlyArray<{ values: readonly unknown[] }>, key: string): number | null {
  for (const write of writes) if (write.values[0] === key) return Number(write.values[1]);
  return null;
}

function cardsFor(label: string, howMany: number, extraLabels: readonly string[] = []) {
  return Array.from({ length: howMany }, (_unused, index) => ({
    number: 1000 + index,
    title: `a ${label} card`,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    labels: [label, ...extraLabels].map((name) => ({ name })),
  }));
}

/**
 * A `gh` double whose PER-LABEL answers and WHOLE-QUEUE answer are given
 * separately — which is the whole point, because the defect is precisely the
 * two disagreeing. `blipOn` is the label whose per-label call comes back `[]`
 * while the queue read still holds its cards.
 */
function ghThatBlips(options: {
  readonly queue: Readonly<Record<string, number>>;
  readonly blipOn?: readonly string[];
  readonly wholeQueueFails?: boolean;
}): QueueGhReader {
  const { queue, blipOn = [], wholeQueueFails = false } = options;
  return (args) => {
    const at = args.indexOf("--label");
    if (at !== -1) {
      const label = args[at + 1]!;
      if (blipOn.includes(label)) return JSON.stringify([]);
      return JSON.stringify(cardsFor(label, queue[label] ?? 0));
    }
    if (args.includes("sort:created-asc")) {
      return JSON.stringify([{ number: 1000, createdAt: "2026-09-01T00:00:00Z" }]);
    }
    if (args.includes("pr")) return JSON.stringify([]);
    /* The whole open queue, for the pipeline groups — and now for the zero's
       cross-examination. It is UNAFFECTED by the blip, which is what makes the
       disagreement visible. */
    if (wholeQueueFails) throw new Error("gh: the whole-queue read is down");
    return JSON.stringify(Object.entries(queue).flatMap(([label, count]) => cardsFor(label, count)));
  };
}

const QUIET = { log: () => {}, warn: () => {} };

describe("a category that reads empty is cross-examined before the zero is believed", () => {
  it("⚠ REFUSES the zero when the run's own whole-queue read holds cards with that label", async () => {
    const { conn, writes } = connectionThat();
    const said: string[] = [];
    const outcome = await refreshQueueCounts(
      conn,
      ghThatBlips({ queue: { [PROCESS]: 8, [BUGS]: 1 }, blipOn: [PROCESS] }),
      { log: () => {}, warn: (line) => said.push(line) },
    );

    expect(outcome.ok).toBe(true);
    /* The row is never written, so the previous number and its OLDER timestamp
       stand — which is what the panel renders the age of. */
    expect(storedFor(writes, "process")).toBeNull();
    expect(said.join("\n")).toMatch(/REFUSING seat:retro.*8 open card/s);
  });

  it("⚠ POSITIVE CONTROL — the untouched categories in that same run are still written", async () => {
    const { conn, writes } = connectionThat();
    const outcome = await refreshQueueCounts(
      conn,
      ghThatBlips({ queue: { [PROCESS]: 8, [BUGS]: 1 }, blipOn: [PROCESS] }),
      QUIET,
    );

    expect(outcome.ok).toBe(true);
    /* A refusal is per category. One blip must not cost him the other six
       numbers, or the repair would be a worse outage than the defect. */
    expect(storedFor(writes, "bugs")).toBe(1);
    expect(outcome.ok && outcome.skipped).toBe(1);
  });

  it("⚠ POSITIVE CONTROL — a genuinely empty category still stores 0", async () => {
    const { conn, writes } = connectionThat();
    const outcome = await refreshQueueCounts(conn, ghThatBlips({ queue: { [BUGS]: 1 } }), QUIET);

    expect(outcome.ok).toBe(true);
    /* Nothing carries `seat:retro` in this world, the per-label read agrees,
       and 0 is the true answer. A counter that can no longer say zero would
       pass every refusal arm above and still be broken. */
    expect(storedFor(writes, "process")).toBe(0);
    expect(storedFor(writes, "bugs")).toBe(1);
  });

  it("⚠ refuses an empty read it CANNOT check — an unverified zero is the one that parks the team", async () => {
    const { conn, writes } = connectionThat();
    const said: string[] = [];
    const outcome = await refreshQueueCounts(
      conn,
      ghThatBlips({ queue: { [BUGS]: 1 }, blipOn: [PROCESS], wholeQueueFails: true }),
      { log: () => {}, warn: (line) => said.push(line) },
    );

    expect(outcome.ok).toBe(true);
    expect(storedFor(writes, "process")).toBeNull();
    expect(said.join("\n")).toMatch(/could not be taken this run/);
  });

  it("⚠ and a category whose cards are all EXCLUDED still stores 0 — `offered` is not an empty read", async () => {
    const { conn, writes } = connectionThat();
    /* `parked` is an exclusion, so this category is on nobody's offer — but it
       is not empty, and the reading has real rows. Production's `security`
       reads exactly this: `0 open · 1 parked`. Refusing it would take a TRUE
       number off his panel. */
    const gh: QueueGhReader = (args) => {
      const at = args.indexOf("--label");
      if (at !== -1) {
        const label = args[at + 1]!;
        if (label === "seat:warden") return JSON.stringify(cardsFor(label, 1, ["parked"]));
        return JSON.stringify([]);
      }
      if (args.includes("sort:created-asc")) return JSON.stringify([{ number: 1000, createdAt: "2026-09-01T00:00:00Z" }]);
      if (args.includes("pr")) return JSON.stringify([]);
      return JSON.stringify(cardsFor("seat:warden", 1, ["parked"]));
    };
    const outcome = await refreshQueueCounts(conn, gh, QUIET);

    expect(outcome.ok).toBe(true);
    /* Without the exclusions column this world stores the TOTAL, which is 1.
       The fact under test is that the row was WRITTEN at all — the reading had
       rows, so no cross-examination was owed. */
    expect(storedFor(writes, "security")).not.toBeNull();
  });
});

/**
 * THE LAW-7 SIBLING, FOUND IN THE SAME SWEEP.
 *
 * `countPipelineGroups`'s own docblock has said since #325 that *"a broken `gh`
 * that returned an empty list here would write TWELVE zeros — his page would
 * read 'nothing in the pipeline at all', which is the most reassuring and most
 * wrong sentence this panel could ever print"* — and then guarded only the
 * SHAPE. An empty array is a perfectly good array.
 */
describe("the whole-queue read is cross-examined the same way", () => {
  it("⚠ REFUSES an empty queue read while this run's own oldest-card read found a card", async () => {
    const { conn, writes } = connectionThat();
    const said: string[] = [];
    const gh: QueueGhReader = (args) => {
      const at = args.indexOf("--label");
      if (at !== -1) return JSON.stringify(cardsFor(args[at + 1]!, 1));
      if (args.includes("sort:created-asc")) return JSON.stringify([{ number: 1000, createdAt: "2026-09-01T00:00:00Z" }]);
      if (args.includes("pr")) return JSON.stringify([]);
      return JSON.stringify([]);
    };
    const outcome = await refreshQueueCounts(conn, gh, { log: () => {}, warn: (line) => said.push(line) });

    expect(outcome.ok).toBe(true);
    /* Not one group row is written — the twelve zeros his page would have read
       as an empty pipeline. */
    for (const write of writes) expect(String(write.values[0])).not.toMatch(/^group:/);
    expect(said.join("\n")).toMatch(/REFUSING the pipeline groups.*provably wrong/s);
  });

  it("⚠ POSITIVE CONTROL — a queue that really has rows still writes every group", async () => {
    const { conn, writes } = connectionThat();
    const outcome = await refreshQueueCounts(conn, ghThatBlips({ queue: { [BUGS]: 2 } }), QUIET);

    expect(outcome.ok).toBe(true);
    expect(writes.some((write) => String(write.values[0]).startsWith("group:"))).toBe(true);
  });
});

describe("the evidence comes from a reading this run already takes", () => {
  it("asks `gh` for the whole open queue exactly once, however many categories refuse", async () => {
    const { conn } = connectionThat();
    let wholeQueueReads = 0;
    const gh: QueueGhReader = (args) => {
      const at = args.indexOf("--label");
      if (at !== -1) return JSON.stringify([]);
      if (args.includes("sort:created-asc")) return JSON.stringify([{ number: 1000, createdAt: "2026-09-01T00:00:00Z" }]);
      if (args.includes("pr")) return JSON.stringify([]);
      wholeQueueReads += 1;
      return JSON.stringify(CREW_WORK_CATEGORIES.flatMap((category) => cardsFor(category.queueLabel, 1)));
    };
    await refreshQueueCounts(conn, gh, QUIET);

    /* ⚠ ONE response, ONE instant. Two reads could not settle a disagreement
       between two readings — they would only describe a third moment. */
    expect(wholeQueueReads).toBe(1);
  });

  it("⚠ every switch category is covered by the cross-check, derived rather than listed", async () => {
    const { conn, writes } = connectionThat();
    /* Every category blips at once — the API-blip shape the card describes, and
       the one that would park the team. Not one zero is written. */
    const gh = ghThatBlips({
      queue: Object.fromEntries(CREW_WORK_CATEGORIES.map((category) => [category.queueLabel, 3])),
      blipOn: CREW_WORK_CATEGORIES.map((category) => category.queueLabel),
    });
    const outcome = await refreshQueueCounts(conn, gh, QUIET);

    expect(outcome.ok).toBe(true);
    for (const category of CREW_WORK_CATEGORIES) {
      expect(storedFor(writes, category.key)).toBeNull();
    }
  });
});
