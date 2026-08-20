/**
 * IS THIS THE UNIQUE INDEX SAYING NO — both error shapes, driven directly.
 *
 * # Why this file exists, and it is an incident rather than diligence
 *
 * `isDuplicateKey` shipped reading `error.code` off the TOP-LEVEL error. That
 * is the shape a hand-written test error has and NOT the shape the real path
 * produces: Drizzle wraps the driver's error in a `DrizzleQueryError` and hangs
 * the original off `cause`. So the duplicate escaped as a throw and the mint
 * reported `failed` over a perfectly working index — found by driving a second
 * delivery of one design (variant `486` after `492`) and reading the answer.
 *
 * `candidateRetention.isMissingTable` made exactly this mistake, fixed it, and
 * WROTE IT DOWN in its own docblock. It repeated here because the guard had no
 * arm at all, and the lesson that generalises is the one that file already
 * carries: **a test that invents the error it expects is testing its own
 * invention.** Both shapes below, and the wrapped one is the real one.
 */
import { describe, expect, it } from "vitest";

import { isDuplicateKey, recordInkDeliveryCrop } from "./castingV2InkDeliveryCrops";

/** What mysql2 actually throws, as the driver builds it. */
const driverError = () => Object.assign(new Error("Duplicate entry '1-703-ink:neck' for key 'uq_casting_ink_delivery_crops_delivery'"), {
  code: "ER_DUP_ENTRY",
  errno: 1062,
  sqlState: "23000",
});

describe("the duplicate reader sees the index through drizzle's wrapper", () => {
  it("sees the driver's own error", () => {
    expect(isDuplicateKey(driverError())).toBe(true);
  });

  it("⚠ sees it WRAPPED — the shape the real path produces", () => {
    /* The arm that was missing. Without the chain walk this is `false`, the
       mint answers `failed`, and MINTED ONCE looks broken while it works. */
    const wrapped = Object.assign(new Error("Failed query: insert into `casting_ink_delivery_crops`"), {
      name: "DrizzleQueryError",
      cause: driverError(),
    });
    expect(isDuplicateKey(wrapped)).toBe(true);
  });

  it("sees it through a second layer, and stops before it walks forever", () => {
    const twice = { cause: { cause: driverError() } };
    expect(isDuplicateKey(twice)).toBe(true);
    /* A cycle is a database driver nobody has met yet, and an infinite loop
       inside a catch block is a hung request rather than a failed one. */
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isDuplicateKey(loop)).toBe(false);
  });

  it("NEGATIVE CONTROL: everything else is somebody else's problem", () => {
    /*
      The half that makes the positive mean something. A reader that answered
      `true` to a lost connection would report a crop that does not exist, and
      the carry would silently ride the artwork with nothing in the log.
    */
    expect(isDuplicateKey(new Error("connection lost"))).toBe(false);
    expect(isDuplicateKey(Object.assign(new Error("no such table"), {
      code: "ER_NO_SUCH_TABLE", errno: 1146,
    }))).toBe(false);
    expect(isDuplicateKey(Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK", errno: 1213 }),
    }))).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
    expect(isDuplicateKey("ER_DUP_ENTRY")).toBe(false);
  });
});

/**
 * THE NAME THE CHAIN GAVE THIS CROP, checked before anything is written
 * (migration 0050, ruled fable-1199 §1).
 *
 * The writer no longer mints its own `publicId`: the chain wrote one at claim
 * time, a hundred lines and one render earlier, and this row must be findable
 * under it. A row filed under any other name is a crop nothing points at — the
 * carry would find nothing while every log line said `minted`, which is the
 * silent shape this whole build exists to end.
 *
 * Driven without a database on purpose: the guard runs before the transaction
 * opens, so these arms exercise the real function rather than a double of it.
 */
describe("the writer honours the name the chain already wrote", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    userId: 1,
    candidatePublicId: "cast-1",
    publicId: "b9c1f4de-77a0-4a52-8f31-2d6e0c5ab914",
    variantPublicId: "variant-9",
    slot: "ink:neck",
    region: "tattooed skin",
    storageKey: "casting-v2/ink-delivery/crop.png",
    digest: "a".repeat(64),
    mime: "image/png",
    byteSize: 64,
    width: 10,
    height: 10,
    bboxX: 0,
    bboxY: 0,
    bboxW: 10,
    bboxH: 10,
    frameWidth: 100,
    frameHeight: 100,
    maskPixels: 50,
    keptPixels: 50,
    ...over,
  });

  it("REFUSES a name that is not the shape this product mints", async () => {
    for (const publicId of ["", "crop-1", "b9c1f4de", "  ", "not-a-uuid-at-all-really"]) {
      await expect(recordInkDeliveryCrop(row({ publicId })), publicId)
        .rejects.toThrow(/publicId/);
    }
  });

  it("REFUSES a userId that is not a real account", async () => {
    /* The guard beside it, kept armed: both run before the transaction, and an
       arm for one is not an arm for the other. */
    for (const userId of [0, -1, 1.5, Number.NaN]) {
      await expect(recordInkDeliveryCrop(row({ userId })), String(userId))
        .rejects.toThrow(/userId/);
    }
  });

  it("NEGATIVE CONTROL: a well-formed name gets PAST the guard", async () => {
    /*
      The half that makes the refusals mean something. Without it, a guard that
      rejected every input would pass every arm above — and this suite has no
      database, so "past the guard" is exactly what a database error proves.
    */
    await expect(recordInkDeliveryCrop(row())).rejects.not.toThrow(/publicId|userId/);
  });
});
