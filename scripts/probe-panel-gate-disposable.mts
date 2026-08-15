/**
 * THE GATE, AT THE WIRE — does `facePanel` discriminate, or is it the flag?
 *
 * The screen arm (`drive-outsider-panel-default`) shows the outsider no panel.
 * On its own that is a green about the FLAG: dev defines neither
 * `CASTING_REFERENCE_LIBRARY_SCOPE` nor `CASTING_FACE_SCAN_SCOPE`, so every dev
 * account is outside them and "no panel" would be true of anybody.
 *
 * So this asks ONE server — started with `CASTING_REFERENCE_LIBRARY_SCOPE`
 * naming exactly one account — the same question as both accounts, in the same
 * minute. If the named one gets `enabled: true` and the outsider `false`, the
 * gate is doing the work. If both answer the same, the surface's darkness says
 * nothing about the gate and the screen arm is a green about configuration.
 *
 *   PORT=3010 CASTING_REFERENCE_LIBRARY_SCOPE=users:<id> ENABLE_STORAGE_CLEANUP_WORKER=true pnpm dev
 *   npx tsx scripts/probe-panel-gate-disposable.mts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:3010";
const conn = await openDatabase(process.env.DATABASE_URL);
const [bots] = await conn.execute(
  `SELECT u.id, c.publicId AS candidate FROM users u
     JOIN casting_candidates c ON c.userId = u.id AND c.status = 'ready'
    WHERE u.openId = 'verify-bot-local' ORDER BY c.id DESC LIMIT 1`);
const bot = (bots as Array<{ id: number; candidate: string }>)[0]!;
await conn.end();
const outsider = await ensureOutsider();

async function tokenFor(openId: string, name: string) {
  return new SignJWT({ openId, appId: process.env.VITE_APP_ID, name })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

async function panel(token: string, candidateId: string) {
  const url = `${BASE}/api/trpc/castingV2.facePanel?input=${encodeURIComponent(JSON.stringify({ json: { candidateId, variantId: null } }))}`;
  const res = await fetch(url, { headers: { cookie: `app_session_id=${token}` } });
  const body = await res.json() as any;
  return { status: res.status, data: body?.result?.data?.json ?? body };
}

const named = await panel(await tokenFor("verify-bot-local", "Verify Bot"), bot.candidate);
const outside = await panel(outsider.token, outsider.candidatePublicId!);

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};
console.log(`server ${BASE} · named user ${bot.id} · outsider ${outsider.id}\n`);
check(named.status === 200 && named.data?.enabled === true,
  "the NAMED account is inside the gate", `${named.status} enabled=${JSON.stringify(named.data?.enabled)}`);
check(outside.status === 200 && outside.data?.enabled === false,
  "the OUTSIDER is not", `${outside.status} enabled=${JSON.stringify(outside.data?.enabled)}`);
check(Array.isArray(outside.data?.groups) && outside.data.groups.length === 0,
  "and gets nothing to render rather than an empty shell",
  `groups=${JSON.stringify(outside.data?.groups)} scanning=${JSON.stringify(outside.data?.scanning)}`);
console.log(failed === 0 ? "\nthe gate discriminates" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
