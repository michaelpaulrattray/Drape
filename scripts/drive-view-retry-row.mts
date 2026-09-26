/**
 * HIS ONE MUTED LINE, PHOTOGRAPHED (#1347) — law 6, both themes.
 *
 * His ruling, Desk reply 224, 2026-09-26: *"one muted line under the name,
 * nothing else … Under an unchecked view: 'Unchecked · Try again' … Under the
 * view that never arrived: 'Refunded · Try again'."*
 *
 * The room needs three states side by side to be judged — a good view, an
 * unchecked one and one that never arrived — and a signed Cast in the dev
 * database has none of the last two.
 *
 * ⚠ **SO THE STATES ARE INJECTED AT THE WIRE, ON THE `castingV2.getCast`
 * RESPONSE, AND NOTHING IS WRITTEN TO A ROW.** That is the builder-seat rule of
 * 2026-09-26, and it is not tidiness: the dev database is shared between seats,
 * a failure marker written onto somebody's fixture Cast outlives the run, and
 * "restore it exactly" is a promise a crashed driver cannot keep. Rewriting the
 * response is reversible by closing the browser.
 *
 * It photographs the strip the room draws from that response, in light and in
 * dark, and it ASSERTS the applied theme rather than trusting what it wrote —
 * `ThemeProvider` writes its own theme back in a mount effect, so a post-`goto`
 * `setItem` loses the race and a driver that does not read `data-theme` back
 * produces two identical frames and a claim that both themes were seen.
 *
 *   npx tsx scripts/drive-view-retry-row.mts [--base http://localhost:3000]
 *
 * Output: `output/1347-row/<theme>-strip.png` plus a whole-room frame each, and
 * one line per reading. It spends nothing — no render, no credit, no text call.
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import { getDb } from "../server/db/connection";
import { openDrivenPage } from "./lib/drivePage.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]!
  : "http://localhost:3000";
const OUT = new URL("../output/1347-row/", import.meta.url);

/** The dev fixture that owns signed Casts. Never a real account. */
const OPEN_ID = "verify-bot-local";

const db = await getDb();
if (!db) throw new Error("no database");

const client = (db as unknown as {
  session: { client: { query: (sql: string, values?: unknown[]) => Promise<[unknown[], unknown]> } };
}).session.client;

/*
  THE FIXTURE'S OWN SIGNED CAST, read rather than hard-coded: a Cast is keyed by
  `models.agencyId` (what `/casting/cast/:castId` takes) and is signed when a
  `casting_candidates` row points at it through `signedCastId`.
*/
const [castRows] = await client.query(
  `select m.agencyId as castId, m.name as name
     from models m
     join users u on u.id = m.userId
     join casting_candidates c on c.signedCastId = m.id
    where u.openId = ?
    group by m.id, m.agencyId, m.name
    order by m.id desc
    limit 1`,
  [OPEN_ID],
);
const cast = (castRows as Array<{ castId: string; name: string | null }>)[0];
if (!cast) throw new Error(`${OPEN_ID} owns no signed Cast in this world`);

const [userRows] = await client.query(
  "select openId, name from users where openId = ? limit 1",
  [OPEN_ID],
);
const user = (userRows as Array<{ openId: string; name: string | null }>)[0];
if (!user) throw new Error(`${OPEN_ID} is not in this world`);

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is not set");
const token = await new SignJWT({
  openId: user.openId,
  appId: process.env.VITE_APP_ID,
  name: user.name ?? OPEN_ID,
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

console.log(`cast ${cast.castId} (${cast.name ?? "unnamed"}) as ${OPEN_ID}`);

/**
 * The three states his line has to be judged against, written onto whatever the
 * server actually answers.
 *
 * The FIRST slot is left exactly as it came — a good view, which must carry
 * nothing — so every frame contains its own control. Every field the shim sets
 * is one the projection itself produces; the shapes are copied from
 * `castSlotRetryOffer`'s three branches, so the room is shown a legitimate
 * answer rather than an impossible one.
 */
const FAILED_NOTE = "This view didn't arrive — refunded";

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });

/*
  A THROW IN THE PAGE IS REPORTED, NEVER SWALLOWED. Without this the only symptom
  of a broken page script is a selector that never appears, which is
  indistinguishable from a feature that does not work — the exact confusion that
  cost this driver its first two runs.
*/
const pageErrors: string[] = [];
page.on("pageerror", (error) => {
  pageErrors.push(String(error).slice(0, 300));
});

let dressedSlots = 0;
let untouchedSlots = 0;

/*
  THE REWRITE, IN THE PAGE, AT `fetch`.

  Puppeteer cannot edit a response body it did not intercept as a request, and
  intercepting the request would mean ANSWERING it ourselves — which is the
  "fixture invented on the client" this driver exists to avoid. So the real
  server answers and the shim edits the parsed body of the one procedure it
  recognises. Superjson's envelope is `{ result: { data: { json: … } } }`
  (`trpc-over-plain-fetch-needs-superjson`), and a batch is an ARRAY of those, so
  both shapes are walked.

  The dressing is written INLINE here rather than serialised across the boundary:
  a `new Function` built from a stringified helper is a code-injection shape even
  when the string is a local literal, and it buys nothing this does not.
*/
/*
  ⚠ **`__name` FIRST**, AND AS A STRING - WITHOUT IT EVERY PAGE FUNCTION IN THIS FILE
  THROWS AND THE DRIVER READS AS A MISSING FEATURE.

  `tsx` transpiles with esbuild's `keepNames`, which rewrites every function
  literal as `__name(function ..., "name")` and emits the `__name` helper at the
  top of the MODULE. A function handed to puppeteer is serialised by
  `Function.prototype.toString`, so it arrives in the page still calling a helper
  that exists only in node - `ReferenceError: __name is not defined`, thrown at
  document start, before anything this driver asserts.

  Measured here first: the shim below silently never installed, the row never
  appeared, and a 90-second `waitForSelector` failed with a message that reads
  exactly like *the feature does not work*. One `pageerror` listener told them
  apart. A string script is not transpiled, so this one arrives intact.
*/
await page.evaluateOnNewDocument(
  "globalThis.__name = globalThis.__name || function (value) { return value; };",
);

await page.evaluateOnNewDocument((failedNote: string) => {
  type Slot = Record<string, unknown>;

  const dress = (slots: Slot[]): Slot[] => slots.map((slot, index) => {
    if (index === 1) {
      /* Delivered, charged, kept, and nobody looked at it (D-246). Free. */
      return {
        ...slot,
        state: "ready",
        note: null,
        refundedCredits: null,
        unjudged: true,
        retry: { priceCredits: 0, reason: "unchecked" },
      };
    }
    if (index === 2) {
      /* Never arrived; the money went back. The tile is the confession. */
      return {
        ...slot,
        state: "failed-refunded",
        url: null,
        note: failedNote,
        refundedCredits: 50,
        retry: { priceCredits: 50, reason: "refunded" },
      };
    }
    /* Everything else, the first one included, is left alone: the control. */
    return slot;
  });

  const original = window.fetch;
  window.fetch = async (...args: Parameters<typeof window.fetch>) => {
    const response = await original(...args);
    const first = args[0];
    const url = typeof first === "string"
      ? first
      : first instanceof URL ? first.href : (first as Request).url;
    if (!url || !url.includes("castingV2.getCast")) return response;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await response.clone().text());
    } catch {
      return response;
    }
    const batched = Array.isArray(parsed);
    const entries = (batched ? parsed : [parsed]) as Array<{
      result?: { data?: { json?: { slots?: Slot[] } } };
    }>;
    let touched = 0;
    for (const entry of entries) {
      const data = entry.result?.data?.json;
      if (!data || !Array.isArray(data.slots)) continue;
      data.slots = dress(data.slots);
      touched += 1;
    }
    (window as unknown as { __dressed?: number }).__dressed = touched;
    return new Response(JSON.stringify(batched ? entries : entries[0]), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
}, FAILED_NOTE);

for (const theme of ["light", "dark"] as const) {
  /*
    THE THEME, SEEDED BEFORE ANY APP CODE RUNS, and REMOVED again before the next
    pass. `ThemeProvider` writes its own theme back to storage in a mount effect,
    so a `setItem` after `goto` loses that race and both frames come out dark
    (`theme-seed-before-app-code`). And two of these scripts left registered
    would re-seed the first pass's theme under the second.
  */
  const seed = await page.evaluateOnNewDocument((value: string) => {
    window.localStorage.setItem("drape_theme", value);
    document.documentElement.setAttribute("data-theme", value);
  }, theme);
  await page.goto(`${BASE}/casting/cast/${cast.castId}`, { waitUntil: "domcontentloaded" });

  /* Wait on the ROW, never on the clock — the remote database makes the first
     paint slow, and a fixed sleep photographs skeletons. */
  try {
    await page.waitForSelector(".dpc-slot__row", { timeout: 120_000 });
  } catch (error) {
    if (pageErrors.length > 0) {
      throw new Error(
        `the row never appeared AND the page threw — fix this first: ${pageErrors.join(" · ")}`,
      );
    }
    throw error;
  }

  /*
    AND THE PICTURES MUST BE ON THE SCREEN BEFORE IT IS PHOTOGRAPHED.

    His whole ruling is about the row's WEIGHT against the picture above it -
    *"the good tiles have become louder than the broken one"* — so a frame taken
    while the 2K views are still downloading shows him six empty boxes and a row,
    which is a different question from the one he asked. The first run of this
    driver produced exactly that: the assertions all passed and the frame was
    useless. Waited on the BYTES, never on the clock (the verify skill's second
    reading).
  */
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".dpc-strip__frame img")];
    if (images.length === 0) return false;
    return images.every(
      (image) => (image as HTMLImageElement).complete
        && (image as HTMLImageElement).naturalWidth > 0,
    );
  }, { timeout: 120_000 });
  const decoded = await page.evaluate(
    () => document.querySelectorAll(".dpc-strip__frame img").length,
  );
  console.log(`${theme}: ${decoded} package pictures decoded before the frame`);

  const applied = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  if (applied !== theme) {
    throw new Error(`theme did not switch: asked ${theme}, got ${applied}`);
  }

  const reading = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".dpc-strip__item")];
    return tiles.map((tile) => {
      const row = tile.querySelector(".dpc-slot__row");
      const link = tile.querySelector(".dpc-slot__again");
      const style = row ? window.getComputedStyle(row) : null;
      const linkStyle = link ? window.getComputedStyle(link) : null;
      /*
        THE WORD IS A BARE TEXT NODE, so `row.textContent` reads
        "Unchecked·Try again" with no spaces in it: the spacing between the
        word, the dot and the link is the flex `gap`, not whitespace in the
        markup. Read the three parts separately and record the gap, or an
        assertion on his sentence fails for a reason that is not about the
        sentence (measured on this driver's third run).
      */
      const word = row
        ? [...row.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => (node.textContent ?? "").trim())
          .join("")
        : null;
      return {
        label: tile.querySelector(".dpc-slot__label")?.textContent ?? "",
        row: row ? (row.textContent ?? "").replace(/\s+/g, " ").trim() : null,
        word,
        /* What the eye reads, gap included. */
        line: word && link ? `${word} · ${(link.textContent ?? "").trim()}` : null,
        gap: style?.gap ?? null,
        link: link ? (link.textContent ?? "").trim() : null,
        confession: tile.querySelector(".dpc-slot__confession p")?.textContent ?? null,
        pill: tile.querySelector(".dpc-slot__refund") !== null,
        caption: tile.querySelector(".dpc-takes__caption") !== null,
        /* One line: the row's own height must be a single line of its own type. */
        rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
        rowFontSize: style?.fontSize ?? null,
        rowColour: style?.color ?? null,
        linkFontSize: linkStyle?.fontSize ?? null,
        linkColour: linkStyle?.color ?? null,
        linkUnderline: linkStyle?.textDecorationLine ?? null,
      };
    });
  });

  const dressedCount = await page.evaluate(
    () => (window as unknown as { __dressed?: number }).__dressed ?? 0,
  );
  if (dressedCount === 0) {
    throw new Error("the getCast response was never rewritten — the frame is not the case");
  }

  const rows = reading.filter((tile) => tile.row !== null);
  const bare = reading.filter((tile) => tile.row === null && tile.label !== "Master");
  dressedSlots = rows.length;
  untouchedSlots = bare.length;

  /* His two sentences, read off the screen rather than off the source. */
  const said = rows.map((tile) => tile.line);
  if (!said.includes("Unchecked · Try again")) {
    throw new Error(`no unchecked row on screen — saw ${JSON.stringify(said)}`);
  }
  if (!said.includes("Refunded · Try again")) {
    throw new Error(`no refunded row on screen — saw ${JSON.stringify(said)}`);
  }
  /* Nothing anywhere says a price, and no tile wears the old pill or caption. */
  for (const tile of reading) {
    if (tile.pill) throw new Error(`${tile.label} still wears the CR BACK pill`);
    if (tile.caption) throw new Error(`${tile.label} still wears a caption line`);
    if (tile.row && /\d/.test(tile.row)) {
      throw new Error(`${tile.label}'s row carries a number: "${tile.row}"`);
    }
  }
  /* A good view carries nothing — the control inside every frame. */
  if (bare.length === 0) {
    throw new Error("every tile has a row; there is no good-view control in this frame");
  }

  await mkdir(OUT, { recursive: true });
  const strip = await page.$(".dpc-strip");
  if (!strip) throw new Error("no strip on the page");
  await strip.screenshot({ path: new URL(`${theme}-strip.png`, OUT).pathname.slice(1) });
  await page.screenshot({ path: new URL(`${theme}-room.png`, OUT).pathname.slice(1) });
  await writeFile(
    new URL(`${theme}-reading.json`, OUT),
    JSON.stringify(reading, null, 2),
    "utf8",
  );

  await page.removeScriptToEvaluateOnNewDocument(seed.identifier);

  console.log(`\n${theme}: ${rows.length} rows, ${bare.length} good views carrying nothing`);
  for (const tile of rows) {
    console.log(
      `  ${tile.label.padEnd(12)} "${tile.line}"  ${tile.rowHeight}px gap ${tile.gap}  `
      + `word ${tile.rowFontSize} ${tile.rowColour} · link ${tile.linkFontSize} `
      + `${tile.linkColour} ${tile.linkUnderline}`,
    );
  }
  for (const tile of reading.filter((one) => one.confession !== null)) {
    console.log(`  ${tile.label.padEnd(12)} tile says "${tile.confession}" (pill: ${tile.pill})`);
  }
}

await browser.close();

console.log(
  `\nOK — ${dressedSlots} rows and ${untouchedSlots} bare good views in each theme.`
  + `\nFrames: output/1347-row/{light,dark}-{strip,room}.png`
  + "\nSpent: nothing. No row was written; the states were injected on the getCast response.",
);

process.exit(0);
