/**
 * "ON HER FACE" — the evidence pack, driven (D-101, the UI milestone contract).
 *
 * `c29d93d6` is held at the door because no one has LOOKED at it. This opens the
 * real sheet in the real browser, expands a real face that really does keep
 * three segments, and photographs the panel in both themes — and it asserts the
 * handful of things a screenshot cannot: that the thumbnails are masked rather
 * than three copies of one face, that a row's tap writes into the ask box and
 * changes nothing else, and that a face keeping nothing renders nothing at all.
 *
 * Every check records what it SAW (D-235). An affirmative with no observation
 * behind it is not a reading.
 *
 *   npx tsx scripts/drive-kept-panel-evidence.mts
 *   npx tsx scripts/drive-kept-panel-evidence.mts --base http://localhost:3001
 *
 * Shots land in `output/kept-panel/`.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";
import sharp from "sharp";
import type { Page } from "puppeteer-core";

import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const BASE = arg("base", process.env.VERIFY_BASE_URL ?? "http://localhost:3000");
const OUT = path.resolve("output/kept-panel");

/** The verify bot's sheet, and the face on it that keeps three segments. */
const SESSION = "a52412e4-010e-4f9a-ae55-da62c9b0b91f";
const SEEDED_TILE = "05";
/** A face on the same sheet with no segments — the empty state, from real data. */
const BARE_TILE = "08";

const THEMES = ["dark", "light"] as const;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");
const token = await new SignJWT({ openId: "verify-bot-local", appId, name: "Verify Bot" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, absent, records, failures, print } = createChecks();

/**
 * The thumbnail's own box, photographed.
 *
 * The reading that would have caught the CORS defect and did not exist: the
 * first version of this driver asserted `backgroundImage !== "none"` and
 * `mask-mode: luminance` off the computed style, and PASSED on three completely
 * empty boxes — every stylesheet fact was true and every mask fetch had been
 * blocked. A guard that reads the CSS cannot fail on the only failure that
 * matters.
 */
async function thumbShot(page: Page, index: number): Promise<Buffer | null> {
  const box = await page.evaluate((at) => {
    const thumb = document.querySelectorAll<HTMLElement>(".dpc-kept__thumb")[at];
    if (!thumb) return null;
    const rect = thumb.getBoundingClientRect();
    /*
      `getBoundingClientRect` is viewport-relative and puppeteer's `clip` is
      PAGE-relative. The first version omitted the scroll offset and quietly
      photographed the sub-heading instead of the thumbnail — and then compared
      two identical photographs of the same wrong box and reported 0.0, which
      reads exactly like "this element paints nothing".
    */
    return {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }, index);
  if (!box || box.width < 2 || box.height < 2) return null;
  return Buffer.from(await page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    encoding: "binary",
  }) as Uint8Array);
}

/**
 * HOW MUCH OF THIS BOX IS THE ELEMENT, rather than the room behind it.
 *
 * The second instrument was also wrong and this is why: a thumbnail here sits
 * over the sheet's own blurred tiles, so an EMPTY 44px box is full of colour —
 * the backdrop's. Measuring the box's spread scored a blank slot 26.2 and a
 * painted one 26.2, and would have passed the defect a second time.
 *
 * The honest reading is a DELTA against the same box with the stencil blocked
 * at the network layer, which is the defect itself reproduced. Nothing painted
 * → the two photographs are identical → zero. That is a null result with a
 * fixture that could have produced a non-null one.
 */
async function meanAbsoluteDifference(a: Buffer, b: Buffer): Promise<number> {
  const [left, right] = await Promise.all([
    sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (left.data.length !== right.data.length) {
    throw new Error(`two shots of one box came back different sizes: ${left.data.length} vs ${right.data.length}`);
  }
  let total = 0;
  for (let at = 0; at < left.data.length; at += 1) total += Math.abs(left.data[at] - right.data[at]);
  return total / left.data.length;
}

/** Below this the element contributed nothing anyone could see. */
const PAINTED_AT = 1;

/** The healthy photographs, kept so the control has something to differ from. */
const liveThumbs: Record<string, Array<Buffer | null>> = {};

/** The panel, as the DOM actually holds it. */
const readPanel = `(() => {
  const panel = document.querySelector(".dpc-kept");
  if (!panel) return null;
  const rows = Array.from(panel.querySelectorAll(".dpc-kept__row")).map((row) => {
    const thumb = row.querySelector(".dpc-kept__thumb");
    const style = thumb ? getComputedStyle(thumb) : null;
    return {
      name: row.querySelector(".dpc-kept__name")?.textContent ?? "",
      from: row.querySelector(".dpc-kept__from")?.textContent ?? "",
      label: row.getAttribute("aria-label") ?? "",
      maskImage: style ? (style.maskImage || style.webkitMaskImage || "") : "",
      maskMode: style ? (style.maskMode || style.webkitMaskSourceType || "") : "",
      background: style ? style.backgroundImage : "",
    };
  });
  const cs = getComputedStyle(panel);
  return {
    title: panel.querySelector(".dpc-kept__title")?.textContent ?? "",
    sub: panel.querySelector(".dpc-kept__sub")?.textContent ?? "",
    colour: cs.color,
    rows,
  };
})()`;

for (const theme of THEMES) {
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  /* A blocked fetch is a fact the browser states out loud and nobody was
     listening. Collected per run and asserted below. */
  const refused: string[] = [];
  page.on("requestfailed", (request) => {
    refused.push(`${request.failure()?.errorText} ${request.url().slice(0, 140)}`);
  });
  try {
    /* Before first paint — index.html applies the stored theme itself, so a
       toggle after load would photograph a transition rather than a theme. */
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);

    await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 120_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${SEEDED_TILE} larger"]`, { timeout: 120_000 });

    const appliedTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(appliedTheme === theme, `${theme}: the page is actually in this theme`, `data-theme="${appliedTheme}"`);

    await page.click(`button[aria-label="View candidate ${SEEDED_TILE} larger"]`);
    await page.waitForSelector(".dpc-kept", { timeout: 60_000 });
    /* The thumbnails are background images; a shot taken before they decode is
       a photograph of three empty boxes. */
    await page.waitForFunction(
      `Array.from(document.querySelectorAll(".dpc-kept__thumb")).every((t) => getComputedStyle(t).backgroundImage !== "none")`,
      { timeout: 60_000 },
    );
    /*
      WAIT ON THE BYTES, NOT ON THE CLOCK.

      A stencil now travels through the proxy, which fetches it from R2 — slower
      than a direct bucket read, and slower than the 1.2s settle this used to
      trust. Two of the three thumbnails were photographed mid-flight and
      measured as painting NOTHING, which is indistinguishable from the CORS
      defect. So the readiness signal is the resource itself.
    */
    await page.evaluate(async () => {
      const urls = Array.from(document.querySelectorAll<HTMLElement>(".dpc-kept__thumb"))
        .flatMap((thumb) => {
          const style = getComputedStyle(thumb);
          return [style.maskImage, (style as any).webkitMaskImage, style.backgroundImage];
        })
        .map((value) => (typeof value === "string" ? (value.match(/url\("?([^")]+)"?\)/) ?? [])[1] : null))
        .filter((value): value is string => Boolean(value));
      await Promise.all(urls.map((url) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(null);
        image.onerror = () => resolve(null);
        image.src = url;
      })));
    });
    await new Promise((resolve) => setTimeout(resolve, 800));

    const panel = await page.evaluate(readPanel) as any;
    check(Boolean(panel), `${theme}: the panel is on the screen`, panel ? "found .dpc-kept" : "no .dpc-kept");

    /*
      HIS STRUCTURE, AND THE ONE WORD THE FACE DECIDES.

      The seeded candidate is cast as "an East Asian idol, early 20s" and is
      male, so the correct heading here is "On his face" — the mock's literal
      "On her face" over this photograph is the defect this run found.
    */
    check(
      panel.title === "On his face",
      `${theme}: his heading's structure, with this face's own pronoun`,
      `title="${panel.title}" over a male candidate`,
    );
    check(
      panel.rows.every((row: any) => !/^Her\b/.test(row.name)),
      `${theme}: no row calls a man's face hers`,
      panel.rows.map((r: any) => `"${r.name}"`).join(", "),
    );
    check(
      panel.sub === "Things this version is keeping. Tap one to talk about it.",
      `${theme}: his sub, verbatim`,
      `sub="${panel.sub}"`,
    );
    check(
      panel.rows.length === 3,
      `${theme}: one row per kept segment`,
      `${panel.rows.length} rows: ${panel.rows.map((r: any) => r.name).join(" · ")}`,
    );
    check(
      panel.rows.every((row: any) => row.from === "from an edit"),
      `${theme}: each row says where it came from, in words`,
      panel.rows.map((r: any) => `"${r.from}"`).join(", "),
    );

    /*
      THE LINE THE WHOLE PANEL RESTS ON. A segment mask is a one-channel PNG
      with no alpha; CSS masking defaults to `alpha`, which reads that as opaque
      everywhere and shows the entire crop — three rows, three copies of one
      face. Read off the live element rather than off the stylesheet.
    */
    const masked = panel.rows.filter((row: any) => /luminance/i.test(row.maskMode));
    check(
      masked.length === panel.rows.length,
      `${theme}: every thumbnail is cut by LUMINANCE, not by a missing alpha channel`,
      `${masked.length}/${panel.rows.length} rows report mask-mode ${panel.rows.map((r: any) => r.maskMode).join("/")}`,
    );
    const distinctMasks = new Set(panel.rows.map((row: any) => row.maskImage));
    check(
      distinctMasks.size === panel.rows.length,
      `${theme}: each row wears its OWN stencil`,
      `${distinctMasks.size} distinct mask urls across ${panel.rows.length} rows`,
    );

    check(
      panel.rows.every((row: any) => row.label.includes("Talk about it")),
      `${theme}: a row announces itself as a way to talk, not as a control`,
      `first label: "${panel.rows[0]?.label}"`,
    );

    /* THE PIXELS THEMSELVES — judged at the end, against the blocked control. */
    const shots: Array<Buffer | null> = [];
    for (let index = 0; index < panel.rows.length; index += 1) {
      const shot = await thumbShot(page, index);
      shots.push(shot);
      if (shot) await writeFile(path.join(OUT, `thumb-${theme}-${index}.png`), shot);
    }
    liveThumbs[theme] = shots;
    check(
      shots.every(Boolean),
      `${theme}: each row's thumbnail box exists and was photographed`,
      `${shots.filter(Boolean).length}/${panel.rows.length} boxes captured at 44px`,
    );

    const segmentRefusals = refused.filter((entry) => entry.includes("segments/"));
    check(
      segmentRefusals.length === 0,
      `${theme}: nothing the panel asked for was refused by the browser`,
      segmentRefusals.length === 0
        ? `${refused.length} failed requests overall, none of them a segment object`
        : segmentRefusals.join(" | "),
    );

    await page.screenshot({ path: path.join(OUT, `kept-panel-${theme}.png`) as `${string}.png` });
    const box = await page.evaluate(() => {
      const panel = document.querySelector(".dpc-kept");
      if (!panel) return null;
      const rect = panel.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (box) {
      await page.screenshot({
        path: path.join(OUT, `kept-panel-${theme}-closeup.png`) as `${string}.png`,
        clip: {
          x: Math.max(0, box.x - 16),
          y: Math.max(0, box.y - 16),
          width: Math.min(1440, box.width + 32),
          height: box.height + 32,
        },
      });
    }

    /*
      THE TAP: it writes the opening of her sentence into the ask box and does
      nothing else. Asserted on both halves — what appeared, and that no request
      went out.
    */
    if (theme === "dark") {
      const before = await page.evaluate(
        () => (document.querySelector(".dpc-refine__ask textarea, .dpc-refine__ask input") as HTMLInputElement)?.value ?? null,
      );
      await page.click(".dpc-kept__row");
      await new Promise((resolve) => setTimeout(resolve, 400));
      const after = await page.evaluate(
        () => (document.querySelector(".dpc-refine__ask textarea, .dpc-refine__ask input") as HTMLInputElement)?.value ?? null,
      );
      check(
        before === "" && typeof after === "string" && after.length > 0,
        "a tap prefills the ask box and nothing else",
        `box went from "${before}" to "${after}"`,
      );
      check(
        typeof after === "string" && after.endsWith(" — "),
        "the prefill is the OPENING of her sentence, left unfinished",
        `"${after}"`,
      );
      const stillThere = await page.evaluate(() => document.querySelectorAll(".dpc-kept__row").length);
      check(stillThere === 3, "the list is unchanged by being tapped", `${stillThere} rows after the tap`);
      await page.screenshot({ path: path.join(OUT, "kept-panel-prefilled.png") as `${string}.png` });

      /* THE EMPTY STATE, from real data rather than from a story about it. */
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 600));
      await page.click(`button[aria-label="View candidate ${BARE_TILE} larger"]`).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const empty = await page.evaluate(() => ({
        panel: document.querySelectorAll(".dpc-kept").length,
        heading: Array.from(document.querySelectorAll("*")).some((el) => el.textContent === "On her face"),
        refine: document.querySelectorAll(".dpc-refine__ask").length,
      }));
      check(
        empty.panel === 0 && !empty.heading,
        "a face keeping nothing renders NOTHING — not a heading over a blank list",
        `${empty.panel} panels, heading present: ${empty.heading}, refine box present: ${empty.refine > 0}`,
      );
      await page.screenshot({ path: path.join(OUT, "kept-panel-empty.png") as `${string}.png` });
    } else {
      absent("the tap and the empty state", "driven once, in dark — they are not theme-dependent");
    }
  } finally {
    await browser.close();
  }
}

/*
  THE NEGATIVE CONTROL — the defect itself, reproduced, on the same instrument.

  Not a style override (the first attempt was one, and React re-applied its own
  inline styles under it, so the "broken" reading came back byte-identical to
  the healthy one — a control that could not fail, guarding a check that could
  not fail). This aborts the stencil requests at the network layer, which is
  precisely what CORS did: `net::ERR_FAILED`, nothing else touched.

  If the reading does NOT fall here, the reading above proves nothing.
*/
{
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  const refused: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("image-proxy")) refused.push(request.url().slice(-60));
  });
  try {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().includes("/api/image-proxy")) void request.abort();
      else void request.continue();
    });
    await page.evaluateOnNewDocument(() => window.localStorage.setItem("drape_theme", "dark"));
    await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 120_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${SEEDED_TILE} larger"]`, { timeout: 120_000 });
    await page.click(`button[aria-label="View candidate ${SEEDED_TILE} larger"]`);
    await page.waitForSelector(".dpc-kept__thumb", { timeout: 60_000 });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const deltas: number[] = [];
    for (let index = 0; index < (liveThumbs.dark?.length ?? 0); index += 1) {
      const healthy = liveThumbs.dark?.[index];
      const starved = await thumbShot(page, index);
      if (starved) await writeFile(path.join(OUT, `thumb-control-${index}.png`), starved);
      deltas.push(healthy && starved ? await meanAbsoluteDifference(healthy, starved) : -1);
    }
    check(
      refused.length > 0,
      "CONTROL — the stencil really was blocked, the way CORS blocked it",
      `${refused.length} image-proxy requests refused at the network layer`,
    );
    check(
      deltas.every((delta) => delta >= PAINTED_AT),
      "every thumbnail PAINTS — its box differs from the same box with no stencil",
      `mean per-channel difference ${deltas.map((d) => d.toFixed(1)).join(" / ")} levels (nothing painted = 0)`,
    );
    await page.screenshot({ path: path.join(OUT, "kept-panel-control-no-stencil.png") as `${string}.png` });
  } finally {
    await browser.close();
  }
}

print();
await writeFile(path.join(OUT, "checks.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`\nshots + checks: ${OUT}`);
process.exit(failures().length === 0 ? 0 : 1);
