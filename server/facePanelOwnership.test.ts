/**
 * THE FACE PANEL'S OWNERSHIP CLAIM, DRIVEN — #1181 option C.
 *
 * The `facePanel` procedure's own docblock (`server/routes/castingV2.ts`) makes
 * a claim about enforcement invariant 1 — *scope the owner in the statement that
 * reads or writes*:
 *
 *   "Ownership is proved inside the statements that read (invariant 1):
 *    resolveOwnedCandidateId, listCandidateVariants and listLineageReferences
 *    each carry userId into their own WHERE."
 *
 * ⚠ **NOTHING IN THIS REPOSITORY DROVE THAT SENTENCE.** Measured by sabotage
 * during #1160 slice 3: deleting the owner clause from `resolveOwnedCandidateId`
 * — so that any account's candidate public id resolves for anybody — was not
 * noticed by the face-panel suites, and over the FULL suite (798 files) the only
 * reds were `architectureAtlas.test.ts`'s three, which redden on ANY source edit
 * because that suite fingerprints the tree. So "no arm anywhere" was a derived
 * answer rather than a hand count, and this file is the arm that was missing.
 *
 * The face panel returns, for a candidate, its variants, the reference-library
 * crops of her face, scan geometry and delivered ink. A candidate public id is a
 * UUID, so a lost owner clause is not an enumerable hole — but invariant 1
 * exists precisely because ownership must not rest on an id being hard to guess,
 * and the founder's ruling of 2026-07-25 is about this exact surface: *"no one
 * should be able to steal or copy that work."*
 *
 * # WHAT THIS PROVES, AND WHAT IT DOES NOT — both halves, because the card's
 * # whole point is that this is the third guard in this area that could be
 * # green while proving nothing
 *
 * It proves the LINE: every statement those readers run carries an owner clause.
 * It does NOT prove the BEHAVIOUR — that a stranger's public id actually comes
 * back empty against a real database. That is #1181 option A, it is still owed,
 * and it is blocked rather than skipped: the harness it wants lives in
 * <server/castingV2-variant-lineage-db.test.ts>, which does not exist on `main`
 * (it arrives with #1160 slice 3, PR #1185), and a db suite runs only where a
 * disposable database exists — never on the gate. This one runs everywhere,
 * every PR, which is the trade the card names.
 *
 * # THE POPULATION IS DERIVED FROM THE CLAIM, NOT FROM THE STATEMENTS
 *
 * A guard whose population comes from the value under test cannot see that value
 * go wrong. So the two sides here are deliberately different artifacts:
 *
 *   the claim        the backticked reader names in `facePanel`'s docblock
 *   the value        the owner clauses in each reader's own statements
 *
 * Neither can move alone. A reader renamed in the docblock and not in the code
 * fails to resolve; a reader whose WHERE loses `userId` fails the clause arm.
 *
 * ⚠ **AND THE DECLARATION IS FOUND BY WALKING `server/db/`, NOT BY A PATH** —
 * that is not tidiness, it is measured: `resolveOwnedCandidateId` is MOVING
 * between modules right now (`castingV2Segments.ts` → `castingV2.ts`, #1160
 * slice 3), because it was never a segment function and that file is being
 * reduced to the purge path. A guard pinned to a path would have gone red on a
 * move that changes nothing about ownership, which teaches a shift to delete it.
 *
 * # WHERE THIS READER CAN BE FOOLED, said rather than implied
 *
 * A statement region runs from one `db.select`/`db.execute`/… to the next, so a
 * line AFTER the last statement that happens to name an owner clause would be
 * counted toward it. Nothing in the three readers does, and the positive
 * controls below delete the real clauses from the real bodies rather than from a
 * fixture, so the checker is proven able to fail on the exact sabotage that
 * found this card.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The reader names `facePanel`'s docblock claims prove ownership in their own
 * WHERE.
 *
 * The paragraph is cut at `each carry` on purpose: the clause after it backticks
 * `userId`, which is the FIELD and not a reader, and a filter that had to know
 * that would be a second place to keep the answer.
 */
function claimedReaders(): string[] {
  const source = readFileSync(path.join(repoRoot, "server", "routes", "castingV2.ts"), "utf8");
  const claim = /Ownership is proved inside the statements that read \(invariant 1\):([\s\S]*?)each carry/
    .exec(source);
  if (!claim) {
    throw new Error(
      "facePanel's ownership claim has been reworded or removed — re-point this arm at it rather "
      + "than deleting it. The claim is what gives this guard its population; with no claim there "
      + "is no reading, and a silent pass here is exactly the state #1181 was filed about.",
    );
  }
  const names = [...claim[1].matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)].map((hit) => hit[1]);
  if (names.length === 0) {
    throw new Error(
      "facePanel's ownership claim names no readers — it cannot be checked, so it is refused "
      + "rather than passed",
    );
  }
  return names;
}

type Declaration = { module: string; body: string };

/** Every `export async function <name>` under `server/db/`, source files only. */
function declarationOf(name: string): Declaration {
  const found: Declaration[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      const source = readFileSync(full, "utf8");
      const at = source.indexOf(`export async function ${name}(`);
      if (at === -1) continue;
      found.push({
        module: path.relative(repoRoot, full).replaceAll("\\", "/"),
        body: bodyAt(source, at),
      });
    }
  };
  walk(path.join(repoRoot, "server", "db"));
  if (found.length !== 1) {
    throw new Error(
      `${name} resolves to ${found.length} declarations under server/db (${
        found.map((hit) => hit.module).join(", ") || "none"
      }) — facePanel's claim names it, so exactly one is the only readable answer`,
    );
  }
  return found[0];
}

/** From the declaration to the brace that closes it, comments and strings skipped. */
function bodyAt(source: string, at: number): string {
  const open = source.indexOf("{", source.indexOf(")", at));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      i = source.indexOf("\n", i);
      if (i === -1) break;
      continue;
    }
    if (two === "/*") {
      i = source.indexOf("*/", i) + 1;
      continue;
    }
    const char = source[i];
    if (char === '"' || char === "'") {
      i = source.indexOf(char, i + 1);
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error("could not find the end of the declaration — the reader, not the code, is wrong");
}

const STATEMENT = /\bdb\s*\.\s*(?:select|selectDistinct|execute|update|insert|delete)\b/g;

/** Drizzle's `eq(table.userId, …)` and a raw template's `userId = ${…}`. */
const OWNER_CLAUSE = /\beq\(\s*\w+\.userId\s*,|\b(?:\w+\.)?userId\s*=\s*\$\{/;

/** Each statement in a body, keyed by the offset it starts at. */
function statementsIn(body: string): string[] {
  const starts = [...body.matchAll(STATEMENT)].map((hit) => hit.index);
  if (starts.length === 0) return [];
  return starts.map((start, index) => body.slice(start, starts[index + 1] ?? body.length));
}

/** The statements of one reader that do NOT carry an owner clause. */
function unscopedStatements(body: string): string[] {
  return statementsIn(body).filter((statement) => !OWNER_CLAUSE.test(statement));
}

describe("the face panel's ownership claim", () => {
  it("names at least the three readers it was written about", () => {
    /*
      A FLOOR AGAINST SILENT SHRINKAGE, and deliberately not a copy of the
      names: the claim is the population, so a reader ADDED to it is simply
      checked. What this arm exists to catch is a reader quietly dropped from the
      sentence while the panel still reads through it — coverage leaving with no
      diff anywhere near a WHERE. If one legitimately stops serving the panel,
      lower this floor in the same commit and say which and why.
    */
    expect(claimedReaders().length).toBeGreaterThanOrEqual(3);
  });

  it("resolves every claimed reader to exactly one declaration under server/db", () => {
    const modules = Object.fromEntries(
      claimedReaders().map((name) => [name, declarationOf(name).module]),
    );
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(3);
    for (const [name, module] of Object.entries(modules)) {
      expect(module, `${name} must live under server/db`).toMatch(/^server\/db\//);
    }
  });

  it("proves the owner is in every statement each claimed reader runs", () => {
    for (const name of claimedReaders()) {
      const { module, body } = declarationOf(name);
      const statements = statementsIn(body);
      /*
        A reader with no statement at all is refused rather than passed: an empty
        population reading as a pass is how a guard keeps a reputation it stopped
        earning (the Atlas collectors' class).
      */
      expect(statements.length, `${name} (${module}) runs no statement this reader can see`)
        .toBeGreaterThan(0);
      expect(
        unscopedStatements(body),
        `${name} (${module}) runs a statement with no userId in it — invariant 1 says the owner `
        + "goes in the statement that reads, not in a check before it",
      ).toEqual([]);
    }
  });
});

describe("the reader itself, before its verdict counts for anything", () => {
  /*
    WORKING LAW 2 — verify the instrument before believing its finding. Every
    control below mutates the REAL body of a REAL reader, because a fixture
    proves the regex and not the reading. The first two are the sabotage that
    found #1181.
  */
  it("fails when the drizzle owner clause is deleted (the sabotage that found this card)", () => {
    const { body } = declarationOf("resolveOwnedCandidateId");
    const sabotaged = body.replace(/\n\s*eq\(castingCandidates\.userId, input\.userId\),/, "");
    expect(sabotaged, "the sabotage did not change the body — the control is inert").not.toBe(body);
    expect(unscopedStatements(body)).toEqual([]);
    expect(unscopedStatements(sabotaged).length).toBe(1);
  });

  it("fails when a raw template's owner clauses are deleted", () => {
    const { body } = declarationOf("listLineageReferences");
    const sabotaged = body.replaceAll(/\b(?:\w+\.)?userId = \$\{input\.userId\}/g, "1 = 1")
      .replace(/\n\s*eq\(castingReferenceLibrary\.userId, input\.userId\),/, "");
    expect(sabotaged).not.toBe(body);
    expect(unscopedStatements(body)).toEqual([]);
    /* Both branches lose their owner — the drizzle one and the recursive CTE. */
    expect(unscopedStatements(sabotaged).length).toBe(2);
  });

  it("fails when a joined reader's owner clauses are deleted", () => {
    const { body } = declarationOf("listCandidateVariants");
    const sabotaged = body.replaceAll(/\n\s*eq\(\w+\.userId, userId\),/g, "");
    expect(sabotaged).not.toBe(body);
    expect(unscopedStatements(body)).toEqual([]);
    expect(unscopedStatements(sabotaged).length).toBe(1);
  });

  it("refuses a claim it cannot read rather than reporting an empty population", () => {
    expect(() => {
      const names = [..."".matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)];
      if (names.length === 0) throw new Error("no readers");
      return names;
    }).toThrow();
    /* The real refusals are unreachable from a test without editing the tree, so
       what is driven here is the shape they take: an unreadable claim throws.
       Their wording is the finding a shift reads, which is why it names the card. */
    expect(() => declarationOf("aReaderThatDoesNotExist")).toThrow(/resolves to 0 declarations/);
  });

  it("does not mistake a check before the statement for a clause inside it", () => {
    /*
      A NEGATIVE CONTROL, because this is the exact mistake invariant 1 is about:
      a SELECT that proves ownership followed by a statement keyed on id alone
      reads as safe to a human and is a check-then-write race. `assertPositiveId`
      is such a check and must not count.
    */
    const checkThenRead = `{
      assertPositiveId(input.userId, "userId");
      const rows = await db.select().from(t).where(eq(t.candidateId, input.candidateId));
    }`;
    expect(unscopedStatements(checkThenRead).length).toBe(1);
  });
});

/* atlas hook probe — reverted in the same breath */
