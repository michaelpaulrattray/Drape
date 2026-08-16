/**
 * THE EATEN CLICK — the founder's own diagnosis, instrumented (fable-722).
 *
 * > *"it will be selected on one and you wont be able to click the next version
 * > — youll have to click like 5-10 times or click another version and then it
 * > works… but the image always changes with the version selected. i think its
 * > because it waits for the features to catch up before it allows you to
 * > select another thumbnail."*
 *
 * The image is always RIGHT. What is wrong is that a click on a particular next
 * thumbnail does not register, repeatedly, while a different thumbnail works
 * first try.
 *
 * # Why the burst sampler cannot see this, and this driver can
 *
 * `drive-burst-clicks-disposable.mts` clicks with `element.click()` from inside
 * the page. That dispatches an event straight at the node: it cannot miss, it
 * cannot be covered, and it cannot be eaten by the element being replaced
 * between the press and the release. **A programmatic click proves the handler
 * works; it says nothing about whether a person can reach it.** So this driver
 * uses REAL mouse input at measured coordinates — hit-tested by the browser,
 * exactly as his hand is.
 *
 * # The three failures it can tell apart
 *
 *   NO PRESS       the pointer went down and nothing on the chip heard it —
 *                  covered, moved, or `pointer-events: none`
 *   EATEN          the press landed and no CLICK followed — the node was
 *                  replaced between down and up, which is the signature that
 *                  fits "5-10 times, or click another one and then it works"
 *   IGNORED        the click fired, the handler ran, and the selection did not
 *                  move — his gate theory, and the one that would be contrary
 *                  to a standing ruling (clicks are never gated, fable-686 §2b)
 *
 * Driven under Fast 3G, in the window his theory names: each attempt is made
 * while the previous selection's panel work is still landing.
 *
 * It spends nothing: no render, no credits. The panel scan is held where it
 * rides a scan-only batch and declared where it does not.
 *
 *   npx tsx scripts/drive-eaten-clicks-disposable.mts [--no-throttle]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";
import type { Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/eaten-clicks");
const THROTTLE = !process.argv.includes("--no-throttle");
/**
 * THE POSITIVE CONTROL (`--sabotage`).
 *
 * A clean null here means "nothing was eaten" only if this driver CAN see an
 * eaten click. So the control manufactures one: a `pointerdown` listener
 * replaces the chip node with a copy of itself, exactly as a re-render between
 * the press and the release would, and the release then lands on a node that
 * never saw the press — no click event, which is the DOM-swap signature. If the
 * EATEN arm does not go red under this, the green run above says nothing.
 */
const SABOTAGE = process.argv.includes("--sabotage");
/** How many version-to-version moves to attempt. */
const MOVES = Number(process.env.MOVES ?? 8);
/** How long one attempt is given before it is called a failure and repeated. */
const ATTEMPT_MS = Number(process.env.ATTEMPT_MS ?? 2_500);
/** His own figure — past this many tries the product is broken, not slow. */
const MAX_TRIES = 10;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<Array<{ openId: string; session: string; position: number; versions: number }>>(
  `SELECT u.openId AS openId, s.publicId AS session, c.position AS position, COUNT(v.id) AS versions
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
     JOIN casting_candidate_variants v ON v.candidateId = c.id AND v.status = 'ready'
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    GROUP BY c.id HAVING versions >= 3 ORDER BY c.id DESC LIMIT 1`,
);
await conn.end();
if (rows.length === 0) throw new Error("no fixture cast with three delivered versions to click between");
const { openId, session, position, versions } = rows[0]!;
const tile = String(position + 1).padStart(2, "0");

const token = await new SignJWT({ openId, appId, name: "Eaten clicks" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page, faceScan } = await openDrivenPage({
  base: BASE, token, width: 1440, height: 1000, holdFaceScan: true,
});

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};

type Attempt = {
  move: number;
  try: number;
  target: string | null;
  /** What the browser heard, in order: the press, then the click, if any. */
  press: boolean;
  click: boolean;
  /** Did the selection actually move to the target? */
  selected: boolean;
  /** Was the panel still catching up when this was attempted (his theory)? */
  panelWorking: boolean;
  ms: number;
};
const attempts: Attempt[] = [];

try {
  if (THROTTLE) {
    const client = await page.createCDPSession();
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }

  /*
    WHAT THE BROWSER HEARD — recorded from OUT HERE, so the product carries no
    probe. Capture phase on the document, so a handler that stops propagation
    cannot hide the event from this reading.
  */
  await page.evaluateOnNewDocument(`(() => {
    window.__heard = [];
    const label = (target) => {
      const chip = target && target.closest ? target.closest(".dpc-refine__pick") : null;
      return chip ? (chip.querySelector("span")?.textContent?.trim() ?? "(no label)") : null;
    };
    for (const kind of ["pointerdown", "click"]) {
      document.addEventListener(kind, (event) => {
        window.__heard.push({ kind, at: Math.round(performance.now()), label: label(event.target) });
      }, true);
    }
    /*
      AND WHETHER THE RAIL ITSELF MOVES while the panel lands (fable-722 (b)).

      A person aims at a thumbnail and presses a moment later. If the chip has
      travelled in between — the panel's rows arriving and resizing the columns
      — the press lands somewhere else, and to them that is a click that did
      nothing. Recorded as the rail's own top-left over time, so the claim is a
      distance rather than an impression.
    */
    window.__railBoxes = [];
    setInterval(() => {
      const rail = document.querySelector(".dpc-refine__stack");
      if (!rail) return;
      const box = rail.getBoundingClientRect();
      window.__railBoxes.push({
        at: Math.round(performance.now()),
        x: Math.round(box.left), y: Math.round(box.top),
        w: Math.round(box.width), h: Math.round(box.height),
      });
    }, 100);
  })()`);

  if (SABOTAGE) {
    /* The manufactured eaten click — see `SABOTAGE`. Installed on the page, in
       the same capture phase, so the swap happens before the release. */
    await page.evaluateOnNewDocument(`(() => {
      document.addEventListener("pointerdown", (event) => {
        const chip = event.target && event.target.closest
          ? event.target.closest(".dpc-refine__pick")
          : null;
        if (chip && chip.parentNode) chip.parentNode.replaceChild(chip.cloneNode(true), chip);
      }, true);
    })()`);
    console.log("SABOTAGE: every press replaces its chip — the EATEN arm must go red\n");
  }

  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 240_000 });
  console.log(`${versions} delivered versions on this face — the rail is the target\n`);

  const heardSince = async (from: number) => (await page.evaluate(
    `(window.__heard ?? []).filter((one) => one.at >= ${from})`,
  )) as Array<{ kind: string; at: number; label: string | null }>;
  const now = async () => (await page.evaluate("Math.round(performance.now())")) as number;

  const railState = async () => (await page.evaluate(`(() => {
    const picks = Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
      .filter((pick) => pick.tagName === "BUTTON");
    return {
      labels: picks.map((pick) => pick.querySelector("span")?.textContent?.trim() ?? null),
      lit: picks.findIndex((pick) => pick.getAttribute("aria-pressed") === "true"),
      /* His theory's own window: the panel beside the picture still catching
         up with the version that was just selected. */
      panelWorking: Boolean(document.querySelector(".dpc-face__working"))
        || Boolean(document.querySelector(".dpc-face__scanning")),
    };
  })()`)) as { labels: Array<string | null>; lit: number; panelWorking: boolean };

  for (let move = 1; move <= MOVES; move += 1) {
    const before = await railState();
    /* The NEXT version along, wrapping — "the next thumbnail", his words. */
    const target = (before.lit + 1) % before.labels.length;
    const label = before.labels[target] ?? null;

    let landed = false;
    for (let attempt = 1; attempt <= MAX_TRIES && !landed; attempt += 1) {
      const picks = await page.$$(".dpc-refine__stack .dpc-refine__pick");
      const element = picks[target];
      if (!element) break;
      const box = await element.boundingBox();
      if (!box) break;
      /* Scrolled out of the rail's own overflow is not an eaten click — it is a
         chip nobody could have clicked, and it is skipped rather than counted. */
      const state = await railState();
      const startedAt = await now();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      let selected = false;
      const until = Date.now() + ATTEMPT_MS;
      while (Date.now() < until) {
        const at = await railState();
        if (at.lit === target) { selected = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const heard = await heardSince(startedAt);
      const onTarget = heard.filter((one) => one.label === label);
      attempts.push({
        move,
        try: attempt,
        target: label,
        press: onTarget.some((one) => one.kind === "pointerdown"),
        click: onTarget.some((one) => one.kind === "click"),
        selected,
        panelWorking: state.panelWorking,
        ms: Date.now() - (until - ATTEMPT_MS),
      });
      landed = selected;
    }
    const tries = attempts.filter((one) => one.move === move).length;
    console.log(`move ${move}: "${label}" — ${landed ? `selected after ${tries} click(s)` : `NEVER selected in ${tries}`}`
      + `${attempts.find((one) => one.move === move)?.panelWorking ? " (panel catching up)" : ""}`);
  }

  const total = attempts.length;
  const noPress = attempts.filter((one) => !one.press);
  const eaten = attempts.filter((one) => one.press && !one.click);
  const ignored = attempts.filter((one) => one.click && !one.selected);
  const firstTry = new Set(attempts.filter((one) => one.try === 1 && one.selected).map((one) => one.move));
  const moves = new Set(attempts.map((one) => one.move));

  console.log("");
  check(noPress.length === 0, "every click reached a chip",
    `${noPress.length} of ${total} clicks were not heard at all`);
  check(eaten.length === 0, "no click was EATEN between the press and the release",
    `${eaten.length} of ${total} presses produced no click event`);
  check(ignored.length === 0, "no click fired and left the selection where it was",
    `${ignored.length} of ${total} clicks moved nothing`);
  check(firstTry.size === moves.size, "every version selected on the FIRST click",
    `${firstTry.size} of ${moves.size} moves landed first try`);

  /*
    HOW FAR THE RAIL TRAVELLED WHILE THIS RAN — the aim-and-it-moved half.

    Reported rather than asserted on: a rail that shifts is a mechanism for his
    report, and a rail that does not shift RULES THAT MECHANISM OUT, which is
    worth as much. The figure is the largest displacement between any two
    consecutive readings, so a slow drift and one jump are told apart by the
    trace beside it.
  */
  const boxes = await page.evaluate("window.__railBoxes ?? []") as Array<
    { at: number; x: number; y: number; w: number; h: number }
  >;
  let worst = 0;
  let worstAt = 0;
  for (let at = 1; at < boxes.length; at += 1) {
    const jump = Math.max(
      Math.abs(boxes[at]!.x - boxes[at - 1]!.x),
      Math.abs(boxes[at]!.y - boxes[at - 1]!.y),
    );
    if (jump > worst) { worst = jump; worstAt = boxes[at]!.at; }
  }
  console.log(`rail displacement: worst single jump ${worst}px at ${worstAt}ms`
    + ` over ${boxes.length} readings`);
  await writeFile(path.join(OUT, "rail-boxes.json"), `${JSON.stringify(boxes, null, 2)}\n`);

  await writeFile(path.join(OUT, "attempts.json"), `${JSON.stringify(attempts, null, 2)}\n`);
  await page.screenshot({ path: path.join(OUT, "at-rest.png") });
} finally {
  console.log(faceScan.line() ?? "");
  await browser.close();
}

console.log(failed === 0 ? "\nall arms passed" : `\n${failed} arm(s) failed`);
process.exit(failed === 0 ? 0 : 1);
