import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { campaignDeleteBody } from "./rosterChips";

/**
 * CARD #2320 — the founder's word, 2026-10-12: the casting library and the
 * screens beside it say "character", never "cast" or "cast member". Only what
 * a customer sees changes; no identifier is renamed.
 *
 * Every string the card changed is a pair: the wording it must now say and the
 * wording it must no longer say. The negative alone would pass on a deleted
 * string, so each row carries both. Comments are stripped first, so an old
 * sentence kept in a note cannot satisfy or fail an arm.
 */

const code = (path: string) => withoutComments(readFileSync(resolve(process.cwd(), path), "utf8"));

const LIBRARY = "client/src/pages/CastingV2.tsx";
const RENAME = "client/src/foundation/RenameDialog.tsx";
const PICKER = "client/src/features/boards/canvas/CastPickerModal.tsx";
const SELECTION = "client/src/features/castingV2/castSelection.ts";
const CHIPS = "client/src/features/castingV2/rosterChips.ts";

const PAIRS: ReadonlyArray<{ file: string; now: string; gone: string }> = [
  { file: LIBRARY, now: 'placeholder="Search by name"', gone: 'placeholder="Search cast by name"' },
  { file: LIBRARY, now: 'aria-label="Search by name"', gone: 'aria-label="Search cast by name"' },
  {
    file: LIBRARY,
    now: '{shownCount === 1 ? "character" : "characters"}',
    gone: '{shownCount === 1 ? "cast member" : "cast members"}',
  },
  { file: LIBRARY, now: ">New character<", gone: ">New cast member<" },
  {
    file: LIBRARY,
    now: "A character is a face and a presence — made once, reusable in every campaign.",
    gone: "A cast member is a face and a presence — signed once, reusable in every campaign.",
  },
  {
    file: LIBRARY,
    now: "A ready-made set of characters, cleared to use without casting —",
    gone: "A ready-made roster of signed cast members",
  },
  { file: RENAME, now: "CHARACTER · {currentName.toUpperCase()}", gone: "CAST MEMBER ·" },
  { file: PICKER, now: 'placeholder="Search characters…"', gone: 'placeholder="Search casts..."' },
  { file: SELECTION, now: '"1 character"', gone: '"1 cast member"' },
];

describe("card 2320 — the library says 'character'", () => {
  it.each(PAIRS)("$file says $now", ({ file, now }) => {
    expect(code(file)).toContain(now);
  });

  it.each(PAIRS)("$file no longer says $gone", ({ file, gone }) => {
    expect(code(file)).not.toContain(gone);
  });

  it("the delete-campaign question counts characters, singular and plural (driven)", () => {
    expect(campaignDeleteBody("Summer", 1)).toContain("The 1 character in it stays in your library");
    expect(campaignDeleteBody("Summer", 4)).toContain("The 4 characters in it stay in your library");
  });
});

describe("card 2320 — the class: no 'cast member' left in the code of the five files", () => {
  it.each([LIBRARY, RENAME, PICKER, SELECTION, CHIPS])("%s", (file) => {
    expect(code(file)).not.toMatch(/cast member/i);
  });
});
