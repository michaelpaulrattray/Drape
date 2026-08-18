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

/*
  AND A KIND NOBODY HAS CATALOGUED IS NAMED BY ITS OWN CLASS (fable-911 §2's
  addition — the verdicts must be READ, not merely stored).

  The stored verdicts are the reading that would justify promoting the open
  lane's presence check to binding, and a reading nobody surfaces is this
  program's oldest sin. Two facts make the surfacing real rather than promised:
  the check names itself with its slot key, so the founder's per-class table
  grows a row per kind; and `delivered_absent` already fires on a read absence
  *whether or not the facet was binding at the time*, which is exactly the case
  an open kind is in.
*/
describe("an open kind in the founder's own table", () => {
  const fangs = (over: Partial<StoredCheck> = {}): StoredCheck => ({
    subject: { kind: "open", slot: "open:fangs", noun: "fangs" },
    asked: "vampire fangs",
    verified: true,
    read: true,
    binding: false,
    saw: "long white pointed fangs",
    ...over,
  });

  it("names its own class rather than searching the closed vocabulary", () => {
    expect(classesOf(attempt({ verification: { checks: [fangs()] } }))).toEqual(["open:fangs"]);
  });

  it("counts a MISS the product would not refuse over — the reading, bought", () => {
    /*
      Non-binding, and it still lands in the column the founder certifies on.
      That is the whole point of the report and the gate being able to disagree:
      a kind nobody thought to bind stays invisible exactly as long as nobody
      thinks to bind it.
    */
    const row = attempt({
      verification: { checks: [fangs({ verified: false, absent: true, saw: "ordinary teeth" })] },
    });
    expect(classifyAttempt(row)).toBe("delivered_absent");
    expect(classifyAttemptForClass(row, "open:fangs")).toBe("delivered_absent");
  });

  it("POSITIVE CONTROL — the same kind delivered reads as compliant", () => {
    /* Without this the miss above proves nothing about the instrument: a
       classifier that answered `delivered_absent` to every open row would pass
       the test above and measure nothing. */
    expect(classifyAttempt(attempt({ verification: { checks: [fangs()] } })))
      .toBe("delivered_compliant");
  });

  it("LEGACY — a row written before the subject existed keeps its old class", () => {
    /* Every row up to 2026-08-18 carries `facet` alone, and nothing rewrites
       history. One derivation reads both spellings; the old rows must not move. */
    expect(classesOf(attempt({ verification: { checks: [check({ facet: "hairWorn" })] } })))
      .toEqual(["hairWorn"]);
  });
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

  /*
    OVERTURNED DELIBERATELY (Fable ruling, fable-030), and the old expectation
    is worth keeping in view: this row used to demand `delivered_noncompliant`
    for ANY read miss, on the reasoning that an advisory miss cannot refuse and
    so must at least be counted.

    Run-10 showed what that costs. She asked for "gold hoop earrings" and got a
    gold hoop in each ear; the reader marked it unverified for being "thin and
    understated, not bold hoops" — an adjective she never used. Counting that as
    a false pass makes the founder's zero unreachable for every free-lane class
    and buries real false passes among quibbles.

    It is still COUNTED — its own bucket, its own column, outside the compliant
    numerator, and inside the denominator. What it is not is a false pass. And
    every advisory row carries a mandatory manual double-read until the bucket
    has a track record; if the look finds the asked thing actually absent, the
    row becomes a false pass and the classification itself gets investigated.
  */
  it("counts an ADVISORY miss in its own bucket — counted, never a false pass", () => {
    const row = attempt({
      verification: { checks: [check({ facet: "hairWorn", binding: false, verified: false, saw: "hair loose" })] },
    });
    expect(classifyAttempt(row)).toBe("delivered_advisory");
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

  it("gives an ask it cannot express its own column, not the infrastructure one", () => {
    /*
      The founder's smile ask (opus-346): filed, refused at the repaint door
      because `expression` has no slot, refunded whole — and recorded as
      `unknown`, which put a named product gap into the bucket that means
      "nobody knows why". `cannot_say` is not a failure of anything; it is the
      count of asks this product cannot yet say, which is a roadmap.
    */
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "cannot_say" })))
      .toBe("refused_cannot_say");
    /* And it is NOT swept into either neighbour — nothing broke, and no
       picture came back wrong, because no picture was ever taken. */
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "cannot_say" })))
      .not.toBe("refused_infra");
    expect(classifyAttempt(attempt({ status: "failed", failureClass: "cannot_say" })))
      .not.toBe("refused_honest");
  });

  it("keeps a cannot-say refusal out of the delivery rate entirely", () => {
    /* A refusal claims no delivery. If this ever entered the denominator, a
       product gap would depress the rate the founder certifies — the same
       inversion the honest-refusal split was made for. */
    const report = summarize([
      attempt({ status: "failed", failureClass: "cannot_say" }),
      attempt({ verification: { checks: [check({ facet: "eye.colour", verified: true })] } }),
    ]);
    expect(report.overall.refused_cannot_say).toBe(1);
    expect(report.overall.deliveryClaims).toBe(1);
    expect(report.overall.deliveryRate).toBe(100);
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

  it("watches a NEWLY PROMOTED kind from its first paid render (fable-525 §3b)", () => {
    /*
      Horns was promoted on 2026-08-14 with survival and removal measured at n=3
      on a single face. The honest answer to a small n is not confidence, it is
      SUPERVISION: because classes are derived from the facets a verdict was
      written about, and horns BINDS (it is a presence subject, so an ask that
      comes back without them is an absence), the very first horns render enters
      this report under its own name and is judged against the 95% bar like
      everything else.

      Asserted rather than assumed, because "it derives, so it must appear" is
      exactly the reasoning that has been right about the architecture and wrong
      about the code before.
    */
    const row = attempt({
      verification: { checks: [check({ facet: "horns", asked: "curved ram horns" })] },
    });
    expect(classesOf(row)).toEqual(["horns"]);

    const report = summarize([row]);
    const horns = report.byClass.find((tally) => tally.edit === "horns");
    expect(horns?.total).toBe(1);

    /* And a removal of them is a class of its own, so a horns removal can never
       be carried over the bar by the horns additions beside it. */
    const removal = attempt({
      operationId: "op-2",
      verification: { checks: [check({ facet: "horns", absenceIsTheAsk: true })] },
    });
    expect(classesOf(removal)).toEqual(["horns · removal"]);
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
    /*
      Run-6's `hairWorn` is ADVISORY under fable-030, and the reason is the
      whole ruling in one row: nobody asked for her hair. It is a pinned
      presentation fact, and the pixels were later measured at 0.00 mean
      |Δluma| — the reader described the same head three ways and flipped on the
      third. Her words are the arbiter, and her words never mentioned it.

      The instrument still says the ugly thing: the class is named, it is
      outside the compliant numerator, and it is inside the denominator, so
      `hairWorn` reads 0% and blocks. What it is not is a charge for something
      she asked for and did not get.
    */
    expect(classifyAttemptForClass(runSix, "hairWorn")).toBe("delivered_advisory");
  });

  it("keeps the whole render OUT of the compliant column — nothing is laundered", () => {
    /* The customer was charged once for one picture, and moving the miss to its
       own bucket must not turn it into a pass. It does not: the render claims a
       delivery, contributes nothing to the numerator, and the rate reads 0. */
    expect(classifyAttempt(runSix)).toBe("delivered_advisory");
    const report = summarize([runSix]);
    expect(report.overall.delivered_advisory).toBe(1);
    expect(report.overall.delivered_compliant).toBe(0);
    expect(report.overall.deliveryClaims, "still a delivery claim").toBe(1);
    expect(report.overall.deliveryRate).toBe(0);
    expect(report.overall.clearsBar).toBe(false);
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

/**
 * THE ADVISORY BUCKET, AND THE CONTROLS THAT STOP IT BEING A LAUNDROMAT
 * (Fable ruling, fable-030).
 *
 * The specimen is run-10's, from production: she asked for "gold hoop
 * earrings", the frame shows a gold hoop in each ear, and the reader marked it
 * unverified for being "thin and understated, not bold hoops" — an adjective
 * she never used. Counting that as a false pass makes the founder's zero
 * unreachable for every free-lane class AND hides real false passes among
 * quibbles.
 *
 * The pair is what makes it trustworthy: the quibble moves OUT, and a genuine
 * miss on a value her words define stays IN.
 */
describe("an advisory miss is not a false pass, and a binding miss still is", () => {
  const delivered = (checks: Array<Record<string, unknown>>) =>
    attempt({ verification: { checks: checks as never } });

  it("REPLAY — run-10's earrings row lands in advisory, not in FALSE", () => {
    const report = summarize([delivered([
      {
        facet: "statedAccessories",
        asked: "gold hoop earrings",
        verified: false,
        read: true,
        binding: false,
        saw: "small gold hoop earrings, thin and understated, not bold hoops",
      },
    ])]);
    expect(report.overall.delivered_advisory).toBe(1);
    expect(report.overall.delivered_noncompliant, "the founder's zero stays zero").toBe(0);
    expect(report.overall.delivered_compliant, "it is not a pass either").toBe(0);
  });

  it("CONTROL — a genuine miss on a value her words define is STILL a false pass", () => {
    /* Without this the bucket would be a laundromat: everything unverified
       quietly reclassified into the harmless column. */
    const report = summarize([delivered([
      {
        facet: "eye.colour",
        asked: "green",
        verified: false,
        read: true,
        binding: true,
        saw: "her eyes are brown",
      },
    ])]);
    expect(report.overall.delivered_noncompliant).toBe(1);
    expect(report.overall.delivered_advisory).toBe(0);
    expect(report.overall.clearsBar, "one false pass still fails the class").toBe(false);
  });

  it("a binding miss beside an advisory one is a FALSE PASS — the worse reading wins", () => {
    const report = summarize([delivered([
      { facet: "statedAccessories", asked: "gold hoop earrings", verified: false, read: true, binding: false, saw: "thin hoops" },
      { facet: "eye.colour", asked: "green", verified: false, read: true, binding: true, saw: "brown" },
    ])]);
    expect(report.overall.delivered_noncompliant).toBe(1);
    expect(report.overall.delivered_advisory).toBe(0);
  });

  it("an advisory row is a delivery CLAIM, so it cannot flatter the rate by leaving", () => {
    /* One compliant delivery beside one advisory reads 50%, not 100%. The
       bucket removes it from the false-pass count, never from the denominator
       — otherwise "avoided being caught" would read identically to "delivered
       perfectly". */
    const report = summarize([
      delivered([{ facet: "makeup", asked: "nude lip gloss", verified: true, read: true, binding: true, saw: "nude gloss" }]),
      delivered([{ facet: "makeup", asked: "nude lip gloss", verified: false, read: true, binding: false, saw: "a little pinker than nude" }]),
    ]);
    expect(report.overall.deliveryClaims).toBe(2);
    expect(report.overall.deliveryRate).toBe(50);
    expect(report.overall.clearsBar, "a class half-quibbled has not shown 95%").toBe(false);
  });

  it("a legacy row with no binding flag is NOT quietly advisory", () => {
    /* `binding` is absent on old rows. Absent must not read as "false" and
       demote a real miss into the harmless bucket — the safe reading of an
       unknown is the one that does not take a finding away. */
    const report = summarize([delivered([
      { facet: "eye.colour", asked: "green", verified: false, read: true, saw: "brown" },
    ])]);
    expect(report.overall.delivered_advisory).toBe(0);
    expect(report.overall.delivered_noncompliant).toBe(1);
  });
});

/**
 * THE SECOND COLUMN — segment permanence's honesty condition.
 *
 * The founder attached it to the store itself: a carried patch is recorded as
 * CARRIED, never as a fresh delivery. The failure it forbids is not a false
 * pass; it is subtler and worse at certification time. Once carried facets
 * count, the per-class rate rises because the denominator has quietly lost the
 * painter's hardest cases — a number that improves because the exam got easier.
 */
describe("carried facets are never fresh deliveries", () => {
  const carried = (over: Partial<StoredCheck> = {}) => check({ carried: true, ...over });

  it("classifies a render that only carried as carried, not compliant", () => {
    expect(classifyAttempt(attempt({ verification: { checks: [carried()] } }))).toBe("delivered_carried");
  });

  it("keeps carried rows OUT of the rate's denominator entirely", () => {
    const report = summarize([
      attempt({ operationId: "fresh-ok", verification: { checks: [check()] } }),
      attempt({ operationId: "carried-1", verification: { checks: [carried()] } }),
      attempt({ operationId: "carried-2", verification: { checks: [carried()] } }),
    ]);

    // One fresh claim, one fresh pass — 100% of what was actually painted, and
    // the two carried renders neither help nor hurt it.
    expect(report.overall.deliveryClaims).toBe(1);
    expect(report.overall.delivered_compliant).toBe(1);
    expect(report.overall.delivered_carried).toBe(2);
    expect(report.overall.deliveryRate).toBe(100);
  });

  it("does not let carrying rescue a rate the painting earned", () => {
    /*
      THE FLATTERING BIAS, DRIVEN. Two fresh attempts, one of them a false
      pass, plus eight carried renders. If carried rows entered the
      denominator the class would read 90% and clear nothing honestly; the
      rate must stay at what the painter did — 50% — with the eight reported
      beside it.
    */
    const rows = [
      attempt({ operationId: "fresh-ok", verification: { checks: [check()] } }),
      attempt({
        operationId: "fresh-miss",
        verification: { checks: [check({ verified: false })] },
      }),
      ...Array.from({ length: 8 }, (_unused, index) => attempt({
        operationId: `carried-${index}`,
        verification: { checks: [carried()] },
      })),
    ];

    const report = summarize(rows);
    expect(report.overall.deliveryRate).toBe(50);
    expect(report.overall.delivered_carried).toBe(8);
    expect(report.overall.clearsBar).toBe(false);
  });

  it("still calls a carried fact that is MISSING a false pass", () => {
    /*
      The store's own promise failing. She paid for those freckles once, the
      product said it would keep them, and the frame she was charged for does
      not have them. Excusing that as "this render did not paint it" would
      rebuild the bias through the door this column was opened to close.
    */
    const row = attempt({
      verification: { checks: [carried({ verified: false, saw: "clear skin" })] },
    });
    expect(classifyAttempt(row)).toBe("delivered_noncompliant");
    expect(summarize([row]).overall.clearsBar).toBe(false);
  });

  it("judges a mixed render on what it painted, and counts the carried facet in its own class", () => {
    const row = attempt({
      verification: {
        checks: [
          check({ facet: "hair.colour", asked: "copper" }),
          carried({ facet: "marks", asked: "a light scattering of freckles" }),
        ],
      },
    });

    // The row delivered fresh work and it is judged on that…
    expect(classifyAttempt(row)).toBe("delivered_compliant");
    // …while the carried facet's OWN class records what actually happened to it.
    expect(classifyAttemptForClass(row, "marks")).toBe("delivered_carried");
    expect(classifyAttemptForClass(row, "hair.colour")).toBe("delivered_compliant");

    const report = summarize([row]);
    const marks = report.byClass.find((tally) => tally.edit === "marks")!;
    expect(marks.deliveryClaims).toBe(0);
    expect(marks.delivered_carried).toBe(1);
    // Not "unexercised" — that would say we never delivered it, and she has it.
    expect(report.unexercised).toEqual([]);
    expect(report.carriedOnly).toEqual(["marks"]);
  });

  it("prints the column, and says why it is outside the rate", () => {
    const text = formatReport(summarize([
      attempt({ operationId: "carried-1", verification: { checks: [carried({ facet: "marks" })] } }),
    ]));
    expect(text).toContain("carr");
    expect(text).toContain("carried by stored segments: 1");
    expect(text).toContain("outside the rate's denominator");
    expect(text).toContain("carried only: marks");
  });

  it("names the ERA on the marks class, because its misses were manufactured by a gap", () => {
    /*
      Until 2026-08-18 a question-less slot whose reading was disputed filed
      NOTHING — not even its words — so `skin` (which owns `marks`) never got a
      library row, and the recipe's standing clauses are built from library rows
      alone. Every render after the one that bought the marks therefore said
      nothing about them and was then ASKED about them by the checker: a
      guaranteed `delivered_absent`.

      So a marks rate taken across that era is a reading about the gap and not
      about the painter. Printed rather than remembered, because the next person
      to open a marks court will read this table first — and a number with no era
      on it is the one they will quote.
    */
    const text = formatReport(summarize([
      attempt({
        operationId: "marks-1",
        verification: {
          checks: [check({ facet: "marks", asked: "freckles across her nose and cheeks", verified: false, binding: false, saw: "no visible freckles" })],
        },
      }),
    ]));
    expect(text).toContain("marks");
    expect(text).toContain("2026-08-18");
    expect(text.toLowerCase()).toContain("recipe silence");
  });

  it("says nothing about the era when no marks class is in the window", () => {
    /* The negative control: a caveat printed on every report is a caveat nobody
       reads, and it would attach the marks story to classes it is not true of. */
    const text = formatReport(summarize([attempt()]));
    expect(text.toLowerCase()).not.toContain("recipe silence");
  });

  it("treats every legacy row as painted, because nothing could have been carried", () => {
    // No `carried` field at all — the honest default, and the one that cannot
    // retroactively empty a historical denominator.
    expect(classifyAttempt(attempt())).toBe("delivered_compliant");
    expect(summarize([attempt()]).overall.delivered_carried).toBe(0);
  });
});

/*
  A REMOVAL IS NOT THE ADDITION IT UNDOES — and until shift 63 they were one row.

  "small gold hoops" and "no glasses — her face uncovered" both write
  `statedAccessories`, so the founder's per-class table scored them together. A
  removal delivering at 60% beside additions delivering at 100% reports as one
  class at about 90% and clears a bar it never met.
*/
describe("the departure has a class of its own", () => {
  const addition = check({ facet: "statedAccessories", asked: "small gold hoops", saw: "gold hoops on both ears" });
  const removal = check({
    facet: "statedAccessories",
    asked: "no glasses — her face uncovered",
    absenceIsTheAsk: true,
    saw: "bare eyes, no frames",
  });

  it("names the two apart from the check's own declaration", () => {
    const row = attempt({ verification: { checks: [addition, removal] } });
    expect(classesOf(row)).toEqual(["statedAccessories", "statedAccessories · removal"]);
  });

  it("does not let a failed removal dirty the addition beside it", () => {
    const row = attempt({
      verification: {
        checks: [addition, { ...removal, verified: false, saw: "she is still wearing her glasses" }],
      },
    });
    expect(classifyAttemptForClass(row, "statedAccessories")).toBe("delivered_compliant");
    expect(classifyAttemptForClass(row, "statedAccessories · removal")).toBe("delivered_noncompliant");
    /* The whole row is still a false pass — the customer paid once for the
       picture, and the zero-false-pass bar is stated on that. */
    expect(classifyAttempt(row)).toBe("delivered_noncompliant");
  });

  it("CONTROL — without the declaration the two share one class, exactly as before", () => {
    const row = attempt({
      verification: { checks: [addition, { ...removal, absenceIsTheAsk: undefined }] },
    });
    expect(classesOf(row)).toEqual(["statedAccessories"]);
  });

  it("gives the removal its own row in the founder's table", () => {
    const report = summarize([
      attempt({ operationId: "op-add", verification: { checks: [addition] } }),
      attempt({
        operationId: "op-remove",
        verification: { checks: [{ ...removal, verified: false, saw: "glasses still on" }] },
      }),
    ]);
    const removals = report.byClass.find((tally) => tally.edit === "statedAccessories · removal")!;
    const additions = report.byClass.find((tally) => tally.edit === "statedAccessories")!;
    expect(removals.delivered_noncompliant).toBe(1);
    expect(removals.clearsBar).toBe(false);
    expect(additions.delivered_compliant).toBe(1);
    expect(additions.clearsBar).toBe(true);
    expect(report.blockers).toContain("statedAccessories · removal");
  });
});

/*
  A SITE NOBODY COULD SEE IS NOT A FALSE PASS.

  Measured on one master, six readings of the same bytes and the same question:
  four came back occluded, two verified. The runtime treats all six the same —
  `isRefusableMiss` is false when occluded, so nothing refuses and nothing is
  refunded — while this report called four of them a charge for a miss, in the
  column whose bar is ZERO. The money and the certification number disagreed
  about one frame.
*/
describe("an occluded site is neither a pass nor a miss", () => {
  const hidden = check({
    facet: "statedAccessories",
    asked: "no earrings — both earlobes bare",
    verified: false,
    occluded: true,
    binding: true,
    saw: "both earlobes are hidden by hair, no earrings visible",
  });

  it("does not count an occluded check as a false pass", () => {
    expect(classifyAttempt(attempt({ verification: { checks: [hidden] } }))).toBe("delivered_unverified");
  });

  it("CONTROL — the same check without the occlusion IS a false pass", () => {
    expect(
      classifyAttempt(attempt({ verification: { checks: [{ ...hidden, occluded: undefined }] } })),
    ).toBe("delivered_noncompliant");
  });

  it("does not count it as a compliant delivery either — it is a silence, not a clean sheet", () => {
    const row = attempt({ verification: { checks: [check(), hidden] } });
    expect(classifyAttempt(row)).toBe("delivered_unverified");
    const report = summarize([row]);
    expect(report.overall.delivered_compliant).toBe(0);
    expect(report.overall.delivered_noncompliant).toBe(0);
    expect(report.overall.deliveryClaims).toBe(1);
  });

  it("still reports a real binding miss standing beside an occluded one", () => {
    const row = attempt({
      verification: {
        checks: [hidden, check({ facet: "hairWorn", verified: false, saw: "hair in a high bun" })],
      },
    });
    expect(classifyAttempt(row)).toBe("delivered_noncompliant");
  });
});

describe("the table fits the names it is printing", () => {
  it("does not shunt a long class name into the numbers", () => {
    const text = formatReport(summarize([
      attempt({
        operationId: "op-remove",
        verification: {
          checks: [check({ facet: "statedAccessories", asked: "no glasses", absenceIsTheAsk: true })],
        },
      }),
      attempt({ operationId: "op-eyes", verification: { checks: [check()] } }),
    ]));
    const lines = text.split("\n");
    const removal = lines.find((line) => line.startsWith("statedAccessories · removal"))!;
    const short = lines.find((line) => line.startsWith("eye.colour"))!;
    /* The long name and the short one end in the same column — the alignment a
       reader checks by eye, checked by the suite instead. */
    expect(removal.length).toBe(short.length);
    expect(removal.endsWith("   ✓")).toBe(true);
  });
});

/**
 * THE MISS THE PRODUCT ALREADY NOTICES AND NOBODY COUNTS (2026-08-15).
 *
 * The realization captioner refuses to pin a caption that does not match the
 * ask, and on a dev render of *"her right eye — fiery red"* it said exactly
 * what went wrong: *"Both irises are vivid fiery red… left eye also shows the
 * red tone, not isolated to the right."* The render delivered, charged, and
 * counted here as a clean pass, because that verdict lived in a log line.
 *
 * It is counted now and it moves no rate — whether an uncorroborated read-back
 * should refuse is a ruling nobody has made, and a ruling needs a number.
 */
describe("a delivery its own read-back could not corroborate", () => {
  const delivered = (over: Partial<AttemptRow> = {}): AttemptRow => ({
    operationId: "op-1",
    createdAt: new Date("2026-08-15T00:00:00Z"),
    status: "ready",
    failureClass: null,
    refundedCredits: 0,
    instructions: ["her right eye — fiery red"],
    verification: { checks: [{ facet: "eye.colour", read: true, verified: true, binding: true }] },
    ...over,
  } as AttemptRow);

  it("counts it, and leaves every rate exactly where it was", () => {
    const clean = summarize([delivered()]);
    const missed = summarize([delivered({
      verification: {
        checks: [{ facet: "eye.colour", read: true, verified: true, binding: true }],
        uncorroborated: [{
          facet: "eye.colour",
          asked: "right eye fiery red",
          saw: "both irises are red, not isolated to the right",
        }],
      },
    } as Partial<AttemptRow>)]);

    expect(clean.uncorroborated).toBe(0);
    expect(missed.uncorroborated).toBe(1);
    /* The rate is untouched on purpose: counting is not scoring. */
    expect(missed.overall.deliveryRate).toBe(clean.overall.deliveryRate);
    expect(missed.overall.clearsBar).toBe(clean.overall.clearsBar);
    expect(missed.overall.deliveryClaims).toBe(clean.overall.deliveryClaims);
  });

  it("does not count a REFUSED attempt twice", async () => {
    /* A refusal is already a refusal in this report. Counting its read-back as
       a second failure would make the honest path look like the failing one. */
    const refused = summarize([delivered({
      status: "failed",
      failureClass: "facts_missing",
      verification: {
        checks: [],
        uncorroborated: [{ facet: "eye.colour", asked: "x", saw: "y" }],
      },
    } as Partial<AttemptRow>)]);

    expect(refused.uncorroborated).toBe(0);
  });
});
