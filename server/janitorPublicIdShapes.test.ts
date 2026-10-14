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
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  JUDGED_WIDTHS,
  judgeId,
  judgedPublicIdStores,
  PUBLIC_ID_COLUMN,
  publicIdStores,
  UnjudgedWidthError,
} from "../scripts/lib/publicIdShapes.mts";
import { readListedSource } from "./testing/listedSource";

/** The value that was actually found in `casting_sessions.publicId` (#1098). */
const THE_LITTER = "1086-inflight-e3ad6977";

describe("the public-id shape judge", () => {
  it("NEGATIVE CONTROL — what the product's own mints emit passes both axes", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const dashed = randomUUID();
      expect(judgeId(dashed, 36), `a minted uuid read as a fault: ${dashed}`)
        .toEqual({ unreachable: false, unminted: false });
      const undashed = dashed.replace(/-/g, "");
      expect(judgeId(undashed, 32), `a minted campaign id read as a fault: ${undashed}`)
        .toEqual({ unreachable: false, unminted: false });
    }
  });

  it("POSITIVE CONTROL — the real litter value is unreachable at 36 and unminted at 32", () => {
    expect(
      judgeId(THE_LITTER, 36),
      "the specimen this reader exists for is not caught — a clean run means nothing",
    ).toEqual({ unreachable: true, unminted: true });
    /* In a 32-wide column the same string is REACHABLE, because the campaign
       route parses an id as `z.string().min(1).max(32)`. That is the reader's
       one blind spot and it is pinned here rather than described. */
    expect(judgeId(THE_LITTER, 32)).toEqual({ unreachable: false, unminted: true });
  });

  /**
   * ⚠ Each of these PASSES `z.string().uuid()` in zod 4 — driven, not assumed —
   * and none can come out of `crypto.randomUUID()`. They are the reason the two
   * axes are separate: calling any of them a fault would redden the reading over
   * a row the product serves correctly.
   */
  it("separates reachable-but-odd from unreachable, on the three shapes zod accepts", () => {
    const uppercase = randomUUID().toUpperCase();
    expect(judgeId(uppercase, 36), "an uppercase uuid is reachable").toMatchObject({
      unreachable: false,
      unminted: true,
    });
    expect(judgeId("00000000-0000-0000-0000-000000000000", 36), "the nil uuid is reachable")
      .toMatchObject({ unreachable: false, unminted: true });
    expect(judgeId("f81d4fae-7dec-11d0-a765-00a0c91e6bf6", 36), "a v1 uuid is reachable")
      .toMatchObject({ unreachable: false, unminted: true });
  });

  it("catches the shapes a hand types, at the width that judges them", () => {
    /* The dashed mint in the undashed column and vice versa: both are what a
       script copying the wrong helper would write. */
    expect(judgeId(randomUUID(), 32).unminted, "a dashed uuid does not fit a 32-wide column").toBe(true);
    expect(judgeId(randomUUID().replace(/-/g, ""), 36).unreachable, "an undashed uuid at 36").toBe(true);
    expect(judgeId("", 36), "an empty id").toEqual({ unreachable: true, unminted: true });
    expect(judgeId("", 32), "an empty campaign id is its only road to a refusal")
      .toEqual({ unreachable: true, unminted: true });
    expect(judgeId("session-1", 36).unreachable).toBe(true);
  });

  it("REFUSES a width it has no mint for, rather than passing the value", () => {
    expect(() => judgeId(randomUUID(), 40)).toThrow(UnjudgedWidthError);
    expect(() => judgeId(randomUUID(), 40)).toThrow(/no\s+mint\s+for/);
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
   * ⚠ **THE ANTI-MIRROR ARM.** The judge holds a COPY of the route's parser
   * (`z.string().uuid()`), because the route's `const publicId` is not exported
   * and exporting a validator out of a router to serve a reading tool would
   * widen a product module for a tool's convenience. A copy drifts (working law
   * 4), so this arm holds the two equal at the route's own source: the day the
   * route loosens or tightens that parser, this goes red instead of the reader
   * quietly measuring a rule the product no longer applies.
   */
  it("⚠ the route still parses a 36-wide public id with z.string().uuid()", () => {
    const route = read("server/routes/castingV2.ts");
    expect(
      route,
      "the route's publicId parser has moved — the judge's copy of it is now measuring the wrong rule",
    ).toContain("const publicId = z.string().uuid();");
    expect(
      route,
      "the campaign id parser has moved — the reader's stated blind spot may no longer be the truth",
    ).toContain("const campaignIdInput = z.string().min(1).max(32);");
  });

  it("names the column it reads, so a rename cannot leave it reading nothing", () => {
    expect(PUBLIC_ID_COLUMN).toBe("publicId");
    expect(
      read("drizzle/schema.ts"),
      `no column called ${PUBLIC_ID_COLUMN} is declared in the schema`,
    ).toContain(`${PUBLIC_ID_COLUMN}: varchar("${PUBLIC_ID_COLUMN}"`);
  });
});

/** A repository file's text, refusing rather than reading an empty string. */
function read(relative: string): string {
  const absolute = path
    .resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), relative);
  const source = readListedSource(absolute);
  expect(source, `${relative} could not be read — this arm would be reading nothing`).not.toBeNull();
  return source ?? "";
}
