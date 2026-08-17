/**
 * EVERY SCRIPT'S DATABASE CONNECTION COMES FROM ONE DOOR.
 *
 * # The ten hours, and why a documented helper was not enough
 *
 * `mysql.createConnection(url)` with no `timezone` parses a DATETIME as LOCAL.
 * Every timestamp in these databases is UTC, so on this bench (UTC+10) a raw
 * read is **ten hours early** — silently, with a Date that looks entirely
 * reasonable. `scripts/lib/dbConnection.mts` has said so in its own header for
 * weeks, and offered `openDatabase()` as the one obvious thing to import.
 *
 * It was not enough. Shift 36 found `peek-dev-ledger-disposable.mts` printing
 * the **money ledger** through a raw connection — every row ten hours early —
 * and then made the same mistake again in a fresh probe, which briefly made a
 * correct founder-facing artifact look wrong. A helper nobody is required to use
 * is the "helper written, docs written, call site never added" shape (invariant
 * 7's family), and the answer to a class is never "remember harder".
 *
 * # AND A CLEANUP SCRIPT SCOPES ITS DELETE BY THE IDS IT MINTED, NEVER BY A
 * # PROPERTY (ruled fable-892 §5, from opus-654 §5)
 *
 * Written here rather than in a mailbox because this is the header a script
 * author reads before touching a database. A fixture teardown was scoped as
 * *"delete the sessions that have no rolls"* — true of the two rows it had just
 * created, and true of seven older ones it knew nothing about. It removed nine.
 *
 * It cost nothing that time (dev only, verify-bot's own empty shells, audited
 * afterwards at 0 orphaned candidates and 0 orphaned rolls) and the next one
 * will not be so lucky. **Keep the ids you inserted and delete those** — a
 * property is a description of your fixture at the moment you wrote it, not an
 * identity, and anything that later matches the description is collateral.
 *
 * It is invariant 1's shape — scope the thing in the statement that writes —
 * arriving in the one place nobody thought of as production code.
 *
 * # Why the check reads the AST and not the text
 *
 * The first attempt at this scope was a grep, and it was wrong in both
 * directions: it flagged `scripts/lib/attemptRows.mts`, whose only match was its
 * own comment WARNING against raw connections, and it cleared files merely for
 * containing the word `timezone` anywhere — including in prose. A scan that
 * reads prose as code cannot support a verdict, so this one asks the TypeScript
 * parser where the CALLS are. The controls below drive exactly that distinction.
 *
 * # The rule, and the one exemption
 *
 * A call to `mysql.createConnection` / `mysql.createPool` (or the bare imported
 * forms) anywhere under `scripts/` fails this test. The single exemption is
 * `scripts/lib/dbConnection.mts`, because it IS the door: `openDatabase` and
 * `openPool` are where the connection is actually made, with `timezone: "Z"`
 * applied last so a caller's own options cannot override it.
 *
 * The exemption is a path, not a list of names, and it is asserted to be
 * reachable: if the door ever stops opening a connection, the last control here
 * goes red rather than quietly passing a tree with no door in it.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPTS_ROOT = path.join(REPO_ROOT, "scripts");
const DOOR = path.join(SCRIPTS_ROOT, "lib", "dbConnection.mts");

const RAW_CONNECTION_CALLEES = new Set([
  "mysql.createConnection",
  "mysql.createPool",
  "createConnection",
  "createPool",
]);

function scriptFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts") || entry.endsWith(".mts")) found.push(full);
    }
  };
  walk(SCRIPTS_ROOT);
  return found.sort();
}

/**
 * Where a source text opens its own connection, by parse rather than by match.
 *
 * Exported shape: `{ callee, line }` per site, so a failure names the line a
 * human has to open rather than only the file.
 */
function rawConnectionSites(text: string, fileName = "probe.mts"): Array<{ callee: string; line: number }> {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true);
  const sites: Array<{ callee: string; line: number }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      let callee = "";
      if (ts.isPropertyAccessExpression(expression)) {
        callee = `${expression.expression.getText(source)}.${expression.name.text}`;
      } else if (ts.isIdentifier(expression)) {
        callee = expression.text;
      }
      if (RAW_CONNECTION_CALLEES.has(callee)) {
        sites.push({
          callee,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

describe("scripts open their database through one door", () => {
  /*
    THE INSTRUMENT FIRST, because a checker that cannot fail proves nothing about
    the tree it sweeps (working law 2). These two are the exact pair of mistakes
    the grep version made.
  */
  it("CONTROL — the reader FINDS a real raw connection", () => {
    const sites = rawConnectionSites(
      'import mysql from "mysql2/promise";\n'
      + "const c = await mysql.createConnection(process.env.DATABASE_URL!);\n",
    );
    expect(sites).toEqual([{ callee: "mysql.createConnection", line: 2 }]);
  });

  it("CONTROL — the reader IGNORES a mention in prose, which is what the grep got wrong", () => {
    /* This is `scripts/lib/attemptRows.mts`'s real situation, reduced. */
    const sites = rawConnectionSites(
      "/*\n"
      + "  A raw `mysql.createConnection` parses a DATETIME as LOCAL, so this file\n"
      + "  goes through openDatabase instead. Do not call mysql.createPool here.\n"
      + "*/\n"
      + 'import { openDatabase } from "./dbConnection.mjs";\n'
      + "const c = await openDatabase();\n"
      + 'const sql = "createConnection is also a word in a string";\n',
    );
    expect(sites).toEqual([]);
  });

  it("CONTROL — a pool counts too, since a pool misreads a DATETIME the same way", () => {
    const sites = rawConnectionSites("const p = mysql.createPool({ uri: url });\n");
    expect(sites.map((s) => s.callee)).toEqual(["mysql.createPool"]);
  });

  /*
    THEN THE SCOPE, positive-controlled on the case that caused the rule. Shift
    35's lesson: a scope derived from where code lives can exclude its own origin
    case, and the only way anyone finds out is by asserting it is included.
  */
  it("SCOPE — the swept list contains the origin case and the door itself", () => {
    const files = scriptFiles();
    expect(files).toContain(path.join(SCRIPTS_ROOT, "peek-dev-ledger-disposable.mts"));
    expect(files).toContain(DOOR);
    expect(files.length).toBeGreaterThan(200);
  });

  it("the door still opens a connection, so the exemption is not exempting nothing", () => {
    const sites = rawConnectionSites(readFileSync(DOOR, "utf8"), DOOR);
    expect(sites.map((s) => s.callee).sort()).toEqual(["mysql.createConnection", "mysql.createPool"]);
  });

  /* AND THE SWEEP. */
  it("no script but the door opens its own mysql connection", () => {
    const offenders: string[] = [];
    for (const file of scriptFiles()) {
      if (path.resolve(file) === path.resolve(DOOR)) continue;
      const sites = rawConnectionSites(readFileSync(file, "utf8"), file);
      for (const site of sites) {
        offenders.push(`${path.relative(REPO_ROOT, file).replace(/\\/g, "/")}:${site.line} — ${site.callee}`);
      }
    }
    expect(
      offenders,
      "These open their own connection, which parses every DATETIME as LOCAL — ten hours\n"
      + "early on this bench. Import `openDatabase` (or `openPool`) from\n"
      + "`scripts/lib/dbConnection.mts` instead; both accept a URL or an options object,\n"
      + "so the fix is the callee alone:\n\n"
      + `${offenders.join("\n")}\n`,
    ).toEqual([]);
  });
});

/*
  THE SECOND WAY A SCRIPT READS THE WRONG DATABASE, and this one does not
  misread a timestamp — it misreads the WORLD.

  `railway run --service MySQL` injects that service's own variables, and there
  is no `DATABASE_URL` among them: the production URL arrives as
  `MYSQL_PUBLIC_URL`. `dotenv/config` does not overwrite variables that are
  already set, but it happily fills one that is absent — so a script that loads
  `.env` and then reaches for `DATABASE_URL` gets the DEV database back, under
  the command whose entire purpose was to read production, with the right
  heading printed over it and nothing anywhere to say otherwise.

  That is not hypothetical. The scan-rate report was written this way and its
  first "production is empty" reading came from dev; the two databases share a
  hostname and a database name and differ only in the port, which is why nobody
  sees it in the output. `resolveDatabaseUrl()` is the door for it.
*/
const PRODUCTION_INCANTATION = /service MySQL/;

function readsTheWrongWorld(text: string): boolean {
  if (!PRODUCTION_INCANTATION.test(text)) return false;
  if (!/["']dotenv\/config["']/.test(text)) return false;
  /*
    AND IT MUST ACTUALLY OPEN A DATABASE. The first aim of this rule flagged two
    calibration scripts that name the production wrapper in their usage line and
    never touch a row — they run under it to inherit an environment, and the
    world they read is a file on disk. A guard pointed at the wrong field fails
    in both directions (it also stops saying anything useful about the field it
    was for), so the subject is named explicitly here.
  */
  if (!/openDatabase|openPool|DATABASE_URL/.test(text)) return false;
  return !/MYSQL_PUBLIC_URL|resolveDatabaseUrl/.test(text);
}

describe("a script documented for production reads production", () => {
  it("CONTROL — it catches the exact shape that took tonight's false reading", () => {
    expect(readsTheWrongWorld(
      "/* railway.cmd run --service MySQL -- npx tsx this */\n"
      + 'import "dotenv/config";\n'
      + "const db = await openDatabase(process.env.DATABASE_URL);\n",
    )).toBe(true);
  });

  it("CONTROL — it clears the same script once it goes through the door", () => {
    expect(readsTheWrongWorld(
      "/* railway.cmd run --service MySQL -- npx tsx this */\n"
      + 'import "dotenv/config";\n'
      + "const db = await openDatabase(resolveDatabaseUrl());\n",
    )).toBe(false);
  });

  it("CONTROL — a local-only script is not asked to care", () => {
    expect(readsTheWrongWorld('import "dotenv/config";\nconst db = await openDatabase();\n')).toBe(false);
  });

  it("CONTROL — a script that runs under the wrapper but reads no rows is not flagged", () => {
    /* `scripts/calibration/freckle-density.mts`, reduced: it names the wrapper
       in its usage line, loads `.env` for `FAL_KEY`, and reads frames off disk. */
    expect(readsTheWrongWorld(
      "/* railway.cmd run --service MySQL -- npx tsx this */\n"
      + 'import "dotenv/config";\n'
      + "const apiKey = process.env.FAL_KEY;\n",
    )).toBe(false);
  });

  it("no production-documented script silently falls back to the dev database", () => {
    const offenders: string[] = [];
    for (const file of scriptFiles()) {
      if (readsTheWrongWorld(readFileSync(file, "utf8"))) {
        offenders.push(path.relative(REPO_ROOT, file).split(path.sep).join("/"));
      }
    }
    expect(
      offenders,
      "These say `railway run --service MySQL` in their own header, load `.env`, and then\n"
      + "resolve `DATABASE_URL` — which that command does not inject. They read DEV under the\n"
      + "production incantation and print nothing to say so. Use `resolveDatabaseUrl()` from\n"
      + "`scripts/lib/dbConnection.mts`:\n\n"
      + `${offenders.join("\n")}\n`,
    ).toEqual([]);
  });
});
