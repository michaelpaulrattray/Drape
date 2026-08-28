import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE RESOURCE LOCK MUST REACH THE WIRE (L8b, opus-607 §2, ruled fable-818 §2).
 *
 * Two concurrent paid operations on one Cast are kept apart by a lock whose key
 * is the PRIMARY KEY of `generation_operation_locks`, so acquisition is a
 * duplicate-key INSERT rather than a check-then-write. The guard is real and
 * correctly built. Until this file existed, **nothing failed when it was
 * removed**: deleting `lockKey` from the mint gate, from the mint's
 * `markGenerationOperationRunning`, or from refine and headshot together each
 * left 6,777 tests green. The single red in every arm was the Atlas freshness
 * check — which a semantically-null comment reddens identically, and which
 * holds zero occurrences of `lockKey`. An info-free red is not a control.
 *
 * That is invariant 5 (assert at the WIRE, on the outgoing call) and invariant 7
 * (a control that nothing invokes does not exist), on the path that charges.
 *
 * # Why this is derived rather than listed
 *
 * A second list shadowing the call sites drifts from them (working law 4). The
 * scope is read out of the tree, so a procedure written tomorrow is in scope the
 * moment it exists — the shape `scriptWorldGuard.test.ts` and
 * `scriptExitDiscipline.test.ts` already use.
 *
 * # The rule, and why `model.create` is not an exemption
 *
 * A call that names a `modelId` is claiming a Cast, and a claimed Cast is
 * lockable — so it must pass the key. `models.create` names no `modelId`
 * because the row does not exist yet, and `acquireGenerationOperationLock`
 * would refuse a key naming no resource in the trusted claim anyway. It falls
 * OUT of the rule by construction rather than being carved out of it, so there
 * is no exemption list to rot.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** The declaration sites — their parameter lists name the very fields this
 *  test looks for, so counting them would let a definition masquerade as a
 *  healthy call site. */
const DECLARATIONS = new Set([
  "server/casting/directOperation.ts",
  "server/db/generationOperations.ts",
]);

/** Paid paths whose absence would mean the scanner stopped looking rather than
 *  the tree going quiet — a sweep must prove it was sweeping. */
const MUST_BE_IN_SCOPE = [
  "server/routes/generation/castingExport.ts",     // mint
  "server/routes/generation/castingRefinement.ts", // refine
  "server/routes/generation/castingImaging.ts",    // headshot
  "server/routes/boardOps.ts",                     // canvas
];

async function productionFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await productionFiles(full, out);
    } else if (
      entry.name.endsWith(".ts")
      && !entry.name.endsWith(".test.ts")
      && !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** The argument text of every call to `fn`, by brace matching rather than by a
 *  line regex — these calls span dozens of lines. */
function callArguments(source: string, fn: string): Array<{ line: number; body: string }> {
  const found: Array<{ line: number; body: string }> = [];
  const pattern = new RegExp(`\\b${fn}\\s*\\(`, "g");
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    let depth = 0;
    let index = match[0].length + match.index - 1;
    while (index < source.length) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    found.push({
      line: source.slice(0, match.index).split("\n").length,
      body: source.slice(match.index + match[0].length, index),
    });
  }
  return found;
}

type Site = { file: string; line: number; namesModel: boolean; passesKey: boolean };

async function sitesFor(fn: string, required: string): Promise<Site[]> {
  const sites: Site[] = [];
  for (const absolute of await productionFiles(here)) {
    const file = path.relative(path.join(here, ".."), absolute).replaceAll("\\", "/");
    if (DECLARATIONS.has(file)) continue;
    const source = await readFile(absolute, "utf8");
    if (!source.includes(fn)) continue;
    for (const { line, body } of callArguments(source, fn)) {
      sites.push({
        file,
        line,
        namesModel: /\bmodelId\s*:/.test(body),
        passesKey: new RegExp(`\\b${required}\\b`).test(body),
      });
    }
  }
  return sites;
}

/* 60s because this suite WALKS THE TREE and vitest's default is 5s (#216's class,
   measured 2026-08-29 under a full `pnpm test`: this suite's slowest arm 2884ms). */
describe("the resource lock reaches the wire", { timeout: 60_000 }, () => {
  it("every model-claiming beginDirectOperation passes a lockKey", async () => {
    const sites = await sitesFor("beginDirectOperation", "lockKey");
    const claiming = sites.filter((site) => site.namesModel);

    // Positive control: the scan is looking at the paid paths, so a green here
    // cannot mean the walker quietly returned nothing.
    expect(claiming.length).toBeGreaterThanOrEqual(8);
    for (const file of MUST_BE_IN_SCOPE) {
      expect(claiming.map((site) => site.file)).toContain(file);
    }

    const unlocked = claiming
      .filter((site) => !site.passesKey)
      .map((site) => `${site.file}:${site.line}`);
    expect(unlocked).toEqual([]);
  });

  it("every model-claiming markGenerationOperationRunning passes a requiredLockKey", async () => {
    const sites = await sitesFor("markGenerationOperationRunning", "requiredLockKey");
    const claiming = sites.filter((site) => site.namesModel);

    expect(claiming.length).toBeGreaterThanOrEqual(8);
    for (const file of MUST_BE_IN_SCOPE) {
      expect(claiming.map((site) => site.file)).toContain(file);
    }

    const unproved = claiming
      .filter((site) => !site.passesKey)
      .map((site) => `${site.file}:${site.line}`);
    expect(unproved).toEqual([]);
  });

  it("the castingV2 refine claim passes its candidate lock", async () => {
    /*
      ONE FACE, ONE RENDER (ruled fable-974 §2; built 1423e03a; issue #54).

      The refine claim names no `modelId`, so the model-key rule above cannot
      see it — and until this arm existed, deleting `candidateLockPublicId`
      from the call left the entire suite green: the only regression was a
      hand-run script (`scripts/prove-refine-idempotency-disposable.mts` arm
      3), and a regression CI never runs is invariant 7's control nobody
      invokes. This is also the wire whose absence was mis-filed as an URGENT
      open hole a week after it was closed, because the record's check grepped
      for a token (`lockKey`) the built call site deliberately never contains.

      The call is injected — `(dependencies.begin ?? beginDirectOperation)(…)`
      — so the scanner above, which matches the bare name followed by an open
      paren, cannot see this site either. Matched here in its real shape.
    */
    const source = await readFile(
      path.join(here, "castingV2", "refineService.ts"),
      "utf8",
    );
    const shape = "(dependencies.begin ?? beginDirectOperation)(";
    const first = source.indexOf(shape);
    // Positive control: the site exists, and exactly once — a second claim
    // site in this file must come back here and join the assertion.
    expect(first).toBeGreaterThan(-1);
    expect(source.indexOf(shape, first + 1)).toBe(-1);

    let depth = 1;
    let index = first + shape.length;
    while (index < source.length && depth > 0) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      index += 1;
    }
    const body = source.slice(first + shape.length, index - 1);
    expect(body).toContain('kind: "castingV2.refine"');
    expect(body).toMatch(/\bcandidateLockPublicId\s*:\s*input\.candidatePublicId\b/);
  });

  it("model.create is out of scope by construction, not by exemption", async () => {
    // If creation ever starts naming a modelId, it becomes lockable and the
    // rule above must cover it — this pins the REASON, so the day the premise
    // changes the carve-out cannot survive it silently.
    const sites = await sitesFor("beginDirectOperation", "lockKey");
    const create = sites.filter((site) => site.file === "server/routes/models.ts");
    expect(create).not.toEqual([]);
    for (const site of create) {
      expect(site.namesModel).toBe(false);
    }
  });
});
