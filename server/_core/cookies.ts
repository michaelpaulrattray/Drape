import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  return {
    httpOnly: true,
    path: "/",
    /*
      ⚠ `lax` EVERYWHERE, AND `none` ON HTTPS WAS THE DEFECT — #1653, found by
      the founder's engineering agent in the monthly audit.

      `SameSite=None` tells the browser to attach this cookie to requests made
      BY OTHER SITES. So a signed-in customer visiting any page an attacker
      controlled was one POST away from `billing.cancelSubscription`,
      `billing.createPortalSession` or `auth.logout` being carried out in her
      name: all three take no input, so the forged request needs no body — and
      a POST with no body and no `Content-Type` is a CORS *simple* request,
      which means there is no preflight to fail. The attacker cannot read the
      answer; the side effect is the attack.

      **Nothing in the tree ever needed `None`.** Every road that returns a
      customer to us is a TOP-LEVEL GET — the Google OAuth callback, the Stripe
      checkout return (`appBaseUrl()` + `/app`), the email-verification link —
      and `Lax` sends the cookie on exactly those. It withholds it on a
      cross-site POST and on a subresource load, which is the whole repair.
      `secure` is untouched and still follows the scheme.

      ⚠ **THE COOKIE FIX ALONE DOES NOT COVER THE SESSIONS THAT ALREADY
      EXIST**, which is why `server/security/crossSiteGuard.ts` ships in the
      same change rather than later: a browser keeps a cookie's `SameSite` as
      it was written until something re-issues it, so every customer signed in
      before this deploy carries `None` for the rest of her session. The guard
      refuses the forged request regardless of what her jar says.

      The `lax`-on-localhost half is unchanged and still load-bearing:
      `none` requires `Secure`, which a browser will not accept over plain
      HTTP, so a dev login would silently never set a cookie at all —
      CLAUDE.md's Manus-legacy gotcha. It is now the only value rather than
      one branch of two.
    */
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
