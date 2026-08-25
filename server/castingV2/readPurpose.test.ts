/**
 * THE BOUNDARY ON THE READ STAGE'S NEW NAME — that a purpose reaches telemetry
 * and a customer's sentence never can.
 *
 * Ordered by fable-657 §2: *"THE BOUNDARY AS A TEST: the label comes from the
 * closed set, supplied by the caller, never derived from content — a test
 * asserts the field's values are members of the enum, so a customer sentence
 * can never reach telemetry even by accident."*
 *
 * # Three layers, and they catch different things
 *
 * The TYPE is the layer that actually holds: `about?: ReadPurpose` is a
 * string-literal union, so a customer's sentence at a call site is a compile
 * error rather than a rule twelve call sites have to remember. Nothing here can
 * test that — it is tested by `pnpm check` refusing to build.
 *
 * What this file adds is the two things a type cannot do:
 *
 *   THE SOURCE SCAN   a NEW text call site that forgets the field. The type
 *                     cannot catch that, because the field is optional — and it
 *                     is optional on purpose, so a test double or a script need
 *                     not invent one. So the paid path is asserted by reading
 *                     it, which is the same shape as the script-exit guard.
 *   THE RECORDER      that a purpose actually arrives in the census, and — the
 *                     half that makes the rest mean anything — that the
 *                     membership check CAN FAIL. A checker that has only ever
 *                     seen valid members has not been tested (working law 2).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { READ_PURPOSES, type ReadPurpose } from "../providers/types";
import { throughCensus, withCallCensus } from "./callCensus";

/** Membership, as a value-level predicate — the thing under test in the
 *  negative control below. */
const isReadPurpose = (value: string): boolean =>
  (READ_PURPOSES as readonly string[]).includes(value);

describe("the read stage's purpose vocabulary", () => {
  /*
    PINNED, so growing it is a decision rather than an accident. The seven-way
    split of `reask` is the load-bearing part: the colour door fires on 21 of
    360 attempts and one lumped `reask` would reproduce the hole it was built to
    close, one level down.
  */
  /*
    ELEVEN since 2026-08-20. `reask.vouched` went with the call it counted: the
    invention door's rescue no longer asks the model anything (fable-1141 §2 —
    containment re-runs on the same parse), so the bucket could only ever have
    read zero, and a bucket that cannot be non-zero reads as a measurement
    rather than as an absence.
  */
  /*
    TWELVE since 2026-08-26: `author` joined with the creative register's
    variance card (`creativeRegister.ts`). Every other member is a READING of
    a sentence or a picture; a card is prose WRITTEN for a slice, and a census
    that filed it under `interpret` would price the interpreter for work it
    never did.
  */
  it("is exactly the twelve members the design note enumerated, plus `author`", () => {
    expect([...READ_PURPOSES]).toEqual([
      "interpret",
      "reask.echo",
      "reask.prior",
      "reask.colour",
      "reask.hybrid",
      "reask.relook",
      "verify",
      "caption",
      "describe",
      "classify",
      "gate",
      "author",
    ]);
  });

  it("holds no duplicates and is frozen", () => {
    expect(new Set(READ_PURPOSES).size).toBe(READ_PURPOSES.length);
    expect(Object.isFrozen(READ_PURPOSES)).toBe(true);
  });
});

/**
 * EVERY TEXT CALL ON THE PRODUCT PATH SAYS WHY IT IS BEING MADE.
 *
 * Read off the source rather than driven, because the failure this guards is a
 * call site that does not exist yet: a new `complete({…})` written next month
 * with no `about` is invisible to any runtime test over today's call sites, and
 * it lands as another anonymous fifth of a render.
 *
 * The scan asserts the KEY is present. Its VALUE is the type's job — and for
 * `runOnce` the value is a parameter rather than a literal, which is exactly
 * the design (one function, seven purposes), so a scan for literals would be
 * wrong as well as brittle.
 *
 * **The limit, declared rather than discovered later:** it matches
 * `.complete({` at the end of a line, so a call written inline on one line
 * would not be seen. Every one of the current call sites is formatted that way
 * and none is written inline (checked, not assumed) — but this is a source
 * scan, and a source scan is a claim about spelling. The type is what makes a
 * WRONG value impossible; this only makes a MISSING one loud.
 */
describe("every text call site on the paid path names its purpose", () => {
  const root = join(__dirname, "..");

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!entry.name.endsWith(".ts")) return [];
      if (entry.name.endsWith(".test.ts")) return [];
      return [path];
    });

  it("finds an `about:` on every `complete({` in server/", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!/\.complete\(\{\s*$/.test(line)) return;
        /* The object literal opens here; the field is written first at every
           call site, but allow a few lines so a reformat does not redden the
           suite for no reason. */
        const window = lines.slice(index + 1, index + 6).join("\n");
        if (!/\babout:/.test(window)) {
          offenders.push(`${file.slice(root.length + 1)}:${index + 1}`);
        }
      });
    }
    expect(offenders, "text calls with no purpose — they file as an anonymous fifth of a render").toEqual([]);
  });

  /*
    THE SCAN'S OWN POSITIVE CONTROL. A regex that matched nothing would pass the
    assertion above on an empty list and report the paid path fully labelled — a
    checker cannot be believed until it is known to be looking at something.
  */
  it("and the scan actually found call sites to check", () => {
    let found = 0;
    for (const file of sourceFiles(root)) {
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        if (/\.complete\(\{\s*$/.test(line)) found += 1;
      }
    }
    expect(found).toBeGreaterThanOrEqual(10);
  });
});

describe("the purpose reaches the census, and the check that says so can fail", () => {
  it("records a door's re-ask under its own name", async () => {
    const { census } = await withCallCensus(async () => {
      await throughCensus(
        { stage: "read", provider: "openrouter", model: "anthropic/claude-sonnet-5", about: "reask.colour" },
        async () => "ok",
      );
    });

    expect(census.byAbout["reask.colour"]?.calls).toBe(1);
    expect(census.byStage.read?.calls).toBe(1);
    for (const about of Object.keys(census.byAbout)) {
      expect(isReadPurpose(about)).toBe(true);
    }
  });

  /*
    THE NEGATIVE CONTROL — driven at the recorder rather than through a model,
    because a guard whose only test runs through an LLM that usually behaves is
    an untested guard (working law 3).

    This is the sentence the whole design exists to keep out. It is asserted to
    FAIL the membership check, which is what proves the assertion in the test
    above is doing work rather than agreeing with everything.
  */
  it("REFUSES a customer's sentence — the check comes back false", async () => {
    const sentence = "make her hair the same copper as my sister's wedding photos";
    const { census } = await withCallCensus(async () => {
      await throughCensus(
        /* Cast, because the type is what makes this unwritable at a real call
           site; the census's own field is a plain string, so the runtime check
           is still worth having for anything that reaches it another way. */
        { stage: "read", provider: "openrouter", model: "m", about: sentence as ReadPurpose },
        async () => "ok",
      );
    });

    expect(census.byAbout[sentence]?.calls).toBe(1);
    expect(isReadPurpose(sentence)).toBe(false);
  });
});
