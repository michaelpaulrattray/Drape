/**
 * THE STAGE-3 GATE ROLL — his 553-character cyborg brief, re-rolled on his own
 * account with the brief-fidelity lane LIVE (founder order, verbatim: *"run the
 * cyborg re-roll on my account"*; relayed fable-1636).
 *
 * # The road, and why it is this road
 *
 * Copied clause for clause from `drive-production-sign-disposable.mts`, which
 * is the only PROVEN road from this machine to a real spend on the real
 * account. Both obvious alternatives are wrong and are wrong in ways that have
 * already cost this project something:
 *
 *   `railway run --service MySQL` injects DATABASE variables ONLY, so a roll
 *   driven in-process that way writes PRODUCTION rows while `R2_PUBLIC_URL`
 *   falls back to the LOCAL DEV BUCKET — production rows pointing at dev
 *   objects.
 *
 *   A locally-minted `app_session_id` does not authenticate against production;
 *   the secrets differ.
 *
 * So this runs INSIDE THE PRODUCTION SERVICE'S OWN CONTEXT and does nothing but
 * talk HTTPS to the real server:
 *
 *   railway.cmd run --service Drape -- npx tsx scripts/_drive-production-cyborg-roll-disposable.mts --dry
 *   railway.cmd run --service Drape -- npx tsx scripts/_drive-production-cyborg-roll-disposable.mts --go
 *
 * `JWT_SECRET` is production's, the token is minted in this process, never
 * printed and never persisted, and the SERVER does all the work — production
 * R2, production flags, production credits.
 *
 * # THE DRY TRANSPORT PROOF, before the first credit
 *
 * `--go` refuses to continue if it fails. Three readings: the session
 * authenticates at all; a candidate ONLY PRODUCTION HOLDS answers 200 to it
 * (the world proof, not merely an authentication proof); and a well-formed
 * publicId that is nobody's answers NOT_FOUND (the negative control, because an
 * endpoint that answers 200 to anything has told us nothing about the second).
 *
 * # Money
 *
 * ONE roll, 160 credits, his, on his word. `clientRequestId` is DERIVED from a
 * fixed tag rather than random, so a re-run REPLAYS the same intent and returns
 * the roll that already exists instead of buying a second sheet. On a paid road
 * that is the difference between a retry and a second purchase.
 *
 * # What this script does NOT do
 *
 * It dispatches and prints its receipt. Every fact about what the render then
 * did is read by the PROVEN MySQL road in its own command (fable-1065 §3):
 * teaching this script to poll rows over a second new path in the same sitting
 * is how one unproven transport becomes two.
 *
 * # The matched control that already exists
 *
 * ROLL 213 is the same 553-character brief on the same account, cast minutes
 * BEFORE the flag's redeploy — its compiled `characterNotes` is 178 characters
 * and stops mid-word ("…above right temple, fine"), which is the 180-character
 * guillotine caught in the act. So the before/after arm was bought by accident
 * and costs nothing; this roll is the after.
 */
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { teeTo } from "./lib/benchKit.mts";

const BASE = "https://drape-production-0232.up.railway.app";
/**
 * A candidate ONLY PRODUCTION HOLDS — the world proof.
 *
 * ⚠ NOT the sign drive's `82e23eae-…`: that face has been PURGED since, and it
 * answered NOT_FOUND on the first dry run — identically to the negative
 * control, which is the shape that proves nothing at all. The guard did its job
 * and refused before a credit moved. This one is a candidate of roll 213, cast
 * minutes ago, read off production and CONFIRMED ABSENT FROM DEV (0 rows) —
 * that absence is what makes it a world proof rather than an authentication
 * proof. It will age out the same way; re-pick it, do not relax the check.
 */
const TARGET = process.env.TARGET_PUBLIC_ID ?? "1a1c69e0-b327-415e-a88f-55ad8aafd8af";

const argv = process.argv.slice(2);
const GO = argv.includes("--go");
const say = teeTo(`output/cyborg-reroll/${GO ? "go" : "dry"}.txt`);

/** His own brief, verbatim — byte-identical to the budget court's `CYBORG`. */
const CYBORG =
  "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone structure: "
  + "pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense unsmiling expression. "
  + "Cybernetic augmentation as part of his body: matte-black implant ports embedded in his skull "
  + "above the right temple, fine metal seams running across his scalp like plate joins, a dark "
  + "mechanical plate along his jawline, a small black implant stud below each ear, and his right "
  + "eye glowing faint amber-red. The augmentations are surgically integrated into his skin, not worn.";

if (CYBORG.length !== 553) {
  throw new Error(`the brief is ${CYBORG.length} characters, not the 553 the order names`);
}

/* ------------------------------------------------------- the context gate -- */
const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
const openId = process.env.OPEN_ID ?? process.env.OWNER_OPEN_ID;

if (!secret) throw new Error("no JWT_SECRET — run under `railway.cmd run --service Drape`");
if (!appId) throw new Error("no VITE_APP_ID — verifySession rejects an empty appId");
if (!openId) throw new Error("no OPEN_ID — whose session would this be?");
if (appId !== "drape-production") {
  throw new Error(`appId is "${appId}" — this drive runs only in the production service context`);
}

const token = await new SignJWT({ openId, appId, name: "Cyborg Re-Roll" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("20m")
  .sign(new TextEncoder().encode(secret));
say(`session minted — ${token.length} characters, 20 minutes, this process only`);

const COOKIE = `app_session_id=${token}`;

/* --------------------------------------------------------------- the wire -- */
type Answer = { status: number; body: unknown; text: string };

async function query(path: string, input?: unknown): Promise<Answer> {
  const url = input === undefined
    ? `${BASE}/api/trpc/${path}`
    : `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(url, { headers: { cookie: COOKIE } });
  const text = await response.text();
  return { status: response.status, text, body: safely(text) };
}

async function mutate(path: string, input: unknown): Promise<Answer> {
  const response = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ json: input }),
  });
  const text = await response.text();
  return { status: response.status, text, body: safely(text) };
}

function safely(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

const resultOf = (a: Answer) =>
  (a.body as { result?: { data?: { json?: unknown } } } | null)?.result?.data?.json ?? null;
const errorOf = (a: Answer) =>
  (a.body as { error?: { json?: { message?: string; data?: { code?: string } } } } | null)?.error?.json ?? null;

/* ------------------------------------------------- THE DRY TRANSPORT PROOF -- */
let proven = true;
const prove = (ok: boolean, name: string, saw: string) => {
  if (!ok) proven = false;
  say(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

say(`\nDRY TRANSPORT PROOF — free, and nothing paid runs until it passes`);
say(`base ${BASE}`);

const me = await query("auth.me");
const meJson = resultOf(me) as { id?: number; name?: string; role?: string; approved?: boolean } | null;
prove(
  me.status === 200 && meJson !== null,
  "the session authenticates against the real server",
  meJson ? `${me.status} · id ${meJson.id} · ${meJson.name} · role ${meJson.role} · approved ${meJson.approved}` : `${me.status} · ${me.text.slice(0, 120)}`,
);

const owned = await query("castingV2.variants", { candidateId: TARGET });
prove(
  owned.status === 200 && resultOf(owned) !== null,
  "a candidate ONLY PRODUCTION HOLDS answers, owned by this session",
  owned.status === 200 ? `${owned.status} · owned` : `${owned.status} · ${errorOf(owned)?.data?.code ?? owned.text.slice(0, 120)}`,
);

const nowhere = await query("castingV2.variants", { candidateId: "00000000-0000-4000-8000-000000000000" });
prove(
  errorOf(nowhere)?.data?.code === "NOT_FOUND",
  "negative control — a face that exists nowhere is refused",
  `${nowhere.status} · ${errorOf(nowhere)?.data?.code ?? nowhere.text.slice(0, 120)}`,
);

if (!proven) {
  say(`\nTRANSPORT NOT PROVEN — nothing was spent, nothing was sent.`);
  process.exit(1);
}
say(`transport proven.`);

if (!GO) {
  say(`\n--dry: stopping here. Zero credits moved.`);
  say(`brief: ${CYBORG.length} chars, ${CYBORG.split(/\s+/).length} words — verbatim`);
  process.exit(0);
}

/* ----------------------------------------------------------- the paid step -- */
/** v4-shaped, derived from a fixed tag: a re-run replays rather than re-buys. */
function intentId(tag: string): string {
  const hex = createHash("sha256").update(`cyborg-reroll:${tag}`).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `8${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
}

say(`\nSESSION — free`);
/*
  ⚠ THE FIELD IS `sessionId`, NOT `publicId`. The first run read `publicId`,
  found undefined on a perfectly successful HTTP 200, and REFUSED — which is
  the behaviour worth keeping: a missing session id must stop the roll rather
  than travel as `undefined` into a paid mutation. Nothing was charged either
  time. `SESSION_ID` lets a re-run reuse a session already minted instead of
  leaving another empty one behind.
*/
const existing = process.env.SESSION_ID;
let sessionId: string;
if (existing) {
  sessionId = existing;
  say(`  session ${sessionId} (supplied — no new one minted)`);
} else {
  const session = await mutate("castingV2.createSession", { originType: "roster" });
  const sessionJson = resultOf(session) as { sessionId?: string } | null;
  if (!sessionJson?.sessionId) {
    say(`  FAILED — HTTP ${session.status} · ${session.text.slice(0, 400)}`);
    say(`\nNothing was charged: the roll was never sent.`);
    process.exit(1);
  }
  sessionId = sessionJson.sessionId;
  say(`  session ${sessionId}`);
}

const clientRequestId = intentId("stage3-gate");
say(`\nROLL — 160 credits, his`);
say(`  brief   ${CYBORG.length} chars, ${CYBORG.split(/\s+/).length} words, verbatim`);
say(`  path    (unsent — inside the flag the service applies its own default)`);
say(`  intent  ${clientRequestId} (derived — a re-run replays this intent)`);
const sent = Date.now();
const answer = await mutate("castingV2.createRoll", {
  clientRequestId,
  sessionId,
  briefText: CYBORG,
});
say(`  ${Math.round((Date.now() - sent) / 1000)}s · HTTP ${answer.status}`);
say(`  ${answer.text.slice(0, 3000)}`);
process.exit(0);
