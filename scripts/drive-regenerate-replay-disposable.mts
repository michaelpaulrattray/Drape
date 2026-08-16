/**
 * REGENERATE, READ AT THE WIRE — the founder's two reports from one evening
 * (fable-703, fable-704), looked at in the running app.
 *
 * > *"her right eye — fiery red"* → Regenerate → *"That names one side of a
 * > pair, and pointing at it is how I can work on just that one…"*
 *
 * and, on the same button:
 *
 * > *"it just stayed the same"* — the version's own rail thumbnail, during an
 * > in-place re-roll of it.
 *
 * # What this drive proves, and what it does not
 *
 * It proves the half a unit test cannot: that the record on the row reaches the
 * BUTTON, and that clicking it puts the rectangle on the outgoing request. The
 * other half — that the service writes the record in the first place — is
 * proven on the service with its own sabotage control, because a browser cannot
 * see a database column.
 *
 * **THE ASSERTION IS ON THE REQUEST BODY, NOT ON THE OUTCOME.** The request is
 * aborted in the browser the instant it has been read, so nothing reaches the
 * server, nothing is claimed and nothing is charged. That is not a shortcut: a
 * request carrying the right scope is the whole fix, and letting it through
 * would buy a render to learn something the body already said.
 *
 * # What it spends, declared
 *
 *   credits   ZERO — the one mutation is aborted at the wire, unsent, so no
 *                    operation is claimed and no charge is made
 *   fal       ≤ $0.200 of HOUSE money — one panel scan per arm. The hold this
 *                    drive installs aborts a scan-only batch, and on this sheet
 *                    the scan rides a batch with `facePanel` and
 *                    `segmentsOnFace`: aborting it would abort the panel the
 *                    rail is drawn beside. The meter says so on every run and
 *                    the check is recorded as NOT APPLICABLE rather than passed.
 *
 *   npx tsx scripts/seed-regenerate-fixture-disposable.mts
 *   npx tsx scripts/drive-regenerate-replay-disposable.mts
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";
import type { Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { createChecks, openDrivenPage } from "./lib/drivePage.mts";
import { readFaceScanAsk } from "./lib/faceScanWire.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const SESSION = "0b17d084-ad91-4b4f-955c-45e21703fe05";
const OUT = path.resolve("output/regenerate-replay");
/** Position 3 of the fixture sheet — the tile the seed writes onto. */
const TILE = "04";
const MARK = "regenerate-fixture";
const SCOPE = "eye@right";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query<any[]>("SELECT openId FROM users WHERE id = 1");
if (!owners[0]?.openId) throw new Error("no owner account to drive as");
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Regenerate replay evidence" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));
await conn.end();

await mkdir(OUT, { recursive: true });
const { check, absent, failures, print, records } = createChecks();

function seed(pending: boolean): void {
  const args = ["tsx", "scripts/seed-regenerate-fixture-disposable.mts"];
  if (pending) args.push("--pending");
  const run = spawnSync("npx", args, { stdio: "pipe", encoding: "utf8", shell: true });
  if (run.status !== 0) throw new Error(`seeding failed: ${run.stderr ?? ""}`);
}

/**
 * INTERCEPTION IS THE INSTRUMENT HERE, so this drive installs its own rather
 * than taking `openDrivenPage`'s hold: that handler continues every request it
 * does not hold, which would resolve the refine POST before this one saw it.
 *
 * It does the same two jobs: hold the face scan (a scan-only batch is aborted,
 * so nothing is bought to look at a rail), and, when asked, read and stop the
 * one refine POST.
 */
async function intercept(page: Page, sent: Array<{ url: string; body: string }> | null): Promise<void> {
  await page.setRequestInterception(true);
  /* Interception turns the page cache off as a side effect, and the rail is
     drawing pictures. Put it back. */
  await page.setCacheEnabled(true);
  page.on("request", (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = request.url();
    if (sent && url.includes("castingV2.refine") && request.method() === "POST") {
      sent.push({ url, body: request.postData() ?? "" });
      /* Read and stopped. Nothing reaches the server, so nothing is claimed and
         nothing is charged — see the header. */
      void request.abort("blockedbyclient").catch(() => {});
      return;
    }
    /* Only a batch that is NOTHING BUT scans may be aborted, or the photograph
       beside it goes with it. */
    if (readFaceScanAsk(url, request.postData() ?? null).kind === "scanOnly") {
      void request.abort("blockedbyclient").catch(() => {});
      return;
    }
    void request.continue().catch(() => {});
  });
}

async function openTile(page: Page): Promise<void> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
  const selector = `button[aria-label="View candidate ${TILE} larger"]`;
  await page.waitForSelector(selector, { timeout: 180_000 });
  await page.click(selector);
  /* Wait on the THING, never on the clock — and the thing is the rail, which
     cannot draw until the variants read has answered. Waiting on the panel
     alone photographed an empty stack and failed five laws for it. */
  await page.waitForSelector(".dpc-refine", { timeout: 120_000 });
  await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 120_000 });
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function shot(page: Page, name: string): Promise<void> {
  await writeFile(path.join(OUT, `${name}.png`), await page.screenshot({ type: "png" }) as Buffer);
}

async function shotOf(page: Page, selector: string, name: string): Promise<boolean> {
  const element = await page.$(selector);
  if (!element) return false;
  await writeFile(path.join(OUT, `${name}.png`), await element.screenshot({ type: "png" }) as Buffer);
  return true;
}

/* ------------------------------------------------------------------ ARM ONE
   The request the button sends. */

console.log("\nARM: the outgoing request");
seed(false);

{
  const { browser, page, faceScan } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  try {
    /*
      OUR OWN INTERCEPTION, and it is the instrument. `holdFaceScan` is left off
      deliberately: its handler continues every request it does not hold, which
      would resolve the refine POST before this one ever saw it.
    */
    const sent: Array<{ url: string; body: string }> = [];
    await intercept(page, sent);

    await openTile(page);

    const button = await page.$('button[title^="A fresh take of"]');
    check(Boolean(button), "the version offers a fresh take of itself",
      button ? "the Regenerate button is on the dock" : "no Regenerate button on the panel");
    await shot(page, "01-panel-before-click");

    if (button) {
      await button.click();
      /* Wait on the request rather than on a delay — an assertion about a body
         that never arrived must fail as "never armed", not as "wrong". */
      const until = Date.now() + 20_000;
      while (sent.length === 0 && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const body = sent.at(-1)?.body ?? "";
    if (!check(sent.length > 0, "clicking Regenerate sends a refine request",
      sent.length > 0 ? `${sent.length} refine POST(s) intercepted` : "no refine request in 20s")) {
      /* Nothing below can mean anything without a body. */
    } else {
      /* A tRPC batch: `{"0":{"json":{…}}}`. The envelope is unwrapped rather
         than assumed away — reading one layer too few reported `scope = null`
         on a body that plainly carried it. */
      const parsed = JSON.parse(body) as Record<string, { json?: Record<string, unknown> }>;
      const ask = (Object.values(parsed)[0]?.json ?? {}) as {
        instruction?: string; scope?: string; replayOf?: string;
      };
      console.log(`  body: ${body}`);
      check(ask.scope === SCOPE, "the request carries the rectangle the version was pointed at",
        `scope = ${JSON.stringify(ask.scope ?? null)} (want ${SCOPE})`);
      check((ask.instruction ?? "").includes("her right eye"), "and her own words with it",
        `instruction = ${JSON.stringify(ask.instruction ?? null)}`);
      /*
        AND WHICH VERSION IT IS A FRESH TAKE OF (fable-733 §2) — read at the
        wire, because a marker the server never receives is the already-has
        door firing again. The service proves the id against its own row; what
        a browser can settle is that the field LEAVES, and that is the half a
        unit test cannot see.
      */
      check(
        typeof ask.replayOf === "string" && ask.replayOf.length > 0,
        "and the replay marker that stops the already-has door refusing it",
        `replayOf = ${JSON.stringify(ask.replayOf ?? null)}`,
      );
    }

    /*
      WHAT THIS READING COST THE HOUSE, DECLARED RATHER THAN CLAIMED AWAY.

      The panel's scan rides a batch with `facePanel` and `segmentsOnFace`, so
      holding it would abort the panel the rail is drawn beside. It is recorded,
      not passed: an unheld scan is real money and a walk that scored itself
      free would be reporting the hold it wished it had.
    */
    if (faceScan.asks() === 0) {
      check(true, "no face scan was bought for this reading", "0 scan asks at the wire");
    } else {
      absent("no face scan was bought for this reading",
        `${faceScan.asks()} scan ask(s) rode a mixed batch and were let through — ≤ $0.100 each, house money`);
    }
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ ARM TWO
   What the rail says while a fresh take is in flight. */

console.log("\nARM: the version being redrawn");
seed(true);

{
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  try {
    await intercept(page, null);
    await openTile(page);

    const rail = await page.evaluate(`(() => {
      const chips = Array.from(document.querySelectorAll(".dpc-refine__pick"));
      const ghosts = chips.filter((chip) => chip.classList.contains("dpc-refine__pick--ghost"));
      const redrawing = chips.filter((chip) => chip.querySelector(".dpc-refine__ghostSpin--onChip"));
      const ring = redrawing[0] ? redrawing[0].querySelector(".dpc-refine__ghostSpin--onChip") : null;
      const picture = redrawing[0] ? redrawing[0].querySelector("img") : null;
      const ringBox = ring ? ring.getBoundingClientRect() : null;
      const pictureBox = picture ? picture.getBoundingClientRect() : null;
      return {
        chips: chips.length,
        ghosts: ghosts.length,
        redrawing: redrawing.length,
        busy: redrawing[0] ? redrawing[0].getAttribute("aria-busy") : null,
        /* The ring's centre against the picture's centre — "centered" is a
           measurement here, not an impression. */
        offset: ringBox && pictureBox
          ? {
            x: Math.round((ringBox.left + ringBox.width / 2) - (pictureBox.left + pictureBox.width / 2)),
            y: Math.round((ringBox.top + ringBox.height / 2) - (pictureBox.top + pictureBox.height / 2)),
          }
          : null,
        /* Every word printed inside a ghost chip. The founder's ruling is that
           there are none. */
        ghostWords: ghosts.map((chip) => (chip.textContent || "").trim()).filter(Boolean),
        theme: document.documentElement.dataset.theme || null,
      };
    })()`) as {
      chips: number; ghosts: number; redrawing: number; busy: string | null;
      offset: { x: number; y: number } | null; ghostWords: string[]; theme: string | null;
    };
    console.log(`  rail: ${JSON.stringify(rail)}`);

    check(rail.redrawing === 1, "the version being redrawn wears the ring (fable-703)",
      `${rail.redrawing} chip(s) carrying the on-chip ring`);
    check(rail.busy === "true", "and says so to a reader that cannot see a ring",
      `aria-busy = ${JSON.stringify(rail.busy)}`);
    check(rail.ghosts === 0, "and no ghost chip stands in for a version that is not coming",
      `${rail.ghosts} ghost chip(s)`);
    check(rail.ghostWords.length === 0, "no words on a pending chip (fable-702)",
      rail.ghostWords.length === 0 ? "none" : rail.ghostWords.join(" | "));
    check(
      Boolean(rail.offset) && Math.abs(rail.offset!.x) <= 1 && Math.abs(rail.offset!.y) <= 1,
      "the ring is centred on the picture rather than hanging off it",
      `offset ${JSON.stringify(rail.offset)}`,
    );

    await shot(page, "02-rail-redrawing");
    await shotOf(page, ".dpc-refine__stack", "03-rail-closeup");
    /*
      AND THE CHIP ITSELF, BIG ENOUGH TO JUDGE (law 6).

      A 14px arc on a 64px chip is four pixels in a page screenshot, which is
      not a thing anyone can look at and say whether it reads as working. The
      founder ruled this treatment; he is owed a picture of it, not a
      measurement of it.
    */
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 4 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await shotOf(page, ".dpc-refine__pick[aria-busy='true']", "04-chip-redrawing-4x");
  } finally {
    await browser.close();
  }
}

/* ---------------------------------------------------------------- ARM THREE
   What the rail says in the SECONDS AFTER THE CLICK, before the server has a
   row — the ten-to-twenty-second gap of his screenshot #312 (fable-738).

   Arm two reads a SEEDED row, which is the server-truth ghost and proves the
   rail can draw a ring at all. It cannot see this gap, because by the time a
   row exists the gap is over. So this arm HOLDS the refine request open
   instead of aborting it: the click is out, the mutation is pending, and the
   server has no row — exactly the window the founder was looking at.

   Held, not answered: the request never reaches the server, so nothing is
   claimed and nothing is charged, the same as arm one. */

/* BOTH THEMES (fable-732 §3). The ring is a hairline arc over a dimmed
   picture, and "dimmed" is the word doing the work: a treatment tuned on a dark
   plate can vanish on a light one, which is the whole reason that condition is
   written into the order rather than left to taste. The theme is persisted
   under `drape_theme` and read before first paint, so it is set on the document
   rather than clicked afterwards — a toggle would photograph a transition. */
for (const theme of ["dark", "light"] as const) {
console.log(`\nARM: the seconds after the click, before the server knows — ${theme}`);
seed(false);

{
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  try {
    let held = false;
    await page.evaluateOnNewDocument(`localStorage.setItem("drape_theme", ${JSON.stringify(theme)})`);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("castingV2.refine") && request.method() === "POST") {
        /* Neither continued nor aborted — the click stays in flight, which is
           the state this arm exists to photograph. */
        held = true;
        return;
      }
      if (readFaceScanAsk(url, request.postData() ?? null).kind === "scanOnly") {
        void request.abort("blockedbyclient").catch(() => {});
        return;
      }
      void request.continue().catch(() => {});
    });

    await openTile(page);
    const before = await page.evaluate(
      `document.querySelectorAll(".dpc-refine__pick--ghost, .dpc-refine__ghostSpin--onChip").length`,
    ) as number;

    const button = await page.$('button[title^="A fresh take of"]');
    if (button) await button.click();
    /* One second is far inside his ten-to-twenty, and long enough for React to
       paint. The point of the arm is that nothing is waited FOR. */
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const seeded = await page.evaluate(`(() => {
      const chips = Array.from(document.querySelectorAll(".dpc-refine__pick"));
      const redrawing = chips.filter((chip) => chip.querySelector(".dpc-refine__ghostSpin--onChip"));
      const ghosts = chips.filter((chip) => chip.classList.contains("dpc-refine__pick--ghost"));
      return {
        redrawing: redrawing.length,
        ghosts: ghosts.length,
        busy: redrawing[0] ? redrawing[0].getAttribute("aria-busy") : null,
        ghostWords: ghosts.map((chip) => (chip.textContent || "").trim()).filter(Boolean),
        theme: document.documentElement.dataset.theme || null,
      };
    })()`) as {
      redrawing: number; ghosts: number; busy: string | null;
      ghostWords: string[]; theme: string | null;
    };
    console.log(`  held=${held}  before=${before}  after=${JSON.stringify(seeded)}`);

    check(held, "the click's request was held rather than answered",
      held ? "refine POST held open, unsent" : "no refine POST was intercepted");
    /* The theme is asserted, not assumed. A `localStorage` key the app stopped
       reading would leave both passes photographing the same plate and the
       light arm would be a duplicate wearing a different label. */
    check(seeded.theme === theme, `CONTROL — the plate really is the ${theme} one`,
      `data-theme = ${JSON.stringify(seeded.theme)}`);
    /* THE NEGATIVE CONTROL IS THE BEFORE-READING. A rail that already wore a
       ring would pass the arm below without the seed doing anything. */
    check(before === 0, "CONTROL — the rail wore no ring before the click",
      `${before} ring/ghost element(s) before the click`);
    check(seeded.redrawing === 1,
      "the version being replayed wears the ring within a second of the click (fable-738)",
      `${seeded.redrawing} chip(s) carrying the on-chip ring`);
    check(seeded.busy === "true", "and says so to a reader that cannot see a ring",
      `aria-busy = ${JSON.stringify(seeded.busy)}`);
    check(seeded.ghosts === 0,
      "and a fresh take still stands in for nothing (fable-703)",
      `${seeded.ghosts} ghost chip(s)`);
    check(seeded.ghostWords.length === 0, "no words on a provisional chip either (fable-702)",
      seeded.ghostWords.length === 0 ? "none" : seeded.ghostWords.join(" | "));

    await shot(page, `05-rail-provisional-${theme}`);
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 4 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await shotOf(page, ".dpc-refine__pick[aria-busy='true']", `06-chip-provisional-4x-${theme}`);
  } finally {
    await browser.close();
  }
}
}

/* The fixture does not outlive the reading. */
seed(false);
spawnSync("npx", ["tsx", "scripts/seed-regenerate-fixture-disposable.mts", "--clear"],
  { stdio: "inherit", shell: true });

print();
console.log(`\nscreenshots in ${OUT}`);
await writeFile(path.join(OUT, "verdicts.json"), `${JSON.stringify(records, null, 2)}\n`);
process.exit(failures().length > 0 ? 1 : 0);
