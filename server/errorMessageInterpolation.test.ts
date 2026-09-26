/**
 * THE INTERPOLATION GUARD'S ARMS — drives
 * `server/testing/errorMessageInterpolations.ts` (#1406, the #509 remainder).
 *
 * The reader's own header carries the design and the measurements. This file
 * carries the three things that make it an instrument rather than a claim:
 *
 * **1 · A NEGATIVE CONTROL FIRST, and it is the arm that matters.** The tree
 * as it stands must pass. A guard over the words `prompt` and `brief` in a
 * product whose real filenames are `promptAuthor.ts` and `briefCompiler.ts`
 * is one substring away from refusing exactly the casting errors most worth
 * reading — the `shave`→`shape` typo gate owned a real word and blocked the
 * founder's own ask. The prose arms below are that risk, driven.
 *
 * **2 · A POSITIVE CONTROL THAT CANNOT BE ARGUED WITH.** A fixture carrying
 * `` throw new Error(`refused: ${brief}`) `` must redden, and the finding must
 * NAME the file and the line — a guard that reddens without saying where is a
 * guard nobody can act on.
 *
 * **3 · A FLOOR ON THE POPULATION.** A reader that silently stopped parsing
 * reports zero sites, which is byte-identical to a clean tree. So the walk's
 * own counts are asserted: it must have read hundreds of files and found
 * hundreds of error contexts before its silence means anything (law 2 — a
 * green suite proves nothing if the checker cannot fail).
 *
 * ⚠ **THE REFUSING POPULATION IS READ OUT OF `REFUSING_KEYS`, never typed
 * here** — a key added to the scrub is covered by this guard in the same act,
 * which is the card's own requirement and working law 4.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { REFUSING_KEYS } from "../shared/errorEventScrub";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  ALLOWLIST,
  SOURCE_ROOTS,
  errorMessageLeaks,
  leaksIn,
  type LeakSite,
} from "./testing/errorMessageInterpolations";

/* ⚠ THE CHILD-PROCESS FLOOR, NOT THE CONTENDED ONE, AND BOTH GUARDS ASKED.
   This suite sweeps the tree (so `contendedTestTimeouts` wants a floor) AND
   spawns `git` (so `childProcessTestTimeouts` wants ITS floor). The two
   constants are both 30_000 and `declaresTheFloor` accepts either, so the
   child-process one satisfies both classes; declaring the contended one alone
   does not, which is what the first push of this suite would have learned
   from the gate rather than from preflight. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

/** One read of the real tree, shared — the walk parses ~1,800 files. */
const reading = errorMessageLeaks(repoRoot);

describe("the negative control — the tree as it stands passes", () => {
  it("finds no customer's sentence inside an error message anywhere in the product", () => {
    const named = reading.sites.map(
      (site) => `${site.file}:${site.line}  [${site.context}]  ${site.expression}  <- ${site.key}`,
    );
    expect(named, named.join("\n")).toEqual([]);
  });

  /* THE FLOOR. Without these the arm above passes on a reader that parsed
     nothing, and "no leaks" and "no reading" would be the same sentence. */
  it("read the product, rather than reporting silence about an empty walk", () => {
    expect(reading.files).toBeGreaterThan(900);
    expect(reading.contexts).toBeGreaterThan(400);
  });

  it("excuses nothing today, and the allowlist is the thing that only shrinks", () => {
    expect(ALLOWLIST).toEqual([]);
  });

  it("walks the product's source and not its tests", () => {
    expect([...SOURCE_ROOTS]).toEqual(["server/", "shared/", "client/src/", "scripts/"]);
  });
});

describe("the positive control — the leak reddens, and says where", () => {
  const fixture = (body: string): LeakSite[] => leaksIn("server/casting/_fixture.ts", body);

  it("catches the card's own example, and names the file and the line", () => {
    const sites = fixture(
      ["export function author(brief: string): never {", "  throw new Error(`refused: ${brief}`);", "}"].join("\n"),
    );
    expect(sites).toHaveLength(1);
    expect(sites[0]?.file).toBe("server/casting/_fixture.ts");
    expect(sites[0]?.line).toBe(2);
    expect(sites[0]?.key).toBe("brief");
    expect(sites[0]?.context).toBe("new Error");
    expect(sites[0]?.shape).toBe("interpolation");
  });

  /* Derived from the scrub's own constant: a key added there and not covered
     here is impossible. A key REMOVED takes its own arm, which is the honest
     direction — the hand-written floor in `errorEventScrub.test.ts` is what
     stops the list being emptied quietly. */
  for (const key of REFUSING_KEYS) {
    it(`catches \`\${${key}}\` in an error message`, () => {
      const sites = fixture("throw new Error(`the author refused: ${" + key + "}`);");
      expect(sites).toHaveLength(1);
      expect(sites[0]?.key).toBe(key);
    });

    it(`catches \`\${cast.${key}}\` — the leak through a property`, () => {
      const sites = fixture("log.error(`compose failed for ${cast." + key + "}`);");
      expect(sites).toHaveLength(1);
      expect(sites[0]?.key).toBe(key);
      expect(sites[0]?.context).toBe("log.error");
    });
  }

  it("catches the leak through an element access, where the key is a string", () => {
    const sites = fixture('throw new Error(`refused: ${row["brief"]}`);');
    expect(sites).toHaveLength(1);
    expect(sites[0]?.key).toBe("brief");
  });

  it("catches it inside a callback within the error call, which a function-bounded walk loses", () => {
    const sites = fixture("throw new Error(rows.map((r) => `${r.brief}`).join(', '));");
    expect(sites).toHaveLength(1);
    expect(sites[0]?.key).toBe("brief");
  });

  it("catches it in a CUSTOM error, not only in `Error` and `TRPCError`", () => {
    /* 36 constructors end in `Error` in this tree; naming two would have been
       silent on `MaskError`'s 43 templates alone. */
    for (const constructor of ["TRPCError", "MaskError", "ProviderError", "TypeError"]) {
      const sites = fixture("throw new " + constructor + "(`refused: ${brief}`);");
      expect(sites, constructor).toHaveLength(1);
    }
  });

  it("catches the whole value handed over bare, not only an interpolation", () => {
    const sites = fixture("throw new Error(cast.masterPrompt);");
    expect(sites).toHaveLength(1);
    expect(sites[0]?.shape).toBe("argument");
    expect(sites[0]?.key).toBe("masterPrompt");
  });

  it("matches a key whatever its case", () => {
    expect(fixture("throw new Error(`${MasterPROMPT}`);")).toHaveLength(1);
  });
});

describe("the asymmetry — it reads EXPRESSIONS, and prose must pass", () => {
  const fixture = (body: string): LeakSite[] => leaksIn("server/casting/_fixture.ts", body);

  it("passes a message that merely SAYS `prompt` and `brief`", () => {
    expect(fixture("throw new Error(`the prompt author returned no brief for slice ${index}`);")).toEqual([]);
  });

  it("passes an identifier that CONTAINS a refusing key but is not one", () => {
    /* This is the whole arm. A substring test fails every line of it, and
       these are this product's real symbols. */
    for (const expression of [
      "briefCompiler.name",
      "promptAuthor.version",
      "briefing.edition",
      "preferenceRow.id",
      "imageKeyPrefix",
      "resultUrls.length",
    ]) {
      expect(fixture("throw new Error(`failed at ${" + expression + "}`);"), expression).toEqual([]);
    }
  });

  it("passes a template that is not in an error or a log call at all", () => {
    expect(fixture("const summary = `brief: ${brief}`;")).toEqual([]);
    expect(fixture("await storagePut(`casting/${brief}.png`, bytes);")).toEqual([]);
  });

  it("passes a sibling argument — a template beside an error is not inside it", () => {
    expect(fixture("report(new Error('x'), `${brief}`);")).toEqual([]);
  });

  it("passes a literal argument to an error, which the interpolation half already judged", () => {
    expect(fixture("throw new Error('the prompt author refused the brief');")).toEqual([]);
  });
});

describe("the reader itself — driven on a real tree it does not share with the product", () => {
  /*
    ⚠ A POSITIVE CONTROL ON THE WALK, not only on the parser. Every arm above
    drives `leaksIn` on a string; none of them proves the WALK finds a file,
    reads it and reports it. A reader whose `git ls-files` filter was wrong
    would pass all of them and report an empty tree forever — which is the
    silence the floor arm is about, from the other side.
  */
  it("finds a planted leak in a real repository, through the real walk", () => {
    const root = mkdtempSync(join(tmpdir(), "drape-1406-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: root });
      execFileSync("git", ["config", "user.email", "t@t"], { cwd: root });
      execFileSync("git", ["config", "user.name", "t"], { cwd: root });
      execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });

      const dir = join(root, "server", "casting");
      execFileSync("node", ["-e", `require('fs').mkdirSync(${JSON.stringify(dir)},{recursive:true})`]);
      writeFileSync(
        join(dir, "leaky.ts"),
        "export function go(brief: string): never {\n  throw new Error(`refused: ${brief}`);\n}\n",
      );
      /* A test file carrying the same shape, to prove the exclusion is real
         rather than incidental: if tests were walked this arm would see two. */
      writeFileSync(
        join(dir, "leaky.test.ts"),
        "it('x', () => { throw new Error(`refused: ${brief}`); });\n",
      );
      execFileSync("git", ["add", "-A"], { cwd: root });

      const found = errorMessageLeaks(root);
      expect(found.sites).toHaveLength(1);
      expect(found.sites[0]?.file).toBe("server/casting/leaky.ts");
      expect(found.sites[0]?.line).toBe(2);
      expect(found.files).toBe(1);
      expect(found.contexts).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
