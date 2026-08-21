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
 *
 * # ⚠ THE SENTENCE ABOVE WAS TRUE OF ITS INTENT AND FALSE OF ITS CODE, AND IT
 * # STAYED THAT WAY BECAUSE THE READER WAS ONLY EVER POINTED AT ONE FILE
 * # (found 2026-08-22, driven by the two-paths pin)
 *
 * It claimed `ALTER TABLE … ADD` and `ALTER TABLE … MODIFY`. What it actually
 * matched was ``ADD `col` `` and ``MODIFY `col` `` — the spellings WITHOUT the
 * optional `COLUMN` keyword. Counted across `drizzle/`:
 *
 * ```
 * ADD COLUMN     17 statements     invisible          MODIFY COLUMN  26   invisible
 * ADD `col`      51 statements     understood         MODIFY `col`    2   understood
 * ```
 *
 * **And the two understood `MODIFY` statements are both in migration 0046 —
 * the one file this reader was written against.** Every arm of its own suite
 * was chosen from columns it could already read, so the control set inherited
 * the blind spot from the instrument: a reader validated on the specimen it was
 * built for, which is this campaign's own named class.
 *
 * Nobody was ever given a wrong answer, and that is the design working rather
 * than luck — the unclassified-shape throw meant the blindness surfaced as a
 * refusal the first time anyone asked about a column added the other way. The
 * danger was never a false reading; it was that a red like that reads as *"this
 * pin is broken"* rather than *"this reader is half-built"*, and the cheap fix
 * is to delete the pin.
 *
 * **A third shape was invisible for the same reason and is now handled**: one
 * `ALTER TABLE` adding MANY columns (0029 adds eleven in one statement). The
 * old regexes ran against the whole statement with the `s` flag, so even a
 * matching spelling would have captured every following column's DDL into the
 * first one's answer. The body is now split into clauses at parenthesis depth
 * zero — `enum('a','b')` is one clause with two commas in it — and each clause
 * classified on its own.
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
    /*
      ⚠ THE LINE FILTER ABOVE ONLY SEES A COMMENT THAT BEGINS A LINE, and
      drizzle's own separator does not: it is emitted as `;--> statement-
      breakpoint` TRAILING the statement it ends. So the marker survived the
      filter and became the first line of the NEXT statement, which is
      invisible to a reader using unanchored regexes and fatal to one that
      anchors on `^ALTER TABLE`. Found 2026-08-22 while teaching this reader
      MySQL's second spelling; 15 migration files carry it this way.

      Removed by its exact token rather than by a general strip-to-end-of-line.
      A general strip is probably safe here — checked, no migration has a `--`
      inside a string literal — but "probably safe" is the wrong standard for
      the one function every column pin in the repository reads through, and
      the narrow removal is provable by inspection.
    */
    .split("--> statement-breakpoint")
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

      const body = statement.replace(new RegExp("^\\s*ALTER TABLE\\s+`" + table + "`", "is"), "");
      for (const clause of alterClauses(body)) {
        if (!new RegExp("`" + column + "`").test(clause)) continue;

        const acted = /^(ADD|MODIFY|DROP)\s+(?:COLUMN\s+)?`([A-Za-z0-9_]+)`\s*([\s\S]*)$/i.exec(clause);
        /* A clause that names the column somewhere OTHER than as its subject —
           `ADD INDEX x (`col`)`, a CHANGE that renames it — is a shape this
           reader does not understand, and a silent skip would report the
           previous answer as if it were still the truth. */
        if (!acted || acted[2] !== column) {
          throw new Error(
            `migration ${file} touches \`${table}\`.\`${column}\` in a form this reader does not `
            + `understand — teach it the shape rather than trusting the answer:\n${clause.trim()}`,
          );
        }

        current = acted[1]!.toUpperCase() === "DROP" ? null : acted[3]!.trim();
      }
    }
  }

  if (!sawTable) throw new Error(`no migration mentions \`${table}\` — wrong table name?`);
  return current;
}

/**
 * The comma-separated clauses of an `ALTER TABLE` body.
 *
 * # Why this is not `body.split(",")`
 *
 * Because `enum('generated','carried','refreshed')` is one clause containing
 * three commas, and splitting naively would hand the classifier `MODIFY COLUMN
 * \`selectionReason\` enum('generated'` — which fails to parse as anything and
 * would throw on a statement the reader understands perfectly well. So the
 * split is at parenthesis depth zero, which is the only depth an ALTER's own
 * separators live at. Quotes are not tracked because a MySQL identifier or
 * string containing an unbalanced parenthesis does not occur in this
 * repository's hand-written DDL, and if one ever does the classifier below
 * refuses rather than guessing — which is the property that matters.
 */
function alterClauses(body: string): string[] {
  const clauses: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      clauses.push(body.slice(start, index));
      start = index + 1;
    }
  }
  clauses.push(body.slice(start));
  return clauses.map((clause) => clause.trim()).filter(Boolean);
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
