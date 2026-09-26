/**
 * THE AFTER-PAINT BUDGET'S OWN CONTROLS (#1421).
 *
 * The gate's `bundle-budget` job now refuses twice: once when the JS a customer
 * downloads BEFORE first paint exceeds `FIRST_PAINT_JS_BUDGET_BYTES`, and once
 * when the JS they can fetch AFTER it exceeds `AFTER_PAINT_JS_BUDGET_BYTES`. A
 * refusal that has never been seen to fire is a decoration (working law 2), so
 * the arms here are the negative and positive controls on each pure half:
 *
 *  - the staff-page reader finds the real `App.tsx`'s ten routes and REFUSES a
 *    source with none (an empty list would budget the whole admin panel);
 *  - the walk enters a customer's lazy chunk and never a staff page's, REFUSES
 *    a build with no entry chunk, and REFUSES a declared staff page that has no
 *    chunk of its own (the shape a static import makes);
 *  - the judge is OVER past the line, OK at it, takes out what the browser had
 *    before paint, and REFUSES both a chunk the build did not emit and an empty
 *    after-paint set;
 *  - the budget is one declared number above the reading it was set against,
 *    with headroom smaller than the 109.0 kB dead library driven the day it was
 *    written — and the last arm is the one the card IS: at the first-paint
 *    budget, that same sabotage reads OK with 29.4 kB to spare.
 *
 * The real build is driven by `scripts/after-paint-budget.mts` itself (in the
 * gate and in preflight); a `vite build` inside a unit suite would put nine
 * seconds on every `pnpm test` for a reading the gate takes anyway.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { EmittedAsset } from "../scripts/lib/bundleFold.mts";
import {
  FIRST_PAINT_JS_BUDGET_BYTES,
  judgeFirstPaint,
  renderVerdict,
} from "../scripts/lib/bundleBudget.mts";
import {
  AFTER_PAINT_JS_BUDGET_BYTES,
  AFTER_PAINT_JS_MEASURED_BYTES,
  customerReachableChunks,
  judgeAfterPaint,
  renderAfterPaintVerdict,
  staffPageModulesFromApp,
  type ChunkNode,
} from "../scripts/lib/afterPaintBudget.mts";

const APP_TSX = path.resolve(__dirname, "..", "client", "src", "App.tsx");

const asset = (file: string, gzipBytes: number, kind: "js" | "css" = "js"): EmittedAsset => ({
  file,
  kind,
  rawBytes: gzipBytes * 3,
  gzipBytes,
});

const chunk = (file: string, over: Partial<ChunkNode> = {}): ChunkNode => ({
  file,
  isEntry: false,
  facadeModuleId: null,
  staticImports: [],
  dynamicImports: [],
  importedCss: [],
  ...over,
});

/* ────────────────────────────────────────────────────────────────────────────
   1. WHO IS STAFF — read off App.tsx's own declarations
   ──────────────────────────────────────────────────────────────────────── */

describe("staffPageModulesFromApp — the split is read, never carried", () => {
  it("finds every staffPage route in the REAL App.tsx (a rename reddens this, not the budget)", () => {
    const modules = staffPageModulesFromApp(readFileSync(APP_TSX, "utf8"));
    /* Named rather than only counted: these two are the heaviest staff chunks
       on the tree (AdminOverview 113.3 kB, ModeratorDashboard 15.0 kB), so a
       reader that lost them would move the number by more than the headroom. */
    expect(modules).toContain("client/src/pages/AdminOverview");
    expect(modules).toContain("client/src/pages/ModeratorDashboard");
    expect(modules.length).toBeGreaterThanOrEqual(10);
  });

  it("reads the declaration and not the lazy CUSTOMER route beside it, nor a mention in prose", () => {
    const fixture = `
      const AdminOverview = staffPage(() => import("./pages/AdminOverview"));
      const AdminCrew = staffPage(() => import("./pages/AdminCrew"));
      const BoardPage = lazyRoute(() => import("./features/boards/BoardPage"));
      // staffPage(() => import("./pages/NotReal")) is what the admin pages use
    `;
    /* The comment IS matched — this reader does not strip comments, and saying
       so is cheaper than pretending otherwise: a commented-out staff page that
       has no chunk makes the WALK refuse by name, which is a red that names the
       real problem rather than a silent miscount. */
    const modules = staffPageModulesFromApp(fixture);
    expect(modules).toContain("client/src/pages/AdminOverview");
    expect(modules).toContain("client/src/pages/AdminCrew");
    expect(modules).not.toContain("client/src/features/boards/BoardPage");
  });

  it("⚠ REFUSES a source that declares none — an empty list would budget the admin panel", () => {
    expect(() => staffPageModulesFromApp("const A = lazy(() => import('./pages/A'));")).toThrow(
      /declares no staffPage/,
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2. THE WALK — a customer's reach, and only a customer's
   ──────────────────────────────────────────────────────────────────────── */

/**
 * The real graph's shape, reduced: one entry chunk whose dynamic edges are a
 * staff page and two customer chunks, a shared chunk both sides use, and a
 * chunk only the staff page reaches.
 */
const SHAPE: ChunkNode[] = [
  chunk("assets/index-entry.js", {
    isEntry: true,
    facadeModuleId: "/repo/client/index.html",
    dynamicImports: [
      "assets/AdminOverview-a.js",
      "assets/BoardPage-b.js",
      "assets/errorTracker-c.js",
    ],
  }),
  chunk("assets/AdminOverview-a.js", {
    facadeModuleId: "/repo/client/src/pages/AdminOverview.tsx",
    staticImports: ["assets/shared-s.js", "assets/staffOnly-z.js"],
    importedCss: ["assets/AdminOverview-a.css"],
  }),
  chunk("assets/BoardPage-b.js", {
    facadeModuleId: "/repo/client/src/features/boards/BoardPage.tsx",
    staticImports: ["assets/shared-s.js"],
    importedCss: ["assets/BoardPage-b.css"],
  }),
  chunk("assets/errorTracker-c.js", {
    facadeModuleId: "/repo/client/src/monitoring/errorTracker.ts",
    dynamicImports: ["assets/sentry-d.js"],
  }),
  chunk("assets/sentry-d.js", { facadeModuleId: "/node_modules/@sentry/browser/index.js" }),
  chunk("assets/shared-s.js"),
  chunk("assets/staffOnly-z.js"),
];

const STAFF = ["client/src/pages/AdminOverview"];

describe("customerReachableChunks — the population", () => {
  it("reaches the entry, both customer chunks, the nested library and the shared chunk", () => {
    const { reachable } = customerReachableChunks(SHAPE, STAFF);
    expect(reachable).toEqual([
      "assets/BoardPage-b.js",
      "assets/errorTracker-c.js",
      "assets/index-entry.js",
      "assets/sentry-d.js",
      "assets/shared-s.js",
    ]);
  });

  it("never enters a staff page, so the chunk only IT reaches is out too", () => {
    const { reachable, staffChunks } = customerReachableChunks(SHAPE, STAFF);
    expect(staffChunks).toEqual(["assets/AdminOverview-a.js"]);
    expect(reachable).not.toContain("assets/AdminOverview-a.js");
    expect(reachable).not.toContain("assets/staffOnly-z.js");
    /* And the shared chunk IS in, because the customer side reaches it as well —
       excluding it would under-report what a customer actually downloads. */
    expect(reachable).toContain("assets/shared-s.js");
  });

  it("a nested dynamic import is followed — the specimen sat two edges out, not one", () => {
    /* `main.tsx` → `errorTracker` → `@sentry/browser`. A walk that followed one
       level of dynamic import would have missed the 109 kB entirely. */
    const { reachable } = customerReachableChunks(SHAPE, STAFF);
    expect(reachable).toContain("assets/sentry-d.js");
  });

  it("terminates on a cycle between shared chunks", () => {
    const cyclic: ChunkNode[] = [
      chunk("assets/index-entry.js", {
        isEntry: true,
        staticImports: ["assets/a.js"],
        /* The staff page is present, because a fixture that omits it is refused
           by the arm below and would prove termination on an input the real
           caller cannot produce. */
        dynamicImports: ["assets/AdminOverview-a.js"],
      }),
      chunk("assets/a.js", { staticImports: ["assets/b.js"] }),
      chunk("assets/b.js", { staticImports: ["assets/a.js"] }),
      chunk("assets/AdminOverview-a.js", {
        facadeModuleId: "/repo/client/src/pages/AdminOverview.tsx",
      }),
    ];
    expect(customerReachableChunks(cyclic, STAFF).reachable).toEqual([
      "assets/a.js",
      "assets/b.js",
      "assets/index-entry.js",
    ]);
  });

  it("⚠ REFUSES a build with no entry chunk — a walk from nowhere reaches nothing", () => {
    const noEntry = SHAPE.map((c) => chunk(c.file, { ...c, isEntry: false }));
    expect(() => customerReachableChunks(noEntry, STAFF)).toThrow(/no entry chunk/);
  });

  it("⚠ REFUSES a declared staff page with no chunk of its own — the shape a static import makes", () => {
    /*
      THE ARM THAT MATTERS MOST HERE. If `AdminOverview` is imported statically
      its module lands in the entry chunk and its facade chunk disappears; the
      walk's exclusion then excludes nothing, and the sum below would be quietly
      wrong while looking fine. Refusing by name points at the real defect, which
      `staffPagesLazy.test.ts` and the first-paint budget also refuse.
    */
    const folded = SHAPE.filter((c) => c.file !== "assets/AdminOverview-a.js");
    expect(() => customerReachableChunks(folded, STAFF)).toThrow(
      /declares client\/src\/pages\/AdminOverview as a lazy staff page but the build emitted no chunk/,
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3. THE JUDGE
   ──────────────────────────────────────────────────────────────────────── */

const SHAPE_ASSETS: EmittedAsset[] = [
  asset("assets/index-entry.js", 1000),
  asset("assets/BoardPage-b.js", 400),
  asset("assets/errorTracker-c.js", 30),
  asset("assets/sentry-d.js", 300),
  asset("assets/shared-s.js", 70),
  asset("assets/AdminOverview-a.js", 5000),
  asset("assets/staffOnly-z.js", 60),
  asset("assets/BoardPage-b.css", 25, "css"),
  asset("assets/AdminOverview-a.css", 9000, "css"),
];

const judgeShape = (budgetBytes: number) =>
  judgeAfterPaint({
    reachable: customerReachableChunks(SHAPE, STAFF).reachable,
    firstPaintFiles: ["assets/index-entry.js"],
    chunks: SHAPE,
    assets: SHAPE_ASSETS,
    budgetBytes,
  });

describe("judgeAfterPaint — the verdict", () => {
  it("counts every customer chunk the entry does not already carry, and nothing else", () => {
    const v = judgeShape(10_000);
    expect(v.files.map((f) => f.file)).toEqual([
      "assets/BoardPage-b.js",
      "assets/sentry-d.js",
      "assets/shared-s.js",
      "assets/errorTracker-c.js",
    ]);
    expect(v.totalGzipBytes).toBe(800);
    /* The entry chunk is the first-paint budget's subject and must not be
       double-counted here; the staff page and its private chunk are out. */
    expect(v.files.map((f) => f.file)).not.toContain("assets/index-entry.js");
    expect(v.staffChunkCount).toBe(2);
    expect(v.staffGzipBytes).toBe(5060);
  });

  it("is OK at exactly the budget and OVER one byte under it (the boundary, both sides)", () => {
    expect(judgeShape(800).ok).toBe(true);
    expect(judgeShape(800).headroomBytes).toBe(0);
    expect(judgeShape(799).ok).toBe(false);
    expect(judgeShape(799).headroomBytes).toBe(-1);
  });

  it("reports the CSS those chunks pull in, without budgeting it, and never the staff page's", () => {
    const v = judgeShape(10_000);
    expect(v.cssGzipBytes).toBe(25);
    expect(v.totalGzipBytes).toBe(800);
  });

  it("⚠ REFUSES a reachable chunk the build did not emit — two builds are not one number", () => {
    expect(() =>
      judgeAfterPaint({
        reachable: ["assets/index-entry.js", "assets/gone-x.js"],
        firstPaintFiles: ["assets/index-entry.js"],
        chunks: SHAPE,
        assets: SHAPE_ASSETS,
      }),
    ).toThrow(/emitted no such asset/);
  });

  it("⚠ REFUSES an empty after-paint set — a 0 kB pass is the one reading it must never give", () => {
    expect(() =>
      judgeAfterPaint({
        reachable: ["assets/index-entry.js"],
        firstPaintFiles: ["assets/index-entry.js"],
        chunks: SHAPE,
        assets: SHAPE_ASSETS,
      }),
    ).toThrow(/refusing to judge nothing/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   4. THE DECLARED BUDGET, AND THE SABOTAGE IT WAS SET AGAINST
   ──────────────────────────────────────────────────────────────────────── */

/*
  DRIVEN IN ONE SITTING ON ONE TREE — 2026-09-26, `8178afee` plus the two new
  files, on the founder's machine.

  ⚠ Every figure below is from that one sitting, which is the discipline #1265
  had to repair on the first-paint budget: a control and a sabotage from two
  trees cannot prove a line between them.

  Road: `npx tsx scripts/after-paint-budget.mts` and `npx tsx
  scripts/bundle-budget.mts`, first on the tree as it stands, then with
  `client/src/monitoring/errorTracker.ts`'s destructured `await
  import("@sentry/browser")` restored to the NAMESPACE form that #1418 removed
  (`const mod = await import("@sentry/browser")`), then restored and the restore
  proven at `git status`.

    after paint   control    249,259 B  (243.4 kB, 11 chunks)   exit 0
                  sabotage   360,842 B  (352.4 kB, 11 chunks)   exit 1, OVER by 72.4 kB
    first paint   control    266,819 B  (260.6 kB)              exit 0
                  sabotage   266,822 B  (260.6 kB)              exit 0, OK headroom 29.4 kB

  **+111,583 B of dead library on the customer's road, and first paint moved
  THREE BYTES.** That pair is the card, and the last arm of this file is it.
*/
const MEASURED_2026_09_26 = {
  afterPaintControlBytes: 249_259,
  afterPaintSabotageBytes: 360_842,
  firstPaintControlBytes: 266_819,
  firstPaintSabotageBytes: 266_822,
} as const;

/** What the namespace binding cost a customer, derived from the pair above. */
const NAMESPACE_IMPORT_BYTES =
  MEASURED_2026_09_26.afterPaintSabotageBytes - MEASURED_2026_09_26.afterPaintControlBytes;

describe("the declared after-paint budget", () => {
  it("is 280 kB (1024-byte kB, the ledger's unit), above the reading it was set against", () => {
    expect(AFTER_PAINT_JS_BUDGET_BYTES).toBe(280 * 1024);
    expect(AFTER_PAINT_JS_MEASURED_BYTES).toBeLessThan(AFTER_PAINT_JS_BUDGET_BYTES);
  });

  /*
    ⚠ THE READING AND THE BUDGET ARE PINNED TO EACH OTHER. This is the arm the
    first-paint budget did not have, and its absence cost that guard a blind week
    (#1265): the pair went stale together when a split halved its subject, and no
    arm compared the declared reading to anything a build had said. Here the
    declared reading IS the driven control, so a change that moves the customer's
    after-paint surface leaves this red until somebody re-reads both.
  */
  it("the declared reading is the driven control, not a remembered number", () => {
    expect(AFTER_PAINT_JS_MEASURED_BYTES).toBe(MEASURED_2026_09_26.afterPaintControlBytes);
  });

  it("its headroom is smaller than the dead library it exists to catch (+109.0 kB, driven the same day)", () => {
    const headroom = AFTER_PAINT_JS_BUDGET_BYTES - AFTER_PAINT_JS_MEASURED_BYTES;
    expect(headroom).toBeGreaterThan(0);
    expect(headroom).toBeLessThan(NAMESPACE_IMPORT_BYTES);
  });

  it("the sabotage reading is OVER and the control reading is OK, through the real judge", () => {
    const one = (bytes: number) =>
      judgeAfterPaint({
        reachable: ["assets/index-entry.js", "assets/after-x.js"],
        firstPaintFiles: ["assets/index-entry.js"],
        chunks: [
          chunk("assets/index-entry.js", { isEntry: true, staticImports: ["assets/after-x.js"] }),
          chunk("assets/after-x.js"),
        ],
        assets: [asset("assets/index-entry.js", 266_819), asset("assets/after-x.js", bytes)],
      });
    const control = one(MEASURED_2026_09_26.afterPaintControlBytes);
    const sabotage = one(MEASURED_2026_09_26.afterPaintSabotageBytes);
    expect(control.ok).toBe(true);
    expect(sabotage.ok).toBe(false);
    expect(renderAfterPaintVerdict(control)[0]).toMatch(/OK, headroom 36\.6 kB/);
    expect(renderAfterPaintVerdict(sabotage)[0]).toMatch(/OVER, over by 72\.4 kB/);
  });

  /*
    ⚠ THE HOLE THIS CARD IS, DRIVEN — and the arm to read if you only read one.

    The sabotage above put 109.0 kB of Session Replay and a feedback widget into
    a chunk every customer fetches. Judged at the FIRST-PAINT budget, on that
    same sabotaged tree, the verdict is `OK` with 29.4 kB to spare: first paint
    moved from 266,819 B to 266,822 B, three bytes, because the entry chunk only
    names the lazy chunk it fetches. So the gate was green either way, and would
    have stayed green however much bigger that chunk grew.

    Kept as a standing arm rather than a note, because this is the blindness the
    second budget exists to close, and an arm is the only form of it that cannot
    rot.
  */
  it("⚠ the first-paint budget was blind to it — the same sabotage reads OK with 29.4 kB to spare", () => {
    const firstPaintOnSabotage = judgeFirstPaint(
      ["assets/index-sabotage.js"],
      [asset("assets/index-sabotage.js", MEASURED_2026_09_26.firstPaintSabotageBytes)],
    );
    expect(firstPaintOnSabotage.ok).toBe(true);
    expect(renderVerdict(firstPaintOnSabotage)[0]).toContain("OK, headroom 29.4 kB");
    /* Three bytes of movement on a 109.0 kB regression — the two numbers that
       make one budget unable to stand in for the other. */
    const firstPaintMoved =
      MEASURED_2026_09_26.firstPaintSabotageBytes - MEASURED_2026_09_26.firstPaintControlBytes;
    expect(firstPaintMoved).toBe(3);
    expect(NAMESPACE_IMPORT_BYTES).toBeGreaterThan(
      FIRST_PAINT_JS_BUDGET_BYTES - MEASURED_2026_09_26.firstPaintControlBytes,
    );
  });
});
