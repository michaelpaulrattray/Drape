/**
 * The instrument gets a negative control and a positive control before its
 * verdicts count for anything (working law 2, D-147, D-203). A reliability
 * report that cannot report an ugly number is a press release.
 */
import { describe, expect, it } from "vitest";
import {
  classesOf,
  classifyAttempt,
  classifyAttemptForClass,
  DELIVERY_RATE_BAR,
  formatReport,
  heartbeatLine,
  summarize,
  unsettledAttempts,
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

  /*
    AN HONEST REFUSAL IS NOT A FAILED DELIVERY (Fable ruling, 2026-08-08).

    It sat in the denominator, so a class that behaved perfectly — delivered
    when it could, refused honestly and refunded when it could not — had its
    rate dragged below the founder's bar BY THE REFUSAL. The bar would then
    have blocked a class for being honest, which is the opposite of what
    D-236 measures. The rate answers "when we claimed a delivery, was it
    real"; refusals answer a different question and are reported beside it.

    This matters now rather than in the abstract: step 2 of the walk lands on
    a flat face and can honestly refuse, and `eye.shape` is a single-sample
    class.
  */
  it("an honest refusal does not drag the rate down — it is not a delivery claim", () => {
    const report = summarize([compliant("eye.shape"), attempt({ status: "failed", failureClass: "facts_missing" })]);
    expect(report.overall.refused_honest, "the refusal is still counted, beside the rate").toBe(1);
    expect(report.overall.deliveryRate, "one claim, one compliant delivery").toBe(100);
    expect(report.overall.clearsBar).toBe(true);
  });

  it("but refusals ALONE clear nothing — an unexercised class is not a passing one", () => {
    /* The loophole this closes: if refusals left the denominator and nothing
       replaced the floor, a class that only ever refused would divide zero by
       zero and could be read as clean. It has no delivery sample, so it has
       proven nothing about delivery. */
    const report = summarize(Array.from({ length: 3 }, () =>
      attempt({ status: "failed", failureClass: "facts_missing" })));
    expect(report.overall.refused_honest).toBe(3);
    expect(report.overall.deliveryClaims, "nothing was ever claimed as delivered").toBe(0);
    expect(report.overall.clearsBar).toBe(false);
  });

  it("names an unexercised class apart from one that is below the bar", () => {
    /* Two different findings: `marks` delivered and got it wrong; `eye.shape`
       never delivered at all. Calling both "below the bar" loses one of them —
       and only one of them is evidence about delivery. */
    const report = summarize([
      attempt({ verification: { checks: [check({ facet: "marks", verified: false, saw: "smooth skin" })] } }),
      attempt({ status: "failed", failureClass: "facts_missing", verification: { checks: [check({ facet: "eye.shape" })] } }),
    ]);
    expect(report.blockers).toContain("marks");
    expect(report.blockers, "an unexercised class is not a failing one").not.toContain("eye.shape");
    expect(report.unexercised).toContain("eye.shape");
  });

  it("a false pass still fails the class when every other row is a refusal", () => {
    /* Zero-false-pass is absolute across ALL rows, and taking refusals out of
       the denominator must not give one a hiding place. */
    const report = summarize([
      attempt({ verification: { checks: [check({ facet: "marks", verified: false, saw: "smooth skin" })] } }),
      attempt({ status: "failed", failureClass: "facts_missing" }),
    ]);
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

/**
 * A CLASS IS JUDGED BY ITS OWN CHECKS — the false NEGATIVE, and its controls.
 *
 * Run-6 step 4 is the specimen, and these rows are its stored verdict verbatim
 * from production (variant `c002f6bf`, candidate `7c796a72`): the user asked
 * for gold hoop earrings, got them perfectly, and the table said
 * `statedAccessories` 0% because an inherited `hairWorn` fact on the same
 * render read false.
 */
describe("a class is judged by its own checks, not by its neighbours'", () => {
  /* The verdict as production stored it, one check per line, `saw` included —
     a row with no `saw` would be testing D-235 instead of this. */
  const runSix = attempt({
    operationId: "run-6-step-4",
    verification: {
      checks: [
        { facet: "makeup", asked: "nude lip gloss", verified: true, read: true, binding: true, saw: "lips have a soft nude-pink glossy sheen" },
        { facet: "marks", asked: "freckles", verified: true, read: true, binding: false, saw: "light freckles visible across cheeks and nose" },
        { facet: "statedAccessories", asked: "gold hoop earrings", verified: true, read: true, binding: false, saw: "small gold hoop earrings on both ears" },
        { facet: "hairWorn", asked: "tied back, low ponytail", verified: false, read: true, binding: false, saw: "hair pulled back but left loose down the back, not tied into a ponytail" },
      ],
    },
  });

  it("does not drag a passing class down with a failing one — the earrings were perfect", () => {
    expect(classifyAttemptForClass(runSix, "statedAccessories")).toBe("delivered_compliant");
    expect(classifyAttemptForClass(runSix, "marks")).toBe("delivered_compliant");
    expect(classifyAttemptForClass(runSix, "makeup")).toBe("delivered_compliant");
  });

  it("still names the class that actually failed — the instrument can say the ugly thing", () => {
    expect(classifyAttemptForClass(runSix, "hairWorn")).toBe("delivered_noncompliant");
  });

  it("keeps the whole render non-compliant overall — the false pass is not lost", () => {
    /* The customer was charged once for one picture. Zero-false-pass is stated
       on the render, and moving the miss to its own class must not launder it. */
    expect(classifyAttempt(runSix)).toBe("delivered_noncompliant");
    const report = summarize([runSix]);
    expect(report.overall.delivered_noncompliant).toBe(1);
    expect(report.overall.deliveryRate).toBe(0);
  });

  it("reports run-6's real per-class table", () => {
    const report = summarize([runSix]);
    const rate = (edit: string) => report.byClass.find((tally) => tally.edit === edit)?.deliveryRate;
    expect(rate("statedAccessories")).toBe(100);
    expect(rate("marks")).toBe(100);
    expect(rate("makeup")).toBe(100);
    expect(rate("hairWorn")).toBe(0);
    /* Named, and only the one — the others do not block on its account. */
    expect(report.blockers).toEqual(["hairWorn"]);
  });

  it("counts a class silent on this render as unverified, never as a pass", () => {
    /* Negative control: a facet the reader was asked about and said nothing
       usable on cannot inherit a neighbour's affirmative. */
    const partly = attempt({
      verification: {
        checks: [
          check({ facet: "marks", saw: "freckles across the nose" }),
          check({ facet: "hairWorn", read: false, saw: undefined }),
        ],
      },
    });
    expect(classifyAttemptForClass(partly, "marks")).toBe("delivered_compliant");
    expect(classifyAttemptForClass(partly, "hairWorn")).toBe("delivered_unverified");
  });

  it("gives a refusal the row's own outcome, since a refusal has no per-class checks", () => {
    const refused = attempt({ status: "failed", failureClass: "facts_missing", verification: null });
    expect(classifyAttemptForClass(refused, "statedAccessories")).toBe("refused_honest");
    /* And it lands in the totals only, because nothing names its class. */
    expect(classesOf(refused)).toEqual([]);
  });
});

/**
 * A SAMPLE READ MID-FLIGHT IS BIASED, NOT SLIGHTLY EARLY.
 *
 * Run-6's walk read its table 31 seconds before its last operation settled and
 * printed `unclassified` with `credits refunded: 0` about a row that became
 * `refused_honest` with 25 refunded.
 */
describe("attempts that have not finished happening yet", () => {
  it("names the rows still in flight", () => {
    const rows = [
      attempt({ operationId: "done", status: "ready" }),
      attempt({ operationId: "queued", status: "queued" }),
      attempt({ operationId: "sent", status: "dispatched" }),
      attempt({ operationId: "failed", status: "failed", failureClass: "facts_missing" }),
    ];
    expect(unsettledAttempts(rows).map((row) => row.operationId)).toEqual(["queued", "sent"]);
  });

  it("treats a settled failure as settled — a refusal is an outcome", () => {
    expect(unsettledAttempts([attempt({ status: "failed", failureClass: "facts_missing" })])).toEqual([]);
    expect(unsettledAttempts([attempt({ status: "expired" })])).toEqual([]);
  });

  it("is what run-6 needed: the removal row was mid-flight when the walk scored it", () => {
    /* Read at 23:24:32 as `dispatched`; it settled at 23:25:03 as a refund. If
       it is scored where it stands, the table says `unclassified` and 0
       refunded — both wrong, neither obviously so. */
    const midFlight = attempt({ operationId: "5afc8b62", status: "dispatched", verification: null });
    expect(unsettledAttempts([midFlight])).toHaveLength(1);
    expect(classifyAttempt(midFlight)).toBe("unclassified");
  });
});
