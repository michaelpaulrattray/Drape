/**
 * Drape Atlas — the self-documenting architecture map (plan §P).
 *
 *   pnpm architecture:generate   write docs/architecture/*
 *   pnpm architecture:check      regenerate to a temp dir and diff
 *
 * Everything here is derived mechanically from source. The generator never
 * executes app code, never opens a database connection, never reads an env
 * *value*, and never touches R2 — so the output cannot contain a secret by
 * construction (§P.3, §P.9).
 *
 * Determinism is a hard requirement (§P.6): arrays are stable-sorted by id and
 * nothing carries a timestamp, so two runs on an unchanged tree are
 * byte-identical. `sourceFingerprint` hashes the tracked source inputs rather
 * than the commit, because embedding a SHA would create an impossible
 * commit-then-regenerate loop.
 *
 * v1 scope is deliberately capped (§P.1) to what Casting V2 implementation and
 * the M14 retirement actually consume. Extensions land with the milestone that
 * needs them (§P.2) — never as a standalone documentation project.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind, type SourceFile, type Node } from "ts-morph";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = process.env.ATLAS_OUT_DIR
  ? path.resolve(process.env.ATLAS_OUT_DIR)
  : path.join(repoRoot, "docs", "architecture");

export const SCHEMA_VERSION = "1.0.0";
export const GENERATOR_VERSION = "1.0.0";

/* ------------------------------------------------------------------ types */

type Entity = { id: string; [key: string]: unknown };
type Edge = { from: string; to: string; kind: string };
type Finding = {
  id: string;
  severity: "info" | "warn" | "error";
  kind: string;
  subject: string;
  message: string;
  accepted?: boolean;
};

/* ------------------------------------------------------- lifecycle seeding */

/**
 * Lifecycle status seeded from the plan's §C module map. These are the rows
 * the M14 retirement register is built from, and the Atlas is the deletion
 * authority (§P.10): nothing marked `retire` may be removed while this map
 * still shows live importers.
 */
const LIFECYCLE: Array<{ prefix: string; status: "active" | "compat" | "retire" | "delete" }> = [
  { prefix: "client/src/features/casting/", status: "retire" },
  { prefix: "client/src/features/studio/", status: "retire" },
  { prefix: "client/src/components/ui/sidebar.tsx", status: "delete" },
  { prefix: "client/src/components/Navigation.tsx", status: "delete" },
  { prefix: "client/src/styles/canvas-tokens.css", status: "retire" },
  { prefix: "server/casting/evidence/", status: "retire" },
  { prefix: "server/casting/geminiClient.ts", status: "compat" },
  { prefix: "server/casting/geminiGeneration.ts", status: "compat" },
  { prefix: "server/casting/geminiViews.ts", status: "compat" },
  { prefix: "server/casting/aiService.ts", status: "compat" },
  { prefix: "server/casting/composeIdentityPayload.ts", status: "delete" },
  { prefix: "server/casting/upscaleService.ts", status: "delete" },
  { prefix: "server/routes/generation/castingImaging.ts", status: "compat" },
  { prefix: "server/routes/generation/castingRefinement.ts", status: "compat" },
  { prefix: "server/routes/generation/castingParse.ts", status: "compat" },
];

function lifecycleFor(relative: string): string {
  const hit = LIFECYCLE.find((entry) => relative.startsWith(entry.prefix));
  return hit ? hit.status : "active";
}

/** Path-inferred domain. Annotations may override; code cannot say it. */
function domainFor(relative: string): string {
  const rules: Array<[RegExp, string]> = [
    [/^server\/_core\//, "platform"],
    [/^server\/casting\/evidence\//, "evidence"],
    [/^server\/casting\//, "casting"],
    [/^server\/castingV2\//, "casting-v2"],
    [/^server\/providers\//, "providers"],
    [/^server\/wardrobe\//, "wardrobe"],
    [/^server\/stripe\//, "billing"],
    [/^server\/security\//, "security"],
    [/^server\/slack\//, "alerting"],
    [/^server\/logging\//, "platform"],
    [/^server\/monitoring\//, "platform"],
    [/^server\/db\//, "data"],
    [/^server\/routes\/admin\//, "admin"],
    [/^server\/routes\//, "api"],
    [/^client\/src\/foundation\//, "foundation"],
    [/^client\/src\/features\/([\w-]+)\//, "$1"],
    [/^client\/src\/components\/ui\//, "ui-primitives"],
    [/^client\/src\/components\//, "client-shared"],
    [/^client\/src\/pages\//, "pages"],
    [/^client\/src\/styles\//, "styles"],
    [/^shared\//, "shared"],
    [/^drizzle\//, "data"],
  ];
  for (const [pattern, name] of rules) {
    const match = relative.match(pattern);
    if (match) return name.startsWith("$") ? match[Number(name.slice(1))] : name;
  }
  return "unassigned";
}

/* --------------------------------------------------------------- file scan */

const SCANNED_ROOTS = ["server", "client/src", "shared", "drizzle"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".css", ".mts"];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = SCANNED_ROOTS.flatMap((root) => walk(path.join(repoRoot, root)))
  .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
  .sort();

const sourceFiles = allFiles.filter(
  (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx") && !file.endsWith(".d.ts"),
);
const testFiles = allFiles.filter((file) => /\.(test|spec)\.tsx?$/.test(file));

function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

/* ---------------------------------------------------------- tRPC procedures */

const AUTH_BY_BUILDER: Record<string, string> = {
  publicProcedure: "public",
  // Signed in but not yet approved — the narrow onboarding surface. Its own
  // class, not a flavour of "protected", because it is the one place the beta
  // approval gate deliberately does not apply.
  onboardingProcedure: "onboarding",
  protectedProcedure: "protected",
  adminProcedure: "admin",
  moderatorProcedure: "moderator",
};

type Procedure = {
  id: string;
  namespace: string;
  name: string;
  type: "query" | "mutation" | "subscription";
  auth: string;
  strictInput: boolean;
  rateLimited: boolean;
  file: string;
};

/** Every `const x = router({...})` in the server tree, by variable name. */
function routerDeclarations(project: Project) {
  const declarations = new Map<string, Node>();
  for (const sourceFile of project.getSourceFiles()) {
    const relative = path.relative(repoRoot, sourceFile.getFilePath()).replaceAll("\\", "/");
    if (!relative.startsWith("server/")) continue;
    for (const declaration of sourceFile.getVariableDeclarations()) {
      const call = declaration.getInitializer()?.asKind(SyntaxKind.CallExpression);
      if (!call) continue;
      const callee = call.getExpression().getText();
      if (callee !== "router" && callee !== "t.router") continue;
      const literal = call.getArguments()[0]?.asKind(SyntaxKind.ObjectLiteralExpression);
      if (literal) declarations.set(declaration.getName(), literal);
    }
  }
  return declarations;
}

/**
 * Router variable → the namespace its procedures are actually reachable under.
 *
 * Two composition styles are in use and they mean different things:
 *   `key: someRouter`                    nests    → `parent.key`
 *   `...someRouter._def.procedures`      flattens → `parent`
 *
 * Getting this wrong would mint ids that no client could ever call, and the ids
 * are the Atlas's primary keys — so it resolves to a fixed point rather than
 * assuming one level.
 */
function resolveNamespaces(project: Project): Map<string, string> {
  const declarations = routerDeclarations(project);
  const namespaceOf = new Map<string, string>();

  const root = declarations.get("appRouter");
  if (!root) throw new Error("appRouter not found — the root router is the Atlas's entry point");

  for (const property of root.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()) {
    const assignment = property.asKind(SyntaxKind.PropertyAssignment);
    if (assignment) {
      const target = assignment.getInitializer()?.getText() ?? "";
      namespaceOf.set(target, assignment.getName().replace(/['"]/g, ""));
      continue;
    }
    const shorthand = property.asKind(SyntaxKind.ShorthandPropertyAssignment);
    if (shorthand) namespaceOf.set(shorthand.getName(), shorthand.getName());
  }

  for (let pass = 0; pass < 10; pass += 1) {
    let changed = false;
    for (const [variable, namespace] of [...namespaceOf]) {
      const literal = declarations.get(variable);
      if (!literal) continue;
      for (const property of literal.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()) {
        const spread = property.asKind(SyntaxKind.SpreadAssignment);
        if (spread) {
          const child = spread.getExpression().getText().match(/^(\w+)\._def\.procedures$/)?.[1];
          if (child && !namespaceOf.has(child)) {
            namespaceOf.set(child, namespace);
            changed = true;
          }
          continue;
        }
        const assignment = property.asKind(SyntaxKind.PropertyAssignment);
        const child = assignment?.getInitializer()?.getText();
        if (assignment && child && declarations.has(child) && !namespaceOf.has(child)) {
          namespaceOf.set(child, `${namespace}.${assignment.getName().replace(/['"]/g, "")}`);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return namespaceOf;
}

/**
 * Procedures are read from their declaration site: the chain's leading
 * identifier names the auth class, and the trailing `.query`/`.mutation` names
 * the type. A procedure whose builder we cannot classify is a *finding*, never
 * a guess (§P.1).
 */
function collectProcedures(project: Project, namespaceOf: Map<string, string>): Procedure[] {
  const procedures: Procedure[] = [];
  const unreachable: string[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relative = path.relative(repoRoot, sourceFile.getFilePath()).replaceAll("\\", "/");
    if (!relative.startsWith("server/")) continue;

    for (const declaration of sourceFile.getVariableDeclarations()) {
      const initializer = declaration.getInitializer();
      if (!initializer) continue;
      const call = initializer.asKind(SyntaxKind.CallExpression);
      if (!call) continue;
      const callee = call.getExpression().getText();
      if (callee !== "router" && callee !== "t.router") continue;

      const variable = declaration.getName();
      if (variable === "appRouter") continue;
      const namespace = namespaceOf.get(variable);
      if (!namespace) {
        // A router nobody mounts. That is a real finding — an unreachable
        // surface — not something to paper over with a made-up namespace.
        unreachable.push(`${variable} (${relative})`);
        continue;
      }
      const literal = call.getArguments()[0]?.asKind(SyntaxKind.ObjectLiteralExpression);
      for (const property of literal?.getProperties() ?? []) {
        const assignment = property.asKind(SyntaxKind.PropertyAssignment);
        if (!assignment) continue;
        const name = assignment.getName().replace(/['"]/g, "");
        const chain = assignment.getInitializer();
        if (!chain) continue;
        const text = chain.getText();

        // Derived from AUTH_BY_BUILDER so a new builder cannot be classified
        // here without also being given an auth class there.
        const builder = text.match(
          new RegExp(`\\b(${Object.keys(AUTH_BY_BUILDER).join("|")})\\b`),
        )?.[1];
        const typeMatch = text.match(/\.(query|mutation|subscription)\s*\(/);
        if (!typeMatch) continue;

        procedures.push({
          id: `route:${namespace}.${name}`,
          namespace,
          name,
          type: typeMatch[1] as Procedure["type"],
          auth: builder ? AUTH_BY_BUILDER[builder] : "unclassified",
          strictInput: /\.strict\(\s*\)/.test(text),
          rateLimited: /rateLimit|RATE_LIMITS|checkRateLimit/.test(text),
          file: relative,
        });
      }
    }
  }

  UNREACHABLE_ROUTERS.push(...unreachable.sort());
  return procedures.sort((a, b) => a.id.localeCompare(b.id));
}

/** Routers found in source that nothing mounts — surfaced as findings. */
const UNREACHABLE_ROUTERS: string[] = [];

/* -------------------------------------------------------- express surfaces */

function collectExpressRoutes(): Entity[] {
  const source = read("server/_core/index.ts");
  const routes: Entity[] = [];
  // Capture the handler too: three routers mount on /api/auth, and collapsing
  // them to one row would hide two of the app's session-minting surfaces.
  const mount = /app\.(use|get|post|put|delete|patch)\(\s*("([^"]+)"|'([^']+)')\s*,?\s*([\w.]+)?/g;
  let match: RegExpExecArray | null;
  while ((match = mount.exec(source))) {
    const method = match[1].toUpperCase();
    const routePath = match[3] ?? match[4];
    const handler = match[5] ?? "";
    if (!routePath || !routePath.startsWith("/")) continue;
    routes.push({
      id: `express:${method} ${routePath}${handler ? ` (${handler})` : ""}`,
      method,
      path: routePath,
      handler,
      file: "server/_core/index.ts",
    });
  }
  // Routers mounted without a path prefix declare their own paths internally
  // (image proxy, hero, evidence delivery). Missing them would understate the
  // Express surface, so they are listed with the router as the subject.
  for (const hit of source.matchAll(/app\.use\(\s*(\w+Router)\s*\)/g)) {
    routes.push({
      id: `express:USE (router-defined) ${hit[1]}`,
      method: "USE",
      path: "(defined by the router)",
      handler: hit[1],
      file: "server/_core/index.ts",
    });
  }

  const unique = new Map(routes.map((route) => [route.id, route]));
  return [...unique.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/* ------------------------------------------------- env, flags, workers, ops */

/** Names only. The generator must never be able to read a value (§P.3). */
function collectEnvVars(): Entity[] {
  const names = new Set<string>();
  for (const file of sourceFiles.filter((f) => f.startsWith("server/") || f.startsWith("shared/"))) {
    for (const hit of read(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(hit[1]);
    for (const hit of read(file).matchAll(/process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]/g)) names.add(hit[1]);
  }
  return [...names]
    .sort()
    .map((name) => ({ id: `env:${name}`, name, valueRecorded: false }));
}

function collectFlags(): Entity[] {
  const flags = new Set<string>();
  for (const file of sourceFiles.filter((f) => f.startsWith("server/"))) {
    const source = read(file);
    for (const hit of source.matchAll(/process\.env\.([A-Z0-9_]*(SCOPE|ENABLE|STAGE)[A-Z0-9_]*)/g)) {
      flags.add(hit[1]);
    }
  }
  return [...flags].sort().map((name) => ({
    id: `flag:${name}`,
    name,
    grammar: "off|all|users:<ids>",
  }));
}

function collectWorkers(): Entity[] {
  const source = read("server/_core/index.ts");
  const workers: Entity[] = [];
  for (const hit of source.matchAll(/\b(start[A-Z]\w*|run[A-Z]\w*)\s*\(/g)) {
    const name = hit[1];
    if (name === "startServer") continue;
    workers.push({ id: `worker:${name}`, name, startedFrom: "server/_core/index.ts" });
  }
  const unique = new Map(workers.map((worker) => [worker.id, worker]));
  return [...unique.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function collectOperationKinds(): Entity[] {
  const file = "server/casting/operationContract.ts";
  if (!sourceFiles.includes(file)) return [];
  const source = read(file);
  const kinds = new Set<string>();
  for (const hit of source.matchAll(/["']([a-zA-Z]+(?:\.[a-zA-Z]+)+)["']/g)) {
    if (/^[a-z][\w.]*$/.test(hit[1]) && hit[1].includes(".")) kinds.add(hit[1]);
  }
  return [...kinds].sort().map((kind) => ({ id: `operation:${kind}`, kind, contract: file }));
}

function collectCreditCosts(): Entity[] {
  const file = "server/casting/castingCreditCosts.ts";
  if (!sourceFiles.includes(file)) return [];
  const source = read(file);
  const costs: Entity[] = [];
  for (const hit of source.matchAll(/(\w+)\s*:\s*(\d+)\s*,/g)) {
    costs.push({ id: `cost:${hit[1]}`, name: hit[1], credits: Number(hit[2]), file });
  }
  return costs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/* ------------------------------------------------------------- import graph */

function collectImportEdges(project: Project): Edge[] {
  const edges: Edge[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const from = path.relative(repoRoot, sourceFile.getFilePath()).replaceAll("\\", "/");
    if (!sourceFiles.includes(from)) continue;
    for (const declaration of sourceFile.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) continue;
      const to = path.relative(repoRoot, target.getFilePath()).replaceAll("\\", "/");
      if (!sourceFiles.includes(to)) continue;
      edges.push({ from: `module:${from}`, to: `module:${to}`, kind: "imports" });
    }
  }
  const unique = new Map(edges.map((edge) => [`${edge.from}|${edge.to}|${edge.kind}`, edge]));
  return [...unique.values()].sort((a, b) =>
    `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`),
  );
}

/* ----------------------------------------------------------------- findings */

function computeFindings(
  procedures: Procedure[],
  modules: Entity[],
  edges: Edge[],
): Finding[] {
  const findings: Finding[] = [];

  for (const procedure of procedures) {
    if (procedure.auth === "unclassified") {
      findings.push({
        id: `finding:unclassified-auth:${procedure.id}`,
        severity: "error",
        kind: "unclassified-procedure",
        subject: procedure.id,
        message:
          "Client-facing procedure whose auth builder could not be classified. Auth is never inferred — declare it with a known builder.",
      });
    }
    if (procedure.auth === "public") {
      findings.push({
        id: `finding:public-endpoint:${procedure.id}`,
        severity: "info",
        kind: "public-endpoint",
        subject: procedure.id,
        message:
          "Public endpoint. The allowlist is enumerated by decision (access-control law 5) — confirm this belongs on it.",
      });
    }
    if (procedure.auth === "onboarding") {
      findings.push({
        id: `finding:onboarding-endpoint:${procedure.id}`,
        severity: "info",
        kind: "onboarding-endpoint",
        subject: procedure.id,
        message:
          "Reachable by a signed-in but unapproved account. Like the public allowlist, this set is enumerated by decision — an unapproved account is meant to redeem a code and nothing else.",
      });
    }
    if (!procedure.strictInput && procedure.auth !== "public") {
      findings.push({
        id: `finding:non-strict-input:${procedure.id}`,
        severity: "warn",
        kind: "non-strict-input",
        subject: procedure.id,
        message:
          "Input schema does not call .strict(), so unknown fields are silently dropped rather than rejected (law 4).",
      });
    }
  }

  for (const router of UNREACHABLE_ROUTERS) {
    findings.push({
      id: `finding:unmounted-router:${router.split(" ")[0]}`,
      severity: "warn",
      kind: "unmounted-router",
      subject: router,
      message:
        "Router declared but not reachable from appRouter — either dead code or a surface that was meant to be mounted.",
    });
  }

  // A retired or deleted module that still has importers cannot be removed —
  // this is the view M14 uses as its deletion authority (§P.10).
  const importedBy = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "imports") continue;
    importedBy.set(edge.to, [...(importedBy.get(edge.to) ?? []), edge.from]);
  }
  for (const module of modules) {
    const status = module.lifecycle as string;
    if (status !== "retire" && status !== "delete") continue;
    const callers = importedBy.get(module.id) ?? [];
    if (callers.length > 0) {
      findings.push({
        id: `finding:live-caller:${module.id}`,
        severity: status === "delete" ? "error" : "info",
        kind: "retired-module-has-callers",
        subject: module.id,
        message: `Marked ${status} but still imported by ${callers.length} module(s). Not removable yet.`,
      });
    }
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------- build */

/**
 * Hashes every scanned file, tests included — not just `sourceFiles`.
 *
 * The test inventory is part of the output, so a fingerprint that ignored test
 * files would stay identical while the document changed, which reads as "stale
 * for no reason" and trains people to regenerate without looking. The
 * fingerprint must cover everything the output depends on.
 */
/**
 * Annotations are only worth writing if something checks them (§P.4).
 *
 * v1 validates the one thing that rots silently: a `path:` naming a file that
 * no longer exists. A coupled-contract list whose members have been renamed is
 * worse than none, because it reads as authoritative while pointing nowhere.
 *
 * Deliberately parsed line-wise rather than by adding a YAML dependency — the
 * file's shape is fixed and this keeps the generator's dependency surface at
 * ts-morph plus ajv.
 */
function annotationFindings(): Finding[] {
  const file = path.join(repoRoot, "docs", "architecture", "annotations.yaml");
  if (!fs.existsSync(file)) return [];

  const findings: Finding[] = [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*-?\s*path:\s*(\S+)\s*$/);
    if (!match) continue;
    const target = match[1].replace(/^["']|["']$/g, "");
    if (fs.existsSync(path.join(repoRoot, target))) continue;
    findings.push({
      id: `finding:stale-annotation:${target}`,
      severity: "error",
      kind: "stale-annotation",
      subject: target,
      message: `annotations.yaml line ${index + 1} names a path that does not exist. Annotations cannot be allowed to rot — fix or remove it.`,
    });
  }
  return findings;
}

function fingerprint(): string {
  const hash = createHash("sha256");
  for (const file of allFiles) {
    hash.update(file);
    hash.update(read(file));
  }
  const annotations = path.join(repoRoot, "docs", "architecture", "annotations.yaml");
  if (fs.existsSync(annotations)) hash.update(fs.readFileSync(annotations));
  return hash.digest("hex").slice(0, 16);
}

export function buildAtlas() {
  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const procedures = collectProcedures(project, resolveNamespaces(project));

  const modules: Entity[] = sourceFiles.map((file) => ({
    id: `module:${file}`,
    path: file,
    domain: domainFor(file),
    lifecycle: lifecycleFor(file),
  }));

  const domains: Entity[] = [...new Set(modules.map((module) => module.domain as string))]
    .sort()
    .map((name) => ({
      id: `domain:${name}`,
      name,
      moduleCount: modules.filter((module) => module.domain === name).length,
    }));

  const edges = collectImportEdges(project);
  const findings = [...computeFindings(procedures, modules, edges), ...annotationFindings()].sort((a, b) => a.id.localeCompare(b.id));

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      sourceFingerprint: fingerprint(),
    },
    domains,
    modules,
    routes: procedures.map((procedure) => ({ ...procedure })),
    surfaces: collectExpressRoutes(),
    envVars: collectEnvVars(),
    flags: collectFlags(),
    workers: collectWorkers(),
    operationKinds: collectOperationKinds(),
    creditCosts: collectCreditCosts(),
    tests: testFiles.sort().map((file) => ({ id: `test:${file}`, path: file })),
    edges,
    findings,
  };
}

/* ------------------------------------------------------------------ output */

export function renderExplorer(atlas: ReturnType<typeof buildAtlas>): string {
  // Self-contained: the JSON is embedded, there are no external requests, and
  // a guard test asserts none of this reaches the client bundle (§P.9).
  const payload = JSON.stringify(atlas).replaceAll("<", "\\u003c");
  return `<!doctype html>
<meta charset="utf-8">
<title>Drape Atlas</title>
<style>
:root{color-scheme:dark;--bg:#141416;--fg:#EDEDEF;--muted:#9A9AA2;--line:#2C2C30;--card:#1C1C1F}
body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.6 ui-sans-serif,system-ui}
header{padding:24px 32px;border-bottom:1px solid var(--line)}
h1{margin:0 0 4px;font-size:20px;font-weight:500}
main{padding:24px 32px;display:flex;flex-direction:column;gap:28px}
section{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
h2{margin:0;padding:12px 16px;font:500 11px ui-monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font:12px ui-monospace}
td,th{padding:6px 16px;text-align:left;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:500}
input{width:100%;box-sizing:border-box;padding:10px 16px;background:transparent;border:0;border-bottom:1px solid var(--line);color:var(--fg);font:13px ui-sans-serif;outline:none}
.sev-error{color:#E08A7E}.sev-warn{color:#D9B77A}.sev-info{color:var(--muted)}
.wrap{max-height:420px;overflow:auto}
</style>
<header>
  <h1>Drape Atlas</h1>
  <div style="color:var(--muted)">Generated from source · fingerprint <code>${atlas.meta.sourceFingerprint}</code> · schema ${atlas.meta.schemaVersion}</div>
</header>
<main id="app"></main>
<script>
const ATLAS = ${payload};
const views = [
  {title:'Findings', rows:()=>ATLAS.findings.map(f=>[f.severity,f.kind,f.subject,f.message]), head:['severity','kind','subject','message'], cls:r=>'sev-'+r[0]},
  {title:'Routes & access control', rows:()=>ATLAS.routes.map(r=>[r.namespace+'.'+r.name,r.type,r.auth,r.strictInput?'strict':'—',r.rateLimited?'limited':'—',r.file]), head:['procedure','type','auth','input','rate limit','file']},
  {title:'Express surfaces', rows:()=>ATLAS.surfaces.map(s=>[s.method,s.path,s.file]), head:['method','path','file']},
  {title:'Domains', rows:()=>ATLAS.domains.map(d=>[d.name,String(d.moduleCount)]), head:['domain','modules']},
  {title:'Legacy retirement', rows:()=>ATLAS.modules.filter(m=>m.lifecycle!=='active').map(m=>[m.lifecycle,m.domain,m.path]), head:['status','domain','module']},
  {title:'Env & flags', rows:()=>[...ATLAS.flags.map(f=>['flag',f.name]),...ATLAS.envVars.map(e=>['env',e.name])], head:['kind','name']},
  {title:'Workers', rows:()=>ATLAS.workers.map(w=>[w.name,w.startedFrom]), head:['worker','started from']},
  {title:'Operation kinds', rows:()=>ATLAS.operationKinds.map(o=>[o.kind,o.contract]), head:['kind','contract']},
];
const app = document.getElementById('app');
for (const view of views) {
  const section = document.createElement('section');
  const rows = view.rows();
  section.innerHTML = '<h2>'+view.title+' ('+rows.length+')</h2><input placeholder="Filter…"><div class="wrap"><table><thead><tr>'+view.head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody></tbody></table></div>';
  const tbody = section.querySelector('tbody');
  const draw = (q) => {
    tbody.innerHTML = '';
    for (const row of rows) {
      if (q && !row.join(' ').toLowerCase().includes(q)) continue;
      const tr = document.createElement('tr');
      if (view.cls) tr.className = view.cls(row);
      tr.innerHTML = row.map(cell=>'<td>'+String(cell??'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</td>').join('');
      tbody.appendChild(tr);
    }
  };
  draw('');
  section.querySelector('input').addEventListener('input', (e)=>draw(e.target.value.toLowerCase()));
  app.appendChild(section);
}
</script>
`;
}

export const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Drape Atlas",
  type: "object",
  required: ["meta", "domains", "modules", "routes", "edges", "findings"],
  additionalProperties: false,
  properties: {
    meta: {
      type: "object",
      required: ["schemaVersion", "generatorVersion", "sourceFingerprint"],
      additionalProperties: false,
      properties: {
        schemaVersion: { type: "string" },
        generatorVersion: { type: "string" },
        sourceFingerprint: { type: "string", pattern: "^[0-9a-f]{16}$" },
      },
    },
    domains: { type: "array", items: { type: "object", required: ["id", "name"] } },
    modules: { type: "array", items: { type: "object", required: ["id", "path", "domain", "lifecycle"] } },
    routes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "namespace", "name", "type", "auth", "strictInput", "rateLimited", "file"],
        properties: {
          auth: { enum: ["public", "onboarding", "protected", "admin", "moderator", "unclassified"] },
          type: { enum: ["query", "mutation", "subscription"] },
        },
      },
    },
    surfaces: { type: "array", items: { type: "object", required: ["id", "method", "path"] } },
    envVars: { type: "array", items: { type: "object", required: ["id", "name"] } },
    flags: { type: "array", items: { type: "object", required: ["id", "name"] } },
    workers: { type: "array", items: { type: "object", required: ["id", "name"] } },
    operationKinds: { type: "array", items: { type: "object", required: ["id", "kind"] } },
    creditCosts: { type: "array", items: { type: "object", required: ["id", "name"] } },
    tests: { type: "array", items: { type: "object", required: ["id", "path"] } },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "kind"],
        properties: { kind: { enum: ["imports", "calls", "guards", "reads", "writes", "charges", "refunds", "cleans"] } },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "severity", "kind", "subject", "message"],
        properties: { severity: { enum: ["info", "warn", "error"] } },
      },
    },
  },
} as const;

export function writeAtlas(outDir: string) {
  const atlas = buildAtlas();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "drape-architecture.json"),
    `${JSON.stringify(atlas, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "drape-architecture.schema.json"),
    `${JSON.stringify(SCHEMA, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(outDir, "index.html"), renderExplorer(atlas), "utf8");
  return atlas;
}

/* --------------------------------------------------------------------- CLI */

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const atlas = writeAtlas(OUT_DIR);
  const errors = atlas.findings.filter((finding) => finding.severity === "error").length;
  const warnings = atlas.findings.filter((finding) => finding.severity === "warn").length;
  console.log(
    `[atlas] ${atlas.modules.length} modules · ${atlas.routes.length} procedures · ` +
      `${atlas.surfaces.length} express surfaces · ${atlas.findings.length} findings ` +
      `(${errors} error, ${warnings} warn)`,
  );
  console.log(`[atlas] written to ${path.relative(process.cwd(), OUT_DIR)}`);
}
