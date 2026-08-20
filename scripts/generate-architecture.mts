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

/**
 * THE FINGERPRINT IS OF THE SOURCE, NEVER OF THIS DISK (found opus-926 §5,
 * ruled fable-1234 §2).
 *
 * `core.autocrlf` is `true` on the machine this repo is developed on, so `git
 * checkout` re-materializes files through the CRLF filter every time it touches
 * them — and a working tree ends up MIXED, because a file git has not touched
 * since a tool wrote it keeps whatever endings that tool used. Read on one
 * ordinary sitting: `server/_core/index.ts` LF, `shared/const.ts` CRLF,
 * `drizzle/schema.ts` CRLF, `client/src/App.tsx` CRLF.
 *
 * {@link fingerprint} hashes the BYTES ON DISK, so before this normalize it was
 * hashing that skew. Driven rather than argued: converting
 * `server/_core/index.ts` from LF to CRLF — not one character of content
 * changed, and `git diff` empty — moved the source fingerprint from
 * `99989fd2d9720929` to `cde1db8ddd2061b1`, and restoring the file
 * byte-identically moved it back.
 *
 * **A change git itself does not carry must not move this hash.** What that
 * cost: `docs/architecture/drape-architecture.json` read as STALE at four
 * commits in a row — including `c6940592`, whose entire job was regenerating it
 * — while `region-crop` read FRESH, because there a regeneration and a check
 * happened to run under the same skew. So `server/architectureAtlas.test.ts`'s
 * green was a coin flip nobody could tell from a reading, over the arm that
 * guards the Atlas's currency as *the deletion authority for the
 * legacy-retirement program* (CLAUDE.md).
 *
 * Only `\r\n` is folded. A lone `\r` is content and stays content.
 */
export function sourceText(raw: string): string {
  return raw.replaceAll("\r\n", "\n");
}

function read(relative: string): string {
  return sourceText(fs.readFileSync(path.join(repoRoot, relative), "utf8"));
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
  return expressSurfacesFrom(read("server/_core/index.ts"));
}

/**
 * The Express surfaces declared by one bootstrap source.
 *
 * Pure and exported so its arms can be driven against fixture sources rather
 * than against the repository's own current bootstrap — a checker tested only
 * on the tree it will run over is a checker whose blind spots are invisible
 * exactly where they matter (`architectureExpressSurfaces.test.ts`).
 */
export function expressSurfacesFrom(source: string): Entity[] {
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
  /*
    Routers mounted without a path prefix declare their own paths internally
    (image proxy, hero, evidence delivery). Missing them would understate the
    Express surface, so they are listed with the router as the subject.

    TWO SHAPES, AND THE SECOND WAS MISSING UNTIL 2026-08-20. A router is either
    a module-level value (`app.use(imageProxyRouter)`) or built at registration
    by a factory (`app.use(createCharacterSheetRouter())`) — the newer house
    style, because a factory takes injected dependencies and is what makes the
    route drivable in a suite. Only the first shape was matched, so
    `/api/cast/:castId/sheet` was invisible to the Atlas from the day it
    shipped, and `/api/ink-design/:designId` would have been. Both are
    AUTHENTICATED routes serving one owner's images.

    That is precisely the failure the enumerated-surface list exists to prevent
    (access-control invariant 5), arriving through the mechanism that was
    supposed to prevent it: a checker blind to a shape reports a complete list.
    `architectureExpressSurfaces.test.ts` drives both shapes directly.
  */
  for (const hit of source.matchAll(/app\.use\(\s*(\w+Router)\s*\)/g)) {
    routes.push({
      id: `express:USE (router-defined) ${hit[1]}`,
      method: "USE",
      path: "(defined by the router)",
      handler: hit[1],
      file: "server/_core/index.ts",
    });
  }
  for (const hit of source.matchAll(/app\.use\(\s*(\w*Router)\(\s*\)\s*\)/g)) {
    routes.push({
      id: `express:USE (router-defined) ${hit[1]}()`,
      method: "USE",
      path: "(defined by the router)",
      handler: `${hit[1]}()`,
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

const FLAG_NAME = /^[A-Z0-9_]*(SCOPE|ENABLE|STAGE)[A-Z0-9_]*$/;

/**
 * The flag inventory.
 *
 * Three access forms, because this repo uses all three and an inventory that
 * saw only one under-reported exactly the flags that matter most. Rollout
 * scopes are read as `process.env[SOME_SCOPE_ENV]` through an exported
 * constant — the dot form alone missed every one of them, which meant the
 * Atlas showed four flags while the server validated eight.
 */
function collectFlags(): Entity[] {
  const flags = new Set<string>();
  for (const file of sourceFiles.filter((f) => f.startsWith("server/"))) {
    const source = read(file);
    // process.env.NAME
    for (const hit of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (FLAG_NAME.test(hit[1])) flags.add(hit[1]);
    }
    // process.env["NAME"]
    for (const hit of source.matchAll(/process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]/g)) {
      if (FLAG_NAME.test(hit[1])) flags.add(hit[1]);
    }
    // const SOMETHING_ENV = "NAME" — the constant that the bracket form reads.
    for (const hit of source.matchAll(/const\s+[A-Z0-9_]+_ENV\s*=\s*["']([A-Z0-9_]+)["']/g)) {
      if (FLAG_NAME.test(hit[1])) flags.add(hit[1]);
    }
  }
  return [...flags].sort().map((name) => ({
    id: `flag:${name}`,
    name,
    // Stated per flag rather than assumed: an ENABLE_ switch is a boolean and
    // describing it with the scope grammar was simply untrue.
    grammar: name.startsWith("ENABLE_") ? "true|false" : "off|all|users:<ids>",
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

function collectVocabulary(): Entity[] {
  /*
    THE VOCABULARY, COUNTED (V1's own acceptance).

    One card per kind was the milestone; being able to COUNT them is what makes
    the milestone checkable from outside the code. Read from the card
    registries by declaration order — the Atlas never runs app code, so this is
    a source read like every other collector here.

    Deliberately shallow: names, and which registry each came from. What a card
    ANSWERS is the vocabulary suite's business (`subjectCards.test.ts` and the
    pin), and duplicating those answers here would be a second copy of the
    thing this milestone existed to stop having two of.
  */
  const registries: Array<{ file: string; declaration: string; kind: "subject" | "facet" }> = [
    { file: "server/castingV2/subjectCards.ts", declaration: "SUBJECT_CARDS", kind: "subject" },
    { file: "server/castingV2/facetCards.ts", declaration: "FACET_CARDS", kind: "facet" },
  ];
  const entities: Entity[] = [];
  for (const registry of registries) {
    if (!sourceFiles.includes(registry.file)) continue;
    const source = read(registry.file);
    const start = source.indexOf(`export const ${registry.declaration} = {`);
    if (start === -1) continue;
    const end = source.indexOf("\n} as const satisfies", start);
    if (end === -1) continue;
    const body = source.slice(start, end);
    /* A card opens a block at exactly two spaces of indent; nothing nested
       does, so the shape cannot pick up a field by accident. */
    for (const hit of body.matchAll(/^ {2}("?[\w.]+"?): \{$/gm)) {
      const name = hit[1].replace(/"/g, "");
      entities.push({
        id: `vocabulary:${registry.kind}:${name}`,
        name,
        vocabulary: registry.kind,
        file: registry.file,
      });
    }
  }
  return entities.sort((a, b) => String(a.id).localeCompare(String(b.id)));
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

/* ------------------------------------------------------- re-declared shapes */

/**
 * A SHAPE RE-LISTED INSTEAD OF NARROWED FROM — the copy that drifts, found
 * mechanically (fable-211, on the three specimens of 2026-08-11).
 *
 * # The class, in its own numbers
 *
 * One shape (`HarvestEvidence`: `applied`, `masterRegions`, `deliveredRegions`)
 * was re-declared in three separate modules of one tree inside a fortnight. The
 * live one cost a feature: `assembleWithCarriedSegments` re-listed two of the
 * three fields, so `deliveredRegions` was silently dropped on every render that
 * carried a segment — which is every render after the first kept one. The
 * delivered-anchored cut (10% → 88.7% of what the customer actually bought) was
 * inert for a week and **nothing could see it**: the pass-through branch handed
 * the whole object along, so the map was present whenever no segment was
 * carried, and the local re-declaration made TypeScript agree with the omission.
 *
 * A type that names two or more fields of another module's exported shape is a
 * COPY. `Pick`, `Omit`, an intersection with a reference, or the shape itself
 * are all references and none of them can lose a field this way — so the check
 * is: naming the fields is the defect, and every honest way of narrowing is a
 * type REFERENCE rather than a literal.
 *
 * # Why it is scoped, and why it is scoped to imports
 *
 * Two fields of a shape is a weak signal on its own: `{ width, height }` is a
 * subset of half the geometry in this repository and none of those are copies.
 * The signal comes from the pair of conditions — the local literal's fields are
 * a subset of a shape the file's own module graph says it ALREADY IMPORTS. A
 * file that imports the module holding the original is a file whose author had
 * the real shape in hand and re-typed it anyway.
 *
 * Scoped to `server/castingV2` because that is where the class was measured and
 * where the tree's own typecheck gate already holds tests to the same bar. It
 * widens the day a specimen turns up elsewhere — not before, because a checker
 * tuned on a corpus it has never been run against is a checker nobody trusts by
 * its third false positive.
 */
const SHAPE_COPY_ROOT = "server/castingV2/";
/** How many fields make a match too big to be coincidence, even when several
 *  shapes fit. Chosen from the measured run, not from taste — see below. */
const AMBIGUOUS_COPY_FIELDS = 3;

type NamedShape = { module: string; name: string; props: readonly string[] };

/** The exported object shapes a module offers other modules. */
function exportedShapesOf(sourceFile: SourceFile, module: string): NamedShape[] {
  const shapes: NamedShape[] = [];
  for (const alias of sourceFile.getTypeAliases()) {
    if (!alias.isExported()) continue;
    const literal = alias.getTypeNode();
    if (!literal || literal.getKind() !== SyntaxKind.TypeLiteral) continue;
    shapes.push({ module, name: alias.getName(), props: propertyNamesOf(literal) });
  }
  for (const declaration of sourceFile.getInterfaces()) {
    if (!declaration.isExported()) continue;
    shapes.push({
      module,
      name: declaration.getName(),
      props: declaration.getProperties().map((property) => property.getName()).sort(),
    });
  }
  return shapes.filter((shape) => shape.props.length >= 2);
}

function propertyNamesOf(literal: Node): readonly string[] {
  return literal
    .getChildrenOfKind(SyntaxKind.SyntaxList)
    .flatMap((list) => list.getChildrenOfKind(SyntaxKind.PropertySignature))
    .map((property) => property.getName())
    .sort();
}

/**
 * Whether this literal is one half of `Something & { … }`.
 *
 * That idiom is a reference plus an addition — it cannot lose a field, which is
 * the whole defect — so it is exempt, and only when the intersection really does
 * name the shape being matched against.
 */
function narrowsFrom(literal: Node, shapeName: string): boolean {
  const parent = literal.getParent();
  if (!parent || parent.getKind() !== SyntaxKind.IntersectionType) return false;
  return parent
    .getChildrenOfKind(SyntaxKind.SyntaxList)
    .flatMap((list) => list.getChildren())
    .some((sibling) => sibling !== literal && sibling.getText().includes(shapeName));
}

export function shapeCopyFindings(project: Project, files: readonly string[]): Finding[] {
  const inScope = files.filter(
    (file) => file.startsWith(SHAPE_COPY_ROOT) && !file.endsWith(".test.ts"),
  );
  const relativeOf = (sourceFile: SourceFile) =>
    path.relative(repoRoot, sourceFile.getFilePath()).replaceAll("\\", "/");

  const shapes: NamedShape[] = [];
  const filesByPath = new Map<string, SourceFile>();
  for (const sourceFile of project.getSourceFiles()) {
    const relative = relativeOf(sourceFile);
    if (!inScope.includes(relative)) continue;
    filesByPath.set(relative, sourceFile);
    shapes.push(...exportedShapesOf(sourceFile, relative));
  }

  const findings: Finding[] = [];
  for (const [relative, sourceFile] of filesByPath) {
    /* The modules this file already has in hand. A shape it does not import is
       a shape whose fields it may coincide with innocently. */
    const imported = new Set(
      sourceFile
        .getImportDeclarations()
        .map((declaration) => declaration.getModuleSpecifierSourceFile())
        .filter((target): target is SourceFile => target !== undefined)
        .map(relativeOf),
    );

    for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.TypeLiteral)) {
      const props = propertyNamesOf(literal);
      if (props.length < 2) continue;
      const matched = shapes.filter((shape) => (
        shape.module !== relative
        && imported.has(shape.module)
        && props.every((name) => shape.props.includes(name))
        && !narrowsFrom(literal, shape.name)
        /*
          MOST OF A SHAPE, OR IT IS NOT THAT SHAPE.

          The claim a finding makes is "this literal IS X, re-typed" — and that
          claim needs the literal to be most of X. Measured on this tree, the
          minority matches are all one phenomenon: `{ bytes, contentType }`
          appears in five modules and lands inside `MaskedRefineResult`, which
          has seven fields. Two of seven is a pair of ordinary words that a
          bigger shape happens to contain, not a copy of it. Two of three is
          `HarvestEvidence` with `deliveredRegions` dropped, which is the live
          defect this check exists for.

          Half is the boundary of "most of it" rather than a tuned constant —
          and the fraction is printed in every message, so a reader can see the
          strength of each claim instead of taking the threshold's word for it.
        */
        && props.length * 2 >= shape.props.length
      ));
      if (matched.length === 0) continue;
      /*
        AND AMBIGUITY IS THE OTHER HALF OF THE NOISE FLOOR, also measured: the
        first run over this tree found 42 hits, most of them a local
        `{ width, height }` matching Raster AND Mask AND MatteRequest at once. A
        literal that fits several shapes is not a copy of any of them. Past
        three fields, coincidence stops being the likelier explanation whether
        it is ambiguous or not.
      */
      if (matched.length > 1 && props.length < AMBIGUOUS_COPY_FIELDS) continue;
      const named = matched
        .map((shape) => `${props.length} of ${shape.name}'s ${shape.props.length} fields (${shape.module})`)
        .join(", ");
      findings.push({
        id: `finding:redeclared-shape:${relative}:${literal.getStartLineNumber()}`,
        severity: "warn",
        kind: "redeclared-shape",
        subject: `${relative}:${literal.getStartLineNumber()}`,
        message:
          `Names ${named} — a module that imports a shape and re-lists its fields has written a copy, `
          + `and a copy drifts by losing a field nothing can see. Reference it, or narrow it with Pick/Omit.`,
      });
    }
  }
  return findings;
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
  /* The annotations file is tracked text and takes the same filter as every
     source file above, so it is normalized by the same hand rather than left as
     the one raw read in here — the instance is not the class. */
  const annotations = path.join(repoRoot, "docs", "architecture", "annotations.yaml");
  if (fs.existsSync(annotations)) {
    hash.update(sourceText(fs.readFileSync(annotations, "utf8")));
  }
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
  const findings = [
    ...computeFindings(procedures, modules, edges),
    ...annotationFindings(),
    ...shapeCopyFindings(project, sourceFiles),
  ].sort((a, b) => a.id.localeCompare(b.id));

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
    vocabulary: collectVocabulary(),
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
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "vocabulary", "file"],
        properties: { vocabulary: { enum: ["subject", "facet"] } },
      },
    },
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
