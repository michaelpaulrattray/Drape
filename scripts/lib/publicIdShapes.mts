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
 * # ⚠ THE MINT IS CHOSEN BY THE COLUMN'S DECLARED WIDTH, WHICH IS A
 * # DECLARATION AND NOT AN INFERENCE
 *
 * (The REACHABILITY judge is chosen by the TABLE, not by the width — see the
 * section two below. The width decides the `unminted` axis alone.)
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
 * # ⚠ AND THE CARD'S OWN PREMISE IS TRUE OF TEN TABLES, NOT THIRTEEN
 *
 * #2496 says *"the route parses it with `z.string().uuid()`"*. Read at the code,
 * that is true of ten of the thirteen, and the other three each have their own
 * parser — which is why the judge is keyed on the TABLE and not on the width
 * alone. **THIS IS THE REPAIR THE RELAY'S FINDING ON PR #2516 ASKED FOR, and the
 * two it names were reading as reachable while their picture 404s:**
 *
 *  - `cast_campaigns` — `server/routes/castingV2.ts` parses a campaign id as
 *    `z.string().min(1).max(32)`, which would accept `1086-inflight-e3ad6977`
 *    without complaint. **So no value in that table can ever BE unreachable**,
 *    and this class shows there only on the `unminted` axis, which is not a
 *    fault. LOOSER than the shared parser.
 *  - `casting_ink_designs` — `server/routes/inkDesignDelivery.ts` parses its
 *    `:designId` with the LOWERCASE canonical pattern before the row is ever
 *    read. STRICTER than the shared parser.
 *  - `casting_reference_attachments` — `server/routes/referenceDelivery.ts`
 *    does the same for `:referenceId`. STRICTER.
 *
 * ⚠ **The two strict ones are the silence this reader exists to end, so the
 * difference is not academic — driven, not reasoned about.** An UPPERCASE uuid
 * and the nil uuid both PASS `z.string().uuid()` and both FAIL that pattern. So
 * before this repair a design or an attachment carrying either shape read
 * `unminted` (printed, not a fault) while `GET /api/ink-design/<id>` answered
 * **404** — a row whose picture the product can never serve again, reported as
 * fine. A lowercase v1 uuid passes both, which is why the fix is the pattern
 * rather than a blanket "treat odd as broken".
 *
 * # ⚠ A ROW IS REACHABLE ONLY IF EVERY DOOR IT NEEDS ACCEPTS IT
 *
 * A design's publicId travels two roads: the `castingV2.*` procedure that lists
 * it (`z.string().uuid()`) and the image route that draws it (the pattern). The
 * STRICTER of the two is what decides the verdict, because a design whose
 * picture 404s is not a usable row however well it lists. Where a table's own
 * route is LOOSER, that looser rule governs — the question is always what the
 * product actually applies to that table, never what the shared door applies.
 *
 * The report prints which rule it used for every table that is not on the shared
 * parser, every run, rather than leaving it in this docblock.
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
 * One door's parser for a public id, as the product's own source declares it.
 *
 * ⚠ **Every `accepts` below is a COPY of a declaration one file away, so the
 * suite holds each one equal to its source rather than trusting them to stay
 * so** (working law 4: a second list shadowing a source of truth always drifts
 * from it). None of these validators is exported — `castingV2.ts`'s
 * `const publicId` and the two routes' patterns are all module-private — and
 * exporting a validator out of a router to serve a reading tool would widen a
 * product module for a tool's convenience. So the copies stay, and `source` +
 * `declaration` are carried HERE so the anti-mirror arm can read each file for
 * the text it was copied from instead of holding its own second list of
 * filenames.
 */
export type RoutePublicIdParser = {
  /** How the report names the rule it applied, in the product's own spelling. */
  spelling: string;
  /** The repository-relative file this was copied from. */
  source: string;
  /** The exact text the anti-mirror arm must still find in that file. */
  declaration: string;
  /** Does that door accept this stored value? */
  accepts(value: string): boolean;
};

/**
 * The shared parser: `server/routes/castingV2.ts`'s `const publicId`, which
 * every 36-wide id reaches unless its own table says otherwise below.
 */
const SHARED_UUID_SCHEMA = z.string().uuid();
const SHARED_UUID_PARSER: RoutePublicIdParser = {
  spelling: "z.string().uuid()",
  source: "server/routes/castingV2.ts",
  declaration: "const publicId = z.string().uuid();",
  accepts: (value) => SHARED_UUID_SCHEMA.safeParse(value).success,
};

/**
 * The campaign door, which is LOOSER than the shared one and is the reader's
 * stated blind spot: it refuses nothing a 32-wide column can hold except
 * emptiness.
 */
const CAMPAIGN_ID_PARSER: RoutePublicIdParser = {
  spelling: "z.string().min(1).max(32)",
  source: "server/routes/castingV2.ts",
  declaration: "const campaignIdInput = z.string().min(1).max(32);",
  accepts: (value) => value.length > 0,
};

/**
 * `randomUUID`'s own shape, LOWERCASE and canonical — what the two image routes
 * test a path segment against before they read a row at all.
 *
 * The pattern text is held once and spliced into both `declaration`s, because
 * two literal copies of one regex inside this module is the very drift the
 * anti-mirror arm exists to catch.
 */
export const IMAGE_ROUTE_PATTERN_TEXT =
  "/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/";
const IMAGE_ROUTE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The tables whose own route does NOT use the shared parser, keyed by SQL table
 * name — the whole content of the relay's finding on PR #2516.
 *
 * ⚠ **A table absent from here is judged by the shared parser, which is the
 * direction this map can be wrong in**, so the class is guarded rather than
 * promised: `server/janitorPublicIdShapes.test.ts` sweeps `server/routes/` for
 * the pattern text above and holds the set of files declaring it equal to this
 * map's sources plus an enumerated exemption list. A fourth route adopting it
 * reddens the suite, so it either joins this map or joins the exemption with its
 * reason. **The honest remainder: a route strict in some OTHER shape — a
 * different regex, a zod refinement — is invisible to that sweep, so the arm is
 * a floor and not coverage.**
 */
export const TABLE_ROUTE_PARSERS: Readonly<Record<string, RoutePublicIdParser>> = {
  cast_campaigns: CAMPAIGN_ID_PARSER,
  casting_ink_designs: {
    spelling: `DESIGN_ID_PATTERN ${IMAGE_ROUTE_PATTERN_TEXT}`,
    source: "server/routes/inkDesignDelivery.ts",
    declaration: `const DESIGN_ID_PATTERN =
  ${IMAGE_ROUTE_PATTERN_TEXT};`,
    accepts: (value) => IMAGE_ROUTE_PATTERN.test(value),
  },
  casting_reference_attachments: {
    spelling: `REFERENCE_ID_PATTERN ${IMAGE_ROUTE_PATTERN_TEXT}`,
    source: "server/routes/referenceDelivery.ts",
    declaration: `const REFERENCE_ID_PATTERN =
  ${IMAGE_ROUTE_PATTERN_TEXT};`,
    accepts: (value) => IMAGE_ROUTE_PATTERN.test(value),
  },
};

/**
 * Files under `server/routes/` that declare the image-route pattern and parse
 * something that is NOT a `publicId` in this reader's population — each with
 * the reason, read at the code rather than assumed.
 *
 * This exists so the class sweep above can be an equality rather than a
 * floor-with-an-allowance: a file here is accounted for, a file in neither list
 * reddens.
 */
export const PATTERN_ROUTES_WITHOUT_A_PUBLIC_ID: Readonly<Record<string, string>> = {
  "evidenceDelivery.ts":
    "parses an evidence entity's `id` — castingEvidenceCandidates, modelEvidenceCrops and "
    + "modelReferencePlates, resolved in server/db/evidenceDelivery.ts — and not one of those three "
    + "tables declares a publicId, so no row in this reader's population travels that road.",
};

/**
 * What `crypto.randomUUID()` emits and nothing else: lowercase, canonical,
 * version 4, variant `[89ab]`.
 *
 * Deliberately narrower than the SHARED parser. The nil uuid, a v1 uuid and an
 * uppercase uuid all PASS `z.string().uuid()` and none of them can come out of
 * the product's mint — which is the whole value of the second axis. (It is
 * narrower than the two image-route patterns too, on the version nibble: those
 * accept `[1-8]`, a mint emits `4`.)
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
 * Which door's parser decides whether a row in this table can still be loaded.
 *
 * The table's own entry wins, and only a table with NO entry falls back to the
 * shared parser — so a width this module has no mint for is refused here too,
 * rather than being handed the shared rule on the way past.
 */
export function routeParserFor(store: PublicIdStore): RoutePublicIdParser {
  const own = TABLE_ROUTE_PARSERS[store.table];
  if (own) return own;
  if ((JUDGED_WIDTHS as readonly number[]).includes(store.width)) return SHARED_UUID_PARSER;
  throw new UnjudgedWidthError([store]);
}

/**
 * Judge one stored id against the door its own table goes through.
 *
 * Both axes are reported for every value and the caller decides which is a
 * fault. **The `unreachable` axis asks the TABLE's parser, never the width's**:
 * that was the relay's finding on PR #2516 — keyed on width alone, an uppercase
 * id in `casting_ink_designs` read as reachable while its image route answered
 * 404. The `unminted` axis is still keyed on the width, because that is what the
 * two MINTS are keyed on.
 */
export function judgeId(value: string, store: PublicIdStore): IdVerdict {
  const parser = routeParserFor(store);
  if (store.width === 36) {
    return { unreachable: !parser.accepts(value), unminted: !MINTED_DASHED.test(value) };
  }
  if (store.width === 32) {
    return { unreachable: !parser.accepts(value), unminted: !MINTED_UNDASHED.test(value) };
  }
  /* Unreachable in practice — `routeParserFor` has already refused an unjudged
     width — and kept so that adding a width to `JUDGED_WIDTHS` without giving it
     a mint cannot fall through to a silent verdict. */
  throw new UnjudgedWidthError([store]);
}
