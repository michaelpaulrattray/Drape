/**
 * A REFERENCE ADDED WITHOUT THE UPLOAD IS A BROKEN IMAGE, AND NOTHING IN THIS
 * REPOSITORY CAN SEE IT.
 *
 * The client builds static-asset URLs off `ASSETS_BASE_URL` as plain template
 * literals. The bytes live in an R2 bucket, so a path that was never uploaded
 * type-checks, passes every test, and shows a customer a broken image. That is
 * the third kind of state this repo cannot hold, after the production flag
 * positions and the database schema, and it gets the same answer: ask the thing
 * itself at the moment something is already asking it (fable-1433 §2).
 *
 * `scripts/deploy-rite.mts` fetches each one on every push. This file keeps the
 * READER honest and never touches the network.
 *
 * # What was read on the day it was written (2026-08-23)
 *
 * 24 referenced paths, all literal, all 200 from the production bucket. And
 * production really does set `VITE_ASSETS_BASE_URL` to its own bucket rather
 * than falling back to the DEV bucket baked into `shared/const.ts` — read off
 * the service rather than assumed, because that fallback is exactly the kind of
 * thing that works perfectly on a developer's machine while serving a
 * developer's bucket to customers.
 *
 * # ⚠ THE SHAPE THIS READER CANNOT FOLLOW IS RETURNED, NOT SWALLOWED
 *
 * `${ASSETS_BASE_URL}/${slug}.png` names a file no static reader can know.
 * There is none in the tree today. If one appears it comes back in `dynamic`
 * and the rite says out loud that its count is not the whole list — because a
 * scanner that silently skipped those would report a complete-looking list of a
 * subset, which is this repository's single most repeated defect.
 */
import { describe, expect, it } from "vitest";

import { assetReferencesIn, assetVerdict } from "../scripts/lib/staticAssetReferences.mts";

const file = (text: string, path = "client/src/thing.tsx") => [{ path, text }];

describe("the reference reader", () => {
  it("⚠ CONTROL — it finds a reference in the house shape", () => {
    /* POSITIVE CONTROL. Every assertion below is vacuously satisfiable over an
       empty scan, and an empty scan reads exactly like a bucket with nothing
       missing from it. */
    const { references, dynamic } = assetReferencesIn(
      file('const logo = `${ASSETS_BASE_URL}/drape-logo-tight.png`;'),
    );
    expect(references).toEqual([{ path: "drape-logo-tight.png", file: "client/src/thing.tsx" }]);
    expect(dynamic).toEqual([]);
  });

  it("finds a nested path and de-duplicates across files", () => {
    const { references } = assetReferencesIn([
      { path: "a.ts", text: '`${ASSETS_BASE_URL}/eye-colors/ice.png`' },
      { path: "b.ts", text: '`${ASSETS_BASE_URL}/eye-colors/ice.png`' },
      { path: "c.ts", text: '`${ASSETS_BASE_URL}/logos/nike.svg`' },
    ]);
    expect(references.map((reference) => reference.path)).toEqual([
      "eye-colors/ice.png",
      "logos/nike.svg",
    ]);
    expect(references[0]!.file, "the first file to name it is the one reported").toBe("a.ts");
  });

  it("⚠ returns a VARIABLE reference rather than skipping it", () => {
    /* The one shape it cannot follow. Silently dropping it would make the count
       a subset wearing a total's clothes. */
    const { references, dynamic } = assetReferencesIn(
      file("const url = `${ASSETS_BASE_URL}/${slug}.png`;"),
    );
    expect(references).toEqual([]);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]!.file).toBe("client/src/thing.tsx");
  });

  it("does not invent a reference out of a bare base URL", () => {
    /* NEGATIVE CONTROL — `${ASSETS_BASE_URL}` with no path is not an asset. */
    const { references, dynamic } = assetReferencesIn(file("const base = `${ASSETS_BASE_URL}`;"));
    expect(references).toEqual([]);
    expect(dynamic).toEqual([]);
  });
});

describe("the verdict, proven able to say no", () => {
  const references = [
    { path: "logo.png", file: "client/src/a.tsx" },
    { path: "hero.webp", file: "client/src/b.tsx" },
  ];

  it("⚠ CONTROL — every asset present is no problem, over a real population", () => {
    const verdict = assetVerdict(references, [], new Map([["logo.png", 200], ["hero.webp", 200]]));
    expect(verdict.problems).toEqual([]);
    expect(verdict.line).toContain("2 referenced · 2 read · 0 unread");
  });

  it("reports a 404 as a broken image, naming the file that references it", () => {
    const verdict = assetVerdict(references, [], new Map([["logo.png", 200], ["hero.webp", 404]]));
    expect(verdict.problems).toHaveLength(1);
    expect(verdict.problems[0]).toContain("hero.webp");
    expect(verdict.problems[0], "the reader must say WHERE to go and fix it").toContain(
      "client/src/b.tsx",
    );
    expect(verdict.problems[0]).toContain("broken image");
  });

  it("⚠ treats an unreachable bucket as UNREAD, never as conforming", () => {
    /* The direction that matters: a flaky CDN must not be able to say "all
       present", and it must not cost the rite its verdict either. Same rule as
       the balance lines beside it. */
    const verdict = assetVerdict(references, [], new Map([["logo.png", null], ["hero.webp", null]]));
    expect(verdict.problems, "an unread bucket is not a finding").toEqual([]);
    expect(verdict.line, "but it is visibly unread").toContain("0 read · 2 unread");
  });

  it("reports a dynamic reference as a hole in its own count", () => {
    const verdict = assetVerdict(
      references,
      [{ path: "${slug}.png", file: "client/src/c.tsx" }],
      new Map([["logo.png", 200], ["hero.webp", 200]]),
    );
    expect(verdict.problems).toHaveLength(1);
    expect(verdict.problems[0]).toContain("not the whole list");
    expect(verdict.line).toContain("DYNAMIC");
  });

  it("⚠ refuses an EMPTY scan rather than calling it a clean bucket", () => {
    /* `absence-only-expect-passes-on-nothing`, at the verdict rather than at an
       assertion: zero references and zero problems is what a broken reader
       looks like, and it is indistinguishable from a perfect bucket. */
    const verdict = assetVerdict([], [], new Map());
    expect(verdict.problems).toHaveLength(1);
    expect(verdict.problems[0]).toContain("re-point it");
  });
});
