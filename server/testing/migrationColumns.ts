/**
 * WHAT A COLUMN IS *NOW*, read from the migrations rather than from one of them.
 *
 * # Why this exists
 *
 * Two suites pinned an ink column's shape by reading the migration that CREATED
 * it — `0034_casting_ink_designs.sql` and `0041_casting_ink_form_demand.sql` —
 * and asserting its enum members equalled `INK_PLACEMENTS`. That was a true
 * reading of a true file, right up until `0046_ink_placement_opens.sql` opened
 * both columns to `varchar(64)`.
 *
 * At that moment both suites went on passing while asserting a fence the
 * database no longer has. **A suite that cannot go red when its subject is
 * removed is how a dead control keeps a live reputation** — this campaign's own
 * named disease, and the migration that removes the fence is exactly the
 * commit where it would have been planted by our own hand.
 *
 * So a pin about a column's shape reads the SEQUENCE, not a member of it. A
 * later `MODIFY` is part of what the column is; a reader that stops at the
 * `CREATE` is reading history and reporting the present.
 *
 * # It refuses rather than guesses
 *
 * This is a narrow reader over hand-written DDL, not a SQL engine. It
 * understands four shapes — `CREATE TABLE`, `ALTER TABLE … MODIFY`, `ALTER
 * TABLE … ADD`, `ALTER TABLE … DROP COLUMN` — and **throws on any statement
 * that touches a column it cannot classify**, because the failure mode of a
 * lenient parser here is a confident wrong answer about a column nobody
 * re-reads. A new DDL shape makes this loud on the commit that introduces it.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");

/** Every migration file, in the order a fresh database replays them. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
}

/**
 * The statements of one migration, with every comment line stripped.
 *
 * The prose in these files explains the decision — including, by name, the
 * columns that deliberately do NOT exist — so a reader that kept the comments
 * would read the argument against a column as evidence of the column.
 */
function statementsOf(file: string): string[] {
  return readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** The column definitions inside a `CREATE TABLE` body, by column name. */
function createdColumns(statement: string): Map<string, string> {
  const columns = new Map<string, string>();
  for (const line of statement.split(/\r?\n/)) {
    const match = /^\s*`([A-Za-z0-9_]+)`\s+(.+?),?\s*$/.exec(line);
    /* CONSTRAINT / PRIMARY KEY lines have no leading backticked name, so they
       simply do not match — no exclusion list to keep in step with anything. */
    if (match) columns.set(match[1]!, match[2]!.trim());
  }
  return columns;
}

/**
 * A column's effective DDL after every migration has been applied, or `null`
 * when no migration ever creates it (or the last word on it is a DROP).
 *
 * The type is returned exactly as the DDL spells it, minus a trailing comma:
 * `varchar(64) NOT NULL`, `enum('left','right','centre') NOT NULL`, `json`.
 */
export function effectiveColumn(table: string, column: string): string | null {
  let current: string | null = null;
  let sawTable = false;

  for (const file of migrationFiles()) {
    for (const statement of statementsOf(file)) {
      const created = new RegExp("CREATE TABLE\\s+`" + table + "`\\s*\\(", "i").exec(statement);
      if (created) {
        sawTable = true;
        current = createdColumns(statement).get(column) ?? null;
        continue;
      }

      if (!new RegExp("ALTER TABLE\\s+`" + table + "`", "i").test(statement)) continue;
      sawTable = true;

      const modified = new RegExp("ALTER TABLE\\s+`" + table + "`\\s+MODIFY\\s+`" + column + "`\\s+(.+)$", "is")
        .exec(statement);
      if (modified) { current = modified[1]!.trim(); continue; }

      const added = new RegExp("ALTER TABLE\\s+`" + table + "`\\s+ADD\\s+`" + column + "`\\s+(.+)$", "is")
        .exec(statement);
      if (added) { current = added[1]!.trim(); continue; }

      if (new RegExp("ALTER TABLE\\s+`" + table + "`\\s+DROP COLUMN\\s+`" + column + "`", "i").test(statement)) {
        current = null;
        continue;
      }

      /* Anything else that NAMES this column is a shape this reader does not
         understand, and a silent skip would report the previous answer as if it
         were still the truth. */
      if (new RegExp("`" + column + "`").test(statement)) {
        throw new Error(
          `migration ${file} touches \`${table}\`.\`${column}\` in a form this reader does not `
          + `understand — teach it the shape rather than trusting the answer:\n${statement}`,
        );
      }
    }
  }

  if (!sawTable) throw new Error(`no migration mentions \`${table}\` — wrong table name?`);
  return current;
}

/**
 * The members of a column that is an enum *today*, or a throw when it is not.
 *
 * It throws rather than returning `[]` on a non-enum for the reason the whole
 * file exists: a caller comparing `[]` against a vocabulary gets a clean,
 * confident, wrong red — and a caller comparing it against an empty list gets a
 * clean, confident, wrong green.
 */
export function effectiveEnumMembers(table: string, column: string): string[] {
  const ddl = effectiveColumn(table, column);
  if (ddl === null) throw new Error(`\`${table}\`.\`${column}\` does not exist after the migrations`);
  const match = /^enum\((.*?)\)/i.exec(ddl);
  if (!match) throw new Error(`\`${table}\`.\`${column}\` is \`${ddl}\`, not an enum`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}
