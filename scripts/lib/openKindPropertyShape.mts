/**
 * WHAT `casting_open_kind_properties` MUST BE, asked of the live database.
 *
 * Shared rather than written into the ceremony, for two reasons and the second
 * is the load-bearing one:
 *
 *  1. working law 4 — a ceremony that retypes its own expectations is a second
 *     copy of the schema;
 *  2. **the rehearsal drives these exact assertions against deliberately-wrong
 *     tables** (`scripts/rehearse-open-kind-properties-disposable.mts`), which is
 *     the only way to know they can redden. A shape check that has only ever seen
 *     a correct table cannot fail, and a check that cannot fail is not a check
 *     (working law 2). That is why the table name is a parameter.
 *
 * Each assertion is here because of what its absence would cost:
 *
 *  - the COLUMNS, both ways — a missing one breaks the writer, and one nobody
 *    designed appearing in a table this small is a finding rather than a
 *    curiosity;
 *  - the UNIQUE KEY — the whole reason this is a table and not a cache is *one
 *    row per kind*. With the columns and without the key, a second answer for
 *    `wings` lands and every reader needs a rule for choosing between them;
 *  - both properties NOT NULL — a declined read must write NO ROW. A gate
 *    treating a null `locality` as croppable mints a crop of one wing under the
 *    name of two, which is precisely what fable-872 §2 forbids;
 *  - and BOTH ENUMS against their TypeScript lists. `locality` earned that check
 *    the moment it stopped being a boolean (fable-951): a column that can store
 *    `coLocated` while the code spells it `colocated` is a kind that never
 *    reaches the crop road and never reports why.
 */
import { BODY_ANCHOR_REGIONS } from "../../shared/bodyAnchorRegions";
import { KIND_LOCALITIES } from "../../shared/kindLocality";
import type { CeremonyWorld } from "./ceremony.mts";

export const OPEN_KIND_PROPERTY_TABLE = "casting_open_kind_properties";
export const OPEN_KIND_PROPERTY_KEY = "uq_casting_open_kind_properties_kind";

/** The columns the design ruled, in the order the DDL writes them. */
export const OPEN_KIND_PROPERTY_COLUMNS = [
  "id",
  "kind",
  "locality",
  "anchorRegion",
  "model",
  "promptVersion",
  "createdAt",
] as const;

/**
 * Read the table's shape back and throw on the first thing that is wrong.
 *
 * Returns the lines it proved, so a caller prints evidence rather than the word
 * "ok" — a checker whose output is a tick is indistinguishable from one that
 * examined nothing.
 */
export async function assertKindPropertyShape(
  connection: CeremonyWorld["connection"],
  table: string = OPEN_KIND_PROPERTY_TABLE,
  key: string = OPEN_KIND_PROPERTY_KEY,
): Promise<string[]> {
  const proved: string[] = [];

  const [columns] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${table}\``);
  const names = columns.map((row) => String(row.Field));
  proved.push(`columns: ${names.join(", ")}`);
  const missing = OPEN_KIND_PROPERTY_COLUMNS.filter((name) => !names.includes(name));
  if (missing.length > 0) throw new Error(`missing columns: ${missing.join(", ")}`);
  const extra = names.filter((name) => !OPEN_KIND_PROPERTY_COLUMNS.includes(name as never));
  if (extra.length > 0) throw new Error(`columns nobody designed: ${extra.join(", ")}`);

  const [keys] = await connection.query<any[]>(`SHOW INDEX FROM \`${table}\``);
  const unique = keys.filter((row) => String(row.Key_name) === key);
  if (unique.length !== 1 || Number(unique[0].Non_unique) !== 0 || String(unique[0].Column_name) !== "kind") {
    throw new Error(`${key} is not a UNIQUE index on \`kind\` — one row per kind is not enforced`);
  }
  proved.push(`key: ${key} UNIQUE (kind) — one row per kind, enforced`);

  for (const property of ["locality", "anchorRegion"] as const) {
    const row = columns.find((entry) => String(entry.Field) === property);
    if (String(row?.Null) !== "NO") {
      throw new Error(`\`${property}\` is nullable — a declined read must write NO ROW, never a row with a null in it`);
    }
  }
  proved.push("both properties NOT NULL — the absence of a ROW is the only third state");

  /*
    THE ENUM AGAINST THE TYPESCRIPT LIST, because a hand-written DDL beside a
    constant is the parallel copy that drifts — and this drift would be silent
    until a framing derivation was asked about a place the column had never heard
    of. Compared as SETS in both directions: a missing member cannot be stored,
    and an extra one is a place nobody designed a framing answer for.
  */
  const enumOf = (column: string): string[] => {
    const declared = String(columns.find((entry) => String(entry.Field) === column)?.Type ?? "");
    return Array.from(declared.matchAll(/'([^']+)'/g)).map((match) => match[1]!);
  };
  const matchEnum = (column: string, expected: readonly string[], against: string) => {
    const stored = enumOf(column);
    const absent = expected.filter((member) => !stored.includes(member));
    const invented = stored.filter((member) => !expected.includes(member));
    if (absent.length > 0 || invented.length > 0) {
      throw new Error(
        `the ${column} enum does not match ${against} — missing ${absent.join(", ") || "none"}`
        + `, unknown ${invented.join(", ") || "none"}`,
      );
    }
    proved.push(`${column}: ${stored.length} members, matching ${against} exactly`);
  };
  matchEnum("anchorRegion", BODY_ANCHOR_REGIONS, "BODY_ANCHOR_REGIONS");
  matchEnum("locality", KIND_LOCALITIES, "KIND_LOCALITIES");

  return proved;
}
