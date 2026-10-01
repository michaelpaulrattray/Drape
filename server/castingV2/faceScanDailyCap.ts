/**
 * HOW MANY FACE SCANS AN ACCOUNT MAY BUY IN A DAY (#1603, P1-4).
 *
 * # Why a free signup needs this at all
 *
 * A face scan is **house money**, and `castingV2.faceScan`'s own docblock is the
 * place that says so: *"Nothing is charged to the user — a scan is house money on
 * a read they never asked to pay for."* One scan is fourteen segmenter questions
 * at fal, every bilateral one of which becomes two more.
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
 * `FREE_SCAN_DAILY_CAP`, default 40, through `envInt` — so a blank Railway
 * variable takes the default rather than becoming `NaN`, which on this
 * comparison would admit every scan and silently delete the control.
 *
 * Forty is loose on purpose. A scan is per (candidate, version) and idempotent,
 * so re-opening a face costs nothing; reaching forty in one UTC day means forty
 * distinct faces or versions looked at for the first time, which is far past any
 * session a person actually has. The two measured facts behind it: the in-process
 * cache holds 64 readings (`FACE_SCAN_CACHE_LIMIT`), and the panel's own scan is
 * gated to five concurrent segmenter calls.
 *
 * # Who it applies to
 *
 * ⚠ **EVERY ACCOUNT, not only free ones** — and that is a deliberate choice
 * rather than an oversight. Keying the cap on the plan tier would mean the
 * control's population changes whenever billing does, and it would read a money
 * table to answer a cost question. At forty a day no paying customer can reach
 * it either, so a tier test would buy nothing and cost a dependency.
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
