/**
 * #2322 — the last customer-visible "cast" nouns say "character", and the
 * canvas character picker follows the app theme.
 *
 * The founder's word, on the #2320 pack: *"yes change those to characters"*.
 * And in the same reply, yes to the picker following dark mode.
 *
 * Three arms:
 *
 *  1. The roster copy is DRIVEN — `chipHeading`, `rosterEmptyLine` and
 *     `campaignDeleteBody` are called, not grepped, because they are plain
 *     functions and calling them is the real path.
 *  2. The JSX copy is source-read (no DOM in `pnpm test`), each row as a pair:
 *     the new words present AND the old words absent. The absent half alone
 *     would pass on a deleted string.
 *  3. The picker's colours. It used to draw from the canvas palette, which has
 *     no dark values (`styles/canvas-tokens.css`, #916), so it opened white in
 *     dark mode. Every colour class in it must now be a foundation token that
 *     `foundation/tokens.css` defines in BOTH its light (`:root`) and its dark
 *     (`[data-theme="dark"]`) block — read from that file, never listed here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { campaignDeleteBody, chipHeading, rosterEmptyLine } from "@/features/castingV2/rosterChips";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const PICKER = "client/src/features/boards/canvas/CastPickerModal.tsx";
const SECURITY = "client/src/features/settings/sections/SecuritySection.tsx";
const LOBBY = "client/src/pages/AppLobby.tsx";
const TOKENS = "client/src/foundation/tokens.css";

describe("#2322 — the casting library's copy says character", () => {
  it("the All heading says All characters", () => {
    expect(chipHeading({ kind: "all" }, [])).toBe("All characters");
  });

  it("an empty campaign says No characters in this campaign yet", () => {
    expect(rosterEmptyLine({ kind: "campaign", campaignId: "c1" }, "", 3)).toBe(
      "No characters in this campaign yet",
    );
  });

  it("the delete-campaign question says it keeps its characters, and no longer its cast", () => {
    const body = campaignDeleteBody("Summer", 2);
    expect(body).toContain("Deleting “Summer” keeps its characters.");
    expect(body).not.toMatch(/\bcasts?\b/i);
  });
});

/* Each row: where, what it must now say, what it must no longer say. */
const SWEPT: ReadonlyArray<{ file: string; now: string; gone: string }> = [
  { file: PICKER, now: ">Your characters<", gone: "Your casts" },
  { file: PICKER, now: "+ New character", gone: "+ Cast new" },
  { file: PICKER, now: "Drafts — exploring, not yet signed", gone: "not yet cast" },
  { file: PICKER, now: '"No characters match"', gone: '"No casts match"' },
  { file: PICKER, now: '"No characters yet"', gone: '"No casts yet"' },
  { file: SECURITY, now: 'note="Permanent. Your characters, boards and everything you made go with it."', gone: "Your casts, boards" },
  { file: SECURITY, now: "Your characters, boards and everything you made are deleted with the account.", gone: "Your casts, boards" },
  { file: LOBBY, now: "Your characters live in Casting Studio", gone: "Your casts live" },
];

describe("#2322 — the picker, settings and lobby say character", () => {
  it.each(SWEPT)("$file says $now", ({ file, now }) => {
    expect(source(file)).toContain(now);
  });

  it.each(SWEPT)("$file no longer says $gone", ({ file, gone }) => {
    expect(source(file)).not.toContain(gone);
  });
});

/* The canvas palette's colour utilities — `bg-canvas-ink`, `text-canvas-ink-soft`,
   `border-canvas-border` … — and the scope that pins a subtree light. Sizes
   (`text-canvas-xs`, `rounded-canvas-md`) are not colours and are allowed. */
const CANVAS_COLOUR =
  /\b(?:[a-z-]+:)*(?:bg|text|border|placeholder:text)-canvas-(?:bg|surface|surface-inset|field|ink|ink-soft|ink-faint|border|border-strong|teal-bg|teal-text|destructive|warning|pin-prompt|pin-image)\b|\bcanvas-scope\b/g;
const TOKEN_USE = /\[var\(--([A-Za-z0-9]+)\)\]/g;

function blockOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} block not found in ${TOKENS}`);
  return css.slice(start, css.indexOf("\n}", start));
}

function definedIn(block: string): Set<string> {
  return new Set([...block.matchAll(/^\s*--([A-Za-z0-9]+)\s*:/gm)].map((m) => m[1]));
}

describe("#2322 — the canvas character picker follows the app theme", () => {
  const css = source(TOKENS);
  const light = definedIn(blockOf(css, ":root"));
  const dark = definedIn(blockOf(css, '[data-theme="dark"]'));
  const picker = source(PICKER);
  const used = [...new Set([...picker.matchAll(TOKEN_USE)].map((m) => m[1]))];
  /* Comments may name the old scope or a card number; code may not. */
  const code = picker.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");

  it("the detector catches a canvas colour and passes a canvas size (controls)", () => {
    expect("text-[var(--ink)] bg-canvas-surface".match(CANVAS_COLOUR)).toEqual(["bg-canvas-surface"]);
    expect("hover:text-canvas-ink".match(CANVAS_COLOUR)).toEqual(["hover:text-canvas-ink"]);
    expect('className="canvas-scope fixed"'.match(CANVAS_COLOUR)).toEqual(["canvas-scope"]);
    expect("text-canvas-xs rounded-canvas-md text-canvas-md".match(CANVAS_COLOUR)).toBeNull();
  });

  it("the token reader sees both theme blocks (controls)", () => {
    expect(light.has("surface") && dark.has("surface")).toBe(true);
    expect(light.size).toBeGreaterThan(30);
    expect(dark.size).toBeGreaterThan(20);
    expect(light.has("not-a-token")).toBe(false);
  });

  it("draws no colour from the light-only canvas palette, and is not pinned light", () => {
    expect(code.match(CANVAS_COLOUR) ?? []).toEqual([]);
  });

  it("has colours to read — a guard over nothing passes for the wrong reason", () => {
    expect(used.length).toBeGreaterThanOrEqual(7);
  });

  it("every colour it uses is defined for both light and dark", () => {
    const missing = used.filter((name) => !light.has(name) || !dark.has(name));
    expect(missing, "a picker colour with no dark value draws light in dark mode").toEqual([]);
  });

  it("has no hard-coded colour", () => {
    expect(code).toContain("bg-[var(--surface)]"); // the comment stripper kept the code
    expect(code).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/);
  });
});
