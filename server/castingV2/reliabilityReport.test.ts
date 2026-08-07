/**
 * The instrument gets a negative control and a positive control before its
 * verdicts count for anything (working law 2, D-147, D-203). A reliability
 * report that cannot report an ugly number is a press release.
 */
import { describe, expect, it } from "vitest";
import {
  classesOf,
  classifyAttempt,
  DELIVERY_RATE_BAR,
  formatReport,
  heartbeatLine,
  summarize,
  type AttemptRow,
  type StoredCheck,
} from "./reliabilityReport";

const at = new Date("2026-08-07T10:00:00Z");

const check = (over: Partial<StoredCheck> = {}): StoredCheck => ({
  facet: "eye.colour",
  asked: "pale blue",
  verified: true,
  read: true,
  binding: true,
  saw: "pale blue irises",
  ...over,
});

const attempt = (over: Partial<AttemptRow> = {}): AttemptRow => ({
  operationId: "op-1",
  createdAt: at,
  status: "ready",
  verification: { checks: [check()] },
  ...over,
});

describe("what became of one paid attempt", () => {
  it("counts a confirmed delivery as compliant", () => {
    expect(classifyAttempt(attempt())).toBe("delivered_compliant");
  });

  it("counts a delivery carrying a read miss as NON-compliant — the false pass", () => {
    const row = attempt({
      verification: { checks: [check(), check({ facet: "hairWorn", verified: false, saw: "hair loose" })] },
    });
    expect(classifyAttempt(row)).toBe("delivered_noncompliant");
  });

  it("counts an ADVISORY miss as non-compliant too — it still charged for a miss", () => {
    /* The hair-up render, exactly: delivered, charged, advisory facet missing.
       An advisory miss cannot refuse, which is why it must be COUNTED. */
    const row = attempt({
      verification: { checks: [check({ facet: "hairWorn", binding: false, verified: false, saw: "hair loose" })] },
    });
    expect(classifyAttempt(row)).toBe("delivered_noncompliant");
  });

  it("never counts an unread affirmative as compliant", () => {
    const row = attempt({ verification: { checks: [check({ read: false, saw: undefined })] } });
    expect(classifyAttempt(row)).toBe("delivered_unverified");
  });

  it("never counts a PRE-D-235 row as compliant — those affirmatives were empty by construction", () => {
    /* No `read` field at all, which is every row written before 2026-08-07.
       Counting them as passes would make the instrument flatter the defect it
       was built to measure. */
    const legacy = attempt({
      verification: { checks: [{ facet: "eye.colour", asked: "pale blue", verified: true }] },
    });
    expect(classifyAttempt(legacy)).toBe("delivered_unverified");
  });

  it("never counts a reader outage as compliant", () => {
    expect(classifyAttempt(attempt({ verification: { checks: [], unavailable: true } })))
      .toBe("delivered_unverified");
  });

  it("splits refusals by owner", () => {
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "facts_missing" })))
      .toBe("refused_honest");
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "render_fault" })))
      .toBe("refused_infra");
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "unknown" })))
      .toBe("refused_infra");
  });

  it("says unclassified rather than guessing", () => {
    expect(classifyAttempt(attempt({ status: "failed", failureClass: null })))
      .toBe("unclassified");
  });
});

describe("the bar has a floor and a ceiling (D-215)", () => {
  const compliant = (facet: string) =>
    attempt({ verification: { checks: [check({ facet })] } });

  it("CEILING — twenty clean deliveries read 100% and clear the bar", () => {
    const report = summarize(Array.from({ length: 20 }, () => compliant("eye.colour")));
    expect(report.overall.deliveryRate).toBe(100);
    expect(report.overall.clearsBar).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it("FLOOR — twenty infra refusals read 0% and clear nothing", () => {
    const rows = Array.from({ length: 20 }, () =>
      attempt({ status: "failed", failureClass: "unknown" }));
    const report = summarize(rows);
    expect(report.overall.deliveryRate).toBe(0);
    expect(report.overall.clearsBar).toBe(false);
  });

  it("a single false pass fails the class however good the rate is", () => {
    const rows = [
      ...Array.from({ length: 99 }, () => compliant("eye.colour")),
      attempt({ verification: { checks: [check({ facet: "eye.colour", verified: false, saw: "hazel" })] } }),
    ];
    const report = summarize(rows);
    expect(report.overall.deliveryRate).toBe(99);
    /* 99% is above the 95% bar and it STILL fails: zero false passes means zero. */
    expect(report.overall.deliveryRate).toBeGreaterThan(DELIVERY_RATE_BAR);
    expect(report.overall.clearsBar).toBe(false);
  });

  it("an untested class clears nothing — no attempts is not a pass", () => {
    const report = summarize([]);
    expect(report.overall.total).toBe(0);
    expect(report.overall.clearsBar).toBe(false);
  });

  it("names a failing class without failing the others (D-236)", () => {
    const rows = [
      ...Array.from({ length: 20 }, () => compliant("eye.colour")),
      ...Array.from({ length: 4 }, () =>
        attempt({ verification: { checks: [check({ facet: "eye.shape", verified: false, saw: "rounded" })] } })),
    ];
    const report = summarize(rows);
    const colour = report.byClass.find((tally) => tally.edit === "eye.colour")!;
    const shape = report.byClass.find((tally) => tally.edit === "eye.shape")!;

    expect(colour.clearsBar).toBe(true);
    expect(shape.clearsBar).toBe(false);
    expect(report.blockers).toEqual(["eye.shape"]);
  });
});

describe("the cut is derived from the rows, never declared", () => {
  it("takes the classes from the facets the verdict was written about", () => {
    const row = attempt({
      verification: { checks: [check({ facet: "makeup" }), check({ facet: "eye.colour" })] },
    });
    expect(classesOf(row)).toEqual(["eye.colour", "makeup"]);
  });

  it("gives an attempt with no verdict no class at all", () => {
    expect(classesOf(attempt({ verification: null }))).toEqual([]);
  });

  it("counts one multi-facet attempt against every class it touched", () => {
    const report = summarize([
      attempt({ verification: { checks: [check({ facet: "makeup" }), check({ facet: "eye.colour" })] } }),
    ]);
    expect(report.overall.total).toBe(1);
    expect(report.byClass.map((tally) => tally.edit)).toEqual(["eye.colour", "makeup"]);
    expect(report.byClass.every((tally) => tally.total === 1)).toBe(true);
  });

  it("sums the credits actually returned", () => {
    const report = summarize([
      attempt({ status: "failed", failureClass: "facts_missing", refundedCredits: 25 }),
      attempt({ refundedCredits: 25 }),
      attempt({}),
    ]);
    expect(report.creditsRefunded).toBe(50);
  });
});

describe("the report says the ugly number out loud", () => {
  it("puts the rate, the false passes and the blockers in one heartbeat line", () => {
    const report = summarize([
      attempt(),
      attempt({ verification: { checks: [check({ facet: "hairWorn", verified: false, saw: "hair loose" })] } }),
    ]);
    const line = heartbeatLine(report);
    expect(line).toContain("delivery rate 50%");
    expect(line).toContain("1 false pass");
    expect(line).toContain("hairWorn");
  });

  it("reports no attempts as no rate, rather than as a clean sheet", () => {
    expect(heartbeatLine(summarize([]))).toContain("no attempts yet");
  });

  it("renders a table that shows the false-pass column even when it is zero", () => {
    const table = formatReport(summarize([attempt()]));
    expect(table).toContain("FALSE");
    expect(table).toContain("eye.colour");
    expect(table).toContain(`${DELIVERY_RATE_BAR}% delivered-and-compliant`);
  });
});
