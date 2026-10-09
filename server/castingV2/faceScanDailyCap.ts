/**
 * HOW MANY FACE SCANS AN ACCOUNT MAY BUY IN A DAY (#1603, P1-4).
 *
 * # Why a free signup needs this at all
 *
 * A face scan is **house money**, and `castingV2.faceScan`'s own docblock is the
 * place that says so: *"Nothing is charged to the user — a scan is house money on
 * a read they never asked to pay for."* One scan is **20** segmenter reads at fal
 * (`FACE_SCAN_READS_PER_VERSION`, counted rather than derived) — about $0.10.
 *
 * Until P1-4 that was fine, because every account was approved by hand. From
 * P1-4 a free account arrives on a verified email or a Google sign-in with **no
 * card and no phone** behind it, and this read is the one thing in the product it
 * can spend our money on without spending any of its own credits. So the cap is
 * not a throttle on a customer — it is the cost control that lets the cardless
 * signup exist.
 *
 * # What a capped account actually experiences, and why it is NOT a sentence
 *
 * ⚠ **A CAPPED SCAN IS TODAY'S PANEL, EXACTLY AS A FAILED SCAN IS — and that is
 * the surrounding code's own declared posture, not an invention here.** The
 * procedure already answers this way when a segmenter is down or a frame will not
 * decode: *"A FAILED SCAN IS TODAY'S PANEL, not an error. The user asked to look
 * at a face, not to buy a reading, so a segmenter that is down or a frame that
 * will not decode costs them nothing and shows them exactly what they saw
 * yesterday."*
 *
 * So a capped account opens a face and sees the panel it would have seen anyway —
 * the library rows it has already edited — with no error, no toast and nothing
 * charged. **This is the deliberate reading of the card's *"refuses the N+1th
 * scan"*: the SCAN is refused, the request is not.**
 *
 * The alternative was a sentence on the panel, and it was declined on the
 * disappearing-technology law. Nobody who reaches this has done anything wrong
 * and there is nothing for them to do about it; a line of copy there would be a
 * number they cannot act on sitting on a surface they came to look at a face on,
 * which is clause 6 exactly — *"a control the customer must understand to use, a
 * number they must interpret, a choice they have no basis to make."* His own
 * phrasing of the limits is the test: they *"run quietly in the background, so
 * honest users never notice them."*
 *
 * ⚠ **AND THE HONEST COST OF THAT CHOICE, SAID OUT LOUD: an account at its cap
 * cannot tell a quiet day from a refusal.** The remedy is that the number is set
 * where an honest account never reaches it, and that every refusal writes an
 * audit row a staff member can see — so the product knows even when the customer
 * does not. If it ever turns out that real people are hitting this, the row is
 * where that will show, and THEN it is a copy decision with evidence behind it
 * rather than a guess.
 *
 * # The number
 *
 * `FREE_SCAN_DAILY_CAP`, default **250**, through `envInt` — so a blank Railway
 * variable takes the default rather than becoming `NaN`, which on this
 * comparison would admit every scan and silently delete the control.
 *
 * ⚠ **IT WAS 40, AND 40 WAS MEASURABLY TOO LOW — #2170, 2026-10-10. The
 * paragraph this replaces argued the number from two cache sizes; it is argued
 * here from what accounts actually do and what a scan actually costs.**
 *
 * **What a scan costs the house:** `FACE_SCAN_READS_PER_VERSION` is **20**
 * segmenter reads (`scripts/lib/falSpend.mts`, counted by driving the real
 * `scanFace` through a recording reader — its own docblock notes that *every
 * hand-derivation of this number before that script was wrong*), and fal's
 * published SAM-3 price is **$0.005 a request** (`FAL_MEASURED_USD`). So one
 * scan is about **$0.10**, plus one describer text call on a different
 * transport that is deliberately not priced in with it.
 *
 * ⚠ **The sentence above this one used to say "fourteen segmenter questions",
 * and that was one of the wrong hand-derivations** — 11 asks with 3 bilateral
 * ones doubling. The figure lives in one place precisely so this does not
 * happen; this docblock now cites it instead of recomputing it.
 *
 * **What accounts actually do.** Distinct `(candidate, version)` pairs per UTC
 * day, every row in `casting_face_scans`, all time, read 2026-10-10 (371 rows,
 * one account — the only one that has ever scanned, over ten days):
 *
 *     189 · 56 · 43 · 39 · 20 · 13 · 8 · 1 · 1 · 1
 *
 * **Three of those ten days exceed 40 counted correctly**, and a cap of 40 would
 * have refused 149 of the 189 faces of 22 September — about four fifths of one
 * real session. ⚠ **The 20 is not a quiet day either: it is CENSORED.** That is
 * 8 October, the day the cap first fired, and the account was refused 15 times
 * on top of it — so the demand that day was higher than the row shows, and the
 * only reason it reads as 20 is that this control stopped it.
 *
 * **Why 250 costs the house nothing it was not already exposed to, which is the
 * argument that actually settles the number.** A free account can only scan
 * faces it owns, and it has to buy them first: the one-time grant is
 * `FREE_SIGNUP_GRANT_CREDITS` = 13,500 ledger credits, and a sheet of eight
 * candidates is `CASTING_V2_ROLL_PRICE_CREDITS` = 1,600 — so **eight sheets, 64
 * candidates, about $6.40 of scans in its entire life.** The grant bounds a
 * cardless account's total scan spend an order of magnitude below any plausible
 * daily ceiling, and it does so whether this number is 40 or 250. Anyone who
 * can reach 250 distinct faces in a day has bought about 32 sheets, which is
 * several times a free grant.
 *
 * So the daily number was never the control on a free account's TOTAL; it is a
 * control on a BURST. ⚠ **And the burst road is the one #2174 closed** — the
 * panel's once-a-second poll used to spend a count each time, which is what
 * made 40 behave like 15. With counting fixed, 250 is a ceiling an honest
 * session does not reach and an abusive one cannot pay for.
 *
 * **The worst case, stated rather than implied: 250 × $0.10 = $25.00 of house
 * money per account per UTC day.**
 *
 * ⚠ **AND THIS IS NOT THE ONLY LIMIT ON THIS ROAD — found while driving the new
 * number (#2170), and it is the thing to know before anyone changes it again.**
 * `castingV2.faceScan` also calls `enforceRateLimit(ctx.user.id,
 * RATE_LIMITS.castingRead)`, which is **120 requests a minute**
 * (`server/security/rateLimit.ts`). The two answer differently and a reader who
 * knows only this file will misdiagnose the other: the rate limit throws a real
 * `TOO_MANY_REQUESTS` the client can see, while this cap returns today's panel
 * and says nothing. So a burst is already bounded per MINUTE by that, and this
 * number bounds the DAY. The test that proves this cap fires had to stop
 * looping to it for exactly this reason — 251 requests trip the per-minute
 * limit long before the daily one.
 *
 * # Who it applies to
 *
 * ⚠ **EVERY ACCOUNT, not only free ones** — and that is a deliberate choice
 * rather than an oversight. Keying the cap on the plan tier would mean the
 * control's population changes whenever billing does, and it would read a money
 * table to answer a cost question.
 *
 * ⚠ **THE JUSTIFICATION THIS CLAUSE USED TO CARRY IS FALSIFIED AND IS NOT
 * REPLACED WITH A GUESS (#2170).** It read *"At forty a day no paying customer
 * can reach it either, so a tier test would buy nothing and cost a
 * dependency"* — and the only account that has ever scanned reached it, 15
 * times in four minutes on 8 October. The *conclusion* still holds at 250 for
 * the reason above (a free grant cannot buy enough candidates to get near it,
 * so a tier test would still change nobody's answer), but it holds on the
 * credit grant rather than on the claim that nobody reaches the number.
 *
 * Whether a cardless free account should have a LOWER ceiling than an
 * established one is a real question and is deliberately NOT answered here: it
 * is the tier dependency this clause declines, and reopening it is a design
 * decision rather than a number change.
 */
import { AUDIT_ACTIONS } from "../../shared/auditActions";
import { envInt } from "../_core/env";
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
 * Count this scan against the account's day; `false` means do not buy it.
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
 * least healthy.
 */
export async function mayBuyFaceScan(userId: number): Promise<boolean> {
  const cap = envInt("FREE_SCAN_DAILY_CAP");
  const day = utcDayOf(new Date());

  let scans: number;
  try {
    scans = await countFaceScanAgainstDay({ userId, day });
  } catch (error) {
    log.error({ err: error, userId }, "[faceScanDailyCap] could not count the day — refusing the scan");
    return false;
  }

  if (scans <= cap) return true;

  /*
    ONE ROW PER REFUSED SCAN, bucketed as `abuse` in
    `shared/auditActionCategories.ts` in this same commit — otherwise the panel's
    abuse filter drops it and nobody can ever see this firing, which is the
    defect that file's login-alarm comment records.

    ⚠ It fires on EVERY refused scan rather than only the first of a day, and that
    is the useful direction: the thing worth seeing is how hard an account is
    pushing, and a once-a-day row cannot show that. `warning`, because one capped
    account is a cost note and not an incident.
  */
  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED,
    resourceType: "casting",
    metadata: { day, scansToday: scans, cap },
    severity: "warning",
  });

  return false;
}
