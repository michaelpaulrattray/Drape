/**
 * THE CHARACTER'S PAGE, THE SELECTION BAR AND THE SIGN'S REFUSALS SAY
 * "CHARACTER" — #2382.
 *
 * The founder's ruling of 2026-10-12 (#2320, #2322, #2318): the customer reads
 * "character", not "cast". Those sweeps did not reach the signed character's
 * page, the library's selection bar or the Sign's own refusals. Identifiers
 * (`castId`, `CastSelectionBar`, `deleteCast`) are the code's and stay.
 *
 * What is read: every string a customer sees or hears on these surfaces — a
 * `title=`, `label=` or `aria-label=` attribute, a `?? "…"` name fallback, and
 * the server sentences authored as `message:` / `publicMessage:` or handed to
 * `sealFailure` — and none may say Cast.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const OLD_NOUN = /\bcasts?\b/i;

/** The customer-facing literals on one source, by the shapes listed above. */
function customerStrings(source: string): string[] {
  const found: string[] = [];
  const shapes = [
    /\b(?:title|label|aria-label)="([^"]*)"/g,
    /\?\?\s*"([^"]*)"/g,
    /\b(?:message|publicMessage):\s*(?:[\w.]+\s*\|\|\s*)?(["`])((?:(?!\1).)*)\1/g,
    /\bsealFailure\([^)]*?(["`])((?:(?!\1).)*)\1\)/g,
    /^\s*(["`])((?:That|This|The|Part of) [^"`]*)\1,?\s*$/gm,
  ];
  for (const shape of shapes) {
    for (const match of source.matchAll(shape)) found.push(match[match.length - 1]);
  }
  return found;
}

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const SURFACES = [
  "./CastingRoom.tsx",
  "../features/castingV2/components/CastSelectionBar.tsx",
  "../../../server/castingV2/signService.ts",
  "../../../server/castingV2/signRecovery.ts",
  /* #2432: the library page and the route's own refusals, which the sweep
     above did not reach. */
  "./CastingV2.tsx",
  "../../../server/routes/castingV2.ts",
];

describe("the customer reads 'character' on the page, the bar and the Sign (#2382)", () => {
  it("the reader finds the old wording when it is there (negative control)", () => {
    const old = [
      '<EmptyState title="That Cast isn\'t here" />',
      '<button aria-label="Rename this Cast">',
      '<div role="toolbar" aria-label="Selected cast">',
      'name={data.name ?? "this cast"}',
      '        message: "That Cast wasn\'t signed. You were not charged.",',
      "    message: `The Cast couldn't be signed. ${tail}`,",
      '        message: chargeResult.error || `Not enough credits. Signing a Cast costs ${n} credits.`,',
      '      await sealFailure(options, operation, 0, 0, "That Cast wasn\'t signed. You were not charged.");',
      "      \"That Cast wasn't signed. Everything you paid was refunded.\",",
    ];
    for (const line of old) {
      const strings = customerStrings(line);
      expect(strings.length, line).toBeGreaterThan(0);
      expect(strings.some((text) => OLD_NOUN.test(text)), line).toBe(true);
    }
  });

  for (const path of SURFACES) {
    it(`${path.split("/").at(-1)} says character, never cast`, () => {
      const strings = customerStrings(read(path));
      expect(strings.length, "the reader found the file's strings").toBeGreaterThan(2);
      expect(strings.filter((text) => OLD_NOUN.test(text))).toEqual([]);
    });
  }

  it("the library's own sentences say character too (#2432)", () => {
    /* Template sentences are not one of the reader's shapes, so these are read
       by their own words: the old line must be gone and the new one present. */
    const library = read("./CastingV2.tsx");
    expect(library).not.toMatch(/\} casts came from this casting|`Those casts couldn't/);
    expect(library).toContain("characters came from this casting");
    expect(library).toContain("Those characters couldn't be added to");
    expect(library).toContain("Those characters couldn't be taken out of");
    expect(library).toContain('label={cast.name ?? "this character"}');
    const route = read("../../../server/routes/castingV2.ts");
    expect(route).not.toContain('"Cast not found"');
    expect(route).toContain(`message: "That character isn't here."`);
    expect(route).toContain("This character is still being made");
  });

  it("the new sentences are the ones on the page (positive control)", () => {
    const room = read("./CastingRoom.tsx");
    expect(room).toContain('title="That character isn\'t here"');
    expect(room).toContain('aria-label="Rename this character"');
    expect(room).toContain('aria-label="Character name"');
    const sign = read("../../../server/castingV2/signService.ts");
    expect(sign).toContain("That character wasn't signed. You were not charged.");
    expect(sign).toContain("The character couldn't be signed.");
  });
});
