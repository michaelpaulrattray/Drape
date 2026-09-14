/**
 * THE CARDS NO SWITCH CAN OFFER ANYBODY — driven at the counter's own log
 * (#893).
 *
 * The standing orders say it in as many words: *"Background work runs ONLY
 * where a switch says so."* So an open card carrying none of the seven switch
 * labels is not takeable by any shift, however real it is — and until this
 * reading existed, nothing anywhere said so.
 *
 * **Measured the night it was built: exactly one, and it had been there two
 * days.** `#804` — *handleSubscriptionUpdated has no which-sub-is-newer guard*,
 * a billing defect that came out of PR #803's review on 11 September — carried
 * `debt` and nothing else. It was on his page the whole time, in the Debt
 * group; every shift since had read the queue, worked the category order, and
 * correctly never seen it. **Visible and takeable are different things, and
 * only one of them gets work done.**
 *
 * ⚠ **THE ARMS ARE ON THE LOG, WHICH IS THE PRODUCT HERE.** Nothing is stored
 * and nothing is refused — the deliverable is a sentence a shift reads at 3am,
 * so a suite that asserted a return value would be testing a thing nobody
 * consumes. The arms drive `refreshQueueCounts` end to end with a fake `gh` and
 * a connection double, and read what it printed.
 *
 * The four, and the second and third are the ones that keep it honest:
 *
 *   1. a `debt`-only card is NAMED, with its number;
 *   2. ⚠ **POSITIVE CONTROL — zero is printed as a real answer.** A line that
 *      appears only when it has something to say is indistinguishable, on the
 *      night it says nothing, from a reading that stopped being taken;
 *   3. ⚠ **a card waiting on HIM is not reported.** `roadmap` and `parked` are
 *      not work nobody can take — they are work nobody may take yet, and
 *      reporting them would bury the one card that matters under thirty that
 *      do not;
 *   4. an unlabelled card is named too, under `unfiled`.
 */
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { refreshQueueCounts, type QueueGhReader } from "../scripts/lib/crewQueueCount.mts";

/* Same declaration as `crewQueueCountEmptyRead.test.ts`, for the same reason:
   every arm hands the reading a FAKE `gh`, but the module it imports holds
   `execFileSync` one hop out, and an arm added later that forgot the fake would
   spawn for real inside vitest's 5s default. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

type Card = { readonly number: number; readonly title: string; readonly labels: readonly string[] };

function connectionThat() {
  const conn = {
    async query<T = unknown>(sql: string): Promise<[T, unknown]> {
      if (/SHOW TABLES LIKE/.test(sql)) return [[{}] as T, null];
      if (/SHOW COLUMNS/.test(sql)) return [[] as unknown as T, null];
      return [[] as unknown as T, null];
    },
  };
  return { conn };
}

/**
 * A `gh` double serving ONE population — the whole-queue read and every
 * per-label read are filtered out of the same list, so the arms cannot
 * accidentally describe a queue that disagrees with itself.
 */
function ghServing(cards: readonly Card[]): QueueGhReader {
  const shape = (list: readonly Card[]) =>
    JSON.stringify(
      list.map((card) => ({
        number: card.number,
        title: card.title,
        createdAt: "2026-09-11T00:00:00Z",
        updatedAt: "2026-09-11T00:00:00Z",
        labels: card.labels.map((name) => ({ name })),
      })),
    );
  return (args) => {
    const at = args.indexOf("--label");
    if (at !== -1) return shape(cards.filter((card) => card.labels.includes(args[at + 1]!)));
    if (args.includes("sort:created-asc")) {
      return JSON.stringify(cards.length === 0 ? [] : [{ number: cards[0]!.number, createdAt: "2026-09-11T00:00:00Z" }]);
    }
    /* The merged-pull-request read behind the possibly-fixed flag. */
    if (args.includes("pr")) return JSON.stringify([]);
    return shape(cards);
  };
}

async function logOf(cards: readonly Card[]): Promise<string> {
  const said: string[] = [];
  const { conn } = connectionThat();
  const outcome = await refreshQueueCounts(conn, ghServing(cards), {
    log: (line) => said.push(line),
    warn: (line) => said.push(line),
  });
  expect(outcome.ok, `the reading refused: ${outcome.ok ? "" : outcome.reason}`).toBe(true);
  return said.join("\n");
}

/** The card that was invisible for two days, at its real labels. */
const EIGHT_OH_FOUR: Card = {
  number: 804,
  title: "handleSubscriptionUpdated has no which-sub-is-newer guard",
  labels: ["debt"],
};

/** One that IS on offer, so no arm below passes on an empty queue. */
const ON_OFFER: Card = { number: 884, title: "the reviewer produced no verdict", labels: ["bug"] };

describe("the counter names the open cards no switch can reach", () => {
  it("⚠ #804's real shape is NAMED, with its number", async () => {
    const said = await logOf([EIGHT_OH_FOUR, ON_OFFER]);

    expect(said).toMatch(/reachable by no switch — 1 open card\(s\)/);
    expect(said).toMatch(/#804 \[debt\] handleSubscriptionUpdated/);
    /* And the card that IS on offer is not in the list — the reading must not
       simply repeat the queue back. */
    expect(said).not.toMatch(/#884 \[/);
  });

  it("⚠ POSITIVE CONTROL — zero is printed as a real answer, not as silence", async () => {
    const said = await logOf([ON_OFFER, { number: 883, title: "a retro card", labels: ["debt", "seat:retro"] }]);

    expect(said).toMatch(/reachable by no switch — 0 open card\(s\)/);
    expect(said).toMatch(/none — every open card is either on offer above or waiting on him by design/);
  });

  it("⚠ a card waiting on HIM is not reported — roadmap and parked are not untakeable", async () => {
    const said = await logOf([
      ON_OFFER,
      { number: 801, title: "N3: the refine engine re-asked", labels: ["roadmap", "rung:N3"] },
      { number: 203, title: "N2: RETIRE the wardrobe/basics machinery", labels: ["parked", "rung:N2"] },
      { number: 16, title: "N1 — the creative register", labels: ["scope-change", "design-unbuilt"] },
    ]);

    expect(said).toMatch(/reachable by no switch — 0 open card\(s\)/);
    for (const number of [801, 203, 16]) expect(said).not.toMatch(new RegExp(`#${number} \\[`));
  });

  it("a card with no label at all is named too, under `unfiled`", async () => {
    const said = await logOf([ON_OFFER, { number: 999, title: "filed in a hurry", labels: [] }]);

    expect(said).toMatch(/reachable by no switch — 1 open card\(s\)/);
    expect(said).toMatch(/#999 \[unfiled\] filed in a hurry/);
  });
});
