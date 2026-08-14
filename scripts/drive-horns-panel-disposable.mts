/**
 * THE HORNS ROW ON SCREEN (law 6: render before shipping anything visual).
 *
 * The service-level drive proved the BOX behaves as the court measured. This is
 * the other half and the one law 6 actually asks for: a person looking at the
 * panel with horns on the face, in both themes.
 */
import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/horns-row");
const THEME = process.env.THEME ?? "dark";
const secret = process.env.JWT_SECRET!;
const appId = process.env.VITE_APP_ID!;

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position
     FROM casting_candidates c JOIN casting_sessions s ON s.id = c.sessionId
    WHERE c.publicId = ?`, [process.env.FACE ?? "86e896f1-b9ca-4f4f-8bd7-b38e32b82a36"]);
await connection.end();
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Horns row" })
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, print, failures } = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1500, height: 1000 });

try {
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(THEME)}); } catch {} })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-face__row", { timeout: 120_000 });

  let seen: any = null;
  for (let at = 0; at < 120; at += 1) {
    seen = await page.evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll(".dpc-face__row"));
      const horns = rows.find((row) => (row.textContent ?? "").toLowerCase().includes("horn"));
      /* The picture lives on the CUT inside the thumb, not on the thumb —
         the thumb is the tile that holds one cut per instance. My first
         assertion read the wrong element and called a working row empty. */
      const cut = horns ? horns.querySelector(".dpc-face__cut") : null;
      const style = cut ? getComputedStyle(cut) : null;
      return {
        rows: rows.length,
        pending: rows.filter((r) => r.getAttribute("data-state") === "pending").length,
        hornsRow: Boolean(horns),
        hornsState: horns ? horns.getAttribute("data-state") : null,
        hornsThumb: style ? {
          image: style.backgroundImage.slice(0, 40),
          mask: (style.webkitMaskImage || style.maskImage || "").slice(0, 40),
          size: (() => { const r = cut.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
        } : null,
        names: rows.map((r) => (r.querySelector(".dpc-face__name")?.textContent ?? "").trim()),
      };
    })()`);
    if (seen.hornsRow && seen.hornsState === "settled") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await page.screenshot({ path: `${OUT}/panel-${THEME}.png` });
  check(seen.hornsRow, "the panel has a HORNS row on a horned face", `rows: ${seen.names.join(", ")}`);
  check(seen.hornsState === "settled", "and it is this version's own reading", `state ${seen.hornsState}`);
  check(
    Boolean(seen.hornsThumb?.image && seen.hornsThumb.image !== "none")
      && (seen.hornsThumb?.size?.w ?? 0) > 8,
    "with a picture of her own horns in it, like every other row",
    JSON.stringify(seen.hornsThumb),
  );
} finally {
  print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
