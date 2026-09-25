/**
 * A CANDIDATE CARRIES NO DISPOSITION — #1241, his brief of 2026-09-25.
 *
 * Verbatim: *"candidates are auditioners and carry no personality by design —
 * retire personaLine end to end: the tile slot, the props, the sheet state, any
 * server projection still selecting or sending it, and the aria-label/alt
 * fallbacks in the same file that read `personaLine ?? …`. One index label
 * remains per tile. Sweep the whole field out rather than leaving a dead prop."*
 *
 * What the customer reported: every tile on a sheet read **"01 … 01"** — the
 * same number bottom-left and bottom-right. The left slot drew the disposition
 * and fell back to the index; the author road nulls the disposition for every
 * account since 2026-09-24 (#176), so the fallback was all anybody ever saw.
 *
 * # WHY THIS FILE IS A TOKEN SWEEP AND NOT A BEHAVIOUR TEST
 *
 * The field ran through nineteen source modules and eight suites, and every one
 * of the readers is now deleted — so there is no call left to assert against.
 * What can come back is the NAME, through any of them, and a token is the only
 * thing that sees that. Two readers, on purpose: a DERIVED walk of the whole
 * product tree (which cannot be fooled by a module the named list forgot) and a
 * NAMED list of the modules the sweep actually touched (which cannot be fooled
 * by a walker that silently walks nothing — the failure the memory note
 * `directory-population-loses-promoted-subject` is about).
 *
 * # ⚠ EVERY ABSENCE ARM HERE IS PAIRED WITH A POSITIVE CONTROL
 *
 * An absence arm passes for three different reasons and only one of them is the
 * finding: the token is gone; the matcher is broken; the reader read nothing. So
 * the matcher is proven to FIND the token in a literal, the file reader is proven
 * to find a token that IS in each named file, and the walker is proven to find a
 * control token across the tree. Working law 2, and the reason this file is
 * longer than the absence it asserts.
 *
 * # THE MIGRATION HISTORY IS EXCLUDED, AND THAT IS NOT A LOOPHOLE
 *
 * `drizzle/0017_*.sql` and the `drizzle/meta/*_snapshot.json` files RECORD that
 * the column once existed. Editing them would be rewriting what was applied to
 * two live databases. The live declaration — `drizzle/schema.ts` — is asserted
 * clean, and migration 0068 is asserted to hold the DROP.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";

/* This suite reads every source file in the product, which is well past
   vitest's 5s default under parallel load (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const ROOT = path.resolve(__dirname, "../..");

/**
 * A NAMED file, which is not allowed to be missing.
 *
 * Everything here goes through `readListedSource` (#223): this tree carries
 * hundreds of untracked disposables under `scripts/`, and a file can leave
 * between a listing and its read — an ENOENT out of a `.filter()` refuses the
 * deploy rite on a clean tree. For a name this suite chose, though, absence is
 * the finding rather than a skip, so the null is turned back into a failure
 * here and tolerated only on the walk below.
 */
function read(file: string): string {
  const text = readListedSource(path.resolve(ROOT, file));
  if (text === null) throw new Error(`${file} is not there, and this suite names it`);
  return text;
}

/**
 * The token, case-insensitive on purpose: the sweep also retired
 * `followPersonaLine` — a field that had carried the parent candidate's INDEX
 * since founder gate 16 and kept the caption's name for months — so a
 * capitalised comeback is the likelier one.
 */
const TOKEN = /personaline/i;

/** This guard, which is the only file allowed to write the retired name. */
const SELF = "server/castingV2/candidateDispositionRetired.test.ts";

/**
 * ⚠ THE CLASS PREFIX IS ASSEMBLED, NOT WRITTEN — do not "tidy" these back into
 * one literal.
 *
 * `client/src/features/castingV2/castingV2CssEmitters.test.ts` finds dead CSS by
 * scanning `client/src` alone, and it PROVES that scope by failing if any file
 * under `server/` or `shared/` writes a `dpc-` class inside a quote. A guard
 * about a client class therefore cannot name one here as a plain string — it
 * would make the dead-class reader blind, which is a worse defect than the one
 * this file guards. The first draft of this suite reddened that arm exactly.
 */
const DPC = "dpc-";
const CAPTION_MARKER = `className="${DPC}card__caption"`;
const RETIRED_SLOT_CLASS = `${DPC}card__line"`;
const RETIRED_SLOT_RULE = `.${DPC}card__line {`;

/**
 * THE MODULES THE FIELD RAN THROUGH, named because the card named them.
 *
 * Kept as a list rather than derived because its job is to be a SECOND reader of
 * the walk below: a list and a walk cannot both be empty for the same reason.
 * Each entry must exist — a file that moved fails here rather than passing by
 * being unreadable.
 */
const SWEPT = [
  "server/castingV2/briefCompiler.ts",
  "server/castingV2/castProjection.ts",
  "server/castingV2/castingIntent.ts",
  "server/castingV2/cohortPhotorealHuman.ts",
  "server/castingV2/rollProjection.ts",
  "server/castingV2/rollService.ts",
  "server/castingV2/signService.ts",
  "server/db/castingV2.ts",
  "server/db/castingV2Sign.ts",
  "server/routes/castingV2.ts",
  "drizzle/schema.ts",
  "client/src/features/castingV2/components/CandidateTile.tsx",
  "client/src/features/castingV2/components/CandidateViewer.tsx",
  "client/src/features/castingV2/components/KeptTray.tsx",
  "client/src/features/castingV2/components/SignConfirm.tsx",
  "client/src/features/castingV2/keptStrip.ts",
  "client/src/features/castingV2/castingV2.css",
  "client/src/pages/CastingRoom.tsx",
  "client/src/pages/CastingSheet.tsx",
  "client/src/pages/CastingV2.tsx",
] as const;

/** A token that IS in each of those files — the reader's positive control. */
const ANCHOR: Record<string, string> = {
  "client/src/features/castingV2/castingV2.css": `${DPC}card`,
  "drizzle/schema.ts": "castingCandidates",
};
const anchorFor = (file: string) => ANCHOR[file] ?? "candidate";

/**
 * Every source file under the product's own trees. Tests included: a fixture
 * re-declaring the field is how it comes back next time.
 */
function productFiles(): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", "dist", ".git", "meta"]);
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.resolve(ROOT, dir))) {
      if (skip.has(entry)) continue;
      const rel = `${dir}/${entry}`;
      /* An entry can be gone before it is even CLASSIFIED — the shape #223's
         first fix missed, because the surviving ENOENT said `stat`, not `open`. */
      const stats = statSync(path.resolve(ROOT, rel), { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) walk(rel);
      else if (/\.(ts|tsx|css)$/.test(entry)) out.push(rel);
    }
  };
  for (const root of ["server", "client/src", "shared", "scripts"]) walk(root);
  return out;
}

/**
 * How many spans each caption row on the tile holds, in source order.
 *
 * Deliberately crude: it reads from the caption's opening tag to the next
 * closing div, which is what that element is in both render paths. A structural
 * parse would be a second implementation of JSX to maintain, and the thing being
 * guarded is a slot coming back — which shows up as a span either way.
 */
function captionSpanCounts(source: string): number[] {
  const counts: number[] = [];
  const marker = CAPTION_MARKER;
  let at = source.indexOf(marker);
  while (at !== -1) {
    const end = source.indexOf("</div>", at);
    const block = source.slice(at, end === -1 ? source.length : end);
    counts.push(block.split("<span").length - 1);
    at = source.indexOf(marker, at + marker.length);
  }
  return counts;
}

describe("the candidate disposition is retired end to end (#1241)", () => {
  it("the matcher can find the token — in a literal, before any absence is believed", () => {
    expect(TOKEN.test("  personaLine: string | null;")).toBe(true);
    expect(TOKEN.test("      followPersonaLine: \"08\",")).toBe(true);
    expect(TOKEN.test("  indexLabel: string;")).toBe(false);
  });

  it.each(SWEPT)("%s is readable and holds no disposition field", (file) => {
    expect(existsSync(path.resolve(ROOT, file)), `${file} has moved — re-point this list`).toBe(true);
    const text = read(file);
    /* THE POSITIVE HALF FIRST: a file that failed to load, or a path that
       resolved somewhere empty, would satisfy the absence below for the wrong
       reason. */
    expect(text.length, file).toBeGreaterThan(200);
    expect(text, `${file} did not contain its own anchor — the reader is wrong, not the absence`)
      .toContain(anchorFor(file));
    expect(TOKEN.test(text), `${file} names the retired disposition again`).toBe(false);
  });

  it("no file anywhere in the product names it — the derived reader, with the walk proven", () => {
    const files = productFiles();
    /* The walk is proven to have walked: a floor well under the real count, and
       a control token that certainly exists in many places. */
    expect(files.length).toBeGreaterThan(800);
    /* A LISTED entry may have left since the walk, so the null is skipped rather
       than thrown (#223) — the floors above and below are what stop a reader
       that has gone quiet from passing vacuously. */
    const listed = (file: string) => readListedSource(path.resolve(ROOT, file));
    const withControl = files.filter((file) => /candidate/i.test(listed(file) ?? ""));
    expect(withControl.length).toBeGreaterThan(50);

    /* THIS FILE IS THE ONE EXEMPTION, and it is exempt by PATH rather than by a
       pattern: it quotes his brief and the migration, so it necessarily names
       what it forbids. Asserting the walk actually reached it is what stops the
       exemption from being a hole — a second offender cannot hide behind it. */
    expect(files).toContain(SELF);
    const offenders = files.filter((file) => file !== SELF && TOKEN.test(listed(file) ?? ""));
    expect(offenders).toEqual([]);
  });

  it("the column is off the live schema, and migration 0068 drops it", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("export const castingCandidates");
    expect(TOKEN.test(schema)).toBe(false);

    const migration = read("drizzle/0068_casting_v2_drop_candidate_persona_line.sql");
    expect(migration).toContain("ALTER TABLE `casting_candidates` DROP COLUMN `personaLine`;");
  });

  it("ONE index label per tile — every caption row on the tile holds exactly one span", () => {
    const tile = read("client/src/features/castingV2/components/CandidateTile.tsx");
    /* The retired slot's own class is gone too — a second span could not be
       styled back into the row without it, and a dead rule is how it returns. */
    expect(tile).not.toContain(RETIRED_SLOT_CLASS);
    expect(read("client/src/features/castingV2/castingV2.css")).not.toContain(RETIRED_SLOT_RULE);

    /* Two render paths draw a caption — the signed tile and the ordinary one —
       and his ruling is about both. */
    expect(captionSpanCounts(tile)).toEqual([1, 1]);
  });

  it("the caption counter can count two — the arm above is not passing on a broken reader", () => {
    const two = [
      `      <div ${CAPTION_MARKER}>`,
      `        <span className="${DPC}card__line">{candidate.indexLabel}</span>`,
      "        <span className=\"dp-metadata\">{candidate.indexLabel}</span>",
      "      </div>",
    ].join("\n");
    expect(captionSpanCounts(two)).toEqual([2]);
    expect(captionSpanCounts("<div>nothing here</div>")).toEqual([]);
  });
});
