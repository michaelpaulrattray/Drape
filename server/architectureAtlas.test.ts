import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { atlasSourcePaths, checkArchitecture } from "../scripts/check-architecture.mts";
import { sourceText } from "../scripts/generate-architecture.mts";

const repoRoot = path.resolve(__dirname, "..");

/**
 * The Atlas guard (plan §P.7, §P.10).
 *
 * The repo has no CI service, so `pnpm test` *is* the CI — and since every push
 * is gated on the suite, this guard gates deploys too. It fails in three
 * distinct ways, each with a different fix:
 *
 *   stale output          → run `pnpm architecture:generate`, review the diff,
 *                           and include it in the change like any other file.
 *   schema-invalid or
 *   nondeterministic      → a generator bug. Fix it before proceeding.
 *   a new finding         → a control went dormant, a route lost its auth
 *                           classification, or a module marked for retirement
 *                           gained a caller. Fix the code, or record a reviewed
 *                           exception. Silence is never an option.
 *
 * The check reads only source; it opens no database, reads no env value and
 * touches no storage, so it is safe in every environment the suite runs in.
 */
describe("architecture atlas", () => {
  it(
    "is fresh, schema-valid, deterministic and free of secret-shaped strings",
    () => {
      const { ok, problems } = checkArchitecture();
      expect(ok, `Atlas check failed:\n  - ${problems.join("\n  - ")}`).toBe(true);
    },
    60_000,
  );

  it("⚠ AN ATLAS PATH GIT DOES NOT TRACK IS A CLONE THAT CANNOT BUILD", () => {
    /*
      The incident: `52f4d93b` committed an Atlas naming
      `server/castingV2/carrySurvival.test.ts` and never staged the file. 173
      lines, 28 passing arms, present on exactly one machine — and the freshness
      check above could not see it, because it regenerates from that same
      working tree and therefore agreed with itself. A clean clone of `main`
      failed this file with a fingerprint mismatch and no explanation.

      Driven on an INJECTED index rather than the real one, so the arm proves
      the rule and not today's tree: a suite that passes only because the tree
      happens to be clean tests nothing on the day it is not.
    */
    const realPaths = atlasSourcePaths(JSON.parse(
      fs.readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
    ));
    /* Population first — an empty path list would make both arms below vacuous,
       and an empty list is exactly what a renamed `path:` key produces. */
    expect(realPaths.length, "source paths the Atlas names").toBeGreaterThan(500);
    expect(realPaths).toContain("server/castingV2/carrySurvival.test.ts");

    /* An index missing one real file — the defect, reported by name because the
       action is `git add <path>` and a count does not tell you what to add. */
    const missingOne = new Set(realPaths.filter((file) => file !== realPaths[0]));
    const withHole = checkArchitecture({ trackedFiles: () => missingOne });
    expect(withHole.problems.join("\n")).toContain(`${realPaths[0]} is in the Atlas but is NOT TRACKED BY GIT`);

    /* And the reader's own blindness is a problem rather than a pass: an empty
       `git ls-files` — no git, a wrong cwd, a swallowed throw — would otherwise
       let this check report a clean tree while examining nothing. */
    const blind = checkArchitecture({ trackedFiles: () => new Set<string>() });
    expect(blind.problems.join("\n")).toContain("cannot see the index");
    /* It must NOT then also blame every file individually — one honest problem,
       not a thousand derived from it. */
    expect(blind.problems.filter((p) => p.includes("NOT TRACKED BY GIT"))).toEqual([]);
  }, 120_000);

  it("CAN FAIL — the path reader driven on the shapes the generator emits", () => {
    /*
      `atlasSourcePaths` decides a POPULATION, and a population reader that
      returns everything is as useless as one that returns nothing. The
      generator emits three kinds of `path:` and only one is a file.
    */
    expect(atlasSourcePaths({
      modules: [{ path: "server/db/storageCleanup.ts" }],
      tests: [{ path: "server/castingV2/carrySurvival.test.ts" }],
      client: [{ path: "client/src/App.tsx" }],
      routes: [
        /* Not a file — the generator's own placeholder for a router-defined route. */
        { path: "(defined by the router)" },
        /* Not a file — an HTTP path. */
        { path: "/api/health" },
      ],
    })).toEqual([
      "client/src/App.tsx",
      "server/castingV2/carrySurvival.test.ts",
      "server/db/storageCleanup.ts",
    ]);
    /* Nested arbitrarily deep, because the Atlas nests. */
    expect(atlasSourcePaths({ a: { b: [{ c: { path: "scripts/deploy-rite.mts" } }] } }))
      .toEqual(["scripts/deploy-rite.mts"]);
    /* And nothing at all, from something that names no paths. */
    expect(atlasSourcePaths({ meta: { sourceFingerprint: "abc" } })).toEqual([]);
  });

  it("⚠ A CRLF-SMUDGED CHECKOUT IS NOT A STALE ATLAS (fable-1366 §3c)", () => {
    /*
      The generator writes LF; git on Windows hands the working copy back with
      CRLF. A raw byte comparison then reported the Atlas STALE with IDENTICAL
      fingerprints on both sides and an EMPTY `git diff` — a verdict whose own
      instructions cannot reproduce it, on the gate the currency law just gave
      teeth to.

      Driven through `checkArchitecture` itself rather than through the
      normalizer, because a normalizer that is correct and never consulted is
      the failure this whole file exists to be the opposite of.
    */
    const CR = String.fromCharCode(13);
    const smudged = (at: string) =>
      fs.readFileSync(at, "utf8").split("\n").join(`${CR}\n`);
    const { ok, problems } = checkArchitecture({ readFile: smudged });
    expect(ok, `a CRLF checkout was read as stale: ${problems.join(" | ")}`).toBe(true);
  }, 60_000);

  it("CONTROL — a REAL content change is still stale", () => {
    /*
      Without this, the arm above is satisfied by a checker that compares
      nothing at all. One character, inside the committed JSON, and the
      freshness rule must still fire.
    */
    const tampered = (at: string) => {
      const text = fs.readFileSync(at, "utf8");
      return at.endsWith("drape-architecture.json")
        ? text.replace(/"schemaVersion": "/, '"schemaVersion": "9')
        : text;
    };
    const { ok, problems } = checkArchitecture({ readFile: tampered });
    expect(ok).toBe(false);
    expect(problems.join(" ")).toContain("drape-architecture.json is stale");
  }, 60_000);

  /*
    #195 — THE EXPLORER IS UNTRACKED, SO ITS STALENESS IS NOT A FINDING.

    `docs/architecture/index.html` is gitignored (`.gitignore:21`). Merging a
    PR that regenerated the Atlas and fast-forwarding `main` brings a new
    `drape-architecture.json` and CANNOT bring the explorer, so the local copy
    is stale BY CONSTRUCTION — and the checker refused over it, on a file whose
    only writer is `pnpm architecture:generate` and whose "diff" nobody can
    review. Three consecutive deploy rites paid for it.

    All four arms are driven through INJECTED dependencies rather than by
    touching git's index: `git add -f` on an ignored file to prove a tracked
    arm would be a test that mutates the repository to observe itself.
  */
  const realTracked = (): ReadonlySet<string> => new Set(
    execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
      .split("\n")
      .filter(Boolean)
      .map((line) => line.trim()),
  );
  const EXPLORER = "docs/architecture/index.html";
  const SCHEMA_FILE = "docs/architecture/drape-architecture.schema.json";
  /* A reader that answers `answer` for one repo-relative path and the real
     bytes for everything else. `null` means "this file is not there". */
  const readerFor = (relative: string, answer: string | null) => (at: string): string => {
    if (at.split("\\").join("/").endsWith(relative)) {
      if (answer === null) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return answer;
    }
    return fs.readFileSync(at, "utf8");
  };

  it("⚠ #195 — AN UNTRACKED EXPLORER THAT DISAGREES WITH THE ATLAS IS NOT A PROBLEM", () => {
    /* foreman-78's scenario, reproduced exactly: the file on disk holds an
       older render. Today's population is the REAL index, in which the
       explorer is ignored — so if this ever goes red, either the file was
       tracked or the rule was removed. */
    expect(realTracked().has(EXPLORER), "the explorer is gitignored today").toBe(false);
    const { ok, problems } = checkArchitecture({ readFile: readerFor(EXPLORER, "<html>an older render</html>") });
    expect(problems.join(" | ")).not.toContain("index.html");
    expect(ok, `problems: ${problems.join(" | ")}`).toBe(true);
  }, 60_000);

  it("CONTROL — the same disagreement on a TRACKED explorer still refuses", () => {
    /* Without this the arm above is satisfied by a checker that stopped
       comparing. The only difference between the two is what git says. */
    const tracked = new Set([...realTracked(), EXPLORER]);
    const { ok, problems } = checkArchitecture({
      trackedFiles: () => tracked,
      readFile: readerFor(EXPLORER, "<html>an older render</html>"),
    });
    expect(ok).toBe(false);
    expect(problems.join(" | ")).toContain(`${EXPLORER} is stale or hand-edited`);
  }, 60_000);

  it("CONTROL — a TRACKED generated file missing from the working tree refuses", () => {
    /* The state step 3 already reports for the Atlas itself. */
    const tracked = new Set([...realTracked(), EXPLORER]);
    const { ok, problems } = checkArchitecture({
      trackedFiles: () => tracked,
      readFile: readerFor(EXPLORER, null),
    });
    expect(ok).toBe(false);
    expect(problems.join(" | ")).toContain(`${EXPLORER} is tracked but is not in the working tree`);
  }, 60_000);

  it("CONTROL — the secret sweep REPORTS a file it cannot open rather than skipping it", () => {
    /*
      ⚠ THIS WAS THE SECOND HALF OF THE ARM ABOVE AND CI CAUGHT IT. Pinned
      there on `index.html`, it passed locally and failed on the gate: on a
      fresh clone that file DOES NOT EXIST, so `readdirSync` never lists it and
      step 6 never tries to read it. Two behaviours through one fixture whose
      population differs between worlds — the arm could not be right in both.

      Driven on `annotations.yaml` instead: tracked, present in every world,
      inside `docs/architecture/`, and read by step 6 alone — so this arm says
      exactly one thing and says it everywhere. A swallowed read is the silent
      green invariant 7 exists against.
    */
    const { ok, problems } = checkArchitecture({
      readFile: readerFor("docs/architecture/annotations.yaml", null),
    });
    expect(ok).toBe(false);
    expect(problems.join(" | ")).toContain("annotations.yaml: could not be read for the secret sweep");
  }, 60_000);

  it("⚠ #195 SWEEP — the committed SCHEMA is generated too, and nothing compared it", () => {
    /*
      `writeAtlas` writes three files; this check only ever read two of them.
      `drape-architecture.schema.json` IS tracked, so a hand-edited or stale
      one is exactly the reviewable finding the explorer is not — and it
      shipped green until now. Same class as the arms above with the sign
      flipped, which is why both go through one comparison.
    */
    expect(realTracked().has(SCHEMA_FILE), "the schema is committed").toBe(true);
    const { ok, problems } = checkArchitecture({
      readFile: readerFor(SCHEMA_FILE, '{\n  "hand": "edited"\n}\n'),
    });
    expect(ok).toBe(false);
    expect(problems.join(" | ")).toContain(`${SCHEMA_FILE} is stale or hand-edited`);
  }, 60_000);

  it("lives outside the client tree so Vite never bundles it", () => {
    // §P.9: the explorer is an internal document, not a product surface. It
    // sits under docs/ precisely so it cannot be shipped to a browser by
    // accident, and the vite root is client/ — this pins both facts.
    const atlasDir = path.join(repoRoot, "docs", "architecture");
    expect(fs.existsSync(atlasDir)).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "client", "src", "architecture"))).toBe(false);

    const viteConfig = fs.readFileSync(path.join(repoRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toContain("docs/architecture");
    expect(viteConfig).not.toContain("docs\\architecture");
  });

  it("records env var names without their values", () => {
    // The generator cannot read a value by construction (§P.3); this pins the
    // shape of the output so a future extension cannot quietly start doing so.
    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { envVars: Array<Record<string, unknown>> };

    expect(atlas.envVars.length).toBeGreaterThan(0);
    for (const entry of atlas.envVars) {
      expect(Object.keys(entry).sort()).toEqual(["id", "name", "valueRecorded"]);
      expect(entry.valueRecorded).toBe(false);
    }
  });

  /**
   * ⚠ A FLAG IS AN ENVIRONMENT VARIABLE, AND FOR MOST OF THIS ATLAS'S LIFE THE
   * TWO LISTS DID NOT AGREE THAT IT WAS.
   *
   * `collectFlags` was hardened to read three access forms — `process.env.NAME`,
   * `process.env["NAME"]`, and `const SOMETHING_ENV = "NAME"` — because the
   * rollout scopes are all reached through that third one. `collectEnvVars` was
   * a separate reader that knew only the first two, and nothing ever compared
   * them. Read off the committed artifact on 2026-08-23: **25 of the 29 flags
   * were absent from `envVars`**, among them `CASTING_V2_SCOPE`, the root flag
   * of the whole program. Four evidence-bucket credential NAMES were missing
   * with them (`R2_EVIDENCE_BUCKET` and its two keys, `R7_EVIDENCE_COMPOSER_RECIPE`).
   *
   * This is the strongest kind of finding an artifact can carry, because it
   * needs no outside reference: **one list contradicted the other inside the
   * same file.**
   *
   * `collectFlags` is now a filtered VIEW of the env-var set rather than a
   * parallel reading of the same source (working law 4), so the inclusion holds
   * by construction. This asserts it anyway — the construction is the fix, and
   * this is what notices if someone un-derives it.
   */
  /**
   * The vocabulary collector reads its two registries by TEXT — the declaration
   * header, then card names by indentation. It is correct today (29 subjects,
   * 30 facets, both matching), and it had two `continue`s that would have
   * emitted an EMPTY vocabulary on a rename or a reformat, in exactly the tone
   * the artifact uses to say twenty-nine. Those now throw.
   *
   * This is the other half: the registries are IMPORTED and compared, so the
   * two readings are a text scan and a module evaluation rather than one
   * instrument agreeing with itself.
   */
  it("names every subject and facet card the registries declare", async () => {
    const { SUBJECT_CARDS } = await import("./castingV2/subjectCards");
    const { FACET_CARDS } = await import("./castingV2/facetCards");

    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { vocabulary: Array<{ name: string; vocabulary: string }> };

    for (const [kind, registry] of [
      ["subject", SUBJECT_CARDS],
      ["facet", FACET_CARDS],
    ] as const) {
      const declared = Object.keys(registry).sort();
      const inAtlas = atlas.vocabulary
        .filter((entry) => entry.vocabulary === kind)
        .map((entry) => entry.name)
        .sort();

      expect(declared.length, `${kind} cards declared`).toBeGreaterThan(10);
      expect(inAtlas, `the Atlas's ${kind} vocabulary is not the registry's`).toEqual(declared);
    }
  });

  it("every flag is also an env var — one reader, not two", () => {
    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { envVars: Array<{ name: string }>; flags: Array<{ name: string }> };

    const envNames = new Set(atlas.envVars.map((entry) => entry.name));
    const flagNames = atlas.flags.map((entry) => entry.name);

    /* Population first: an empty flag list is a subset of anything, and that
       reads exactly like coverage (`absence-only-expect-passes-on-nothing`). */
    expect(flagNames.length).toBeGreaterThan(20);
    expect(envNames.size).toBeGreaterThan(flagNames.length);

    expect(
      flagNames.filter((name) => !envNames.has(name)),
      "flags the env-var inventory has never heard of — the two readers have stopped seeing the same access forms",
    ).toEqual([]);
  });

  /**
   * ⚠ THE EDGE GRAPH IS THE DELETION AUTHORITY, AND IT KNEW ONE OF THE THREE
   * WAYS A MODULE REACHES ANOTHER.
   *
   * CLAUDE.md: *"nothing is removed while its retirement view still shows live
   * callers."* That view is built from these edges alone, so ZERO callers is the
   * reading that authorizes removal — and `collectImportEdges` walked
   * `getImportDeclarations()`, which returns static `import … from "…"` and
   * nothing else. Re-exports and dynamic imports produced no edge at all.
   *
   * Measured 2026-08-23 against the committed artifact: 134 barrel reaches and
   * 43 dynamic ones were missing, and **65 modules showed ZERO inbound edges
   * while being genuinely reached** — among them `server/routes/emailAuth.ts`
   * and `server/routes/googleAuth.ts`, both login routes, reached only by
   * `await import(…)` in `_core/index.ts` and holding four of invariant 9's
   * five session mints between them; and all three background workers, which
   * the Atlas's own `workers` list names.
   *
   * Six modules under a `retire` lifecycle read as removable and were not.
   *
   * # THIS ARM IS A GENUINELY DIFFERENT READING, NOT A COPY
   *
   * The generator resolves through the TypeScript compiler — `ts-morph` symbols
   * and `getModuleSpecifierSourceFile()`. This walks the tree with a regex and
   * resolves against the FILE SYSTEM. Neither can inherit the other's blind
   * spot, which is the whole point (working law 4); a checker sharing its
   * subject's resolver cannot show where that resolver stops.
   *
   * Relative specifiers only. Aliased ones (`@/…`) are a real reach this arm
   * does not claim to cover — stated rather than left as a silent floor, so a
   * green run here is a floor and not coverage.
   */
  it("holds the barrel and dynamic reaches, not only the static ones", () => {
    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { edges: Array<{ from: string; to: string; kind: string }>; modules: Array<{ path: string }> };

    const known = new Set(atlas.edges.map((edge) => `${edge.from}|${edge.to}`));
    const modules = new Set(atlas.modules.map((module) => module.path));

    const reExport = /export\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*["'](\.[^"']+)["']/g;
    /* NOT preceded by `:` — `let x: import("./y").T` is TypeScript's import-TYPE
       syntax, erased at compile time and not a runtime reach. The generator does
       not count it either, and the two instances in this tree resolve to modules
       carrying 12 and 4 other inbound edges, so no deletion verdict rests on the
       question. Narrowed with its reason stated rather than quietly filtered. */
    const dynamic = /(?:^|[^:\s])\s*\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g;

    const found = { barrel: [] as string[], dynamic: [] as string[] };
    const missing: string[] = [];

    const resolve = (fromFile: string, specifier: string): string | undefined => {
      const base = path.resolve(path.dirname(path.join(repoRoot, fromFile)), specifier);
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ]) {
        const rel = path.relative(repoRoot, candidate).replaceAll("\\", "/");
        if (modules.has(rel)) return rel;
      }
      return undefined;
    };

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name) || /\.(test|spec)\.tsx?$/.test(entry.name)) continue;
        const from = path.relative(repoRoot, full).replaceAll("\\", "/");
        if (!modules.has(from)) continue;
        /* Block comments stripped first: a `{@link import("./x")}` in a docblock
           is a documentation reference, not a reach, and counting it would make
           this reader disagree with the generator about something neither of
           them is wrong about. */
        const text = fs.readFileSync(full, "utf8").replace(/\/\*[^]*?\*\//g, "");
        for (const [pattern, bucket] of [
          [reExport, found.barrel],
          [dynamic, found.dynamic],
        ] as const) {
          pattern.lastIndex = 0;
          for (const hit of text.matchAll(pattern)) {
            const to = resolve(from, hit[1]!);
            if (!to) continue;
            bucket.push(`${from} -> ${to}`);
            if (!known.has(`module:${from}|module:${to}`)) missing.push(`${from} -> ${to}`);
          }
        }
      }
    };
    for (const root of ["server", "client/src", "shared", "drizzle"]) {
      walk(path.join(repoRoot, root));
    }

    /* Population first, per shape — a reader that finds nothing agrees with any
       graph at all, and that reads exactly like coverage. */
    expect(found.barrel.length, "no re-exports found — the reader has stopped reading").toBeGreaterThan(50);
    expect(found.dynamic.length, "no dynamic imports found — the reader has stopped reading").toBeGreaterThan(10);

    expect(
      [...new Set(missing)].sort(),
      "reaches the Atlas's edge graph does not have — a module reached only this way reads as having no callers, which is what authorizes deleting it",
    ).toEqual([]);
  });

  /**
   * THE FRESHNESS VERDICT ABOVE IS ONLY A READING IF ITS HASH IS OF THE SOURCE
   * (found opus-926 §5, ordered fable-1234 §2b).
   *
   * `core.autocrlf` is `true` here, so `git checkout` rewrites line endings on
   * every file it touches and the working tree runs MIXED. The fingerprint
   * hashes file text, so before `sourceText` it hashed that skew: the same
   * commit answered `23a85001b1a85f4d` and then `99989fd2d9720929` minutes
   * apart, and flipping ONE file from LF to CRLF — content untouched, `git
   * diff` empty — moved it on demand. The first test in this file was
   * therefore a coin flip wearing a reading's face, over the arm that keeps
   * the Atlas usable as the retirement program's deletion authority.
   *
   * This is the property guarded by construction rather than remembered. It
   * drives the normalize DIRECTLY, on a fixture pair, so it cannot be rescued
   * by whatever endings this checkout happens to hold.
   */
  it("hashes the SOURCE and not this disk — CRLF and LF text are the same text", () => {
    const lf = "const a = 1;\nconst b = 2;\n\nexport { a, b };\n";
    const crlf = lf.replaceAll("\n", "\r\n");

    // The negative control: the two fixtures really are different bytes, so a
    // passing assertion below is the normalize working and not the fixtures
    // being identical.
    expect(crlf).not.toEqual(lf);
    expect(sha(crlf)).not.toEqual(sha(lf));

    expect(sourceText(crlf)).toEqual(sourceText(lf));
    expect(sha(sourceText(crlf))).toEqual(sha(sourceText(lf)));

    // And a lone CR is CONTENT, not a line ending — it must survive, or the
    // normalize is quietly editing source rather than folding endings.
    expect(sourceText("a\rb")).toEqual("a\rb");
  });
});

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
