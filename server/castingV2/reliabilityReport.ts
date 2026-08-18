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
 * A delivery splits four ways, because "delivered" on its own is the exact
 * comfort that hid the hair-up false pass for a day:
 *
 *   - **compliant** — every fact the reader was asked about, it confirmed.
 *   - **NON-compliant** — delivered and charged, and the thing HER WORDS asked
 *     for is not in the picture. This is the false-pass bucket, and the
 *     founder's bar for it is ZERO, because it charges for non-compliance.
 *   - **advisory** — delivered and charged, her ask IS in the picture, and the
 *     reader disagrees about a quality she never specified. Run-10: "gold hoop
 *     earrings" delivered as a gold hoop in each ear, marked unverified for
 *     being "thin and understated, not bold hoops" — an adjective nobody used,
 *     on a free-lane value the product refuses to adjudicate (D-187). Her words
 *     are the sole arbiter (law 8). Outside the numerator AND outside the false
 *     passes: a class drowning in advisory rows has demonstrated nothing, it
 *     has merely avoided being caught.
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
import { subjectKey, type FactSubject } from "./renderVerification";

/** What became of one paid attempt. Ordered worst-to-best for reporting. */
export type AttemptOutcome =
  | "delivered_absent"
  | "delivered_noncompliant"
  | "refused_infra"
  | "delivered_advisory"
  | "refused_honest"
  | "refused_cannot_say"
  | "delivered_unverified"
  | "delivered_carried"
  | "delivered_compliant"
  | "unclassified";

/** One stored check, as the verdict writes it (D-235 shape). */
export type StoredCheck = {
  /**
   * WHAT THE CHECK WAS ABOUT, IN THE SPELLING THE ROW WAS WRITTEN IN.
   *
   * Two fields for one fact, and this is the one place in the report where that
   * is honest rather than law 4's violation: they are the SAME question asked
   * at two different times, and rows written before the open lane entered the
   * net (every row up to 2026-08-18) carry `facet` alone. Nothing rewrites
   * history, so the reader has to be total over both — and it is derived ONCE,
   * in `labelOfStoredCheck`, which every consumer here and in the report
   * scripts goes through.
   *
   * The new spelling is the discriminated subject, so an open kind names itself
   * (`open:fangs`) instead of arriving as a string the closed vocabulary would
   * be searched for in vain.
   */
  facet?: string;
  subject?: FactSubject;
  asked: string;
  verified: boolean;
  /** Absent on rows written before D-235 — treated as unverified, never as a pass. */
  read?: boolean;
  binding?: boolean;
  saw?: string;
  /**
   * THIS FACT WAS CARRIED, NOT PAINTED — segment permanence's honesty column.
   *
   * True when the facet is in the picture because a stored segment was pasted
   * there, rather than because this render produced it. It is still a true
   * fact about the delivered frame — she genuinely has the freckles she paid
   * for — and it is emphatically NOT a fresh delivery.
   *
   * The founder's condition on the whole store, and it is not squeamishness:
   * once carried facets count as deliveries, the per-class rate rises because
   * the denominator has quietly lost its hardest cases, at the exact moment he
   * is asked to certify a number. That is the flattering-bias family, and this
   * campaign has been burned by every other member of it.
   *
   * Absent on every row written before segments existed, which is the honest
   * default: nothing was carried, because nothing could be.
   */
  carried?: boolean;
  /**
   * THE READER SAID THE ASKED THING IS NOT IN THE PICTURE AT ALL.
   *
   * See `renderVerification.FacetCheck.absent`. Here it does one job: it tells
   * a charge for a picture that lacks what she asked for apart from a reader
   * quibbling about a thing she got. The two shared a bucket until 2026-08-12
   * and the first one cost 25 credits on the founder's own account without
   * appearing anywhere in this report.
   *
   * Absent on every row written before the reader was asked the question, which
   * is honest: those rows record that something was unverified and genuinely do
   * not say which kind. They stay where they always were.
   */
  absent?: boolean;
  /**
   * THE SITE COULD NOT BE SEEN AT ALL — neither a pass nor a miss.
   *
   * `renderVerification.isOccluded`. Hair over both earlobes is the specimen:
   * the reader reaches the frame, says the lobes are hidden, and the runtime
   * already declines to refuse on it (`isRefusableMiss` is false). This report
   * did not know the field existed, so such a check — read, unverified, binding
   * — fell straight into `delivered_noncompliant`: **a false pass, in the
   * column whose bar is ZERO, for a frame where nothing is wrong.**
   *
   * Measured before it was fixed, on one master, six readings of the same bytes
   * and the same question: **four occluded, two verified.** Same picture, same
   * ask, and today's report calls four of them a false pass and two of them a
   * compliant delivery. The money is stable across all six (nothing refuses);
   * only the founder's certification number moves, and it moves on a coin.
   */
  occluded?: boolean;
  /**
   * THIS CHECK'S SUCCESS CRITERION IS AN ABSENCE — the departure's own mark.
   *
   * `renderVerification.FacetCheck.absenceIsTheAsk`, set at the one departure
   * call site and stored verbatim with the rest of the check. Read here for one
   * purpose: `classOfCheck` gives a removal its own class, so a removal cannot
   * be carried over the 95% bar by the additions that share its facet.
   */
  absenceIsTheAsk?: boolean;
};

export type StoredVerification = {
  checks?: StoredCheck[];
  unavailable?: boolean;
  attempts?: number;
  readings?: number;
  /**
   * WHAT THE READ-BACK COULD NOT CORROBORATE (2026-08-15).
   *
   * The realization captioner is asked what the render made of the ask, and it
   * refuses to pin a caption that does not match — *"Both irises are vivid
   * fiery red… left eye also shows the red tone, not isolated to the right"*,
   * on a render that delivered and charged. That verdict used to live only in a
   * log line, so this report — which reads stored rows — counted the render as
   * a clean pass.
   *
   * It is COUNTED here and it does not change any rate. Whether an
   * uncorroborated read-back should refuse, or should count against the bar, is
   * a ruling nobody has made; a number is what that ruling needs, and until
   * today there was not one.
   */
  uncorroborated?: Array<{ facet: string; asked: string; saw: string }>;
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
 * NOT A FAILURE AT ALL — a capability gap, refused before anything was rendered.
 *
 * `cannot_say` is the repaint road refusing an ask its recipe has no way to
 * state (`expression`, today). No provider was contacted, no picture was made,
 * the whole charge went back. Filing it with the dead transports would say
 * *our infrastructure broke* about a product that worked exactly as designed;
 * filing it with `facts_missing` would say *the picture came back wrong* about
 * a picture that was never taken.
 *
 * It gets its own column because it answers its own question: **how often does
 * a customer ask for something this product cannot yet express?** That number
 * is a roadmap, and it is the number the smile finding would have made visible
 * months earlier (fable-442 ruling 2).
 */
const CANNOT_SAY_CLASSES = new Set(["cannot_say"]);

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

/**
 * COULD THIS FRAME HAVE ANSWERED THE QUESTION AT ALL?
 *
 * The runtime and this report have to agree about what a check MEANS, and until
 * now they did not: `isRefusableMiss` has always excluded occluded checks — a
 * site nobody can see never spends the user's refusal — while every test below
 * read the same check as a read, unverified, binding miss and called it a false
 * pass. The money said "nothing is wrong here" and the certification number said
 * "charged for a miss", about one frame.
 *
 * Absent on every row written before the reader could say it, which classes
 * exactly as it does today: an unknown is answerable until it says otherwise, so
 * no historical row moves and no finding is taken away.
 */
function answerable(check: StoredCheck): boolean {
  return check.occluded !== true;
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
 * `overall` keeps the whole-row verdict. A render delivered with a BINDING read
 * miss is a non-compliant delivery, because the customer was charged once for
 * the whole picture — and the zero-false-pass bar is stated on that. So the
 * false pass is never lost by this change; it moves from four class rows to the
 * one class that actually failed.
 */
export function classifyAttemptForClass(row: AttemptRow, edit: string): AttemptOutcome {
  /* Through `classOfCheck`, the same function that NAMED the class — a filter
     that re-derived membership from `check.facet` here would be the second list,
     and its drift would show up as a class whose rate is computed from checks
     that are not the ones the class is made of. */
  return classifyChecks(row, (row.verification?.checks ?? []).filter((check) => classOfCheck(check) === edit));
}

function classifyChecks(row: AttemptRow, checks: ReadonlyArray<StoredCheck>): AttemptOutcome {
  if (row.status !== "ready") {
    if (!row.failureClass) return "unclassified";
    if (CANNOT_SAY_CLASSES.has(row.failureClass)) return "refused_cannot_say";
    return HONEST_REFUSAL_CLASSES.has(row.failureClass) ? "refused_honest" : "refused_infra";
  }

  if (row.verification?.unavailable === true || checks.length === 0) return "delivered_unverified";

  /*
    A BINDING miss is the false pass — and only a binding one (Fable ruling,
    2026-08-08, sharpened so this can never launder).

    It used to be any read miss, binding or not, and run-10 is why that is
    wrong. She asked for *"gold hoop earrings"*. She got gold hoop earrings —
    one in each ear, confirmed by opening the frame. The reader marked it
    unverified because they were *"thin and understated, not bold hoops"*: an
    adjective **she never used**, on a free-lane value the product deliberately
    refuses to adjudicate (D-187, which exists because that reader refunded six
    legitimate renders in eighteen attempts).

    **Her words are the sole arbiter** (law 8). A false pass is charging for a
    picture that lacks what SHE asked for. A reader quibbling a quality nobody
    specified is a different finding and gets a different bucket — otherwise
    every free-lane class fails the founder's bar by construction, and a real
    false pass hides among the quibbles where nobody can see it.

    The binding flag already carries exactly this distinction: it is set for
    values this program DEFINES and can hold a reader to. Deriving the split
    from it rather than from a new list is the whole reason it is trustworthy.
  */
  /*
    `binding !== false`, NOT `binding === true` — and my own control caught the
    difference. Legacy rows carry no `binding` at all, so `check.binding` reads
    undefined; testing for truth would have quietly demoted every historical
    miss into the harmless bucket. The safe reading of an unknown is the one
    that does not take a finding away, which is D-235's asymmetry pointed at a
    different field.
  */
  /*
    A BINDING MISS COUNTS WHETHER IT WAS PAINTED OR CARRIED, and it is
    deliberately the FIRST test.

    A carried fact that is not in the picture is the store's own promise
    failing: she paid for those freckles once, the product said it would keep
    them, and the frame she was charged for does not have them. Excusing that
    because "this render did not paint it" would build the flattering bias back
    in through the door the carried column was added to close.
  */
  /*
    AND THE WORST OUTCOME OF ALL IS TESTED BEFORE IT: SHE ASKED, AND IT IS NOT
    THERE (2026-08-12, run 1 step 4).

    `delivered_advisory` was built for a reader inventing a fault in a picture
    the user got — *"thin and understated, not bold hoops"*, an adjective she
    never used — and the reasoning below is right about that case and stays.
    But the bucket was catching a second, opposite animal: she typed **"wear her
    hair down"**, the frame came back with her hair in a high bun, the reader
    said so verbatim on both renders, and it landed here as a quibble because
    `hairWorn` was not binding. 25 credits, twice, on the founder's own account,
    invisible to the delivery-rate bar the whole report exists to serve.

    So a READ, FRESH miss the reader calls an ABSENCE gets its own line —
    whether or not the facet was binding at the time. That last clause is the
    point: the gate and the report must be able to disagree, or the report can
    only ever confirm what the gate already believed, and a facet nobody thought
    to bind stays invisible exactly as long as nobody thinks to bind it. This is
    the instrument that would have found the defect without the walk.

    Carried misses are excluded here and land in `delivered_noncompliant`
    below — a pasted segment the reader cannot find is the store's promise
    failing, which is a different failure with a different owner.
  */
  if (checks.some((check) =>
    answerable(check) && wasRead(check) && !check.verified && check.absent === true && check.carried !== true)) {
    return "delivered_absent";
  }

  if (checks.some((check) => answerable(check) && wasRead(check) && !check.verified && check.binding !== false)) {
    return "delivered_noncompliant";
  }

  /*
    NOTHING FRESH HAPPENED HERE — the picture is right, and this render proved
    nothing about painting.

    Its own outcome so it sits outside the delivery denominator entirely: a
    carried facet is arithmetic, and arithmetic that works is not evidence that
    the painter delivers. The class's rate has to keep meaning "when we claimed
    a fresh delivery, was it real".
  */
  const fresh = checks.filter((check) => check.carried !== true);
  if (fresh.length === 0) return "delivered_carried";

  if (fresh.some((check) => answerable(check) && wasRead(check) && !check.verified)) return "delivered_advisory";
  /*
    Every check must be affirmatively read AND answerable. One silence is not a
    clean sheet, and neither is a site nobody could see: an occluded check is
    treated here exactly as a silence is — never a pass, never a false pass —
    which is the only reading that leaves the money and the number saying the
    same thing about the same frame.
  */
  if (fresh.every((check) => wasRead(check) && answerable(check))) return "delivered_compliant";
  return "delivered_unverified";
}

/**
 * WHICH CLASS ONE CHECK BELONGS TO — and a removal is not the same class as the
 * addition it undoes.
 *
 * Both are `statedAccessories`: *"small gold hoops"* and *"no glasses — her face
 * uncovered"* write the same facet. Until this function they were therefore ONE
 * row in the founder's table, and the arithmetic of that is the whole reason it
 * matters: a removal delivering at 60% beside additions delivering at 100%
 * reports as one class at about 90%, and the per-class bar he is asked to
 * certify never sees the removal — which is the newest and least-proven
 * capability on the road.
 *
 * The split is DERIVED from the check's own declaration, never from prose: the
 * departure call site sets `absenceIsTheAsk`, `verifyRender` carries it onto the
 * check, and `refineService` stores the check array verbatim, so the flag is
 * already in every row written since the departure shipped. No migration, no new
 * writer, and no second list — this is the one place the name is made, and both
 * the naming and the filtering below read it.
 *
 * A row written before the flag existed has no flag and keeps exactly the class
 * it has today. Nothing in the existing table moves.
 */
export function classOfCheck(check: StoredCheck): string {
  const named = labelOfStoredCheck(check);
  return check.absenceIsTheAsk === true ? `${named} · removal` : named;
}

/**
 * THE ONE PLACE A STORED CHECK IS NAMED — both spellings, one derivation.
 *
 * An open kind names itself with its slot key (`open:fangs`), which is what
 * makes fable-911's addition true rather than aspirational: the verdicts are
 * READ, not merely stored, because the class table already tallies per class
 * and `delivered_absent` already fires on a read absence *whether or not the
 * facet was binding at the time*. So an open kind's misses land in the
 * founder's own table, per kind, from the day the net starts asking — which is
 * the reading the promotion-to-binding ruling will need.
 *
 * A row carrying neither spelling cannot come from any writer this program has
 * ever had; it is named rather than dropped, because a check quietly grouped
 * under somebody else's class is the failure this function exists to prevent.
 */
export function labelOfStoredCheck(check: StoredCheck): string {
  if (check.subject) return subjectKey(check.subject);
  return check.facet ?? "unnamed";
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
  const classes = (row.verification?.checks ?? []).map(classOfCheck);
  return Array.from(new Set(classes)).sort();
}

export type ClassTally = {
  edit: string;
  total: number;
  delivered_compliant: number;
  delivered_noncompliant: number;
  /**
   * DELIVERED, CHARGED, AND THE THING SHE ASKED FOR IS NOT IN THE PICTURE.
   *
   * D-246 class (c) as it actually reaches a customer. Counted apart from
   * `delivered_noncompliant` because that column is about a fact the product
   * PROMISED to keep (a carried segment the reader cannot find), and this one is
   * about the sentence she typed and paid for. Both fail the founder's bar;
   * they have different owners and different fixes.
   */
  delivered_absent: number;
  /**
   * Delivered, charged, and what HER WORDS asked for is in the picture — with
   * the reader disagreeing about a quality she never specified.
   *
   * Its own bucket so the founder's zero-false-pass number means what it says.
   * Outside the compliant numerator too: a class drowning in advisory rows has
   * demonstrated nothing, it has merely avoided being caught.
   */
  delivered_advisory: number;
  delivered_unverified: number;
  /**
   * THE SECOND COLUMN — delivered, correct, and carried rather than painted.
   *
   * She has the thing; a stored segment put it there. Reported beside the rate
   * and never inside it, because a rate that counted these would climb exactly
   * as the painter's hardest cases left its denominator. Its own column is what
   * makes the store's benefit visible without letting it flatter the number the
   * founder certifies.
   */
  delivered_carried: number;
  refused_honest: number;
  /** Asks this product cannot yet express — refused before any render. */
  refused_cannot_say: number;
  refused_infra: number;
  unclassified: number;
  /**
   * Attempts that ENDED IN A DELIVERY CLAIM — the rate's denominator.
   *
   * Compliant, non-compliant and unverified. Refusals are excluded: nothing was
   * delivered and the money went back, so they answer a different question and
   * are reported in their own columns. Kept as a field rather than recomputed
   * by every reader, so "what was this percentage OF" is on the record beside
   * the percentage.
   */
  deliveryClaims: number;
  /** Compliant deliveries as a share of DELIVERY CLAIMS, in percent. */
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
  /** Delivered renders whose own read-back could not corroborate the ask.
   *  Counted, never folded into a rate — see `StoredVerification`. */
  uncorroborated: number;
  /**
   * PAID ATTEMPTS THIS REPORT CANNOT SEE, disclosed rather than merely omitted
   * (fable-828 §2, from opus-617).
   *
   * The rows here come `FROM casting_candidate_variants` (`attemptRows.mts`),
   * and a refine killed before its variant row was written has none — the
   * operation was claimed and CHARGED, the recovery sweep refunded it, and
   * nothing about it ever reaches this table. Read on production 2026-08-17:
   * **15 of the founder's 199 settled refines, 7.5%.**
   *
   * Excluding them from the delivery rate is arguably right for what D-236's
   * bar MEANS — a deploy-collision death is not the product failing to deliver
   * a picture, and CLAUDE.md documents that class as designed-for and accepted.
   * Excluding them SILENTLY is not right: it is a denominator that quietly
   * drops a class of paid attempts, and it flatters the number in the one
   * direction nobody would check. So the count is carried and printed with its
   * reason.
   *
   * Undefined means the caller did not count them — which is NOT zero, and the
   * formatter says so rather than printing a confident nought.
   */
  recoveredExclusions?: number;
  /** Classes below the bar, named — they do not block the others (D-236). */
  blockers: string[];
  /**
   * Classes that claimed no delivery at all — every attempt refused.
   *
   * Named apart from `blockers` because they are a different finding and
   * calling them the same thing loses one of them. A class BELOW the bar
   * delivered and got it wrong; an UNEXERCISED class never delivered, so it has
   * proven nothing either way. It is not passing — `clearsBar` is false and it
   * shows a dash rather than a percentage — but reporting it as "below the bar"
   * would say we measured something we did not.
   */
  unexercised: string[];
  /**
   * Classes whose every appearance in this window was CARRIED.
   *
   * Named apart from `unexercised` because they are a different fact and one
   * word for both loses one of them: an unexercised class never delivered at
   * all, while a carried-only class was in every picture and painted in none of
   * them. The store worked; the painter was not on trial. Reporting the second
   * as passing would be the flattering read, and reporting it as failing would
   * be a lie about a face that is correct.
   */
  carriedOnly: string[];
};

/** D-236's bar. A number with teeth, beside D-193's. */
export const DELIVERY_RATE_BAR = 95;
export const FALSE_PASS_BAR = 0;

const emptyTally = (edit: string): ClassTally => ({
  edit,
  total: 0,
  delivered_compliant: 0,
  delivered_noncompliant: 0,
  delivered_absent: 0,
  delivered_advisory: 0,
  delivered_unverified: 0,
  delivered_carried: 0,
  refused_honest: 0,
  refused_cannot_say: 0,
  refused_infra: 0,
  unclassified: 0,
  deliveryClaims: 0,
  deliveryRate: 0,
  clearsBar: false,
});

function finish(tally: ClassTally): ClassTally {
  /*
    THE DENOMINATOR IS DELIVERY CLAIMS, NOT ATTEMPTS (Fable ruling, 2026-08-08).

    It was `total`, which counts refusals — so a class that behaved perfectly,
    delivering when it could and refusing honestly and refunding when it could
    not, had its own honesty drag it below the founder's bar. One compliant
    delivery beside one honest refusal read **50%**. The bar would then block a
    class for being honest, which inverts the thing D-236 measures.

    The rate answers one question: WHEN WE CLAIMED A DELIVERY, WAS IT REAL. A
    refusal makes no such claim — nothing was delivered and the money went
    back — so it is reported in its own column beside the rate rather than
    inside it. Honesty behaviour and delivery behaviour are different questions
    and a single number cannot answer both.

    `delivered_unverified` STAYS in the denominator. It is a delivery claim
    whose reading failed, and taking it out would let a reader outage lift the
    rate — the exact inflation D-235 was written against.
  */
  /*
    `delivered_carried` is deliberately ABSENT from this sum — segment
    permanence's honesty condition, held in the one line where it could be
    quietly lost. A carried facet claims no fresh delivery, so it belongs
    beside the rate rather than inside it.
  */
  tally.deliveryClaims = tally.delivered_compliant
    + tally.delivered_noncompliant
    + tally.delivered_absent
    + tally.delivered_advisory
    + tally.delivered_unverified;
  tally.deliveryRate = tally.deliveryClaims === 0
    ? 0
    : Math.round((tally.delivered_compliant / tally.deliveryClaims) * 1000) / 10;
  /*
    A class with no DELIVERY CLAIMS has not cleared anything — and this is the
    loophole the change above would otherwise open. Refusals leaving the
    denominator must not let a class that only ever refused divide nothing by
    nothing and read as clean: it has no delivery sample, so it has proven
    nothing about delivery. Reporting an unexercised class as passing is the
    instrument telling a comfortable lie, which is what D-215 forbids.
  */
  /*
    AND A CHARGE FOR A MISSING THING FAILS THE BAR TOO.

    `FALSE_PASS_BAR` is zero and it now governs BOTH columns. It has to: the
    whole reason `delivered_absent` was split out is that the founder's
    zero-false-passes number could not see the class, and splitting it without
    adding it here would have moved the failures somewhere quieter and called
    that a fix. A class where the user asked for something and did not get it is
    exactly what the bar is stated about.
  */
  tally.clearsBar = tally.deliveryClaims > 0
    && tally.deliveryRate >= DELIVERY_RATE_BAR
    && tally.delivered_noncompliant + tally.delivered_absent <= FALSE_PASS_BAR;
  return tally;
}

export function summarize(
  rows: ReadonlyArray<AttemptRow>,
  options: { windowFrom?: Date; windowLabel?: string; recoveredExclusions?: number } = {},
): ReliabilityReport {
  const overall = emptyTally("all");
  const byClass = new Map<string, ClassTally>();
  let creditsRefunded = 0;
  let uncorroborated = 0;

  for (const row of rows) {
    const outcome = classifyAttempt(row);
    overall.total += 1;
    overall[outcome] += 1;
    creditsRefunded += row.refundedCredits ?? 0;
    /* A DELIVERED render whose own read-back did not corroborate the ask. Only
       delivered ones: a refusal is already counted as a refusal, and counting
       it twice would make the honest path look like the failing one. */
    if (row.status === "ready" && (row.verification?.uncorroborated?.length ?? 0) > 0) {
      uncorroborated += 1;
    }

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
    uncorroborated,
    recoveredExclusions: options.recoveredExclusions,
    blockers: classes
      .filter((tally) => tally.deliveryClaims > 0 && !tally.clearsBar)
      .map((tally) => tally.edit),
    unexercised: classes
      .filter((tally) => tally.deliveryClaims === 0 && tally.delivered_carried === 0)
      .map((tally) => tally.edit),
    carriedOnly: classes
      .filter((tally) => tally.deliveryClaims === 0 && tally.delivered_carried > 0)
      .map((tally) => tally.edit),
  };
}

/**
 * One line, for a heartbeat:
 * `delivery rate 96.2% (25 of 26 attempts claimed a delivery) · 0 false passes`.
 *
 * It said "(25 attempts)" beside a percentage that was never of attempts. A
 * number that misnames its own population is how a reader draws the wrong
 * conclusion from a correct figure, so the denominator says what it is —
 * especially now that refusals sit outside it.
 */
export function heartbeatLine(report: ReliabilityReport): string {
  const { overall } = report;
  if (overall.total === 0) return "delivery rate — (no attempts yet)";
  if (overall.deliveryClaims === 0) {
    return `delivery rate — (no delivery claimed in ${overall.total} attempt`
      + `${overall.total === 1 ? "" : "s"}) · blockers ${report.blockers.join(", ") || "none"}`;
  }
  const falsePasses = overall.delivered_noncompliant;
  const blockers = report.blockers.length === 0 ? "none" : report.blockers.join(", ");
  return `delivery rate ${overall.deliveryRate}% `
    + `(${overall.deliveryClaims} of ${overall.total} attempts claimed a delivery) · `
    + `${falsePasses} false pass${falsePasses === 1 ? "" : "es"} · blockers ${blockers}`;
}

/** The full table, for a walk report or an on-demand read. */
export function formatReport(report: ReliabilityReport): string {
  const lines: string[] = [];
  lines.push(`RELIABILITY — ${report.windowLabel}`);
  if (report.windowFrom) lines.push(`window from ${report.windowFrom.toISOString()}`);
  lines.push("");
  /* `claims` is the rate's denominator, printed beside the rate so the two can
     never be read apart — a class showing 100% off one claim and one showing it
     off twenty are different findings, and the old table hid the difference. */
  /* Wide enough for the widest class NAME rather than for the widest name that
     existed when this was written: `statedAccessories · removal` is 27 and would
     have shunted its own row five columns right — the one row a reader is most
     likely to be looking for. */
  const width = Math.max(22, ...report.byClass.map((tally) => tally.edit.length), report.overall.edit.length);
  const header = "class".padEnd(width)
    + "n".padStart(4) + " claim".padStart(7) + "  ok".padStart(6) + " FALSE".padStart(7)
    + "   adv".padStart(7) + " unver".padStart(7) + " carr".padStart(7) + " ref-h".padStart(7)
    + " ref-c".padStart(7) + " ref-i".padStart(7) + "   rate  bar";
  lines.push(header);
  lines.push("-".repeat(header.length));
  const row = (tally: ClassTally) =>
    tally.edit.padEnd(width)
    + String(tally.total).padStart(4)
    + String(tally.deliveryClaims).padStart(7)
    + String(tally.delivered_compliant).padStart(6)
    + String(tally.delivered_noncompliant).padStart(7)
    + String(tally.delivered_advisory).padStart(7)
    + String(tally.delivered_unverified).padStart(7)
    /* CARRIED sits between the delivery columns and the refusals, outside the
       rate: it is the store working, and it is not the painter delivering. */
    + String(tally.delivered_carried).padStart(7)
    + String(tally.refused_honest).padStart(7)
    /* ref-c between the honest refusal and the infrastructure one, because that
       is where it belongs in meaning: nothing broke, and nothing was wrong with
       a picture — the product could not say the ask. */
    + String(tally.refused_cannot_say).padStart(7)
    + String(tally.refused_infra).padStart(7)
    /* A rate with no claims behind it is not 0% — it is nothing, and printing
       a number there invites it to be compared with a real one. */
    + (tally.deliveryClaims === 0 ? "—".padStart(7) : `${tally.deliveryRate}%`.padStart(7))
    + (tally.deliveryClaims === 0 ? "   —" : tally.clearsBar ? "   ✓" : "   ✗");
  for (const tally of report.byClass) lines.push(row(tally));
  lines.push("-".repeat(header.length));
  lines.push(row(report.overall));
  lines.push("");
  lines.push(`credits refunded: ${report.creditsRefunded}`);
  if (report.uncorroborated > 0) {
    lines.push(
      `delivered but not corroborated by the read-back: ${report.uncorroborated}`
      + " (counted, not scored — no ruling yet on whether these should refuse)",
    );
  }
  if (report.overall.delivered_carried > 0) {
    lines.push(
      `carried by stored segments: ${report.overall.delivered_carried} `
      + "— correct in the picture, outside the rate's denominator, because a "
      + "carried facet is arithmetic rather than a fresh delivery",
    );
  }
  /*
    AND THE ERA A MARKS NUMBER WAS TAKEN IN (ruled fable-927 §5).

    Until 2026-08-18 a question-less slot whose reading was DISPUTED filed
    nothing at all — not even its words. `skin` owns `marks` and has no
    segmentation question, so a marks ask the reader denied left no library row;
    the repaint recipe's standing clauses are built from library rows alone; and
    every render after the one that bought the marks therefore said nothing
    about them while the checker went on ASKING about them. A guaranteed
    `delivered_absent`, manufactured by the gap rather than by the painter.

    Printed only when the class is in the window, because a caveat on every
    report is a caveat nobody reads — and printed at all because the next person
    to open a marks court will read this table first, and a rate with no era on
    it is the number they will quote.
  */
  if (report.byClass.some((tally) => tally.edit === "marks" || tally.edit.startsWith("marks"))) {
    lines.push(
      "marks: rows before 2026-08-18 sit inside the RECIPE SILENCE era — `skin` "
      + "filed no row when its reading was disputed, so later renders never said "
      + "the marks they were then checked for. Those misses are a reading about "
      + "that gap, not about the painter; exclude them from any marks court.",
    );
  }
  /*
    WHAT THIS TABLE COULD NOT SEE, said out loud (fable-828 §2).

    A denominator that drops a class of PAID attempts without saying so is a
    number flattering itself, and this one dropped them invisibly for as long as
    the report has existed. Printed even when the count is zero, because "none
    this window" and "nobody counted" are different facts and a missing line
    reads as the first.
  */
  if (report.recoveredExclusions === undefined) {
    lines.push(
      "paid attempts settled by recovery: NOT COUNTED by this caller "
      + "— excluded from the delivery denominator, and their number is unknown",
    );
  } else {
    lines.push(
      `paid attempts settled by recovery: ${report.recoveredExclusions} `
      + "— deploy-collision class, charged and refunded, excluded from the "
      + "delivery denominator because they never reached a render",
    );
  }
  lines.push(
    `bar: ${DELIVERY_RATE_BAR}% delivered-and-compliant per class, ${FALSE_PASS_BAR} false passes (D-236)`,
  );
  if (report.blockers.length > 0) {
    lines.push(`below the bar: ${report.blockers.join(", ")} — named, not blocking the others`);
  }
  if (report.unexercised.length > 0) {
    lines.push(
      `no delivery claimed: ${report.unexercised.join(", ")} — every attempt refused, `
      + "so nothing about delivery is proven either way",
    );
  }
  if (report.carriedOnly.length > 0) {
    lines.push(
      `carried only: ${report.carriedOnly.join(", ")} — she has these and the store `
      + "kept them, but this window painted none of them, so the painter is unproven here",
    );
  }
  return lines.join("\n");
}

/** Re-exported so callers can name a facet without importing two modules. */
export type { Facet };
