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

export function checkArchitecture(): CheckResult {
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
    const committed = fs.readFileSync(committedPath, "utf8");
    const fresh = `${JSON.stringify(atlas, null, 2)}\n`;
    if (committed !== fresh) {
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
    if (fs.readFileSync(explorerPath, "utf8") !== renderExplorer(atlas)) {
      problems.push("docs/architecture/index.html is stale or hand-edited — regenerate it");
    }
  }

  // 5. No secret-shaped strings in anything we publish.
  for (const file of fs.existsSync(committedDir) ? fs.readdirSync(committedDir) : []) {
    const contents = fs.readFileSync(path.join(committedDir, file), "utf8");
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
