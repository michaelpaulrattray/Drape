/**
 * #1010 — THE REFERRAL LINK SETTINGS HANDS OUT HAS A CLIENT HALF AGAIN.
 *
 * `getMyCode` builds `…/?ref=CODE`, `ReferralBlock.tsx` shows it under Copy,
 * and `useReferralClaim` is the hook that catches the code on landing and
 * claims it after login. Its only importer ever was `pages/Dashboard.tsx`,
 * deleted 2026-04-04 (`98931f66`) — a path-three death: written, wired, live,
 * then orphaned by a commit aimed at something else. Nothing failed; a
 * friend opening the link simply got nothing, for five months.
 *
 * Three arms, each on the bytes, because the defect was an ABSENCE and only a
 * reader that insists on the presence can see it come back:
 *
 *   1. the app root MOUNTS the bridge (the wire itself);
 *   2. the bridge CALLS the hook (a bridge that renders null and calls nothing
 *      would pass arm 1 and wire nothing);
 *   3. the hook still READS `?ref=` and still CLAIMS through `referral.claim`
 *      (the road the bridge exists to reach).
 *
 * Driven red on `e61b4546` before the wire existed: arm 1 fails on the
 * un-mounted tree, which is the negative control this guard needs.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "client", "src");
const APP = path.join(ROOT, "App.tsx");
const BRIDGE = path.join(ROOT, "features", "referral", "ReferralClaimBridge.tsx");
const HOOK = path.join(ROOT, "features", "referral", "useReferralClaim.ts");

describe("#1010 · the referral link's client half is mounted", () => {
  it("App.tsx mounts <ReferralClaimBridge /> at the root, beside the operation bridge", () => {
    const source = readFileSync(APP, "utf8");
    expect(source).toMatch(/import \{ ReferralClaimBridge \} from "\.\/features\/referral\/ReferralClaimBridge"/);
    expect(source).toMatch(/<ReferralClaimBridge \/>/);
    /* Same shape as the operation bridge, and in the same provider scope:
       inside TooltipProvider/ThemeProvider, where useAuth and trpc resolve. */
    const opAt = source.indexOf("<GenerationOperationBridge />");
    const refAt = source.indexOf("<ReferralClaimBridge />");
    const routerAt = source.indexOf("<Router />");
    expect(opAt).toBeGreaterThan(-1);
    expect(refAt).toBeGreaterThan(opAt);
    expect(routerAt).toBeGreaterThan(refAt);
  });

  it("the bridge calls the hook and renders nothing", () => {
    const source = readFileSync(BRIDGE, "utf8");
    expect(source).toMatch(/import \{ useReferralClaim \} from "\.\/useReferralClaim"/);
    expect(source).toMatch(/export function ReferralClaimBridge\(\) \{\s*useReferralClaim\(\);\s*return null;\s*\}/);
  });

  it("the hook reads ?ref= on landing and claims through referral.claim", () => {
    const source = readFileSync(HOOK, "utf8");
    expect(source).toMatch(/params\.get\("ref"\)/);
    expect(source).toMatch(/trpc\.referral\.claim\.useMutation\(\)/);
    expect(source).toMatch(/claimMutation\.mutate\(\s*\{ referralCode: storedCode \}/);
  });

  it("POSITIVE CONTROL — the un-mounted root that shipped is what arm 1 refuses", () => {
    const source = readFileSync(APP, "utf8");
    const sabotaged = source.replace("          <ReferralClaimBridge />\n", "");
    expect(sabotaged).not.toBe(source);
    expect(sabotaged).not.toMatch(/<ReferralClaimBridge \/>/);
  });
});
