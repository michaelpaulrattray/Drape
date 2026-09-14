import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE ABUSE STRIP SAYS WHAT IT COUNTS — #946.
 *
 * The moderator console's strip read *"N critical in the last day"* and there
 * was no day behind it: `getAbuseAlertsSummary` had no date condition of any
 * kind. Worse, N was the criticals among the newest TEN abuse rows, and the
 * whole panel — headed *"Needs looking at"* — renders only when N is above
 * zero. So ten newer warning-level rows pushed a critical alert to position
 * eleven and took its own panel off the page, with the row correctly in the
 * table and correctly in the bucket. That is the shape the founder ruling
 * above the abuse bucket exists to refuse: *"the wire would exist, the row
 * would exist, and staff would never see it."*
 *
 * The count is a real `COUNT` now — proven at the statement in
 * `server/auditLogFilterSql.test.ts`, which is where a claim about SQL belongs.
 * What is held HERE is the half that lives in the markup and that no SQL test
 * can see:
 *
 *   - neither console promises a window the query does not have;
 *   - each console's panel is gated on the summary's own critical count, so a
 *     future edit cannot quietly narrow it back to a page's worth.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE EVERY READ. Both files now carry a docblock
 * explaining the removed phrase, and a reader that cannot tell a mention from
 * a declaration makes the fix undocumentable — the same lesson the shift
 * runner's quiet-entry detector arrived at (#360).
 *
 * ⚠ EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL, because an absence
 * arm is green when its subject is deleted and green when its matcher is
 * wrong, and both have happened in this repository (working law 2).
 */

const CLIENT = path.resolve(__dirname, "../client/src");

/** The two consoles that draw an abuse strip from `getAbuseAlerts`. */
const STRIPS = {
  moderator: "features/moderator/AuditLogsTab.tsx",
  admin: "features/admin/AuditLogsFilters.tsx",
};

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT, relative), "utf8");

/** Source with block and line comments removed. */
const code = (text: string): string =>
  text
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("{/*");
    })
    .join("\n");

describe("the abuse strip says what it counts (#946)", () => {
  it("reads both consoles, and reads real files", () => {
    /*
      The positive control for every arm below. A path that stopped resolving
      would throw here rather than making an absence arm pass by reading
      nothing — which is the failure mode this whole file is about.
    */
    for (const [name, relative] of Object.entries(STRIPS)) {
      const source = read(relative);
      expect(source.length, `${name} read as empty`).toBeGreaterThan(500);
      expect(code(source), `${name} draws no abuse count at all`).toContain("criticalCount");
    }
  });

  it("neither console promises a day the query does not have", () => {
    for (const [name, relative] of Object.entries(STRIPS)) {
      const source = code(read(relative));

      expect(source, `${name} claims a time window the summary does not apply`)
        .not.toContain("in the last day");
      expect(source, `${name} claims a time window the summary does not apply`)
        .not.toContain("last 24");
    }
  });

  it("the phrase it settled on is the one both consoles use", () => {
    /*
      The paired half, and it is not decoration: the two arms above are equally
      green if the sentence is deleted outright, which would take the number
      off a staff surface rather than making it honest. The admin console had
      already arrived at this wording on its own — the moderator one was
      brought to it, not invented.
    */
    for (const [name, relative] of Object.entries(STRIPS)) {
      expect(code(read(relative)), `${name} no longer shows a critical count to staff`)
        .toContain("critical</span>");
    }
  });

  it("each panel is gated on the summary's own count, never on the rows it shows", () => {
    /*
      THE ARM THAT HOLDS THE ACTUAL DEFECT. Both panels return null / render
      nothing when the critical count is zero. While that count was taken over
      the returned page, the gate was "is there a critical among the newest
      ten" — which is how an alert hid its own panel. The count is unbounded
      now, so the gate is "is there a critical at all", and these assertions
      are what stop it being narrowed back to `alerts` without anybody noticing.
    */
    const moderator = code(read(STRIPS.moderator));
    expect(moderator, "the moderator panel's render gate has moved")
      .toContain("(alertsQuery.data?.criticalCount || 0) > 0");

    const admin = code(read(STRIPS.admin));
    expect(admin, "the admin panel's render gate has moved")
      .toContain("(alertsData.criticalCount || 0) === 0");

    /*
      And neither count may be computed from the alerts LIST — that is the
      defect written out in one line, and it is what a well-meaning refactor
      reaches for when the count looks redundant beside the rows.

      ⚠ THE FIRST DRAFT OF THIS ARM MATCHED `.severity === "critical"` AND WENT
      RED ON A CORRECT TREE: the moderator console reads exactly that per ROW,
      to decide whether a row's pill wears attention. Reading a severity is
      fine and universal; COUNTING a list of them is the defect. So the matcher
      is the counting shape, not the comparison.
    */
    for (const [name, source] of [["moderator", moderator], ["admin", admin]] as const) {
      expect(source, `${name} counts severities out of the alerts list again`)
        .not.toContain("alerts.filter(");
      expect(source, `${name} counts severities out of the alerts list again`)
        .not.toContain("alerts?.filter(");
    }
  });
});
