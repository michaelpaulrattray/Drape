import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { CastingInkDesignRow } from "../../drizzle/schema";
import type { InkDesignToRecord } from "../db/castingV2InkDesigns";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import { effectiveColumn } from "../testing/migrationColumns";
import { INK_PLACEMENT_MAX_LENGTH, INK_PLACEMENT_TALLY_MAX_LENGTH } from "./inkPlacementResolve";

/**
 * THE KEEPER FOR A ONE-COMMIT-WIDE TRAP (ordered fable-1112 §3).
 *
 * # The trap
 *
 * Migration 0046 opened `placement` on both ink tables to `varchar(64)`: the
 * DATABASE will now hold any word a customer uses for where a tattoo goes,
 * because fable-1078 ruled such an ask is never refused on placement.
 *
 * Two narrowings were deliberately LEFT IN PLACE on top of that open column:
 *
 *   the writer  `db/castingV2InkDesigns.ts` types `InkDesignToRecord.placement`
 *   the type    `drizzle/schema.ts` declares `$type<InkPlacement>()`
 *
 * Both are TRUE TODAY and each is true only because of the other. Every writer
 * narrows, so the type is an honest description of the contents; the type is
 * narrow, so 28 files' worth of consumers keep compiling for a capability
 * nothing can yet send.
 *
 * ⚠ **THE FIRST OF THOSE TWO LINES SAID "the door — `server/routes/castingV2.ts`
 * validates `z.enum(INK_PLACEMENTS)`" UNTIL 2026-09-24, AND ITS PREMISE WAS
 * ALREADY SHAKY WHEN #1158 RETIRED THAT DOOR.** The sentence beneath it read
 * *"the door is the sole writer"*, and `recordInkDesign` has had TWO callers
 * since the reference road landed: the studio's upload, now retired on his
 * ruling, and `inkReferenceMint`. A text pin on one writer's file could not
 * have seen the other widen. Anchoring on the insert's input type fixes that as
 * a side effect of the retirement rather than waiting for the trap to spring.
 *
 * **The day the door opens, the type becomes a promise the column no longer
 * keeps** — a row read as `InkPlacement` while holding `sleeve`, with every
 * exhaustive `switch` over the three compiling and being wrong.
 *
 * # Why a comment was not enough
 *
 * opus-819 named that trap in prose and fable-1112 refused prose as its keeper:
 * *"a one-commit-wide trap named so it cannot be quiet is still a memory unless
 * an instrument holds it."* This file is the instrument. It has no opinion about
 * whether the door should open — it only insists the two narrowings move
 * together, in one commit, so the trap announces itself instead of waiting to be
 * remembered.
 *
 * # Two arms, because the two directions fail differently
 *
 * The TYPE arm below is a compile-time pin: it fails under `pnpm check` and
 * vitest cannot see it. The TEXT arms fail under vitest and `pnpm check` cannot
 * see them. Neither instrument sees the other's failure, which is the standing
 * custody rule of this campaign stated as a test file.
 */

/*
  THE TYPE ARM — mutual assignability, which is type equality written twice.

  Widen the column's `$type` to `string` and the first line stops compiling;
  narrow `InkPlacement` past the row and the second does. Either way `pnpm
  check` goes red on the commit that did it.
*/
const _rowPlacementIsTheVocabulary: InkPlacement = null as unknown as CastingInkDesignRow["placement"];
const _vocabularyIsTheRowPlacement: CastingInkDesignRow["placement"] = null as unknown as InkPlacement;
void _rowPlacementIsTheVocabulary;
void _vocabularyIsTheRowPlacement;

/*
  THE SAME ARM ON THE WRITE SIDE, added with #1158 slice 1 — and it is the one
  that carries the retired door's job.

  The text arm below reads this repository's source for `placement: InkPlacement`
  and there are TWO such fields one file apart: `InkDesignToRecord` (what a
  writer must hand in) and `RecordedInkDesign` (what it gets back). A widening of
  the WRITE side alone would leave the read side's spelling untouched and the
  text arm green — a regex standing in for something the type system already
  states, which is the class `CLAUDE.md` names four Atlas collectors for. This
  pin cannot be satisfied by the neighbour: it is the write type by name.
*/
const _recordedPlacementIsTheVocabulary: InkPlacement =
  null as unknown as InkDesignToRecord["placement"];
const _vocabularyIsTheRecordedPlacement: InkDesignToRecord["placement"] =
  null as unknown as InkPlacement;
void _recordedPlacementIsTheVocabulary;
void _vocabularyIsTheRecordedPlacement;

/* THE NARROWING SITE, and it is no longer a door. See the first text arm: the
   studio's upload retired with #1158 slice 1, and `recordInkDesign`'s input type
   is the one thing every writer of this row must pass through. */
const RECORD = readFileSync(path.resolve(__dirname, "../db/castingV2InkDesigns.ts"), "utf8");
const SCHEMA = readFileSync(path.resolve(__dirname, "../../drizzle/schema.ts"), "utf8");

describe("the open column's two narrowings are one decision", () => {
  it("the column really is open, so this pin has something to hold", () => {
    /*
      THE ARM'S OWN PREMISE, ASSERTED FIRST. Everything below is about a
      narrowing that only matters because the storage beneath it is wide. If
      0046 were reverted, the arms below would still pass and would be guarding
      nothing — a pin whose subject is gone, which is the exact failure the
      re-aimed schema suites were rescued from.
    */
    expect(effectiveColumn("casting_ink_designs", "placement")).toBe("varchar(64) NOT NULL");
    expect(effectiveColumn("casting_ink_form_demand", "placement")).toBe("varchar(64) NOT NULL");
  });

  it("every writer still narrows to the measured vocabulary", () => {
    /*
      ⚠ THIS ARM USED TO READ THE DOOR, AND THE DOOR IS GONE — #1158 slice 1
      retired the ink studio's `upload` procedure on his ruling *"It retires
      with N2"*. It read:

          expect(DOOR).toMatch(/placement:\s*z\.enum\(INK_PLACEMENTS\)/)

      **The keeper is re-aimed rather than deleted**, which is this file's own
      standing instruction two arms below, and the re-aim makes it STRONGER
      rather than merely surviving. The docblock's premise was *"the door is the
      sole writer, so the type is an honest description of the contents"* — and
      that premise was never quite true: `recordInkDesign` has always had TWO
      callers, the retired studio upload and `inkReferenceMint`, the take from
      an attached picture (`CASTING_INK_REFERENCE_SCOPE`, HELD and moved to N3
      by his Crew reply #213). A text search on ONE writer's file could never
      have caught the other opening.

      So the narrowing is pinned where every writer must pass through it: the
      input type of the only function that inserts the row. A new road minting
      designs inherits the pin by construction instead of needing a new arm
      nobody would remember to write (working law 4 — derive, never mirror).
    */
    /* BOTH sides of the insert, counted rather than merely found: the write
       type and the read-back type each carry it, and a bare `toMatch` here
       would go green on either one alone. The compile-time pin at the head of
       this file names the write type specifically; this is its vitest-visible
       half, and the two instruments cannot see each other's failure — which is
       this file's own stated custody rule. */
    expect(RECORD.match(/placement:\s*InkPlacement;/g) ?? []).toHaveLength(2);
  });

  it("the row type still narrows to the same vocabulary, on both tables", () => {
    const narrowed = SCHEMA.match(/placement:\s*varchar\("placement",[^)]*\)\.\$type<InkPlacement>\(\)/g) ?? [];
    expect(narrowed).toHaveLength(2);
  });

  it("names what must happen on the day either one moves", () => {
    /*
      THE INSTRUCTION LIVES WITH THE ARM THAT ENFORCES IT, so whoever reddens
      this suite reads the answer in the same file as the failure rather than
      going looking for a mailbox message.

      TO OPEN THE PLACEMENT: widen `InkDesignToRecord["placement"]` to the open
      shape, widen BOTH `$type<InkPlacement>()` declarations to `string`, and
      fix the consumers `pnpm check` then names — all in one commit. Then
      rewrite this file to pin the NEW coupling (whatever narrows an open
      placement: a length, a normaliser, a trim), because a keeper deleted along
      with the thing it kept is how the next trap gets planted.

      ⚠ THIS ARM USED TO READ THE DOOR'S OWN COPY of that instruction
      (`expect(DOOR).toMatch(/THE CLOSED LIST IS THE CONTRACT/)`), and the door
      left with #1158 slice 1. The instruction now lives HERE, beside the arm
      that enforces it, which is what this file's docblock said it was for all
      along — and it is pinned at the one place a widening must pass through
      rather than at one writer's prose.
    */
    expect(RECORD).toMatch(/THE CLOSED LIST IS THE CONTRACT/);
  });

  it("the door's cap and the column's width are one decision", () => {
    /*
      THE SECOND COUPLING, ordered fable-1114 §3 and the same pattern as the one
      above. `resolveInkPlacement` admits a phrase up to
      `INK_PLACEMENT_MAX_LENGTH`; the column holds `varchar(64)`; this database
      runs STRICT_TRANS_TABLES, so a 65th character is an ERROR at the INSERT
      and not a truncation.

      If the two ever disagree in the loose direction, the failure lands as a
      500 on a customer's upload — which is the worst available way to discover
      a number, and the one this arm exists to make impossible.
    */
    const ddl = effectiveColumn("casting_ink_designs", "placement");
    const width = /varchar\((\d+)\)/i.exec(ddl ?? "");
    expect(width, `unreadable column DDL: ${ddl}`).not.toBeNull();
    expect(Number(width![1])).toBe(INK_PLACEMENT_MAX_LENGTH);
  });

  it("the tally's bound sits inside the column's, never outside it", () => {
    /* The demand row is tighter for a privacy reason rather than a storage one,
       so the ordering is the assertion: a tally bound that grew past the column
       would be a sentinel that never fires and a phrase MySQL refuses. */
    expect(INK_PLACEMENT_TALLY_MAX_LENGTH).toBeLessThan(INK_PLACEMENT_MAX_LENGTH);
  });

  it("can fail — the reader is not matching its own optimism", () => {
    /* The control: these are text searches, and a text search that cannot miss
       is a test of its own regex rather than of the source. */
    expect(RECORD).not.toMatch(/placement:\s*InkPlacementz;/);
    expect(SCHEMA).not.toMatch(/\$type<InkPlacementz>\(\)/);
    expect(RECORD.length).toBeGreaterThan(1000);
    expect(SCHEMA.length).toBeGreaterThan(1000);
  });
});
