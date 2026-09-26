/**
 * THE AFTER-PAINT BUDGET — what a customer fetches ONCE THE PAGE IS UP (#1421).
 *
 * `bundleBudget.mts` beside this file judges the first download and nothing
 * else: `FIRST_PAINT_JS_BUDGET_BYTES`, read off the built `index.html`. It is a
 * good instrument and it answers exactly one question. **Until this module
 * nothing measured a chunk fetched AFTER paint**, and the specimen is measured
 * rather than imagined.
 *
 * ⚠ **THE SPECIMEN, AND IT IS WHY THE FIRST-PAINT NUMBER CANNOT BE WIDENED TO
 * COVER THIS.** #1418 shipped the browser error tracker as a lazy chunk, and
 * `const mod = await import("@sentry/browser")` binds the whole NAMESPACE, so
 * nothing can be tree-shaken: the chunk carried Session Replay (`rrweb`,
 * `recordCanvas`) and the Feedback widget for a product that runs neither.
 * Driven on this tree (the road is in `server/afterPaintBudget.test.ts`):
 *
 *   | reading | after-paint customer JS | first-paint JS |
 *   |---|---|---|
 *   | the tree as it stands | **243.4 kB** (249,259 B) | 260.6 kB (266,819 B) |
 *   | the namespace form restored | **352.4 kB** (360,842 B) | 260.6 kB (266,822 B) |
 *
 * **109.0 kB of dead library on every customer's visit, and first paint moved
 * THREE BYTES** — inside a 29.4 kB headroom, so `bundle-budget` was green on
 * both readings and would stay green however much bigger that chunk got. It was
 * caught by hand, by grepping the emitted chunk for library names, which is not
 * a road anybody walks twice.
 *
 * # What is budgeted, and the population is the interesting part
 *
 * **Every JS chunk a customer can fetch, minus the ones they fetch before
 * paint.** Reached by walking the emitted chunk graph from the entry chunk,
 * following static AND dynamic edges, and never ENTERING a chunk that is a
 * `staffPage()` route — so a staff page's weight, and everything only it
 * reaches, stays outside both budgets exactly as it does today. Measured on the
 * tree this was written against: 11 customer chunks at 243.4 kB, against 21
 * staff-only chunks at 204.2 kB that no customer ever asks for.
 *
 * The split is not invented here. `client/src/App.tsx` declares it —
 * `staffPage(() => import("./pages/X"))` — and `client/src/staffPagesLazy.test.ts`
 * already holds both halves of it; `staffPageModulesFromApp` reads that
 * declaration rather than carrying a list of page names (working law 4).
 *
 * ⚠ **AND THE GRAPH IS ROLLUP'S OWN DECLARATION, NEVER A REGEX OVER THE
 * EMITTED CODE.** Vite writes a dynamic import as
 * `__vitePreload(() => import("./x.js"), __vite__mapDeps([…]))`, so the edges
 * ARE in the bytes and could be scraped — and this repository has paid for that
 * shape four times in one sitting (the Atlas's procedure walker, its
 * operation-kind reader, its flag inventory, its price reader: *a regex
 * standing in for something the code already states, reporting a complete list
 * either way*). `OutputChunk.imports`, `.dynamicImports` and `.facadeModuleId`
 * are the declaration, which is why the runner builds in-process instead of
 * reading `dist/`.
 *
 * # What it deliberately does NOT answer
 *
 *  - **It is a CEILING, not one session's transcript.** A customer who never
 *    opens a board does not fetch `BoardPage` (126.2 kB of the 243.4 kB); one
 *    who does, does. The number is *what a customer can be made to download*,
 *    and it moves the moment a library lands anywhere on that surface — which
 *    is the question the specimen needed asked.
 *  - **Staff-only weight stays unbudgeted.** A dead library inside
 *    `AdminOverview` is invisible to this number and to the first-paint one,
 *    on purpose: the pages are lazy precisely so they cost a customer nothing.
 *  - **A staff page reached STATICALLY from a customer module is undercounted
 *    here** — its facade chunk is skipped by the walk while its code has moved
 *    into the entry. That is the one case this reader is weaker than it looks,
 *    and it is also the case `staffPagesLazy.test.ts` and `bundle-budget` both
 *    already refuse, which is why it is stated rather than handled twice.
 *  - **CSS is reported beside the verdict and never budgeted**, for the reason
 *    the first-paint budget gives: the card's number is JS, and folding CSS in
 *    would make the reading incomparable with the rows before it.
 *
 * # The reader is `bundleFold.mts`'s, so this is not a second gzip
 *
 * Level-9 gzip of the emitted file, through `readEmittedAssets` — the same
 * reader the ledger and the first-paint budget quote. Two readers of one file
 * would make two numbers out of one fact.
 *
 * # The budget, declared ONCE, here
 *
 * 280 kB on 243.4 kB measured — 36.6 kB of room. The rule is the first-paint
 * budget's rule and it has not changed: **enough for ordinary feature work on a
 * customer surface, and less than the cheapest thing this guard exists to
 * catch.** Both halves are readings: 36.6 kB of room against a 109.0 kB dead
 * library driven on this tree.
 *
 * ⚠ **AND THE MEASURED READING IS PINNED TO THE DRIVEN CONTROL BY AN ARM**, for
 * #1265's reason, which cost the first-paint budget a blind week: a budget and
 * a measurement that were correct together go stale together the moment a split
 * moves the subject, and only a re-read notices. Moving the line — up OR down —
 * is an edit to both constants with the new reading beside it, never a change
 * to the reader.
 *
 * `scripts/after-paint-budget.mts` is the runner (the gate's `bundle-budget`
 * job runs it beside the first-paint one, and `pnpm preflight` does);
 * `server/afterPaintBudget.test.ts` drives the pure halves below, including the
 * arm that proves a verdict can be RED and the arm that proves the first-paint
 * budget was blind to the specimen.
 */
import type { EmittedAsset } from "./bundleFold.mts";

/** kB here means 1024 bytes, as `bundleFold.kb` prints it. */
const KB = 1024;

/**
 * The line. Measured 243.4 kB (249,259 B) on 2026-09-26 at `8178afee`,
 * `npx tsx scripts/after-paint-budget.mts`, level-9 gzip of the eleven
 * customer-reachable chunks the entry chunk does not carry.
 */
export const AFTER_PAINT_JS_BUDGET_BYTES = 280 * KB;

/**
 * The reading the budget was set against, kept beside it so the headroom is a
 * fact on the verdict line rather than arithmetic someone does later — and so
 * the pair cannot go stale unnoticed (the arm in the suite pins it).
 */
export const AFTER_PAINT_JS_MEASURED_BYTES = 249_259;

/**
 * One emitted JS chunk, as rollup declares it. Every field here is read off
 * `OutputChunk`; nothing is parsed out of the chunk's code.
 *
 * `file` is keyed the way `readEmittedAssets` keys it — `assets/<name>` — so a
 * graph node and a gzip reading join without a second convention.
 */
export type ChunkNode = {
  readonly file: string;
  readonly isEntry: boolean;
  /** the module this chunk is the facade for, posix-slashed; `null` for a shared chunk */
  readonly facadeModuleId: string | null;
  readonly staticImports: readonly string[];
  readonly dynamicImports: readonly string[];
  /** `viteMetadata.importedCss` — reported, never budgeted */
  readonly importedCss: readonly string[];
};

/**
 * The staff pages, read out of `App.tsx`'s own `staffPage(() => import(…))`
 * declarations and returned as module paths (`client/src/pages/AdminOverview`).
 *
 * ⚠ REFUSES a source with none. A reader that returned `[]` would call every
 * staff chunk a customer's and quietly budget the whole admin panel — the
 * verdict would go RED for the wrong reason, or a rename would make this
 * instrument measure something nobody asked about. An empty list is never an
 * answer here.
 */
export function staffPageModulesFromApp(appSource: string): string[] {
  const found = [
    ...appSource.matchAll(/staffPage\(\(\)\s*=>\s*import\("\.\/pages\/([A-Za-z0-9]+)"\)\)/g),
  ].map((m) => `client/src/pages/${m[1]}`);
  if (found.length === 0) {
    throw new Error(
      "after-paint-budget: App.tsx declares no staffPage(() => import(\"./pages/…\")) route — " +
        "either the staff split has been rewritten into a shape this reader does not know, or it is gone. " +
        "Both must be a red, not a budget over every staff page.",
    );
  }
  return [...new Set(found)];
}

export type ReachResult = {
  /** every chunk a customer can fetch, the entry chunk included */
  readonly reachable: readonly string[];
  /** the staff-page facade chunks the walk refused to enter */
  readonly staffChunks: readonly string[];
};

/**
 * Walk the emitted chunk graph from the entry chunk, following static and
 * dynamic edges, and never entering a `staffPage()` route's chunk.
 *
 * ⚠ REFUSES two ways, and each is a state in which a sum would look fine:
 *
 *  - **no entry chunk** — the build's shape is not the one this reader knows,
 *    and a walk from nowhere returns nothing, which reads as a tiny bundle;
 *  - **a declared staff page with no chunk of its own** — the page has been
 *    folded into another chunk (a static import is how), so the walk's
 *    exclusion is not excluding it and the number below is not the number.
 *
 * A cycle between shared chunks is ordinary rollup output and terminates on the
 * visited set; an arm drives it.
 */
export function customerReachableChunks(
  chunks: readonly ChunkNode[],
  staffModules: readonly string[],
): ReachResult {
  const byFile = new Map(chunks.map((c) => [c.file, c]));
  const isStaff = (chunk: ChunkNode): boolean =>
    chunk.facadeModuleId !== null &&
    staffModules.some(
      (m) => chunk.facadeModuleId!.endsWith(`${m}.tsx`) || chunk.facadeModuleId!.endsWith(`${m}.ts`),
    );

  const staffChunks = chunks.filter(isStaff).map((c) => c.file);
  const missing = staffModules.filter(
    (m) => !chunks.some((c) => c.facadeModuleId?.endsWith(`${m}.tsx`) || c.facadeModuleId?.endsWith(`${m}.ts`)),
  );
  if (missing.length > 0) {
    throw new Error(
      `after-paint-budget: App.tsx declares ${missing.join(", ")} as a lazy staff page but the build emitted no chunk for it — ` +
        "its module has been folded into another chunk (a static import does that), so this walk is not excluding it. " +
        "`client/src/staffPagesLazy.test.ts` names the shape.",
    );
  }

  const entries = chunks.filter((c) => c.isEntry).map((c) => c.file);
  if (entries.length === 0) {
    throw new Error(
      "after-paint-budget: the build emitted no entry chunk — a walk from nowhere reaches nothing, " +
        "and a 0 kB verdict is the one reading this must never give",
    );
  }

  const reachable = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (reachable.has(file)) continue;
    reachable.add(file);
    const node = byFile.get(file);
    if (!node) continue;
    for (const next of [...node.staticImports, ...node.dynamicImports]) {
      const target = byFile.get(next);
      /* An edge to something the graph does not hold is not silently dropped as
         "reached": it is left out here and caught by the judge, which refuses a
         reachable file the build did not emit. */
      if (!target || isStaff(target)) continue;
      queue.push(next);
    }
  }
  return { reachable: [...reachable].sort(), staffChunks };
}

export type AfterPaintVerdict = {
  readonly ok: boolean;
  /** the JS chunks a customer fetches after first paint, each with its gzip size */
  readonly files: ReadonlyArray<{ readonly file: string; readonly gzipBytes: number }>;
  readonly totalGzipBytes: number;
  readonly budgetBytes: number;
  /** positive under budget, negative over it */
  readonly headroomBytes: number;
  /** CSS those chunks pull in — reported, never budgeted */
  readonly cssGzipBytes: number;
  /** what the walk refused to enter, so the verdict says what it is NOT counting */
  readonly staffChunkCount: number;
  readonly staffGzipBytes: number;
};

/**
 * Join the walk with the reader's sizes, take out what the browser already had
 * before paint, and judge the rest.
 *
 * ⚠ REFUSES a reachable chunk the reader did not emit — the graph comes from a
 * build and the sizes from disk, so a chunk in one and not the other means two
 * builds blended into one number (`bundleFold`'s staleness guard, pointed the
 * same way).
 *
 * ⚠ REFUSES an empty after-paint set. Today it is eleven chunks; zero means the
 * walk, the first-paint list or the graph has changed shape, and every one of
 * those must be a red rather than a pass at 0 kB.
 */
export function judgeAfterPaint(input: {
  readonly reachable: readonly string[];
  readonly firstPaintFiles: readonly string[];
  readonly chunks: readonly ChunkNode[];
  readonly assets: readonly EmittedAsset[];
  readonly budgetBytes?: number;
}): AfterPaintVerdict {
  const { reachable, firstPaintFiles, chunks, assets } = input;
  const budgetBytes = input.budgetBytes ?? AFTER_PAINT_JS_BUDGET_BYTES;
  const byFile = new Map(assets.map((a) => [a.file, a]));
  const byChunk = new Map(chunks.map((c) => [c.file, c]));
  const beforePaint = new Set(firstPaintFiles);

  const files: Array<{ file: string; gzipBytes: number }> = [];
  const cssFiles = new Set<string>();
  for (const file of reachable) {
    const asset = byFile.get(file);
    if (!asset) {
      throw new Error(
        `after-paint-budget: the chunk graph names "${file}" but the build emitted no such asset — ` +
          "the graph and the assets are from different builds; rebuild rather than reading this",
      );
    }
    for (const css of byChunk.get(file)?.importedCss ?? []) {
      if (!beforePaint.has(css)) cssFiles.add(css);
    }
    if (beforePaint.has(file)) continue;
    if (asset.kind !== "js") continue;
    files.push({ file, gzipBytes: asset.gzipBytes });
  }
  if (files.length === 0) {
    throw new Error(
      "after-paint-budget: every customer-reachable chunk is already fetched before paint — " +
        "refusing to judge nothing (see this module's header: a 0 kB pass is not a small bundle)",
    );
  }

  let cssGzipBytes = 0;
  for (const css of cssFiles) cssGzipBytes += byFile.get(css)?.gzipBytes ?? 0;

  const staffFiles = chunks.filter((c) => !reachable.includes(c.file));
  const totalGzipBytes = files.reduce((n, f) => n + f.gzipBytes, 0);
  return {
    ok: totalGzipBytes <= budgetBytes,
    files: files.sort((a, b) => b.gzipBytes - a.gzipBytes),
    totalGzipBytes,
    budgetBytes,
    headroomBytes: budgetBytes - totalGzipBytes,
    cssGzipBytes,
    staffChunkCount: staffFiles.length,
    staffGzipBytes: staffFiles.reduce((n, c) => n + (byFile.get(c.file)?.gzipBytes ?? 0), 0),
  };
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} kB`;
}

/** The lines a shift reads on the gate and in preflight. */
export function renderAfterPaintVerdict(v: AfterPaintVerdict): string[] {
  const lines: string[] = [];
  lines.push(
    `after-paint-budget: customer JS fetched after first paint ${kb(v.totalGzipBytes)} gzip (level 9)` +
      ` against a budget of ${kb(v.budgetBytes)} — ${v.ok ? "OK" : "OVER"},` +
      ` ${v.ok ? "headroom" : "over by"} ${kb(Math.abs(v.headroomBytes))}`,
  );
  for (const f of v.files) lines.push(`  ${f.file}  ${kb(f.gzipBytes)}`);
  lines.push(`  (CSS after paint: ${kb(v.cssGzipBytes)} — reported, not budgeted)`);
  lines.push(
    `  (not counted: ${v.staffChunkCount} staff-only chunks, ${kb(v.staffGzipBytes)} — ` +
      "a customer never fetches them, which is why the pages are lazy)",
  );
  if (!v.ok) {
    lines.push(
      "  Something a customer does not need is inside a chunk they DO fetch — most often a whole " +
        "library bound as a namespace, which cannot be tree-shaken (`await import(\"pkg\")` " +
        "restored to the namespace form added 109.0 kB when this was driven, 26 Sep 2026, and " +
        "moved first paint by three bytes). `pnpm machinist:bundle` names the owners. " +
        "Move the budget only with a new reading beside it in scripts/lib/afterPaintBudget.mts.",
    );
  }
  return lines;
}
