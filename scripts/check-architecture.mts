/**
 * Atlas check (plan §P.7, §P.10).
 *
 * Regenerates to a temp directory, byte-diffs against the committed output,
 * validates against the schema with ajv, and diffs the findings list so a
 * *newly* dormant control or a newly-called retired module fails loudly.
 *
 * The repo has no CI service, so `pnpm test` is the CI: a vitest guard runs
 * this same logic. This CLI exists for running it directly.
 *
 * It never writes the committed files — regenerating is a developer action
 * whose diff gets reviewed like any other change (§P.7).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The 2020-12 build, not ajv's default draft-07 one — the schema declares
// draft 2020-12 (§P.5) and the default build cannot resolve that meta-schema.
import { Ajv2020 } from "ajv/dist/2020.js";

import { SCHEMA, buildAtlas, renderExplorer } from "./generate-architecture.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const committedDir = path.join(repoRoot, "docs", "architecture");

/**
 * Belt and braces (§P.9). The generator structurally cannot read an env value,
 * but the outputs are published internally, so they are also greped for
 * anything shaped like a credential before they ship.
 */
const SECRET_SHAPES: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{16,}/, "OpenAI-style key"],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, "Stripe secret key"],
  [/\bwhsec_[A-Za-z0-9]{16,}/, "Stripe webhook secret"],
  [/\bre_[A-Za-z0-9]{16,}/, "Resend key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bmysql:\/\/[^\s"']*:[^\s"']+@/, "database URL with credentials"],
  [/\bhttps:\/\/[^\s"']*:[^\s"']+@/, "URL with embedded credentials"],
];

export type CheckResult = { ok: boolean; problems: string[] };

/**
 * ⚠ THE COMPARISON IS ON CONTENT, NOT ON THE BYTES GIT LEFT ON DISK
 * (fable-1366 §3c, found on a fresh worktree checkout).
 *
 * The generator writes LF. Git, with `core.autocrlf` on Windows, hands the
 * working copy back with CRLF — so a raw `!==` here reported the committed
 * Atlas STALE while its own `sourceFingerprint` and the source's were
 * IDENTICAL, and `git diff` was empty. A verdict of "stale" that the diff it
 * tells you to review cannot show is a checker teaching people to ignore it,
 * on the one gate the currency law just gave teeth.
 *
 * The 2026-08-21 EOL fix normalized the FINGERPRINT and left this second
 * comparison alone — an exemption where a class fix was owed, which is the
 * `exemption-is-not-a-class-fix` shape exactly. So the normalizer is a named
 * function used at BOTH comparison sites rather than an inline `.replace()` at
 * the one that bit, and the sweep for siblings is recorded: the capability
 * census compares PARSED JSON (`JSON.stringify(committed.static)`), so it was
 * never exposed, and it is the only other committed-artifact checker.
 *
 * A line ending is a fact about the checkout, never about what the generator
 * produced. Nothing else is normalized: a real content change still fails.
 */
const LF_ONLY = (text: string): string => text.split("\r\n").join("\n");
const sameContent = (a: string, b: string): boolean => LF_ONLY(a) === LF_ONLY(b);

/**
 * The three reads this function makes, injectable so the freshness rule above
 * can be DRIVEN rather than reasoned about.
 *
 * Without it `sameContent` could be exported and unit-tested while sitting
 * beside a comparison that never called it — a reader that reports correctly
 * and is never consulted, which is the one failure this whole checker exists to
 * be the opposite of. The default is the filesystem, so every real caller is
 * byte-for-byte unchanged.
 */
export type CheckReader = (absolutePath: string) => string;

/**
 * ⚠ EVERY PATH THE ATLAS NAMES IS A PATH THE REPOSITORY HAS — the check that
 * was missing on 2026-08-22, and the reason a clean clone of `main` was RED.
 *
 * The Atlas is built by walking the WORKING TREE. Git pushes the INDEX. Those
 * are different sets, and nothing compared them: `52f4d93b` regenerated the
 * Atlas with `server/castingV2/carrySurvival.test.ts` in the tree, committed
 * the Atlas, and never staged the file. 173 lines and 28 passing arms — the
 * class arm for *"every delivered fact survives the next repaint"* — existed on
 * one machine and nowhere else, while the committed Atlas said the repository
 * had it.
 *
 * **Nothing went red on the machine that made the mistake**, which is the whole
 * shape of it: the freshness check regenerates from that same working tree, so
 * it agreed with itself. Every custody suite line for the next eleven hours
 * counted 28 tests that were not at HEAD, and a fresh clone failed this very
 * checker with a fingerprint mismatch it had no way to explain.
 *
 * The deploy rite could not catch it either: its dirty check filters `??` lines
 * deliberately, because a tree full of disposable scripts must not block a
 * push. So the gap was real and neither existing guard was wrong.
 *
 * Doctrine 23: the arm goes at the producer. This runs where the Atlas is
 * MADE — every path it emits, checked against what git actually tracks.
 *
 * ⚠ ITS COVERAGE IS THE ATLAS'S COVERAGE, WHICH IS NOT THE REPOSITORY.
 * Measured 2026-08-23: the Atlas names 1,494 source paths and **not one of them
 * is under `scripts/`**. So an untracked driver, court or ceremony is invisible
 * to this check, and the first thing it failed to catch was a new driver
 * written in the same sitting as itself. That is a bound rather than a bug —
 * the Atlas is a map of the application — but it is stated here so nobody reads
 * a green as "nothing was dropped".
 */
export type TrackedFiles = () => ReadonlySet<string>;

const gitTrackedFiles: TrackedFiles = () => new Set(
  execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim()),
);

/** Every `path:` the Atlas emits that looks like a source file in this repo. */
export function atlasSourcePaths(atlas: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      /* A real repo-relative source path. The generator also emits
         `"(defined by the router)"` for routes with no file of their own, and
         route paths like `/api/health` — neither is a file and neither is
         git's business. */
      if (key === "path" && typeof value === "string" && /^[\w.@-]+(\/[\w.@-]+)*\.(ts|tsx|mts|cts|js|jsx)$/.test(value)) {
        found.add(value);
      } else {
        walk(value);
      }
    }
  };
  walk(atlas);
  return [...found].sort();
}

export function checkArchitecture(
  dependencies: { readFile?: CheckReader; trackedFiles?: TrackedFiles } = {},
): CheckResult {
  const readFile = dependencies.readFile ?? ((at: string) => fs.readFileSync(at, "utf8"));
  const trackedFiles = dependencies.trackedFiles ?? gitTrackedFiles;
  const problems: string[] = [];

  const atlas = buildAtlas();

  // 1. Schema validity.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(SCHEMA);
  if (!validate(atlas)) {
    for (const error of validate.errors ?? []) {
      problems.push(`schema: ${error.instancePath || "/"} ${error.message}`);
    }
  }

  // 2. Determinism — two builds on an unchanged tree must be identical.
  const second = buildAtlas();
  if (JSON.stringify(atlas) !== JSON.stringify(second)) {
    problems.push(
      "generator is not deterministic: two runs on an unchanged tree differed",
    );
  }

  // 3. Freshness — the committed output must match what the source produces.
  const committedPath = path.join(committedDir, "drape-architecture.json");
  if (!fs.existsSync(committedPath)) {
    problems.push("docs/architecture/drape-architecture.json is missing — run pnpm architecture:generate");
  } else {
    const committed = readFile(committedPath);
    const fresh = `${JSON.stringify(atlas, null, 2)}\n`;
    if (!sameContent(committed, fresh)) {
      const committedAtlas = JSON.parse(committed);
      problems.push(
        "docs/architecture/drape-architecture.json is stale — run pnpm architecture:generate and review the diff " +
          `(committed fingerprint ${committedAtlas?.meta?.sourceFingerprint}, source ${atlas.meta.sourceFingerprint})`,
      );

      // Say *what* changed, so a stale file is cheap to act on.
      const before = new Set((committedAtlas.findings ?? []).map((f: { id: string }) => f.id));
      const after = new Set(atlas.findings.map((finding) => finding.id));
      const added = [...after].filter((id) => !before.has(id as string));
      const removed = [...before].filter((id) => !after.has(id as string));
      if (added.length > 0) problems.push(`  new findings: ${added.slice(0, 10).join(", ")}`);
      if (removed.length > 0) problems.push(`  resolved findings: ${removed.slice(0, 10).join(", ")}`);
    }
  }

  // 4. The explorer must be derived from the JSON, never hand-edited.
  const explorerPath = path.join(committedDir, "index.html");
  if (fs.existsSync(explorerPath)) {
    if (!sameContent(readFile(explorerPath), renderExplorer(atlas))) {
      problems.push("docs/architecture/index.html is stale or hand-edited — regenerate it");
    }
  }

  /*
    5. Every path the Atlas names is one git tracks. See {@link TrackedFiles} —
    the Atlas walks the working tree, git pushes the index, and until 2026-08-23
    nothing compared them.

    Reported one file per line rather than as a count: the action is `git add
    <path>`, and a count does not tell you what to add.
  */
  {
    const tracked = trackedFiles();
    /* The population control. An empty `git ls-files` — no git, a wrong cwd, a
       reader that threw and was swallowed — would make the loop below pass over
       nothing while reporting the tree clean, which is the exact green this
       check exists to stop being possible. */
    if (tracked.size === 0) {
      problems.push("the tracked-file reader returned nothing — this check cannot see the index");
    } else {
      for (const file of atlasSourcePaths(atlas)) {
        if (!tracked.has(file)) {
          problems.push(
            `${file} is in the Atlas but is NOT TRACKED BY GIT — a clean clone would not have it: git add ${file}`,
          );
        }
      }
    }
  }

  // 6. No secret-shaped strings in anything we publish.
  for (const file of fs.existsSync(committedDir) ? fs.readdirSync(committedDir) : []) {
    const contents = readFile(path.join(committedDir, file));
    for (const [pattern, label] of SECRET_SHAPES) {
      if (pattern.test(contents)) problems.push(`${file}: contains something shaped like a ${label}`);
    }
  }

  return { ok: problems.length === 0, problems };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { ok, problems } = checkArchitecture();
  if (!ok) {
    console.error(`[atlas:check] FAILED\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("[atlas:check] OK — output is fresh, schema-valid, deterministic and secret-free");
}
