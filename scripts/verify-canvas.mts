/**
 * Canvas interaction invariants — permanent headless regression drive.
 *
 * Guards the two VC2 trust invariants that broke silently once already:
 *   A. Create → immediately drag: the user's position ALWAYS wins over the
 *      in-flight server confirm (no snap-back to spawn position).
 *   B. Right-click add at a panned+zoomed viewport: the node lands at the
 *      cursor's flow position (screen→flow conversion, not raw coords).
 *
 * Run:  pnpm dev (running) → npx tsx scripts/verify-canvas.mts
 * Uses the dev DB verify-bot user (see .claude/skills/verify) and system Edge.
 * Exits non-zero on any invariant failure.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import mysql from "mysql2/promise";
import puppeteer from "puppeteer-core";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// ── Setup: verify-bot session + a dedicated reusable board ─────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
await conn.execute(
  `INSERT INTO users (openId, name, email, approved, emailVerified, role)
   VALUES ('verify-bot-local', 'Verify Bot', 'verify-bot@local.test', 1, 1, 'user')
   ON DUPLICATE KEY UPDATE approved = 1, emailVerified = 1`,
);
const [users] = await conn.execute(`SELECT id FROM users WHERE openId = 'verify-bot-local'`);
const userId = (users as Array<{ id: number }>)[0].id;

let [boards] = await conn.execute(
  `SELECT id FROM boards WHERE userId = ? AND name = 'canvas-invariants' LIMIT 1`,
  [userId],
);
let boardId = (boards as Array<{ id: number }>)[0]?.id;
if (!boardId) {
  const [res] = await conn.execute(
    `INSERT INTO boards (userId, name, startedWith) VALUES (?, 'canvas-invariants', 'blank')`,
    [userId],
  );
  boardId = (res as { insertId: number }).insertId;
}
// Clean slate each run
await conn.execute(`DELETE FROM board_items WHERE boardId = ?`, [boardId]);

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

// ── Browser ────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new" as never,
  args: ["--window-size=1600,1000"],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
await page.setCookie({ name: "app_session_id", value: token, domain: "localhost", path: "/" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${BASE}/app/board/${boardId}`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector('button[aria-label="Add"]', { timeout: 90000 });
await sleep(500);

const nodeCount = () => page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
const nodeRects = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".react-flow__node")].map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.getAttribute("data-id") ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
const addCastViaPill = async () => {
  const btn = (await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Add"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(btn.x, btn.y);
  await sleep(400);
  const item = (await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, [role=menuitem], div")].filter(
      (el) => el.textContent?.trim() === "Cast Model",
    );
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }))!;
  await page.mouse.click(item.x, item.y);
};

// ── Invariant A: create → immediately drag → position sticks ───────────────
{
  const before = await nodeCount();
  await addCastViaPill();
  // Optimistic render: the node must exist essentially immediately
  await page.waitForFunction(
    (n: number) => document.querySelectorAll(".react-flow__node").length > n,
    { timeout: 2000, polling: 100 },
    before,
  );
  check("A1 optimistic render (<2s)", true);

  // Drag it NOW — before the server confirm can land
  const rects = await nodeRects();
  const node = rects[rects.length - 1];
  const from = { x: node.x + node.w / 2, y: node.y + 30 };
  const to = { x: from.x + 340, y: from.y + 180 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await sleep(300);
  const dragged = (await nodeRects()).find((r) => r.id === node.id)!;
  const movedImmediately = Math.abs(dragged.x - node.x - 340) < 30 && Math.abs(dragged.y - node.y - 180) < 30;
  check("A2 drag applied", movedImmediately, `Δ=(${(dragged.x - node.x).toFixed(0)},${(dragged.y - node.y).toFixed(0)})`);

  // Wait out the create-confirm + move-persist + any refetches, then re-assert
  await sleep(5000);
  const settled = (await nodeRects()).find((r) => Math.abs(r.x - dragged.x) < 30 && Math.abs(r.y - dragged.y) < 30);
  check("A3 position survives server confirm (no snap-back)", !!settled);
}

// ── Invariant B: right-click add at panned+zoomed viewport → at cursor ─────
{
  // Zoom out two notches and pan, so screen≠flow coordinates diverge hard
  await page.mouse.move(800, 500);
  await page.mouse.wheel({ deltaY: 240 });
  await sleep(300);
  // Pan: drag on empty pane (avoid the node we made — use top-left region)
  await page.mouse.move(250, 200);
  await page.mouse.down();
  await page.mouse.move(520, 380, { steps: 8 });
  await page.mouse.up();
  await sleep(400);

  const target = { x: 1100, y: 300 };
  const before = await nodeCount();
  await page.mouse.click(target.x, target.y, { button: "right" });
  await sleep(500);
  const item = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, [role=menuitem], div")].filter(
      (el) => el.textContent?.trim() === "Cast Model",
    );
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check("B1 context menu opened", !!item);
  if (item) {
    await page.mouse.click(item.x, item.y);
    await page.waitForFunction(
      (n: number) => document.querySelectorAll(".react-flow__node").length > n,
      { timeout: 3000, polling: 100 },
      before,
    );
    await sleep(300);
    const rects = await nodeRects();
    const newest = rects[rects.length - 1];
    const center = { x: newest.x + newest.w / 2, y: newest.y + newest.h / 2 };
    const dist = Math.hypot(center.x - target.x, center.y - target.y);
    // Node center should land near the cursor (within ~1.5 card widths on screen)
    check("B2 node lands at cursor after pan+zoom", dist < 220, `distance=${dist.toFixed(0)}px`);
  }
}

await browser.close();
await conn.end();

if (failures.length) {
  console.error(`\n${failures.length} invariant(s) FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll canvas invariants hold.");
