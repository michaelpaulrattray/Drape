/**
 * IS EVERY `publicId` IN THE DATABASE ONE THE PRODUCT CAN STILL REACH? (#2496)
 *
 * # The class this answers, and the instance that paid for it
 *
 * A disposable can write a value into a column the product parses with a
 * STRICTER schema than the column enforces, and nothing anywhere reads for it.
 * `casting_sessions.publicId` is `varchar(36)`, so MySQL took
 * `1086-inflight-e3ad6977` happily; the route parses the same field with
 * `z.string().uuid()`, so the row was unreachable the moment it was written.
 *
 * From the outside that looked exactly like a product defect: a shift opened one
 * of those sheets, got a `TRPCClientError` inside a 200, and spent three drivers
 * working out that the cause was litter rather than its own diff. That cost is
 * the whole subject — a customer sees nothing, because the rows were a shift's.
 *
 * ⚠ **The three existing script guards cannot see it, and that is structural.**
 * `scriptExitDiscipline` reads how a script exits, `scriptConnectionDiscipline`
 * reads how it opens a database, and `check:scripts` excludes untracked files by
 * construction (#1231) — which is every disposable. So the writer passed every
 * check the shift close names, for three weeks, while holding a defect.
 *
 * # The two verdicts, and why they are NOT one
 *
 * Each value is judged twice, because the two questions have different answers
 * and different weights:
 *
 *  - **`unreachable`** — the route's own parser refuses it, so no customer and
 *    no shift can ever load that row again. **A FAULT.** This is #1098's defect
 *    exactly.
 *  - **`unminted`** — the parser accepts it, but it is not the shape the
 *    product's own mint emits for that column. **REPORTED, NOT A FAULT**: it is
 *    a pointer to look at a row, never a defect on its own.
 *
 * Both were driven against the real zod in this tree rather than reasoned about,
 * and the measurement is why the split exists: `z.string().uuid()` in zod 4
 * **accepts an UPPERCASE uuid, a v1 uuid and the nil uuid**, none of which
 * `crypto.randomUUID()` can emit. So a hand-written-looking value can be
 * perfectly reachable, and calling that a fault would redden the reading over a
 * row the product serves correctly.
 *
 * # ⚠ THE JUDGE IS CHOSEN BY THE COLUMN'S DECLARED WIDTH, WHICH IS A
 * # DECLARATION AND NOT AN INFERENCE
 *
 * There are two mints in the product and the schema says which column gets
 * which, in the width it declares:
 *
 *  - **36** — `randomUUID()`, the canonical dashed form. Twelve tables.
 *  - **32** — `randomUUID().replace(/-/g, "")` (`newCampaignPublicId`,
 *    `server/db/castCampaigns.ts`), and `cast_campaigns`' own column comment
 *    says so in words: *"32 hex characters, a UUID without dashes."* One table.
 *
 * A width this module has no judge for is **REFUSED**, never skipped — a
 * collector that can come up short must say so rather than reporting a clean
 * population (CLAUDE.md's rule for the four Atlas collectors that were found
 * reading at a shape). `server/janitorPublicIdShapes.test.ts` holds the same
 * line in CI, so a fourteenth table with a 40-wide `publicId` reddens the gate
 * on the day it is declared rather than being quietly dropped from a reading.
 *
 * # ⚠ AND THE CARD'S OWN PREMISE IS TRUE OF TWELVE TABLES, NOT THIRTEEN
 *
 * #2496 says *"the route parses it with `z.string().uuid()`"*. Read at the code:
 * `server/routes/castingV2.ts:206` does, for every 36-wide id — and `:265`
 * parses a campaign id as `z.string().min(1).max(32)`, which would accept
 * `1086-inflight-e3ad6977` without complaint. **So no value in `cast_campaigns`
 * can ever BE unreachable**, and in that one table this class is visible only on
 * the `unminted` axis, which is not a fault. That is a real limit of the reading
 * and the report prints it rather than leaving it here.
 *
 * # What it is NOT, and cannot be
 *
 * Not a CI guard. Its subject is rows in a database, and `vitest.setup.ts`
 * strips `DATABASE_URL` precisely so no suite can reach one — so this runs from
 * a shift's own hands on the Janitor's three-day clock (`docs/JANITOR_LOG.md`),
 * exactly as `memory-index-audit.mts` and `janitor-backup-retention.mts` do.
 * The suite proves the JUDGE and the POPULATION, which is the half that can be
 * automated; the rows are the half that cannot. #286's lesson is why that split
 * is written down rather than implied: a mechanism with no caller does not
 * exist.
 */
import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import { z } from "zod";

import * as schema from "../../drizzle/schema";

/** The column every judged id lives in. One name, in thirteen tables. */
export const PUBLIC_ID_COLUMN = "publicId";

/**
 * The route's parser for a 36-wide public id, as `server/routes/castingV2.ts`
 * declares it.
 *
 * ⚠ **This expression is a COPY of a declaration one file away, so the suite
 * holds the two equal rather than trusting them to stay so** (working law 4: a
 * second list shadowing a source of truth always drifts from it). The route's
 * `const publicId` is not exported, and exporting a validator out of a router
 * to serve a reading tool would widen a product module for a tool's
 * convenience. So the copy stays and `server/janitorPublicIdShapes.test.ts`
 * reads the route's own source for `z.string().uuid()`, reddening if it ever
 * stops saying that.
 */
const ROUTE_UUID_PARSER = z.string().uuid();

/**
 * What `crypto.randomUUID()` emits and nothing else: lowercase, canonical,
 * version 4, variant `[89ab]`.
 *
 * Deliberately narrower than the parser above. The nil uuid, a v1 uuid and an
 * uppercase uuid all PASS `z.string().uuid()` and none of them can come out of
 * the product's mint — which is the whole value of the second axis.
 */
const MINTED_DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The same mint with its dashes stripped — `newCampaignPublicId`'s output. */
const MINTED_UNDASHED = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/;

/** A table that declares a `publicId`, and the width it declares for it. */
export type PublicIdStore = {
  /** The schema module's export name, for a reader looking for the source. */
  symbol: string;
  /** The SQL table name — what a query and an error message both need. */
  table: string;
  /** The declared `varchar` width. 36 or 32; anything else is refused. */
  width: number;
};

/** The widths this module has a mint and a parser for. */
export const JUDGED_WIDTHS = [36, 32] as const;

export class UnjudgedWidthError extends Error {
  constructor(stores: PublicIdStore[]) {
    super(
      `REFUSED — ${stores.length} table(s) declare a ${PUBLIC_ID_COLUMN} of a width this reader has no `
        + `mint for: ${stores.map((store) => `${store.table} (${store.width})`).join(", ")}. `
        + `Judged widths are ${JUDGED_WIDTHS.join(" and ")}. A width with no judge is refused rather than `
        + "skipped — a skipped table reads exactly like a clean one.",
    );
    this.name = "UnjudgedWidthError";
  }
}

/**
 * Every table in the schema declaring a `publicId`, derived from the drizzle
 * DECLARATION rather than from the text of `schema.ts`.
 *
 * `getTableColumns` is the schema's own answer to "what columns does this table
 * have", so there is no regex here to fall out of step with the file — the
 * shape-match-where-a-declaration-exists mistake this repository paid for four
 * times in one sitting (CLAUDE.md, the Atlas's four collectors).
 */
export function publicIdStores(): PublicIdStore[] {
  const found: PublicIdStore[] = [];
  for (const [symbol, value] of Object.entries(schema)) {
    let table: string | undefined;
    try {
      table = getTableName(value as Table);
    } catch {
      continue;
    }
    /* `getTableName` answers `undefined` for a non-table rather than throwing,
       which is how a condition object once overwrote a captured table name in
       another suite's double. The answer has to be checked, not merely caught. */
    if (typeof table !== "string" || table.length === 0) continue;
    const columns = getTableColumns(value as Table) as Record<string, { length?: number } | undefined>;
    const column = columns[PUBLIC_ID_COLUMN];
    if (!column) continue;
    found.push({ symbol, table, width: typeof column.length === "number" ? column.length : -1 });
  }
  return found.sort((left, right) => left.table.localeCompare(right.table));
}

/** `publicIdStores()`, with a width it cannot judge refused rather than dropped. */
export function judgedPublicIdStores(): PublicIdStore[] {
  const stores = publicIdStores();
  if (stores.length === 0) {
    throw new Error(
      `REFUSED — no table in the schema declares a ${PUBLIC_ID_COLUMN}. Either the schema moved or this `
        + "reader is reading nothing, and an empty population reads exactly like a clean one.",
    );
  }
  const unjudged = stores.filter((store) => !(JUDGED_WIDTHS as readonly number[]).includes(store.width));
  if (unjudged.length > 0) throw new UnjudgedWidthError(unjudged);
  return stores;
}

/** What the two judges say about one stored value. */
export type IdVerdict = {
  /** The route's own parser refuses it: the row can never be loaded again. */
  unreachable: boolean;
  /** Reachable, but not what the product's mint emits for this width. */
  unminted: boolean;
};

/**
 * Judge one stored id against the width its column declares.
 *
 * Both axes are reported for every value; the caller decides which is a fault.
 * `unreachable` can only ever be true at width 36, because the campaign route's
 * parser accepts anything non-empty up to 32 characters — see the header.
 */
export function judgeId(value: string, width: number): IdVerdict {
  if (width === 36) {
    return {
      unreachable: !ROUTE_UUID_PARSER.safeParse(value).success,
      unminted: !MINTED_DASHED.test(value),
    };
  }
  if (width === 32) {
    /* The campaign parser is `z.string().min(1).max(32)`; a value read out of
       this column is already inside the width, so emptiness is its only road
       to a refusal. */
    return { unreachable: value.length === 0, unminted: !MINTED_UNDASHED.test(value) };
  }
  throw new UnjudgedWidthError([{ symbol: "(caller)", table: "(caller)", width }]);
}
