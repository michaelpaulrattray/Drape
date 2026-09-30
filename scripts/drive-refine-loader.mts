/**
 * THE HONEST LOADER, PHOTOGRAPHED IN THE RUNNING APP (#55, working law 6).
 *
 *     npx tsx scripts/drive-refine-loader.mts [--base http://localhost:3000]
 *
 * No credit is spent and no row is written. The wait is a fact the SERVER
 * reports, so the fact is injected AT THE WIRE — `window.fetch` is wrapped
 * before the app loads and the `castingV2.variants` answer comes back carrying
 * a pending row with the step under test. That is the builder-seat rule of
 * 2026-09-26: a render's fixture goes on the response, never into a shared dev
 * database row somebody else is also reading.
 *
 * Kept from the bar-and-word half rather than thrown away, and **this is the run
 * it was kept for**: the DUST landed 2026-09-27 and law 6 asked for the same
 * frames again, on the same surface, exactly as that header predicted.
 *
 * Eight frames per theme now. The last four are the ones worth looking hardest
 * at, and each is a state a customer really reaches:
 *
 *   - a dispatched row the road has announced NOTHING about — no bar, no word;
 *   - a settling row — no bar, no word, and NO field either, because nobody is
 *     rendering it;
 *   - a row with **no map of her shape** — the ambient dot field that shipped
 *     before board E, which is the honest answer rather than uniform dust called
 *     her shape;
 *   - and **reduced motion**, where the field is drawn once and still.
 *
 * ⚠ **THE MAP IS CUT FROM THE SUBJECT'S REAL MASTER, by the same function
 * production runs.** A hand-written grid would photograph a driver's idea of her
 * outline; the whole claim being looked at is that the dust lands on HER.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { SignJWT } from "jose";
import type { Page } from "puppeteer-core";

import { cutRefineFigure } from "../server/castingV2/refineFigure";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";
const OUT = "output/55-loader";
const THEMES = ["light", "dark"] as const;

/** Every state the picture can be in, and what each must show. */
const CASES = [
  { name: "01-sending", stage: "dispatched", step: "preparing", expect: "sending, bar at a quarter, dust on her" },
  { name: "02-painting", stage: "dispatched", step: "rendering", expect: "painting, bar at a half, dust on her" },
  { name: "03-checking", stage: "dispatched", step: "reading", expect: "checking, bar at three quarters, dust on her" },
  { name: "04-finishing", stage: "dispatched", step: "storing", expect: "finishing, bar full, dust on her" },
  { name: "05-unannounced", stage: "dispatched", step: null, expect: "NO bar and NO word — her ask and the dust" },
  { name: "06-settling", stage: "settling", step: "reading", expect: "NO bar, NO word, NO field, the money sentence" },
  { name: "07-nomap", stage: "dispatched", step: "rendering", shape: "none", expect: "the ambient dot field, never uniform dust" },
  { name: "08-reducedmotion", stage: "dispatched", step: "rendering", reduce: true, expect: "dust drawn once, still; bar and word stay" },
] as const;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

/*
  THE SUBJECT IS FOUND, NOT REMEMBERED — the lesson #1151 paid for on the face
  panel's own driver, which addressed a session that had since expired with zero
  candidates and failed ninety seconds later on a selector.

  All this surface needs is a READY, unsigned candidate on a session that still
  opens: `viewerRefinable` in `CastingSheet.tsx` is exactly that predicate, and
  the variants query — the one being intercepted — is gated on it.
*/
/* One door onto the database — a raw connection parses every DATETIME as
   local, which is ten hours out on this machine (`scripts/lib/dbConnection.mts`). */
const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query(`
  SELECT s.publicId AS sessionPublicId, c.position, s.userId, u.openId, c.imageKey
    FROM casting_candidates c
    JOIN casting_rolls r ON r.id = c.rollId
    JOIN casting_sessions s ON s.id = r.sessionId
    JOIN users u ON u.id = s.userId
   WHERE c.status = 'ready' AND c.signedCastId IS NULL AND s.status <> 'expired'
   ORDER BY c.id DESC
   LIMIT 1
`) as any[];
await conn.end();
const subject = (rows as any[])[0];
if (!subject) throw new Error("no ready unsigned candidate in this database to open the viewer on");
const SESSION = String(subject.sessionPublicId);
const TILE = String(Number(subject.position)).padStart(2, "0");
console.log(`subject: session ${SESSION}, tile ${TILE}, user ${subject.userId}`);

/*
  HER REAL SHAPE, CUT BY THE FUNCTION PRODUCTION USES.

  The refine cuts this from the master's bytes at dispatch; here the bytes come
  from the public URL instead, because this driver injects at the wire and never
  writes a row (the builder-seat rule of 2026-09-26 — a fixture on a shared dev
  row is somebody else's surprise). Everything downstream is identical: the same
  `cutRefineFigure`, the same digits, the same 1.5 KB the browser really gets.

  If it comes back null the run STOPS rather than photographing a fallback and
  captioning it as dust — that is the one thing these frames exist to show.
*/
const masterUrl = `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${String(subject.imageKey)}`;
const masterResponse = await fetch(masterUrl);
if (!masterResponse.ok) throw new Error(`could not read the subject's master: ${masterResponse.status} ${masterUrl}`);
const HER_SHAPE = await cutRefineFigure(Buffer.from(await masterResponse.arrayBuffer()));
if (!HER_SHAPE) throw new Error("her shape could not be cut from this master — there is nothing to photograph");
console.log(
  `her shape: ${HER_SHAPE.w}x${HER_SHAPE.h} cells, `
  + `${HER_SHAPE.cells.length} digits (${(HER_SHAPE.cells.length / 1024).toFixed(1)} KB on the wire), `
  + `${HER_SHAPE.cells.replace(/[0-3]/g, "").length} of them carrying her`,
);

const token = await new SignJWT({ openId: String(subject.openId), appId, name: "#55 loader frames" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });

/**
 * THE INJECTION, INSIDE THE PAGE.
 *
 * tRPC answers `{"result":{"data":{"json":…}}}` through superjson and batches
 * several procedures into one array, so both shapes are handled — a wrapper
 * that only understood the single shape would silently pass the batch through
 * and photograph a picture with no wait on it, which reads exactly like the
 * feature not working.
 */
async function injectWait(
  page: Page,
  stage: string,
  step: string | null,
  figure: unknown,
): Promise<void> {
  await page.evaluateOnNewDocument(`(() => {
    const STAGE = ${JSON.stringify(stage)};
    const STEP = ${JSON.stringify(step)};
    const FIGURE = ${JSON.stringify(figure)};
    const row = () => ({
      variantId: "fixture-wait",
      instruction: "make the whole look pinker and soften the lighting",
      regenerating: null,
      startedAt: new Date().toISOString(),
      waitedMs: 41_000,
      stage: STAGE,
      step: STEP,
      figure: FIGURE,
    });
    const patch = (payload) => {
      const data = payload?.result?.data?.json;
      if (data && Array.isArray(data.pending)) data.pending = [row()];
      return payload;
    };
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (!url.includes("castingV2.variants")) return response;
      const body = await response.clone().json();
      const patched = Array.isArray(body) ? body.map(patch) : patch(body);
      return new Response(JSON.stringify(patched), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    };
  })()`);
}

const seen: Array<Record<string, unknown>> = [];

for (const theme of THEMES) {
  for (const probe of CASES) {
    const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1280, height: 960 });
    /* Seed the theme BEFORE any app code runs — a post-goto setItem loses to
       the mount effect and photographs one theme twice (memory). */
    await page.evaluateOnNewDocument(`localStorage.setItem("drape_theme", ${JSON.stringify(theme)})`);
    await injectWait(
      page,
      probe.stage,
      probe.step,
      "shape" in probe && probe.shape === "none" ? null : HER_SHAPE,
    );
    /* HIS CLAUSE 7, DRIVEN RATHER THAN READ: reduced motion switches the
       animation off and the bar and the word stay. Emulated at the browser, so
       what is photographed is what a person who asked for less movement sees. */
    if ("reduce" in probe && probe.reduce) {
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    }
    /* Nothing in this run may spend. Watched at the wire rather than assumed. */
    const spends: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /castingV2\.(refine|roll|sign|retry)/.test(request.url())) {
        spends.push(request.url().slice(0, 140));
      }
    });

    await page.goto(`${BASE}/app/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 180_000 });
    /*
      CLICKED IN THE PAGE, NOT THROUGH THE DEVICE.

      `page.click` scrolls to the element and dispatches a real mouse event at
      its centre — and on this sheet it silently did nothing: the viewer never
      opened and the run failed ninety seconds later on the wait's own selector,
      which is a driver fault wearing a missing-feature's clothes (the exact
      confusion `drive-face-panel-evidence.mts`'s header warns about). The
      element's own `click()` is what the tile's handler actually needs, and it
      is proven here by the viewer appearing.
    */
    const opened = await page.evaluate(`(() => {
      const button = document.querySelector('button[aria-label="View candidate ${TILE} larger"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!opened) throw new Error(`tile ${TILE} has no open button on ${SESSION}`);
    await page.waitForSelector(".dpc-viewer", { timeout: 60_000 });
    /* Wait on the THING, never on the clock: the wait appears only once the
       variants answer has landed, which is a remote round trip. */
    await page.waitForSelector(".dpc-viewer__wait", { timeout: 90_000 });

    const read = await page.evaluate(`(() => {
      const fill = document.querySelector(".dpc-viewer__barFill");
      const step = document.querySelector(".dpc-viewer__step");
      const wait = document.querySelector(".dpc-viewer__wait");
      const plate = document.querySelector(".dpc-viewer__plate");
      const rect = plate ? plate.getBoundingClientRect() : null;
      const dust = document.querySelector("[data-dust]");
      const dots = document.querySelector(".dpc-viewer__dots");
      return {
        dust: Boolean(dust),
        dustBox: dust ? dust.width + "x" + dust.height : null,
        dots: Boolean(dots),
        bar: Boolean(document.querySelector(".dpc-viewer__bar")),
        fillWidth: fill ? getComputedStyle(fill).width : null,
        trackWidth: document.querySelector(".dpc-viewer__bar")
          ? getComputedStyle(document.querySelector(".dpc-viewer__bar")).width : null,
        word: step ? step.textContent : null,
        said: wait ? wait.textContent : null,
        plate: rect ? Math.round(rect.width) + "x" + Math.round(rect.height) : null,
      };
    })()`) as any;

    const plate = await page.$(".dpc-viewer__plate");
    const box = plate ? await plate.boundingBox() : null;
    if (box) {
      await writeFile(
        `${OUT}/${theme}-${probe.name}.png`,
        Buffer.from(await page.screenshot({ clip: box, encoding: "binary" }) as Uint8Array),
      );
    }
    /*
      THE FRAME BUDGET, MEASURED — the card asks for it in his own terms: *"a
      canvas animation on a page where a paid render runs — measure the cost on a
      mid laptop and cap the particle count by device"*.

      Taken ONCE, on the ordinary painting frame, because sampling every case
      would treble the run for eight readings of one number. What is reported is
      the interval between animation frames with the dust live: 16.7 ms is the
      display's own rate and is the answer "it costs nothing measurable"; a number
      climbing past it is the dust taking the frame.
    */
    let budget: Record<string, unknown> | null = null;
    if (theme === "light" && probe.name === "02-painting") {
      /*
        ⚠ ON A MID LAPTOP, NOT ON THIS ONE — and the first reading of this number
        was taken on a 20-core desktop, where it said 16.7 ms and meant nothing.
        The card asks for the cost *"on a mid laptop"*, so the CPU is throttled
        four times through the devtools protocol before the sample and released
        after it. What is reported is therefore a pessimistic number rather than
        a flattering one, which is the only kind worth writing down.
      */
      const cdp = await page.createCDPSession();
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      budget = await page.evaluate(`(() => new Promise((resolve) => {
        const deltas = [];
        let last = 0;
        const tick = (now) => {
          if (last) deltas.push(now - last);
          last = now;
          if (deltas.length < 120) return requestAnimationFrame(tick);
          deltas.sort((a, b) => a - b);
          const canvas = document.querySelector("[data-dust]");
          resolve({
            frames: deltas.length,
            medianMs: Math.round(deltas[Math.floor(deltas.length / 2)] * 100) / 100,
            p95Ms: Math.round(deltas[Math.floor(deltas.length * 0.95)] * 100) / 100,
            worstMs: Math.round(deltas[deltas.length - 1] * 100) / 100,
            canvas: canvas ? canvas.width + "x" + canvas.height : null,
            cssPx: canvas ? Math.round(canvas.getBoundingClientRect().width) + "x"
              + Math.round(canvas.getBoundingClientRect().height) : null,
            dpr: window.devicePixelRatio,
            cores: navigator.hardwareConcurrency,
          });
        };
        requestAnimationFrame(tick);
      }))()`) as any;
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
      console.log(`  frame budget (CPU x4): median ${budget!.medianMs} ms, p95 ${budget!.p95Ms} ms, worst ${budget!.worstMs} ms `
        + `on ${budget!.cssPx} css px (canvas ${budget!.canvas}, dpr ${budget!.dpr}, ${budget!.cores} cores)`);
    }

    seen.push({ theme, case: probe.name, expected: probe.expect, spends: spends.length, ...read, ...(budget ? { budget } : {}) });
    console.log(
      `${theme} ${probe.name}: bar=${read.bar} fill=${read.fillWidth}/${read.trackWidth} `
      + `word=${JSON.stringify(read.word)} plate=${read.plate} dust=${read.dust}${read.dustBox ? `(${read.dustBox})` : ""} `
      + `dots=${read.dots} spends=${spends.length}`,
    );
    await browser.close();
  }
}

await writeFile(`${OUT}/seen.json`, `${JSON.stringify(seen, null, 2)}\n`);
console.log(`\n${seen.length} frames in ${OUT}`);
process.exit(0);
