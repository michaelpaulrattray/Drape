/**
 * Mint a production session cookie for the self-dogfood walk (D-174).
 *
 * # The ceremony, and why it looks like the migration one
 *
 * Driving the real product means holding a real session, and a session is
 * signed with `JWT_SECRET` — a production secret. So this follows the 0018
 * migration discipline exactly: **the secret only ever lives inside one
 * command's environment, never in a file, never printed.** This script reads it
 * from its own env, signs, and writes ONLY the token.
 *
 * The token is short-lived on purpose. A dogfood walk takes minutes; a cookie
 * that outlives the session it was minted for is a credential lying around.
 *
 *   JWT_SECRET="$(railway.cmd variables --service Drape --kv | …)" \
 *   APP_ID=drape-production OPEN_ID=<founder> npx tsx scripts/mint-production-session.mts
 *
 * Never echo the command that populates JWT_SECRET.
 */
import { SignJWT } from "jose";

const secret = process.env.JWT_SECRET;
const appId = process.env.APP_ID;
const openId = process.env.OPEN_ID;

if (!secret) throw new Error("JWT_SECRET not present in this command's environment");
if (!appId) throw new Error("APP_ID not set — verifySession rejects an empty appId");
if (!openId) throw new Error("OPEN_ID not set — whose session is this?");

const token = await new SignJWT({ openId, appId, name: "Dogfood Walk" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  /*
    Minutes, not hours. Long enough for a walk, short enough that a leaked
    cookie is worthless by the time anyone finds it.

    `TTL` exists because 30m stopped being "long enough for a walk": the landing
    cap is eight minutes a step and there are five steps, so a legitimately slow
    run can outlive its own session and die looking exactly like a product
    failure. Raising the default instead would spend the safety margin on every
    caller to fix one; the caller that needs longer asks for longer, and says so
    in the command that mints it.
  */
  .setExpirationTime(process.env.TTL || "30m")
  .sign(new TextEncoder().encode(secret));

console.log(token);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
