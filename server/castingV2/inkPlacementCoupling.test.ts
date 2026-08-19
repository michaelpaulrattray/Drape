import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { CastingInkDesignRow } from "../../drizzle/schema";
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
 *   the door    `server/routes/castingV2.ts` validates `z.enum(INK_PLACEMENTS)`
 *   the type    `drizzle/schema.ts` declares `$type<InkPlacement>()`
 *
 * Both are TRUE TODAY and each is true only because of the other. The door is
 * the sole writer, so the type is an honest description of the contents; the
 * type is narrow, so 28 files' worth of consumers keep compiling for a
 * capability nothing can yet send.
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

const DOOR = readFileSync(path.resolve(__dirname, "../routes/castingV2.ts"), "utf8");
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

  it("the door still narrows the upload to the measured vocabulary", () => {
    expect(DOOR).toMatch(/placement:\s*z\.enum\(INK_PLACEMENTS\)/);
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

      TO OPEN THE DOOR: widen `z.enum(INK_PLACEMENTS)` to the open shape, widen
      BOTH `$type<InkPlacement>()` declarations to `string`, and fix the
      consumers `pnpm check` then names — all in one commit. Then rewrite this
      file to pin the NEW coupling (whatever narrows an open placement: a
      length, a normaliser, a trim), because a keeper deleted along with the
      thing it kept is how the next trap gets planted.
    */
    expect(DOOR).toMatch(/THE CLOSED LIST IS THE CONTRACT/);
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
    expect(DOOR).not.toMatch(/placement:\s*z\.enum\(INK_PLACEMENTZ\)/);
    expect(SCHEMA).not.toMatch(/\$type<InkPlacementz>\(\)/);
    expect(DOOR.length).toBeGreaterThan(1000);
    expect(SCHEMA.length).toBeGreaterThan(1000);
  });
});
