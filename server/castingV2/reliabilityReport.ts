/**
 * DELIVERY RATE — the number the customer actually cares about (D-236).
 *
 * Every guard built before this one answers *"did we charge fairly?"*. That is
 * necessary and it is not the question a customer asks. The question a customer
 * asks is *"did I get the thing?"*, and until this module that number did not
 * exist anywhere in the product.
 *
 * # Derived, never mirrored (law 4)
 *
 * Nothing here is written by the render path. Every figure is computed from
 * rows that already exist — the variant's status, its failure class, and the
 * verdict stored on `internalPrompt.verification` — so the report cannot drift
 * from the truth by being forgotten. If a new outcome appears in the product it
 * appears here as `unclassified` rather than being silently folded into a
 * flattering bucket.
 *
 * # The buckets, and why "delivered" is not one of them
 *
 * A delivery splits three ways, because "delivered" on its own is the exact
 * comfort that hid the hair-up false pass for a day:
 *
 *   - **compliant** — every fact the reader was asked about, it confirmed.
 *   - **NON-compliant** — delivered and charged with a fact the record itself
 *     says is missing. This is the false-pass bucket, and the founder's bar for
 *     it is ZERO, because it charges for non-compliance.
 *   - **unverified** — the reader said nothing usable (D-235's `read: false`),
 *     or was unreachable. Not a pass. Counted apart so a reader outage can
 *     never inflate the compliant rate.
 *
 * A refusal splits two ways, because they have different owners:
 *
 *   - **honest** — the render genuinely lacked the fact; the product worked.
 *   - **infra** — transport, size, routing. Our fault, and the bug is usually
 *     already dead by the time anyone reads the number.
 *
 * # Build attribution is by TIMESTAMP, and that is a stated limitation
 *
 * Rows carry no build id — adding one is a migration, and a migration against
 * production is a founder gate. So a build is a time boundary supplied by the
 * caller: a self-drive walk passes its own start time and its sample is
 * therefore exactly the build under test. Anything wider is approximate, and
 * `windowFrom` is carried into the report so a reader can see which it is
 * rather than having to guess.
 */
import type { Facet } from "./refineFacets";

/** What became of one paid attempt. Ordered worst-to-best for reporting. */
export type AttemptOutcome =
  | "delivered_noncompliant"
  | "refused_infra"
  | "refused_honest"
  | "delivered_unverified"
  | "delivered_compliant"
  | "unclassified";

/** One stored check, as the verdict writes it (D-235 shape). */
export type StoredCheck = {
  facet: string;
  asked: string;
  verified: boolean;
  /** Absent on rows written before D-235 — treated as unverified, never as a pass. */
  read?: boolean;
  binding?: boolean;
  saw?: string;
};

export type StoredVerification = {
  checks?: StoredCheck[];
  unavailable?: boolean;
  attempts?: number;
  readings?: number;
};

/** One attempt, as the database already records it. Nothing new is written. */
export type AttemptRow = {
  operationId: string;
  createdAt: Date;
  /** The variant's own status: `ready`, `failed`, … */
  status: string;
  failureClass?: string | null;
  pointsCost?: number | null;
  refundedCredits?: number | null;
  verification?: StoredVerification | null;
  /** What the user asked for, for naming a class when no verdict was stored. */
  requestText?: string | null;
};

/**
 * The failure classes that are OUR fault rather than the render's.
 *
 * `facts_missing` is the one honest refusal: the picture genuinely did not
 * contain the fact, the check caught it, and the user was refunded. Everything
 * else — a dead transport, a size mismatch, a routing gap — is infrastructure,
 * and lumping the two together is how a fixed bug keeps depressing a live
 * number forever.
 */
const HONEST_REFUSAL_CLASSES = new Set(["facts_missing"]);

/**
 * The variant statuses an attempt can still move away from.
 *
 * Lives here rather than in the caller because it is a property of an
 * `AttemptRow`, and a second copy in the walk's own library is the mirror law's
 * drift waiting to happen.
 */
const IN_FLIGHT_STATUSES = new Set(["queued", "dispatched"]);

/**
 * ATTEMPTS THAT HAVE NOT FINISHED HAPPENING YET.
 *
 * Run-6's walk read its rate table **31 seconds before its last operation
 * settled**. The removal appeared as `unclassified` with `credits refunded: 0`;
 * the row it was about to become says `refused_honest`, 25 refunded. Neither
 * number looked wrong — an unclassified row and a zero refund are exactly the
 * shape of a real finding.
 *
 * A reader that samples mid-flight is not slightly early, it is biased: the
 * rows still moving are the SLOW ones, and slow is where the failures are. So
 * callers wait on this and say how many they gave up on, rather than scoring a
 * half-written row.
 */
export function unsettledAttempts(rows: ReadonlyArray<AttemptRow>): AttemptRow[] {
  return rows.filter((row) => IN_FLIGHT_STATUSES.has(row.status));
}

/**
 * A check counts as READ only if it says so.
 *
 * Rows written before D-235 have no `read` field, and the safe reading of a
 * legacy affirmative is "we do not know" — those are exactly the rows whose
 * affirmatives were evidence-free by construction. Counting them as compliant
 * would make the instrument flatter the very defect it was built to measure.
 */
function wasRead(check: StoredCheck): boolean {
  return check.read === true;
}

export function classifyAttempt(row: AttemptRow): AttemptOutcome {
  return classifyChecks(row, row.verification?.checks ?? []);
}

/**
 * WHAT BECAME OF ONE CLASS ON ONE ATTEMPT — judged by its OWN checks.
 *
 * # The false NEGATIVE this exists to end
 *
 * The class tallies used to take the WHOLE row's outcome and count it against
 * every facet the verdict mentioned. A render carries checks for everything the
 * chain has ever written, not just the thing that was asked for, so one advisory
 * miss on an inherited fact marked every other class on that render
 * non-compliant too.
 *
 * Run-6, step 4, is the canonical case. The user asked for gold hoop earrings.
 * The render's own stored verdict reads:
 *
 *   statedAccessories  verified: true   saw: "small gold hoop earrings on both ears"
 *   hairWorn           verified: false  saw: "hair pulled back but left loose…"
 *
 * The earrings were perfect, first time. The table reported
 * **`statedAccessories` 0%** — and `marks` and `makeup` were dragged down the
 * same way on the same render, both having passed their own checks. The class
 * the founder would have been told was most broken is the one that worked.
 *
 * That is the safe direction for a false reading and it is still poison: it
 * makes the 95% bar unreachable for any class unlucky enough to share a render
 * with a flaky one, and it points fixing effort at whichever class happened to
 * be along for the ride.
 *
 * # What deliberately does NOT change
 *
 * `overall` keeps the whole-row verdict. A render delivered with ANY read miss
 * is a non-compliant delivery, because the customer was charged once for the
 * whole picture — and the zero-false-pass bar is stated on that. So the false
 * pass is never lost by this change; it moves from four class rows to the one
 * class that actually failed.
 */
export function classifyAttemptForClass(row: AttemptRow, edit: string): AttemptOutcome {
  return classifyChecks(row, (row.verification?.checks ?? []).filter((check) => check.facet === edit));
}

function classifyChecks(row: AttemptRow, checks: ReadonlyArray<StoredCheck>): AttemptOutcome {
  if (row.status !== "ready") {
    if (!row.failureClass) return "unclassified";
    return HONEST_REFUSAL_CLASSES.has(row.failureClass) ? "refused_honest" : "refused_infra";
  }

  if (row.verification?.unavailable === true || checks.length === 0) return "delivered_unverified";

  /* A single read miss is enough. Delivered with a fact the record itself says
     is absent is the false pass, whether or not the facet could refuse. */
  if (checks.some((check) => wasRead(check) && !check.verified)) return "delivered_noncompliant";
  /* Every check must be affirmatively read. One silence is not a clean sheet. */
  if (checks.every(wasRead)) return "delivered_compliant";
  return "delivered_unverified";
}

/**
 * The edit classes an attempt touched — the axis the founder's bar is stated on.
 *
 * Taken from the facets the verdict was written about, because that is the list
 * the product itself considered binding for that render. An attempt with no
 * stored verdict has no class and is counted only in the totals, never against
 * a class it might not belong to.
 */
export function classesOf(row: AttemptRow): string[] {
  const facets = (row.verification?.checks ?? []).map((check) => check.facet);
  return Array.from(new Set(facets)).sort();
}

export type ClassTally = {
  edit: string;
  total: number;
  delivered_compliant: number;
  delivered_noncompliant: number;
  delivered_unverified: number;
  refused_honest: number;
  refused_infra: number;
  unclassified: number;
  /** Compliant deliveries as a share of ALL attempts, in percent. */
  deliveryRate: number;
  /** Whether this class clears D-236: 95% delivered-and-compliant, zero false passes. */
  clearsBar: boolean;
};

export type ReliabilityReport = {
  windowFrom?: Date;
  windowLabel: string;
  overall: ClassTally;
  byClass: ClassTally[];
  creditsRefunded: number;
  /** Classes below the bar, named — they do not block the others (D-236). */
  blockers: string[];
};

/** D-236's bar. A number with teeth, beside D-193's. */
export const DELIVERY_RATE_BAR = 95;
export const FALSE_PASS_BAR = 0;

const emptyTally = (edit: string): ClassTally => ({
  edit,
  total: 0,
  delivered_compliant: 0,
  delivered_noncompliant: 0,
  delivered_unverified: 0,
  refused_honest: 0,
  refused_infra: 0,
  unclassified: 0,
  deliveryRate: 0,
  clearsBar: false,
});

function finish(tally: ClassTally): ClassTally {
  tally.deliveryRate = tally.total === 0
    ? 0
    : Math.round((tally.delivered_compliant / tally.total) * 1000) / 10;
  /*
    A class with no attempts has not cleared anything. Reporting an untested
    class as passing is the instrument telling a comfortable lie, which is the
    failure mode D-215 exists to forbid.
  */
  tally.clearsBar = tally.total > 0
    && tally.deliveryRate >= DELIVERY_RATE_BAR
    && tally.delivered_noncompliant <= FALSE_PASS_BAR;
  return tally;
}

export function summarize(
  rows: ReadonlyArray<AttemptRow>,
  options: { windowFrom?: Date; windowLabel?: string } = {},
): ReliabilityReport {
  const overall = emptyTally("all");
  const byClass = new Map<string, ClassTally>();
  let creditsRefunded = 0;

  for (const row of rows) {
    const outcome = classifyAttempt(row);
    overall.total += 1;
    overall[outcome] += 1;
    creditsRefunded += row.refundedCredits ?? 0;

    for (const edit of classesOf(row)) {
      const tally = byClass.get(edit) ?? emptyTally(edit);
      tally.total += 1;
      /* ITS OWN CHECKS, not the render's. See `classifyAttemptForClass` — the
         whole-row verdict here is what reported run-6's perfect earrings as
         `statedAccessories` 0%. */
      tally[classifyAttemptForClass(row, edit)] += 1;
      byClass.set(edit, tally);
    }
  }

  const classes = Array.from(byClass.values()).map(finish).sort((a, b) => a.edit.localeCompare(b.edit));
  return {
    windowFrom: options.windowFrom,
    windowLabel: options.windowLabel ?? (options.windowFrom ? "since build" : "all time"),
    overall: finish(overall),
    byClass: classes,
    creditsRefunded,
    blockers: classes.filter((tally) => !tally.clearsBar).map((tally) => tally.edit),
  };
}

/** One line, for a heartbeat: `delivery rate 96.2% (25 attempts) · 0 false passes`. */
export function heartbeatLine(report: ReliabilityReport): string {
  const { overall } = report;
  if (overall.total === 0) return "delivery rate — (no attempts yet)";
  const falsePasses = overall.delivered_noncompliant;
  const blockers = report.blockers.length === 0 ? "none" : report.blockers.join(", ");
  return `delivery rate ${overall.deliveryRate}% (${overall.total} attempts) · `
    + `${falsePasses} false pass${falsePasses === 1 ? "" : "es"} · blockers ${blockers}`;
}

/** The full table, for a walk report or an on-demand read. */
export function formatReport(report: ReliabilityReport): string {
  const lines: string[] = [];
  lines.push(`RELIABILITY — ${report.windowLabel}`);
  if (report.windowFrom) lines.push(`window from ${report.windowFrom.toISOString()}`);
  lines.push("");
  const header = "class".padEnd(22)
    + "n".padStart(4) + "  ok".padStart(6) + " FALSE".padStart(7)
    + " unver".padStart(7) + " ref-h".padStart(7) + " ref-i".padStart(7) + "   rate  bar";
  lines.push(header);
  lines.push("-".repeat(header.length));
  const row = (tally: ClassTally) =>
    tally.edit.padEnd(22)
    + String(tally.total).padStart(4)
    + String(tally.delivered_compliant).padStart(6)
    + String(tally.delivered_noncompliant).padStart(7)
    + String(tally.delivered_unverified).padStart(7)
    + String(tally.refused_honest).padStart(7)
    + String(tally.refused_infra).padStart(7)
    + `${tally.deliveryRate}%`.padStart(7)
    + (tally.total === 0 ? "   —" : tally.clearsBar ? "   ✓" : "   ✗");
  for (const tally of report.byClass) lines.push(row(tally));
  lines.push("-".repeat(header.length));
  lines.push(row(report.overall));
  lines.push("");
  lines.push(`credits refunded: ${report.creditsRefunded}`);
  lines.push(
    `bar: ${DELIVERY_RATE_BAR}% delivered-and-compliant per class, ${FALSE_PASS_BAR} false passes (D-236)`,
  );
  if (report.blockers.length > 0) {
    lines.push(`below the bar: ${report.blockers.join(", ")} — named, not blocking the others`);
  }
  return lines.join("\n");
}

/** Re-exported so callers can name a facet without importing two modules. */
export type { Facet };
