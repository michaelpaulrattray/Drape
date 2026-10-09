import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The master picture's tag is the cast's Klieg ID, not a slogan (#2124).
 *
 * The founder, 2026-10-09: "maybe it can be their unique identifier code? with
 * a small tooltip ? that explain what its for". The tag read IDENTITY LOCKED.
 *
 * Component rendering stays out of `pnpm test` (vitest.config.ts), so this reads
 * the room's source, sliced to the one tag, the way `roomAnatomy.test.ts` does.
 * The rendered behaviour (hover, focus, copy) is proven by the browser frames
 * on the PR. What this pins is what would quietly drift: the id is the cast's
 * own public id from the projection, the explanation is the card's sentence
 * word for word, it goes through the house tooltip, and the copy says "Copied".
 */

const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);

const SENTENCE =
  "This cast's Klieg ID. It never changes and belongs only to them — quote it if you ever contact us about this cast.";

/** The tag alone: from its opening span to the end of its tooltip. */
function tagOf(source: string): string {
  const open = '<span className="dpc-master__locked">';
  const start = source.indexOf(open);
  expect(start, "the tag is in the room").toBeGreaterThan(-1);
  expect(source.indexOf(open, start + 1), "the tag's anchor is unique").toBe(-1);
  const tooltipEnd = source.indexOf("</Tooltip>", start);
  expect(tooltipEnd, "the tag carries a tooltip").toBeGreaterThan(start);
  const end = source.indexOf("</span>", tooltipEnd);
  expect(end, "the tag closes after its tooltip").toBeGreaterThan(tooltipEnd);
  return source.slice(start, end);
}

/** The value a constant is declared with, so the tag can be read through it. */
function constantValue(source: string, name: string): string | null {
  const match = new RegExp(`const ${name} =\\s*\\n?\\s*"([^"]*)";`).exec(source);
  return match ? match[1] : null;
}

describe("the room's master tag is the cast's Klieg ID, card 2124", () => {
  it("shows the cast's public id from the projection, not a slogan", async () => {
    const tag = tagOf(await readFile(ROOM, "utf8"));
    expect(tag).toContain("{data.castId}");
    expect(tag).not.toContain("IDENTITY LOCKED");
    // The lock glyph stays.
    expect(tag).toContain("<Lock ");
  });

  it("explains it with the card's sentence, verbatim, through the house tooltip", async () => {
    const source = await readFile(ROOM, "utf8");
    const tag = tagOf(source);
    expect(constantValue(source, "CAST_ID_EXPLAINED")).toBe(SENTENCE);
    expect(tag).toMatch(/<TooltipContent[^>]*>\s*\{CAST_ID_EXPLAINED\}\s*<\/TooltipContent>/);
    // The ? is a real button inside the trigger, so keyboard focus opens it too.
    expect(tag).toMatch(/<TooltipTrigger asChild>\s*<button\s+type="button"/);
    expect(source).toMatch(
      /import \{[^}]*\bTooltip\b[^}]*\} from "@\/components\/ui\/tooltip";/,
    );
  });

  it("copies the id on click with the house toast", async () => {
    const tag = tagOf(await readFile(ROOM, "utf8"));
    expect(tag).toContain("navigator.clipboard.writeText(data.castId)");
    expect(tag).toContain('toast("Copied")');
  });

  it("negative control: the reader refuses the tag as it was", () => {
    const before = `<span className="dpc-master__locked">
      <Lock size={11} strokeWidth={2} aria-hidden="true" />
      IDENTITY LOCKED
    </span>`;
    // No tooltip at all, so the slice itself cannot be taken.
    expect(() => tagOf(before)).toThrow();
    expect(before).not.toContain("{data.castId}");
  });
});
