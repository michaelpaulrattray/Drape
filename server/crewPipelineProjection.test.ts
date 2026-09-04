/**
 * ONE TABLE, TWO VOCABULARIES — the split that keeps a group from becoming a
 * switch (#325, `server/db/crewWorkSwitches.ts`'s `splitCountRows`).
 *
 * The pipeline groups share `crew_queue_counts` with the switch counts. That
 * shared table is what makes this feature a row and a line rather than a
 * migration and a founder ceremony — but it means ONE reader now has to keep
 * two populations apart, and the way it fails is not symmetric:
 *
 *   * ⚠ **A GROUP ROW READ AS A SWITCH COUNT is the dangerous direction.** The
 *     panel draws a `<Switch>` beside every row in `counts`. A `group:roadmap`
 *     row arriving there would put a toggle on feature work, which is
 *     `PROGRAM.md`'s founder law — *"the team NEVER selects the next feature"* —
 *     with a control attached, on his own page, looking exactly like the five
 *     legitimate ones.
 *   * A switch count read as a group is merely wrong: he would see the same
 *     number twice and the total would exceed the queue.
 *
 * Both are driven below, over a fixture holding BOTH key shapes plus rows
 * belonging to neither — because a fixture containing only one shape cannot
 * fail on a filter that lets everything through.
 */
import { describe, expect, it } from "vitest";

import { splitCountRows } from "./db/crewWorkSwitches";
import { CREW_PIPELINE_GROUPS, pipelineGroupRowKey } from "../shared/crewPipelineGroups";
import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches";

const COUNTED_AT = new Date("2026-08-31T09:19:48Z");

/**
 * ⚠ THE FIXTURE CARRIES EVERY FIELD `readCountRows` DECLARES, and it stopped
 * doing so once (PR #498, finding 3): `possiblyDone` was added to the row shape
 * and this fixture kept four fields. Nothing caught it — `tsconfig.json`
 * excludes `**\/*.test.ts` from `pnpm check`, so no type error, and the suite
 * stayed green only because the parser reads `undefined` as nothing-flagged.
 * A projection suite that quietly stops projecting one field is exactly the
 * green-while-proving-nothing shape `arm-at-the-producer` is about.
 */
function row(categoryKey: string, openCount: number, titles: string | null = null) {
  return { categoryKey, openCount, titles, excluded: null, possiblyDone: null, countedAt: COUNTED_AT };
}

/**
 * A realistic table: five switch counts, thirteen group rows, and two rows
 * belonging to neither vocabulary.
 */
const TABLE = [
  ...CREW_WORK_CATEGORIES.map((category, index) => row(category.key, index + 1)),
  ...CREW_PIPELINE_GROUPS.map((group, index) => row(pipelineGroupRowKey(group.key), index + 20)),
  /* A category renamed months ago, its row left behind — the shape the switch
     reader has always dropped, now in a table two readers share. */
  row("securityy", 99),
  row("group:a-group-we-renamed", 98),
];

describe("the projection keeps the two populations apart", () => {
  it("⚠ NO GROUP ROW REACHES `counts` — the list the panel puts a switch beside", () => {
    const { counts } = splitCountRows(TABLE);
    for (const view of counts) {
      expect(view.categoryKey.startsWith("group:")).toBe(false);
      expect(CREW_WORK_CATEGORIES.map((category) => category.key)).toContain(view.categoryKey);
    }
    /* POSITIVE CONTROL — the filter did not simply empty the list. All five
       switch counts are present, so an arm asserting "no group rows" cannot
       pass on a reader that returns nothing. */
    expect(counts).toHaveLength(CREW_WORK_CATEGORIES.length);
    expect(counts.map((view) => view.categoryKey)).toEqual(CREW_WORK_CATEGORIES.map((category) => category.key));
  });

  it("no switch count reaches `groups`", () => {
    const { groups } = splitCountRows(TABLE);
    const switchKeys = CREW_WORK_CATEGORIES.map((category) => category.key);
    for (const view of groups) expect(switchKeys).not.toContain(view.groupKey);
    /* POSITIVE CONTROL, same reason. */
    expect(groups).toHaveLength(CREW_PIPELINE_GROUPS.length);
  });

  it("⚠ A ROW BELONGING TO NEITHER VOCABULARY IS DROPPED BY BOTH", () => {
    const { counts, groups } = splitCountRows(TABLE);
    expect(counts.map((view) => view.categoryKey)).not.toContain("securityy");
    expect(groups.map((view) => view.groupKey)).toEqual(CREW_PIPELINE_GROUPS.map((group) => group.key));
    expect(groups.map((view) => view.groupKey)).not.toContain("a-group-we-renamed");
  });

  it("⚠ THE GROUPS COME BACK IN THE VOCABULARY'S ORDER, never the table's", () => {
    /* The order is MEANING here — first match wins in `pipelineGroupFor`, so
       the order is what his page says about a card carrying two labels. Driven
       against a table deliberately shuffled out of order. */
    const shuffled = [...CREW_PIPELINE_GROUPS].reverse().map((group, index) => row(pipelineGroupRowKey(group.key), index));
    const { groups } = splitCountRows(shuffled);
    expect(groups.map((view) => view.groupKey)).toEqual(CREW_PIPELINE_GROUPS.map((group) => group.key));
  });

  it("an uncounted group is ABSENT rather than zero — they are opposite facts", () => {
    /* Between this deploy and the next shift's count there are no group rows at
       all, and the panel says "not counted yet" instead of drawing twelve
       confident zeros. A zero here would be the most reassuring and most wrong
       sentence the panel could print. */
    const onlySwitches = CREW_WORK_CATEGORIES.map((category) => row(category.key, 3));
    const { counts, groups } = splitCountRows(onlySwitches);
    expect(groups).toHaveLength(0);
    /* POSITIVE CONTROL — the switch half still arrived, so the empty groups
       list is a fact about the rows and not about a broken reader. */
    expect(counts).toHaveLength(CREW_WORK_CATEGORIES.length);
  });

  it("the titles come through parsed, on both sides", () => {
    const withTitles = [
      row("bugs", 11, '[{"number":345,"title":"a switch card"}]'),
      row(pipelineGroupRowKey("debt"), 27, '[{"number":300,"title":"a debt card"}]'),
    ];
    const { counts, groups } = splitCountRows(withTitles);
    expect(counts[0]?.titles).toEqual([{ number: 345, title: "a switch card" }]);
    expect(groups[0]?.titles).toEqual([{ number: 300, title: "a debt card" }]);
    /* POSITIVE CONTROL for the degradation — a malformed value yields an empty
       list rather than a throw, because his whole tab is one call. */
    const broken = splitCountRows([row(pipelineGroupRowKey("debt"), 27, "{not json")]);
    expect(broken.groups[0]?.titles).toEqual([]);
    expect(broken.groups[0]?.openCount).toBe(27);
  });
});
