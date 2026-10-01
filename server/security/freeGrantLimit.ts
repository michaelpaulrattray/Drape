/**
 * THE FREE GRANT'S QUIET CAP (#1603, P1-4, under the pricing rung #1598).
 *
 * # His ruling, and what it leaves standing
 *
 * Verbatim: *"The AI creative apps I know usually hand out a small free
 * allowance on an email or Google sign-in, with no card or phone. The limits
 * I've mentioned run quietly in the background, so honest users never notice
 * them, and that's the behaviour I'd copy."* And on the obvious alternative:
 * *"i dont think we need to add the water mark i hate water marks"* — a free
 * account gets the same output a paid one does.
 *
 * So there is **no card, no phone, no captcha and no watermark**, and a new
 * account is handed 13,500 ledger credits (2,700 display — eleven rolls). This
 * module is the entire remainder: a cap over a window, keyed on the browser and
 * the network, that an honest person never meets.
 *
 * # Where the disappearing-technology law lands on it
 *
 * Its three gate questions, answered rather than asserted:
 *
 *   1. **What must the customer learn?** Nothing. There is no new control, no
 *      new field and no new step; the happy path is byte-for-byte the signup
 *      that was there before.
 *   2. **What decision does it put in front of them?** None. The only thing
 *      this adds to a customer's experience is a sentence, and only to somebody
 *      who has already been stopped.
 *   3. **Where does the technology show?** Nowhere on the happy path, and
 *      nowhere in the refusal either — the sentence says what was refused and
 *      what to do, and names no device, no network, no window and no number.
 *      Naming them would hand a farmer the shape of the control and tell an
 *      honest person something they cannot act on.
 *
 * # What it refuses, and why not the other thing
 *
 * ⚠ **IT REFUSES THE SIGNUP, NOT THE GRANT.** Creating the account and then
 * withholding its credits was the other road and it is worse on every count:
 * the customer lands in a studio that cannot do anything, with nothing to read
 * and nothing to do, and the product has made her balance the explanation. That
 * is precisely the machinery showing through. Refusing before the account exists
 * leaves nothing half-made and lets the refusal say something true.
 *
 * # The numbers, and why they are loose
 *
 * `FREE_GRANT_MAX_PER_DEVICE` 3 · `FREE_GRANT_MAX_PER_NETWORK` 10 ·
 * `FREE_GRANT_WINDOW_HOURS` 168, all through `envInt`, so a blank variable takes
 * the default instead of becoming `NaN` and admitting everybody.
 *
 * The network cap is deliberately more than three times the device cap because a
 * household, an office, a co-working space or a campus is ONE address — an IP
 * cap tight enough to stop farming would refuse a studio whose whole team signs
 * up on one afternoon. The window is a week rather than a day so that farming
 * cannot be spread thinly over a weekend, and the device cap is 3 rather than 1
 * because a shared machine is an ordinary thing.
 *
 * What the device half can and cannot see is written out in
 * `server/security/deviceKey.ts`. It is a speed bump; nothing here pretends
 * otherwise.
 */
import type { Request, Response } from "express";

import { AUDIT_ACTIONS } from "../../shared/auditActions";
import { FREE_GRANT_REFUSAL_SENTENCE } from "../../shared/freeGrantRefusal";
import { envInt } from "../_core/env";
import { countFreeGrantClaims, recordFreeGrantClaim } from "../db/quietLimits";
import { logAuditEvent } from "../auditLog";
import { createModuleLogger } from "../logging/logger";
import { identifyDevice, type DeviceIdentity } from "./deviceKey";

const log = createModuleLogger("security/freeGrantLimit");

/**
 * THE SENTENCE, and it is the only customer-visible string this card adds.
 *
 * It says what was refused ("a new free account, just now"), gives the two
 * things that actually help ("sign in" for the common honest case — somebody who
 * already has an account — and an address for everyone else), and names no
 * mechanism. There is no number in it, no "device", no "limit" and no "network":
 * each of those would either coach a farmer or tell an honest person something
 * they can do nothing with.
 *
 * ⚠ It also does NOT say "try again later" on its own. The window is a week, so
 * "later" would be a quiet lie; the address is the road that actually resolves
 * it for the honest case this could catch.
 *
 * ⚠ **DECLARED IN `shared/` AND RE-EXPORTED, NOT RESTATED.** The login page
 * renders the same sentence for the Google road, and the client cannot import
 * from `server/` — so a copy there would be two strings for one promise. The
 * re-export is here so every server caller keeps reading it off the module that
 * owns the policy.
 */
export {
  FREE_GRANT_REFUSAL_ERROR_CODE,
  FREE_GRANT_REFUSAL_SENTENCE,
} from "../../shared/freeGrantRefusal";

export type FreeGrantDecision =
  | { readonly allowed: true; readonly device: DeviceIdentity; readonly ipAddress: string }
  | { readonly allowed: false; readonly sentence: string };

/**
 * May this browser, on this network, be handed a free account right now?
 *
 * Call it BEFORE the account is created — the whole point is that a refusal
 * leaves nothing behind. It mints the device cookie on the way through, so the
 * refused browser is recognised on its next attempt rather than looking new.
 *
 * ⚠ **A DATABASE THAT CANNOT ANSWER IS A REFUSAL, NOT AN ALLOWANCE** (invariant
 * 7: a control must refuse when a dependency is missing). The alternative is a
 * control that switches itself off exactly when the product is least healthy.
 */
export async function mayGrantFreeCredits(
  req: Request,
  res: Response,
  ipAddress: string,
): Promise<FreeGrantDecision> {
  const device = identifyDevice(req, res, ipAddress);

  const perDevice = envInt("FREE_GRANT_MAX_PER_DEVICE");
  const perNetwork = envInt("FREE_GRANT_MAX_PER_NETWORK");
  const windowHours = envInt("FREE_GRANT_WINDOW_HOURS");
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  let counts: { device: number; network: number };
  try {
    counts = await countFreeGrantClaims({ deviceKey: device.deviceKey, ipAddress, since });
  } catch (error) {
    log.error({ err: error }, "[freeGrantLimit] could not count claims — refusing the grant");
    return { allowed: false, sentence: FREE_GRANT_REFUSAL_SENTENCE };
  }

  const overDevice = counts.device >= perDevice;
  const overNetwork = counts.network >= perNetwork;
  if (!overDevice && !overNetwork) return { allowed: true, device, ipAddress };

  /*
    ONE ROW, AND IT IS THE ONLY PLACE ANYBODY CAN EVER SEE THIS FIRING. The
    action is bucketed as `abuse` in `shared/auditActionCategories.ts` in the
    same commit that created it — without that line the panel's own abuse filter
    drops every row this writes, which is the defect the site-wide login alarm's
    comment in that file records.

    `warning`, not `critical`: one refusal is far more likely to be an office
    than an attack, and what is worth looking at is a run of them.

    ⚠ The metadata carries which half fired and the counts, because a staff
    member reading this needs to tell "a shared office hit the network cap" from
    "one browser is making accounts" — and `deviceKey` carries its own
    `cookie:`/`derived:` prefix so the confidence is readable too. It carries NO
    email and no name: the account was never created, and the refusal is about a
    browser rather than a person.
  */
  await logAuditEvent({
    action: AUDIT_ACTIONS.ABUSE_FREE_GRANT_CAPPED,
    resourceType: "auth",
    metadata: {
      reason: overDevice ? "device" : "network",
      deviceKey: device.deviceKey,
      deviceClaims: counts.device,
      networkClaims: counts.network,
      perDevice,
      perNetwork,
      windowHours,
    },
    severity: "warning",
    ipAddress,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
  });

  return { allowed: false, sentence: FREE_GRANT_REFUSAL_SENTENCE };
}

/**
 * Record the grant that was just made, against the device the decision was made
 * for.
 *
 * It takes the decision rather than re-reading the request so that the row can
 * only ever carry the key the cap was checked against — re-identifying here
 * would let the two drift, and a cap counting a different key from the one it
 * checks is a cap that never fires.
 */
export async function noteFreeGrantMade(
  decision: Extract<FreeGrantDecision, { allowed: true }>,
  userId: number,
): Promise<void> {
  await recordFreeGrantClaim({
    deviceKey: decision.device.deviceKey,
    ipAddress: decision.ipAddress,
    userId,
  });
}
