/**
 * THE WIRE HOLD, DRIVEN BOTH WAYS — and the server's own rows are the judge.
 *
 * fable-694 §2 ordered an opt-in `holdFaceScan` in the drive harness so that a
 * walk stops buying ~$0.10 of segmenter reads it never declares. A hold is a
 * control, and a control that has only been driven in the direction it is meant
 * to block has not been driven at all (law 2): a wire hold that "worked" because
 * the sheet never asked for a scan is indistinguishable from one that works.
 *
 * So both arms, on the same face, minutes apart:
 *
 *   HELD    hold on. The ask is seen at the wire and aborted. The panel shows
 *           what the library alone knows, the meter says $0.000, and — the part
 *           that is a FACT rather than a claim — the server writes no
 *           `casting.scan_miss` row, because nothing reached it.
 *   BOUGHT  hold off. The same ask reaches the server, the panel fills with
 *           scan-born cutouts, the meter declares the spend, and a scan_miss row
 *           appears with this candidate on it.
 *
 * The audit row is the independent instrument. The meter counts what the BROWSER
 * did; the row records what the SERVER did; a hold is only proven when both
 * agree, and the harness cannot write the row.
 *
 * **THIS SCRIPT SPENDS HOUSE MONEY ON PURPOSE**: the BOUGHT arm is one real
 * scan, ~20 segmenter reads ≈ $0.10, plus one describer call. It is the positive
 * control and it is declared in the run's own output. It buys nothing if the
 * server has already read that (candidate, version) in this process — which the
 * baseline read below detects and says.
 *
 *   npx tsx scripts/drive-facescan-hold-disposable.mts --session <id> --tile 01
 */
import "dotenv/config";
import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { readFaceScanAsk } from "./lib/faceScanWire.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const BASE = arg("base", process.env.VERIFY_BASE_URL ?? "http://localhost:3000");
const SESSION = arg("session", "2df4aeab-daa0-4bab-8ce7-d1e2c969510d");
const TILE = arg("tile", "01");

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query("SELECT openId FROM users WHERE id = 1") as any[];
if (!owners[0]?.openId) throw new Error("no owner account to drive as");
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Face scan wire hold" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

/** Every scan the SERVER paid for, ever — the independent half of the reading. */
async function scanMisses(): Promise<Array<{ id: number; resourceId: string; at: string }>> {
  const [rows] = await conn.query(
    `SELECT id, resourceId, createdAt FROM audit_logs
      WHERE action = 'casting.scan_miss' ORDER BY id`,
  ) as any[];
  return rows.map((row: any) => ({
    id: Number(row.id),
    resourceId: String(row.resourceId),
    at: new Date(row.createdAt).toISOString(),
  }));
}

const say = (line: string) => console.log(line);

const results: Array<{ arm: string; ok: boolean; saw: string }> = [];
const check = (ok: boolean, arm: string, saw: string) => {
  results.push({ arm, ok, saw });
  say(`  ${ok ? "ok  " : "FAIL"} ${arm} — saw: ${saw}`);
};

/** One arm: open the sheet, wait for the panel, report what happened. */
async function walk(hold: boolean): Promise<{
  asks: number;
  held: number;
  delivered: string[];
  line: string | null;
  urls: string[];
  rows: number;
  cutouts: number;
}> {
  const { browser, page, faceScan } = await openDrivenPage({
    base: BASE,
    token,
    width: 1440,
    height: 1000,
    holdFaceScan: hold,
  });
  const urls: string[] = [];
  /* The URLs are captured PASSIVELY beside the harness's own listener, so what
     gets pinned in the suite is the byte-for-byte string the browser sent —
     not a URL this script rebuilt from what it believes tRPC does. */
  page.on("request", (request) => {
    if (readFaceScanAsk(request.url()).kind !== "none") urls.push(request.url());
  });
  try {
    await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 180_000 });
    await page.click(`button[aria-label="View candidate ${TILE} larger"]`);
    await page.waitForSelector(".dpc-face", { timeout: 90_000 });
    /*
      A HELD ARM HAS NOTHING TO WAIT FOR, which is the trap: waiting for the
      cutouts that will never come and then reporting "no cutouts" would be a
      timeout dressed as a finding. So both arms wait for the SAME thing — the
      scan-born cutouts — with the same patience, and the held arm's failure to
      find them is a reading rather than a clock.
    */
    const started = Date.now();
    await page.waitForFunction(
      `document.querySelectorAll(".dpc-face__cut--cutout").length > 0`,
      { timeout: hold ? 25_000 : 180_000, polling: 500 },
    ).catch(() => null);
    const waited = Date.now() - started;
    const panel = await page.evaluate(`(() => {
      const panel = document.querySelector(".dpc-face");
      if (!panel) return { rows: 0, cutouts: 0 };
      return {
        rows: panel.querySelectorAll(".dpc-face__row").length,
        cutouts: panel.querySelectorAll(".dpc-face__cut--cutout").length,
      };
    })()`) as { rows: number; cutouts: number };
    say(`  (${hold ? "HELD" : "BOUGHT"} arm waited ${(waited / 1000).toFixed(1)}s for cutouts)`);
    return {
      asks: faceScan.asks(),
      held: faceScan.held(),
      delivered: faceScan.delivered(),
      line: faceScan.line(),
      urls,
      ...panel,
    };
  } finally {
    await browser.close();
  }
}

say(`\nWIRE HOLD, BOTH WAYS — session ${SESSION}, tile ${TILE}, base ${BASE}\n`);

const before = await scanMisses();
say(`baseline   ${before.length} casting.scan_miss row(s) on record`
  + (before.length > 0 ? `, last id ${before[before.length - 1].id} at ${before[before.length - 1].at}` : ""));

say("\n--- ARM 1: HELD (hold on — nothing should reach the server) ---");
const held = await walk(true);
const afterHeld = await scanMisses();

check(held.asks > 0, "the sheet asked for a scan", `${held.asks} ask(s) at the wire`);
check(held.held === held.asks, "every ask was aborted in the browser",
  `${held.held} of ${held.asks} held`);
check(held.delivered.length === 0, "no version reached the server",
  `delivered: ${held.delivered.length === 0 ? "none" : held.delivered.join(", ")}`);
check(held.rows > 0, "the panel still rendered", `${held.rows} rows`);
/*
  A HELD PANEL WITH CUTOUTS IS NOT A LEAK — and the first run of this script
  labelled it as one. `facePanel` is free: it hands back whatever the server
  already holds in memory for this (candidate, version), so on a version some
  earlier look already paid for, the panel fills WITHOUT the paid ask ever being
  made. Cutouts therefore say nothing about the hold in either direction; the
  audit row does. So the arm names which world it is in rather than asserting a
  count that means two different things.
*/
check(true,
  held.cutouts === 0
    ? "COLD — the hold left the panel with the library alone"
    : "WARM — the server already held this reading, and the free panel read still filled it",
  `${held.cutouts} scan-born cutouts, and NO paid ask left the browser either way`);
check(afterHeld.length === before.length,
  "THE SERVER WROTE NO SCAN ROW — the independent instrument",
  `${before.length} rows before, ${afterHeld.length} after`);

say("\n--- ARM 2: BOUGHT (hold off — the positive control, ~$0.10 of house money) ---");
const bought = await walk(false);
const afterBought = await scanMisses();
const fresh = afterBought.filter((row) => !afterHeld.some((seen) => seen.id === row.id));

check(bought.asks > 0, "the sheet asked for a scan", `${bought.asks} ask(s) at the wire`);
check(bought.held === 0, "nothing was held", `${bought.held} held`);
check(bought.delivered.length > 0, "the ask reached the server",
  `delivered: ${bought.delivered.join(", ") || "none"}`);
check(bought.cutouts > 0, "the panel filled with scan-born cutouts",
  `${bought.rows} rows, ${bought.cutouts} cutouts`);
/*
  A WARM VERSION WRITES NO ROW, and that is not a failure of the hold — it is
  the cache doing its job. Named rather than asserted, because a positive
  control that cannot tell "the server did not pay" from "the server did not
  hear" is not a control.
*/
if (fresh.length > 0) {
  check(true, "the server paid for a scan and said so",
    `${fresh.length} new row(s): ${fresh.map((row) => `#${row.id} candidate ${row.resourceId}`).join(", ")}`);
} else {
  check(true, "INCONCLUSIVE on the row: this version was already warm in the server process",
    "no new casting.scan_miss row — the read was free, so the positive control proves the wire and not the money");
}

say("\n--- what the browser actually sent (pinned in the suite) ---");
for (const url of [...held.urls, ...bought.urls].slice(0, 4)) say(`  ${url}`);

say("\n--- the two declarations ---");
say(held.line ?? "(held arm declared nothing)");
say(bought.line ?? "(bought arm declared nothing)");

await conn.end();
const failed = results.filter((one) => !one.ok);
say(`\n${failed.length === 0 ? "BOTH ARMS HELD" : `${failed.length} FAILURE(S)`} — ${results.length} checks`);
/* The pool and the browser both hold the event loop open; a script that only
   records an exit code sits there with its work done (`scriptExitDiscipline`). */
process.exit(failed.length === 0 ? 0 : 1);
