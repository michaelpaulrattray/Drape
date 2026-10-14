/**
 * THE PUBLIC-ID SHAPE READER'S OWN CONTROLS (#2496).
 *
 * `scripts/janitor-publicid-shapes.mts` reads rows in a database, and no suite
 * here can: `vitest.setup.ts` strips `DATABASE_URL` precisely so a unit test
 * can never reach one. So the split is deliberate and is the whole design —
 * **the rows are a shift's hands on the Janitor's clock, and the JUDGE and the
 * POPULATION are proved here**, which is the half that can be automated.
 *
 * Working law 2 is why this file exists at all: *a green suite proves nothing if
 * the checker cannot fail.* On the day it was written the reader came back clean
 * over all 333 rows in the dev database — the same figure #1098's close
 * measured — and a clean reading from an unproven instrument is worth nothing.
 * Every arm below therefore carries the value that actually appeared in
 * production-shaped litter, `1086-inflight-e3ad6977`, as its positive control,
 * so the instrument is held against the real specimen rather than an invented
 * one.
 *
 * ⚠ **The three arms that matter most are the POPULATION arms.** A judge that
 * works perfectly over a population that has quietly lost a table reports a
 * clean database either way, which is the silence direction and the one no
 * green run can tell you about.
 */
import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  IMAGE_ROUTE_PATTERN_TEXT,
  JUDGED_WIDTHS,
  judgeId,
  judgedPublicIdStores,
  PATTERN_ROUTES_WITHOUT_A_PUBLIC_ID,
  PUBLIC_ID_COLUMN,
  publicIdStores,
  routeParserFor,
  TABLE_ROUTE_PARSERS,
  UnjudgedWidthError,
  type PublicIdStore,
} from "../scripts/lib/publicIdShapes.mts";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";

/* This suite reads files off the real tree (`readListedSource`), which enrols it
   in #741's derived population: vitest's 5 s default goes red under load on
   somebody's machine rather than in CI. File level, so every arm inherits it. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** The value that was actually found in `casting_sessions.publicId` (#1098). */
const THE_LITTER = "1086-inflight-e3ad6977";

/**
 * The four real tables the arms below name, as the judge takes them.
 *
 * `casting_sessions` is the shared door at 36 (the litter's own table),
 * `cast_campaigns` the looser door at 32, and the two delivery tables are the
 * STRICTER image-route doors — the gap the relay's finding on PR #2516 named.
 *
 * These are plain literals rather than lookups, so this file cannot fail at
 * LOAD time (a suite that fails to load still prints "Tests N passed"). The arm
 * `the tables these arms name are all in the real population` holds every one of
 * them against the derived population instead, so a rename in the schema reddens
 * a named arm rather than leaving these judging a table the product has not got.
 */
const SHARED_DOOR = { symbol: "castingSessions", table: "casting_sessions", width: 36 };
const CAMPAIGN_DOOR = { symbol: "castCampaigns", table: "cast_campaigns", width: 32 };
const INK_DESIGN_DOOR = { symbol: "castingInkDesigns", table: "casting_ink_designs", width: 36 };
const REFERENCE_DOOR = {
  symbol: "castingReferenceAttachments",
  table: "casting_reference_attachments",
  width: 36,
} satisfies PublicIdStore;

/** Every table whose own route is STRICTER than the shared parser. */
const STRICT_DOORS: PublicIdStore[] = [INK_DESIGN_DOOR, REFERENCE_DOOR];
const NAMED_DOORS: PublicIdStore[] = [SHARED_DOOR, CAMPAIGN_DOOR, ...STRICT_DOORS];

describe("the public-id shape judge", () => {
  it("NEGATIVE CONTROL — what the product's own mints emit passes both axes, at every door", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const dashed = randomUUID();
      for (const store of [SHARED_DOOR, ...STRICT_DOORS]) {
        expect(judgeId(dashed, store), `a minted uuid read as a fault in ${store.table}: ${dashed}`)
          .toEqual({ unreachable: false, unminted: false });
      }
      const undashed = dashed.replace(/-/g, "");
      expect(judgeId(undashed, CAMPAIGN_DOOR), `a minted campaign id read as a fault: ${undashed}`)
        .toEqual({ unreachable: false, unminted: false });
    }
  });

  it("POSITIVE CONTROL — the real litter value is unreachable at 36 and unminted at 32", () => {
    expect(
      judgeId(THE_LITTER, SHARED_DOOR),
      "the specimen this reader exists for is not caught — a clean run means nothing",
    ).toEqual({ unreachable: true, unminted: true });
    /* In a 32-wide column the same string is REACHABLE, because the campaign
       route parses an id as `z.string().min(1).max(32)`. That is the reader's
       one blind spot and it is pinned here rather than described. */
    expect(judgeId(THE_LITTER, CAMPAIGN_DOOR)).toEqual({ unreachable: false, unminted: true });
  });

  /**
   * ⚠ Each of these PASSES `z.string().uuid()` in zod 4 — driven, not assumed —
   * and none can come out of `crypto.randomUUID()`. They are the reason the two
   * axes are separate: calling any of them a fault **at the shared door** would
   * redden the reading over a row the product serves correctly.
   */
  it("separates reachable-but-odd from unreachable, on the three shapes zod accepts", () => {
    const uppercase = randomUUID().toUpperCase();
    expect(judgeId(uppercase, SHARED_DOOR), "an uppercase uuid is reachable").toMatchObject({
      unreachable: false,
      unminted: true,
    });
    expect(judgeId("00000000-0000-0000-0000-000000000000", SHARED_DOOR), "the nil uuid is reachable")
      .toMatchObject({ unreachable: false, unminted: true });
    expect(judgeId("f81d4fae-7dec-11d0-a765-00a0c91e6bf6", SHARED_DOOR), "a v1 uuid is reachable")
      .toMatchObject({ unreachable: false, unminted: true });
  });

  /**
   * ⚠ **THE RELAY'S FINDING ON PR #2516, AS AN ARM.** The two delivery routes test
   * their path segment against the LOWERCASE canonical pattern before a row is
   * ever read, so at those two tables the three shapes above do NOT all read the
   * same way: an uppercase id and the nil uuid are rows whose picture answers
   * **404** for good, and judging them by the shared parser reported them as
   * fine — the exact silence this reader exists to end.
   *
   * The v1 arm is the one that keeps the fix honest: the pattern accepts
   * `[1-8]` in the version nibble, so a lowercase v1 id is still REACHABLE and
   * merely unminted. A blanket "treat odd as broken" would have passed the two
   * arms above it and been wrong here.
   */
  it("⚠ a stricter image route makes an uppercase or nil id UNREACHABLE, not merely odd", () => {
    const uppercase = randomUUID().toUpperCase();
    for (const store of STRICT_DOORS) {
      expect(
        judgeId(uppercase, store),
        `${store.table} goes through its own route's lowercase pattern, so an uppercase id is a row`
          + " whose picture 404s — it must not read as reachable",
      ).toEqual({ unreachable: true, unminted: true });
      expect(
        judgeId("00000000-0000-0000-0000-000000000000", store),
        `the nil uuid fails ${store.table}'s own route pattern on its version nibble`,
      ).toEqual({ unreachable: true, unminted: true });
      expect(
        judgeId("f81d4fae-7dec-11d0-a765-00a0c91e6bf6", store),
        `a lowercase v1 uuid PASSES ${store.table}'s route pattern ([1-8]) and must stay reachable`,
      ).toEqual({ unreachable: false, unminted: true });
    }
  });

  it("catches the shapes a hand types, at the door that judges them", () => {
    /* The dashed mint in the undashed column and vice versa: both are what a
       script copying the wrong helper would write. */
    expect(judgeId(randomUUID(), CAMPAIGN_DOOR).unminted, "a dashed uuid does not fit a 32-wide column")
      .toBe(true);
    expect(judgeId(randomUUID().replace(/-/g, ""), SHARED_DOOR).unreachable, "an undashed uuid at 36")
      .toBe(true);
    expect(judgeId("", SHARED_DOOR), "an empty id").toEqual({ unreachable: true, unminted: true });
    expect(judgeId("", CAMPAIGN_DOOR), "an empty campaign id is its only road to a refusal")
      .toEqual({ unreachable: true, unminted: true });
    expect(judgeId("session-1", SHARED_DOOR).unreachable).toBe(true);
  });

  it("REFUSES a width it has no mint for, rather than passing the value", () => {
    const unjudged: PublicIdStore = { symbol: "(invented)", table: "(invented)", width: 40 };
    expect(() => judgeId(randomUUID(), unjudged)).toThrow(UnjudgedWidthError);
    expect(() => judgeId(randomUUID(), unjudged)).toThrow(/no\s+mint\s+for/);
    /* And the door chooser refuses it too, rather than handing an unjudged
       width the shared rule on the way past. */
    expect(() => routeParserFor(unjudged)).toThrow(UnjudgedWidthError);
  });
});

describe("the population it judges", () => {
  it("derives every table declaring a publicId, with both controls", () => {
    const stores = publicIdStores();
    const names = stores.map((store) => store.table);
    expect(names.length, "the schema reader found too few tables to be reading the schema")
      .toBeGreaterThan(10);
    /* POSITIVE: the table #1098's three rows were actually in, and the one
       table whose id is minted the other way. */
    expect(names, "the table the litter was found in is not in the population")
      .toContain("casting_sessions");
    expect(names, "the 32-wide store is not in the population").toContain("cast_campaigns");
    /* NEGATIVE: a table with no publicId must not be swept, or every row of it
       reads as a fault. `users` is the largest such table in the schema. */
    expect(names, "a table with no publicId is being judged").not.toContain("users");
    expect(new Set(names).size, "a table is in the population twice").toBe(names.length);
  });

  it("the tables these arms name are all in the real population, at the width they claim", () => {
    const stores = publicIdStores();
    for (const named of NAMED_DOORS) {
      const real = stores.find((store) => store.table === named.table);
      expect(
        real,
        `${named.table} is not in the derived population — every arm naming it is judging a table`
          + " the product has not got",
      ).toBeDefined();
      expect(real?.width, `${named.table} no longer declares a ${named.width}-wide publicId`)
        .toBe(named.width);
    }
  });

  it("⚠ every derived width is one the judge has a mint for", () => {
    const widths = [...new Set(judgedPublicIdStores().map((store) => store.width))].sort();
    expect(
      widths,
      "a publicId column declares a width this reader cannot judge — the run would skip that table,"
        + " and a skipped table reads exactly like a clean one",
    ).toEqual([...JUDGED_WIDTHS].sort());
  });

  it("⚠ the judged widths are backed by the two mints the product actually has", () => {
    const campaigns = read("server/db/castCampaigns.ts");
    expect(
      campaigns,
      "the 32-wide mint is no longer `randomUUID().replace(/-/g, \"\")`, so the undashed judge is"
        + " measuring something the product does not emit",
    ).toContain('randomUUID().replace(/-/g, "")');
  });

  /**
   * ⚠ **THE ANTI-MIRROR ARM, AND ITS POPULATION IS DERIVED.** The judge holds a
   * COPY of each door's parser, because none of them is exported and exporting a
   * validator out of a router to serve a reading tool would widen a product
   * module for a tool's convenience. A copy drifts (working law 4), so this arm
   * holds every copy equal to the text in the file it was copied FROM: the day a
   * door loosens or tightens, this goes red instead of the reader quietly
   * measuring a rule the product no longer applies.
   *
   * The doors come from `routeParserFor` over the real population rather than
   * from a list in here, so a fourth door added to `TABLE_ROUTE_PARSERS` is
   * pinned by this arm with no edit — which is the one thing a hand-kept list
   * of filenames could never promise.
   */
  it("⚠ every door's parser still says in its own file what the judge copied", () => {
    const doors = judgedPublicIdStores().map((store) => routeParserFor(store));
    const unique = new Map(doors.map((door) => [`${door.source}::${door.declaration}`, door]));
    /* The floor: the shared door, the campaign door and the two image routes.
       Fewer than three distinct declarations means this arm has stopped reading
       the thing the repair was about. */
    expect(
      unique.size,
      "fewer distinct door declarations than the product has — this arm has stopped covering the"
        + " stricter routes",
    ).toBeGreaterThanOrEqual(3);
    for (const door of unique.values()) {
      expect(
        read(door.source),
        `${door.source} no longer declares ${JSON.stringify(door.declaration)} — the judge's copy`
          + " of it is now measuring the wrong rule",
      ).toContain(door.declaration);
    }
  });

  /**
   * ⚠ **THE CLASS ARM, AND IT IS WHY THE REPAIR IS NOT JUST TWO TABLES WIDE.**
   * The map above can only be wrong in one direction: a table ABSENT from it is
   * judged by the shared parser, which is exactly how `casting_ink_designs` and
   * `casting_reference_attachments` came to read as reachable while their
   * pictures 404d. So that direction is guarded rather than promised — this arm
   * sweeps `server/routes/` for the image-route pattern and holds the set of
   * files declaring it equal to the map's own sources plus an ENUMERATED
   * exemption list, each exemption carrying its reason.
   *
   * A fifth route adopting the pattern reddens here, so it either joins the map
   * or joins the exemption with the reason it parses no `publicId`.
   *
   * ⚠ **It is a floor and not coverage, and the limit is stated rather than
   * implied: a route strict in some OTHER shape** — a different regex, a zod
   * refinement, a length bound — **is invisible to this sweep.** Deriving every
   * column a route parses more strictly than the schema declares is the card's
   * option 3, and the card declines it.
   */
  it("⚠ every route declaring the image-route pattern is either mapped or exempt", () => {
    const declaring = routeFilesContaining(IMAGE_ROUTE_PATTERN_TEXT);
    /* POSITIVE CONTROL: the sweep found the two files the finding named. An
       equality against an empty set would be satisfied by reading nothing. */
    expect(declaring, "the sweep did not find inkDesignDelivery.ts — it is reading nothing")
      .toContain("inkDesignDelivery.ts");
    expect(declaring, "the sweep did not find referenceDelivery.ts — it is reading nothing")
      .toContain("referenceDelivery.ts");
    const mapped = Object.values(TABLE_ROUTE_PARSERS)
      .filter((parser) => parser.declaration.includes(IMAGE_ROUTE_PATTERN_TEXT))
      .map((parser) => path.basename(parser.source));
    const accounted = [
      ...new Set([...mapped, ...Object.keys(PATTERN_ROUTES_WITHOUT_A_PUBLIC_ID)]),
    ].sort();
    expect(
      declaring,
      "a route under server/routes/ parses an id with the lowercase canonical pattern and is neither"
        + " mapped to its table in TABLE_ROUTE_PARSERS nor listed in"
        + " PATTERN_ROUTES_WITHOUT_A_PUBLIC_ID with its reason. If it parses a publicId, map it —"
        + " otherwise its rows read as reachable here while that route 404s them.",
    ).toEqual(accounted);
    /* An exemption with no reason is the shape that turns this list into a place
       to make an inconvenient red go away. */
    for (const [file, reason] of Object.entries(PATTERN_ROUTES_WITHOUT_A_PUBLIC_ID)) {
      expect(reason.length, `${file} is exempt with no reason recorded`).toBeGreaterThan(40);
    }
  });

  it("names the column it reads, so a rename cannot leave it reading nothing", () => {
    expect(PUBLIC_ID_COLUMN).toBe("publicId");
    expect(
      read("drizzle/schema.ts"),
      `no column called ${PUBLIC_ID_COLUMN} is declared in the schema`,
    ).toContain(`${PUBLIC_ID_COLUMN}: varchar("${PUBLIC_ID_COLUMN}"`);
  });
});

/**
 * Every file under `server/routes/` whose source contains `needle`, by basename,
 * excluding tests — a test naming a pattern is prose about it, not a door.
 *
 * Walks with `{ throwIfNoEntry: false }` and reads through `readListedSource`,
 * because this working tree is shared and a listed path can be gone by the time
 * it is read (#223).
 */
function routeFilesContaining(needle: string): string[] {
  const root = path.resolve(repositoryRoot(), "server/routes");
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const full = path.join(directory, entry);
      const stats = statSync(full, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.includes(".test.")) continue;
      const source = readListedSource(full);
      if (source !== null && source.includes(needle)) found.push(entry);
    }
  };
  walk(root);
  expect(
    found.length,
    `nothing under server/routes/ contains ${needle} — the sweep read nothing`,
  ).toBeGreaterThan(0);
  return [...new Set(found)].sort();
}

/** A repository file's text, refusing rather than reading an empty string. */
function read(relative: string): string {
  const absolute = path.resolve(repositoryRoot(), relative);
  const source = readListedSource(absolute);
  expect(source, `${relative} could not be read — this arm would be reading nothing`).not.toBeNull();
  return source ?? "";
}

/** This repository's root, from this file's own location. */
function repositoryRoot(): string {
  return new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}
