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
 * ⚠ **AND THAT PROPERTY HELD FOR 11 OF 25 CLAIM SITES UNTIL #1268.** The
 * derived arms found call sites by NAME (`\bbeginDirectOperation\s*\(`), and
 * this repository's house style for a testable service reaches the same
 * function through an injected dependency, where the name is followed by a
 * CLOSE paren and never matched. Measured on the tree at `0ba7f9e4`:
 *
 *     beginDirectOperation          25 sites — bare 11, injected 8, aliased 6
 *     markGenerationOperationRunning 20 sites — bare 10, injected 10, aliased 0
 *
 * The three shapes are read here, so the population is 25 and 20 rather than
 * 11 and 10. The defect question was asked before the widening and the answer
 * was clean — no invisible site claiming a `modelId` was missing its key — so
 * this closes a PROSPECTIVE hole: the day one of the fourteen newly-visible
 * paid sites loses its lock, an arm goes red instead of nothing happening.
 *
 * The shapes, in the spellings the tree actually uses:
 *
 *     beginDirectOperation({…})                              bare
 *     (dependencies.begin ?? beginDirectOperation)({…})      injected
 *     const begin = input.begin ?? beginDirectOperation      aliased
 *     …later… begin({…})
 *
 * ⚠ **A SHAPE CENSUS ARM SITS BESIDE THE RULE** (`every claim shape is still
 * being read`), because a widened reader that silently stops matching one
 * shape looks exactly like a tree that stopped using it — and the whole
 * population would go quiet with every assertion green.
 *
 * ⚠ **THE TWO HAND-WRITTEN ARMS BELOW ARE NOT MADE REDUNDANT BY THIS AND ARE
 * DELIBERATELY KEPT.** #1268 suggested they could be deleted once the scanner
 * saw injected sites; read at the code they cannot be. The refine and view
 * retry claims name no `modelId` at all — they lock a CANDIDATE and a SLOT —
 * so the model-key rule still cannot see them whatever shape it reads, and
 * their arms additionally pin things no derived rule knows to ask for
 * (`candidateLockPublicId`, `lockBusyMessage`, one spelling of the slot key).
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
 *  the tree going quiet — a sweep must prove it was sweeping.
 *
 *  Each list names a BARE site, an INJECTED site and an ALIASED site where the
 *  tree has one, so a reader that loses a shape cannot pass by finding the
 *  other two. (`markGenerationOperationRunning` has no aliased site on this
 *  tree; the shape census arm below carries that half instead.) */
const MUST_BE_IN_SCOPE: Record<string, string[]> = {
  beginDirectOperation: [
    "server/routes/generation/castingExport.ts",            // mint      — bare
    "server/routes/generation/castingRefinement.ts",        // refine    — bare
    "server/routes/generation/castingImaging.ts",           // headshot  — bare
    "server/routes/boardOps.ts",                            // canvas    — bare
    "server/casting/evidence/inkCandidateAcceptance.ts",    //           — injected
    "server/casting/evidence/evidenceOperations.ts",        //           — aliased
  ],
  markGenerationOperationRunning: [
    "server/routes/generation/castingExport.ts",            // mint      — bare
    "server/routes/generation/castingRefinement.ts",        // refine    — bare
    "server/routes/generation/castingImaging.ts",           // headshot  — bare
    "server/routes/boardOps.ts",                            // canvas    — bare
    "server/casting/evidence/inkCandidateAcceptance.ts",    //           — injected
  ],
};

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

/**
 * The argument text of a call whose opening paren is already located.
 *
 * Every shape below locates its own paren and hands the index here, so the
 * brace matching — these calls span dozens of lines, which is why a line regex
 * cannot do this job — is written exactly once.
 */
function argumentsAt(source: string, afterOpenParen: number): string {
  let depth = 1;
  let index = afterOpenParen;
  while (index < source.length && depth > 0) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") depth -= 1;
    index += 1;
  }
  return source.slice(afterOpenParen, index - 1);
}

type Shape = "bare" | "injected" | "aliased";

/**
 * Every call to `fn` in one file, in all three shapes the tree reaches it by.
 *
 * `bare`      `fn({…})`
 * `injected`  `(dependencies.fn ?? fn)({…})` — the name is followed by a CLOSE
 *             paren, which is why matching `fn\s*\(` alone saw none of these.
 * `aliased`   `const begin = input.begin ?? fn` and then `begin({…})`. Each
 *             binding owns only the calls between itself and the next binding
 *             of the same name, so a file that re-declares the alias per
 *             function (`evidenceOperations.ts` declares it three times) counts
 *             three call sites and not six.
 */
function callArguments(source: string, fn: string): Array<{ line: number; shape: Shape; body: string }> {
  const found: Array<{ line: number; shape: Shape; body: string }> = [];
  const at = (index: number) => source.slice(0, index).split("\n").length;

  for (const match of source.matchAll(new RegExp(String.raw`\b${fn}\s*\(`, "g"))) {
    const index = match.index;
    found.push({ line: at(index), shape: "bare", body: argumentsAt(source, index + match[0].length) });
  }

  for (const match of source.matchAll(
    new RegExp(String.raw`\(\s*[A-Za-z_$][\w$.]*\s*\?\?\s*${fn}\s*\)\s*\(`, "g"),
  )) {
    const index = match.index;
    found.push({ line: at(index), shape: "injected", body: argumentsAt(source, index + match[0].length) });
  }

  for (const binding of source.matchAll(
    new RegExp(String.raw`(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$.]*\s*\?\?\s*${fn}\b`, "g"),
  )) {
    const alias = binding[1];
    const rebound = [...source.matchAll(new RegExp(String.raw`(?:const|let)\s+${alias}\s*=`, "g"))]
      .map((other) => other.index)
      .find((index) => index > binding.index) ?? source.length;
    for (const call of source.matchAll(new RegExp(String.raw`(?<![\w$.])${alias}\s*\(`, "g"))) {
      const index = call.index;
      if (index < binding.index || index >= rebound) continue;
      found.push({ line: at(index), shape: "aliased", body: argumentsAt(source, index + call[0].length) });
    }
  }

  return found;
}

type Site = { file: string; line: number; shape: Shape; namesModel: boolean; passesKey: boolean };

async function sitesFor(fn: string, required: string): Promise<Site[]> {
  const sites: Site[] = [];
  for (const absolute of await productionFiles(here)) {
    const file = path.relative(path.join(here, ".."), absolute).replaceAll("\\", "/");
    if (DECLARATIONS.has(file)) continue;
    const source = await readFile(absolute, "utf8");
    if (!source.includes(fn)) continue;
    for (const { line, shape, body } of callArguments(source, fn)) {
      sites.push({
        file,
        line,
        shape,
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
    // cannot mean the walker quietly returned nothing. The floor is 16 because
    // 18 claim a model on this tree and the three shapes are all represented
    // in the list below.
    expect(claiming.length).toBeGreaterThanOrEqual(16);
    for (const file of MUST_BE_IN_SCOPE.beginDirectOperation) {
      expect(claiming.map((site) => site.file)).toContain(file);
    }

    const unlocked = claiming
      .filter((site) => !site.passesKey)
      .map((site) => `${site.file}:${site.line} [${site.shape}]`);
    expect(unlocked).toEqual([]);
  });

  it("every model-claiming markGenerationOperationRunning passes a requiredLockKey", async () => {
    const sites = await sitesFor("markGenerationOperationRunning", "requiredLockKey");
    const claiming = sites.filter((site) => site.namesModel);

    expect(claiming.length).toBeGreaterThanOrEqual(12);
    for (const file of MUST_BE_IN_SCOPE.markGenerationOperationRunning) {
      expect(claiming.map((site) => site.file)).toContain(file);
    }

    const unproved = claiming
      .filter((site) => !site.passesKey)
      .map((site) => `${site.file}:${site.line} [${site.shape}]`);
    expect(unproved).toEqual([]);
  });

  it("every claim shape is still being read", async () => {
    /*
      THE WIDENING'S OWN CONTROL (#1268).

      The two rules above are `expect(unlocked).toEqual([])` — an assertion
      that passes most loudly when the population is EMPTY. So a reader that
      silently stops matching the injected or the aliased shape looks exactly
      like a tree that stopped using it: fourteen paid sites leave scope and
      every assertion stays green.

      This arm holds the shapes themselves. It is a floor, not a fixed count —
      a new injected claim site must not have to come back here — and it is
      derived from the same reader, so it cannot drift from what the rules see.
    */
    const begin = await sitesFor("beginDirectOperation", "lockKey");
    const run = await sitesFor("markGenerationOperationRunning", "requiredLockKey");
    const census = (sites: Site[]) => ({
      bare: sites.filter((site) => site.shape === "bare").length,
      injected: sites.filter((site) => site.shape === "injected").length,
      aliased: sites.filter((site) => site.shape === "aliased").length,
    });

    // Measured on the tree at 0ba7f9e4: begin 25 (11/8/6), run 20 (10/10/0).
    const beginShapes = census(begin);
    expect(beginShapes.bare).toBeGreaterThanOrEqual(9);
    expect(beginShapes.injected).toBeGreaterThanOrEqual(6);
    expect(beginShapes.aliased).toBeGreaterThanOrEqual(4);

    const runShapes = census(run);
    expect(runShapes.bare).toBeGreaterThanOrEqual(8);
    expect(runShapes.injected).toBeGreaterThanOrEqual(8);

    /* An aliased site is counted ONCE per call, not once per preceding binding.
       `evidenceOperations.ts` re-declares `begin` in each of its three
       functions; the first shape of this reader paired every binding with every
       later call and reported six sites where there are three — which is how
       #1268's own sweep came to file the population as 28 rather than 25. */
    const aliasedInEvidenceOperations = begin.filter(
      (site) => site.file === "server/casting/evidence/evidenceOperations.ts",
    );
    expect(aliasedInEvidenceOperations.map((site) => site.line)).toHaveLength(3);
    expect(new Set(aliasedInEvidenceOperations.map((site) => site.line)).size).toBe(3);
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

  it("the castingV2 view retry claim passes its per-slot lock, and re-proves it", async () => {
    /*
      ONE SLOT, ONE TRY AGAIN (#1257).

      Invisible to both scanners above for the SAME reason the refine claim is —
      the retry entrance calls through `(dependencies.begin ?? …)(`, so the bare
      `name(` pattern never matches it — and invisible for a second reason on
      top: the key it passes is `cast-view:`, which no derived model-key rule
      would think to look for. Matched here in its real shape.

      Deleting either line from `viewRetryService.ts` must redden this arm; the
      race it closes is the few hundred milliseconds between the entrance's
      admission READ and its claim, during which the entrance is still fetching
      her render source and her signed face.
    */
    const source = await readFile(
      path.join(here, "castingV2", "viewRetryService.ts"),
      "utf8",
    );

    const claimShape = "(dependencies.begin ?? beginDirectOperation)(";
    const claimAt = source.indexOf(claimShape);
    // Positive control: the site exists, and exactly once — a second claim site
    // in this file must come back here and join the assertion.
    expect(claimAt).toBeGreaterThan(-1);
    expect(source.indexOf(claimShape, claimAt + 1)).toBe(-1);
    const claim = argumentsAt(source, claimAt + claimShape.length);
    expect(claim).toContain('kind: "castingV2.viewRetry"');
    expect(claim).toMatch(/\blockKey\s*:\s*slotLockKey\b/);
    /* The customer's own sentence, not the staff one the five model-key roads
       share — a race loser and a slow double-presser are told one thing. */
    expect(claim).toMatch(/\blockBusyMessage\s*:\s*VIEW_RETRY_ALREADY_ASKING_MESSAGE\b/);

    const runShape = "(dependencies.markRunning ?? markGenerationOperationRunning)(";
    const runAt = source.indexOf(runShape);
    expect(runAt).toBeGreaterThan(-1);
    expect(source.indexOf(runShape, runAt + 1)).toBe(-1);
    expect(argumentsAt(source, runAt + runShape.length))
      .toMatch(/\brequiredLockKey\s*:\s*slotLockKey\b/);

    /* The key is built ONCE on this road. Two spellings of it would be a lock
       nobody holds — the claim taking one row and the running transition
       demanding another. */
    expect(source.match(/castViewSlotOperationLockKey\(/g)).toHaveLength(1);
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
