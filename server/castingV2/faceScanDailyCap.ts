/**
 * HOW MANY FACE SCANS AN ACCOUNT MAY BUY IN A DAY (#1603, P1-4).
 *
 * # Why a free signup needs this at all
 *
 * A face scan is **house money**, and `castingV2.faceScan`'s own docblock is the
 * place that says so: *"Nothing is charged to the user — a scan is house money on
 * a read they never asked to pay for."* One scan is `FACE_SCAN_READS_PER_VERSION`
 * segmenter reads at fal, counted rather than derived — and what that comes to
 * in money is deliberately not stated here (see "The numbers" below).
 *
 * Until P1-4 that was fine, because every account was approved by hand. From
 * P1-4 a free account arrives on a verified email or a Google sign-in with **no
 * card and no phone** behind it, and this read is the one thing in the product it
 * can spend our money on without spending any of its own credits. So the cap is
 * not a throttle on a customer — it is the cost control that lets the cardless
 * signup exist.
 *
 * # What a capped account actually experiences — ONE QUIET SENTENCE
 *
 * ⚠ **A CAPPED SCAN IS TODAY'S PANEL WITH A LINE ON IT, and the line is his
 * ruling of 2026-10-10, verbatim: *"Yes, show the quiet line when someone hits
 * the cap, instead of failing silently."*** The rows the library already holds
 * stay on screen and stay tappable; what changes is that the panel says why no
 * new reading is coming. The copy is `FACE_SCAN_CAPPED_LINE` on the client
 * (`client/src/features/castingV2/components/FacePanel.tsx`): *"You've looked
 * at a lot of faces today — readings come back tomorrow."*
 *
 * **It names no number and no engine**, which is what keeps it inside the
 * disappearing-technology law: it says what is happening to their picture and
 * what to expect, never what is doing it or what a ceiling is. The SCAN is
 * refused, the request is not — nothing is charged, nothing errors.
 *
 * ⚠ **AND THIS REVERSES #1603's OWN CHOICE, WHICH IS WHY THAT CHOICE IS KEPT
 * HERE RATHER THAN DELETED.** This section used to be headed *"and why it is
 * NOT a sentence"* and declined the line on clause 6 — *"a number they cannot
 * act on sitting on a surface they came to look at a face on"* — resting on his
 * *"run quietly in the background, so honest users never notice them."* It then
 * stated the honest cost of that choice out loud: **an account at its cap cannot
 * tell a quiet day from a refusal**, with the remedy that the number would be
 * set where an honest account never reaches it, and the condition that would
 * reopen it: *"If it ever turns out that real people are hitting this, the row
 * is where that will show, and THEN it is a copy decision with evidence behind
 * it rather than a guess."*
 *
 * **That condition was met, by the only account that has ever scanned, fifteen
 * times in four minutes on 8 October.** The audit row was where it showed, and
 * his word above is the copy decision it asked for. So the original clause was
 * not wrong — it was right about the law and right about what would change its
 * mind, and the evidence arrived. The line it declined was a number; the line
 * that shipped is not.
 *
 * **The audit row stays either way.** The customer now knows, and the product
 * still needs to: one row per refused scan is how a staff member sees how hard
 * an account is pushing, which a sentence on a panel cannot answer.
 *
 * # The numbers — TWO of them, one per tier
 *
 * `FREE_SCAN_DAILY_CAP` = **40** and `PAID_SCAN_DAILY_CAP` = **100**, both
 * through `envInt` — so a blank Railway variable takes the declared default
 * rather than becoming `NaN`, which on this comparison would admit every scan
 * and silently delete the control.
 *
 * ⚠ **THEY ARE HIS NUMBERS AND HIS DECISION — 2026-10-10, verbatim:**
 *
 * > *"Free accounts: keep the cap at 40 a day. Paid accounts: raise it to 100 a
 * > day, not 250. That still covers almost all of your real busy days. Ask the
 * > crew to measure the real cost of a scan. The code only proves about 6
 * > cents, and the description step isn't measured. Once we have it, I'll
 * > include it in the Roll price so every plan stays profitable. Yes, show the
 * > quiet line when someone hits the cap, instead of failing silently."*
 *
 * ⚠ **ONE CAP OF 40 FOR EVERYBODY WAS MEASURABLY TOO LOW, AND THAT IS WHAT
 * #2170 WAS FILED ABOUT.** Distinct `(candidate, version)` pairs per UTC day,
 * every row in `casting_face_scans`, all time, read 2026-10-10 (371 rows, one
 * account — the only one that has ever scanned, over ten days):
 *
 *     189 · 56 · 43 · 39 · 20 · 13 · 8 · 1 · 1 · 1
 *
 * **Three of those ten days exceed 40 counted correctly.** ⚠ **And the 20 is
 * not a quiet day: it is CENSORED.** That is 8 October, the day the cap first
 * fired, and the account was refused 15 times on top of it — so the demand that
 * day was higher than the row shows, and the only reason it reads as 20 is that
 * this control stopped it.
 *
 * ⚠ **HIS ANSWER IS NOT "THE BUSIEST DAY PLUS HEADROOM", AND THE DIFFERENCE IS
 * THE POINT.** 100 does not cover the 189 of 22 September, and he said so in
 * the same sentence — *"almost all of your real busy days"* — so the trade is
 * his and it is stated: a session past 100 distinct faces in one UTC day is
 * capped, and the quiet line below is what that session is told. **A shift does
 * not raise either number to make a measured day fit.**
 *
 * ⚠ **AND WHAT A SCAN COSTS IS NOT SETTLED — his *"the code only proves about 6
 * cents"* is the honest reading, and measuring it is its own card.** What the
 * tree can prove today is `FACE_SCAN_READS_PER_VERSION` segmenter reads at
 * fal's published SAM-3 price (`scripts/lib/falSpend.mts`), plus a describer
 * text call on another transport that is **not** inside that figure. His plan
 * for the measured number is to fold it into the Roll price so every plan stays
 * profitable, which is a PRICING act rather than a change to these two numbers.
 * **So nothing here quotes a cost per scan**: a number argued from a figure its
 * own author calls unmeasured is the shape this docblock has already been wrong
 * in twice — it said *"fourteen segmenter questions"*, then *"20 reads, about
 * ten cents"*; the first was a bad hand-derivation and the second priced only
 * the half that had been counted.
 *
 * ⚠ **AND THIS IS NOT THE ONLY LIMIT ON THIS ROAD — the thing to know before
 * anyone changes either number again.** `castingV2.faceScan` also calls
 * `enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead)`, which is **120
 * requests a minute** (`server/security/rateLimit.ts`). The two answer
 * differently and a reader who knows only this file will misdiagnose the other:
 * the rate limit throws a real `TOO_MANY_REQUESTS` the client can see, while
 * this cap returns today's panel with the quiet line. So a burst is already
 * bounded per MINUTE by that, and these numbers bound the DAY. The suite that
 * proves this cap fires seeds the day's tally for exactly this reason — 101
 * requests trip the per-minute limit long before the daily one.
 *
 * # Who is on which number
 *
 * ⚠ **PAID MEANS AN ACCOUNT ON A PLAN THAT COSTS MONEY, READ OFF THE PLAN TABLE
 * BILLING READS — never typed here** (his ruling: *"read from the same plan-tier
 * source billing reads, never typed"*). The rung comes from
 * `getSubscriptionByUserId`, the same reader `billing.getStatus` uses, and
 * paid-ness is `PLAN_TIERS[rung].price > 0` rather than a list of rung names:
 * a list has to be edited every time the ladder changes, and the ladder changed
 * four times in the eight days before this was written. A rung priced at zero
 * is a free rung whatever it is called.
 *
 * ⚠ **THE RUNG IS THE WHOLE TEST, AND THAT IS NOT AN OVERSIGHT ABOUT
 * `subscriptionStatus`.** `handleSubscriptionDeleted` and the final-payment
 * failure both write `planTier: "free"` (`server/stripe/webhooks.ts`), so a
 * subscription that has ended has already left the rung. An account whose
 * payment is merely late still holds its plan, and taking its readings down to
 * the free ceiling on the day a card expires is a billing policy nobody has
 * ruled — so this does not invent one.
 *
 * ⚠ **THE PLAN IS NOT READ ON AN HONEST SESSION AT ALL.** The tier read happens
 * only once the day's count has passed the LOWER of the two caps, so an account
 * under 40 never touches the money table. That keeps the dependency the old
 * single-cap docblock was right to worry about (*"it would read a money table
 * to answer a cost question"*) off the common path entirely: it is paid for
 * only by an account that is about to be capped on one number or the other.
 *
 * ⚠ **A TIER THAT CANNOT BE READ IS TREATED AS FREE**, which is the tighter
 * number and therefore the fail-closed direction — the same posture every other
 * arm of this control takes. The cost of being wrong that way is a busy paying
 * account held at 40 for as long as the database is unreachable; the cost of the
 * other way is the looser ceiling handed to whoever asks during an outage.
 *
 * ⚠ **AND THE DAY'S TALLY IS ONE COUNTER PER ACCOUNT, NOT ONE PER TIER** — so a
 * plan bought or cancelled mid-day takes effect on the next look, against the
 * scans already counted. Upgrading at 45 faces opens the way to 100 the same
 * minute; cancelling at 60 shuts the day immediately. Two counters would let an
 * account buy a plan, spend the paid allowance, and get the free one back by
 * cancelling — which is the loophole a per-tier tally would create.
 */
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { AUDIT_ACTIONS } from "../../shared/auditActions";
import { envInt } from "../_core/env";
import { getSubscriptionByUserId } from "../db/billing";
import { countFaceScanAgainstDay } from "../db/quietLimits";
import { logAuditEvent } from "../auditLog";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/faceScanDailyCap");

/**
 * The UTC day a moment falls in, as `YYYY-MM-DD`.
 *
 * UTC rather than a local zone so the boundary is one thing everywhere: a
 * server's local midnight is a different instant from the customer's, and a cap
 * whose day depends on where the process runs is a cap that resets twice or not
 * at all on a deploy between regions.
 */
export function utcDayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * WHICH DAILY CEILING THIS RUNG IS ON — the paid one, or the free one.
 *
 * Paid means the plan costs money, read off `PLAN_TIERS` itself rather than a
 * list of rung names: the ladder is re-priced and re-named often (four times in
 * the eight days before this was written) and a list would have to be edited
 * each time, silently handing a new rung the wrong ceiling until somebody
 * noticed. A rung whose price is zero is a free rung whatever it is called.
 *
 * Exported so the suite can drive the mapping over the real plan table instead
 * of over a fixture that could agree with a wrong implementation.
 */
export function scanCapForPlanTier(tier: PlanTier): number {
  const paid = (PLAN_TIERS[tier]?.price ?? 0) > 0;
  return envInt(paid ? "PAID_SCAN_DAILY_CAP" : "FREE_SCAN_DAILY_CAP");
}

/**
 * The account's own rung, or `"free"` when it cannot be read.
 *
 * `getSubscriptionByUserId` is the reader `billing.getStatus` uses, and it
 * answers `null` both for an account with no credits row and for no database at
 * all — `billing.getStatus` reads that null as `free` and so does this. A
 * thrown read takes the same road rather than escaping: the tighter ceiling is
 * the fail-closed direction, and it is argued in the module header.
 */
async function planTierOf(userId: number): Promise<PlanTier> {
  try {
    const subscription = await getSubscriptionByUserId(userId);
    return subscription?.planTier ?? "free";
  } catch (error) {
    log.error(
      { err: error, userId },
      "[faceScanDailyCap] could not read the plan — holding this account to the free ceiling",
    );
    return "free";
  }
}

/**
 * What the cap says about one look: buy it, refuse it, or could not tell.
 *
 * ⚠ **THREE STATES RATHER THAN A BOOLEAN, AND THE THIRD ONE IS THE WHOLE
 * REASON (#2170).** His ruling asks for a quiet line when an account hits the
 * cap — and a boolean cannot tell *"you have looked at a lot of faces today"*
 * from *"our database is unreachable"*. Both refuse the scan; only one of them
 * is something to say to a customer. A single `false` would put that sentence
 * on the panel during an outage, which is a lie the customer cannot act on.
 */
export type FaceScanCapVerdict = "allowed" | "capped" | "unavailable";

/**
 * Count this scan against the account's day and say whether to buy it.
 *
 * ⚠ **IT COUNTS FIRST AND DECIDES SECOND**, which is argued at
 * `countFaceScanAgainstDay`: the increment is one atomic statement, so two scans
 * arriving together cannot lose each other's count. An attempt made past the cap
 * is therefore counted too and the day stays shut.
 *
 * ⚠ **A DATABASE THAT CANNOT ANSWER REFUSES THE SCAN** (invariant 7). The scan is
 * house money, and the caller degrades to the unscanned panel — so the cost of
 * failing closed here is a panel that is not as full as it could be, while the
 * cost of failing open is an uncapped spend at exactly the moment the product is
 * least healthy. It answers `"unavailable"` rather than `"capped"`, so the
 * panel stays silent instead of blaming the customer for our outage.
 *
 * ⚠ **THE LOWER CEILING IS CHECKED FIRST, AND THE PLAN IS READ ONLY IF IT IS
 * PASSED.** Every look an honest session makes is under the free number, so the
 * common path never touches the money table — the dependency is paid for only
 * by an account that is about to be capped on one number or the other. The
 * short-circuit bound is `Math.min` of the two rather than the free one by
 * name: a deployment that set the paid variable BELOW the free one would
 * otherwise admit a paid account past its own ceiling, and nothing about either
 * number's declaration forbids that ordering.
 */
export async function mayBuyFaceScan(userId: number): Promise<FaceScanCapVerdict> {
  const day = utcDayOf(new Date());

  let scans: number;
  try {
    scans = await countFaceScanAgainstDay({ userId, day });
  } catch (error) {
    log.error({ err: error, userId }, "[faceScanDailyCap] could not count the day — refusing the scan");
    return "unavailable";
  }

  const floor = Math.min(envInt("FREE_SCAN_DAILY_CAP"), envInt("PAID_SCAN_DAILY_CAP"));
  if (scans <= floor) return "allowed";

  const tier = await planTierOf(userId);
  const cap = scanCapForPlanTier(tier);
  if (scans <= cap) return "allowed";

  /*
    ONE ROW PER REFUSED SCAN, bucketed as `abuse` in
    `shared/auditActionCategories.ts` — otherwise the panel's abuse filter drops
    it and nobody can ever see this firing, which is the defect that file's
    login-alarm comment records.

    ⚠ It fires on EVERY refused scan rather than only the first of a day, and that
    is the useful direction: the thing worth seeing is how hard an account is
    pushing, and a once-a-day row cannot show that. `warning`, because one capped
    account is a cost note and not an incident.

    ⚠ **`onFreeCeiling` RATHER THAN THE RUNG'S NAME (#2170).** What a staff
    member needs from this row is which of the two numbers decided it; the exact
    rung is the customer's billing data and the audit log is a staff-wide surface
    with its own MODERATOR readers, so copying it here would widen what that
    surface carries to answer a question it does not ask. `cap` and this flag
    together say everything the row is for.
  */
  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED,
    resourceType: "casting",
    metadata: { day, scansToday: scans, cap, onFreeCeiling: cap === envInt("FREE_SCAN_DAILY_CAP") },
    severity: "warning",
  });

  return "capped";
}
