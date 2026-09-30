/**
 * #1545 — on the canvas, a person is a CAST and never a "model".
 *
 * His word, 2026-09-30: *"library hasnt been designed yet regardless it should
 * read /library not /models"*, on a proposal about the library's title. The
 * address half of that is pinned in `client/src/appRoutes.test.ts`. This suite
 * is the other half — working law 7, fix the class not the instance — and it
 * guards the one surface where the word was actually reaching customers.
 *
 * # WHY THE CANVAS AND NOT THE WHOLE TREE
 *
 * The card asked for every customer-facing "model" meaning a person. Read at
 * the tree and then at the EMITTED BUNDLE, that population is smaller than the
 * card knew and it is almost all here:
 *
 *  - The old lobby views (`LibraryView`, `HomeView`, `BoardsView`) carry twelve
 *    such strings and **not one of them ships**. They have been unmounted since
 *    #302 — `AppLobby` renders `LobbyStub` — and nothing outside their own
 *    directory imports them. `lobbyStub.test.ts` is what keeps them unmounted.
 *  - The legacy studio's copy is **admin-sealed** (#364): a non-admin meets a
 *    404, so it is a staff surface, not a customer one.
 *  - `features/billing` says *"Every model and every tool"* and there **model
 *    means the ENGINE** — the one meaning the product's own
 *    disappearing-technology law says to name plainly. Renaming it would be this
 *    card's mistake in reverse.
 *
 * So `features/boards` — the customer's canvas — is where the word was live,
 * and it is a whole feature that is customer-facing, which is what lets the
 * class arm below have a population instead of an allowlist.
 *
 * # THE STATED LIMIT, BECAUSE IT IS A FLOOR AND NOT COVERAGE
 *
 * The class arm reads the four shapes that are unambiguously user-visible
 * without anyone having to judge — `placeholder=`, `aria-label=`, `caption=`,
 * `title=` and a menu record's `label:` — **plus JSX TEXT**, the words between
 * an opening and closing tag, which are as unambiguously customer-visible as
 * an attribute is.
 *
 * ⚠ **The JSX-text arm exists because the first shape of this suite did NOT
 * have it, and a live instance walked straight through the hole the same
 * hour**: `FirstRunIntro.tsx` said *"Cast your first model"* on its button as
 * TEXT, not as the `caption=` attribute three lines above it that the sweep had
 * already fixed. Preflight found it, not this guard. So the gap is closed
 * rather than declared.
 *
 * **What it still does not read is a TEMPLATE STRING or a bare string constant**,
 * because telling `type: 'model'` (a code value, which stays) from a sentence a
 * customer reads is the judgement a guard cannot make, and an exception list for
 * it would be working law 4's mirror. The swept sentences are pinned
 * individually below; that remainder is a FLOOR and not coverage.
 *
 * Source-read rather than rendered, like `lobbyStub.test.ts` beside it:
 * `pnpm test` runs in a node environment with no DOM.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const BOARDS = "client/src/features/boards";
const PICKER = `${BOARDS}/canvas/CastPickerModal.tsx`;
const NODE_INFO = `${BOARDS}/components/NodeInfoPanel.tsx`;
const ITEM_NODE = `${BOARDS}/nodes/BoardItemNode.tsx`;
const CAST_NODE = `${BOARDS}/canvas/nodes/CastNode.tsx`;
const ADD_MENU = `${BOARDS}/components/AddNodeMenu.tsx`;
const INTRO = `${BOARDS}/components/FirstRunIntro.tsx`;
const BOARD_PAGE = `${BOARDS}/BoardPage.tsx`;

/**
 * Every sentence this card changed, as a pair: the word it must now say, and
 * the word it must no longer. **The negative alone would pass on a deleted
 * string** — which is why each row carries both.
 */
const SWEPT: ReadonlyArray<{ file: string; now: string; gone: string }> = [
  { file: PICKER, now: ">Your casts<", gone: ">Your models<" },
  { file: PICKER, now: 'placeholder="Search casts..."', gone: 'placeholder="Search models..."' },
  { file: PICKER, now: '"No casts match"', gone: '"No models match"' },
  { file: PICKER, now: '"No casts yet"', gone: '"No models yet"' },
  { file: PICKER, now: "Cast someone", gone: "Cast your first model" },
  { file: ADD_MENU, now: "label: 'Cast someone'", gone: "label: 'Cast model'" },
  { file: INTRO, now: 'caption="Cast a person from a sentence"', gone: 'caption="Cast a model from a sentence"' },
  { file: NODE_INFO, now: '<Section title="Cast">', gone: '<Section title="Model">' },
  { file: NODE_INFO, now: "the linked cast was removed", gone: "the linked model was removed" },
  { file: ITEM_NODE, now: "model: 'Cast'", gone: "model: 'Model'" },
  { file: CAST_NODE, now: "forks a new cast", gone: "forks a new model" },
  { file: BOARD_PAGE, now: "'Saved in your Library'", gone: "'Saved in Models'" },
  { file: BOARD_PAGE, now: "It is safe in your Library because", gone: "It is safe in Models because" },
];

describe("#1545 — the canvas calls a person a cast", () => {
  it.each(SWEPT)("$file says $now", ({ file, now }) => {
    expect(source(file)).toContain(now);
  });

  it.each(SWEPT)("$file no longer says $gone", ({ file, gone }) => {
    expect(source(file)).not.toContain(gone);
  });
});

describe("#1545 — the class: no user-visible label on the canvas says \"model\"", () => {
  /*
    The four attribute shapes plus a menu record’s `label:`. Derived from the
    files rather than listed: whoever adds a placeholder saying "model" is
    caught without anyone extending a list.
  */
  const VISIBLE_VALUE =
    /(?:placeholder|aria-label|caption|title)="([^"]*)"|label:\s*'([^']*)'/g;

  /*
    ⚠ **DERIVED FROM THE DIRECTORY, NEVER LISTED** (working law 4). The first
    shape of this suite carried the fifteen filenames by hand, and a hand list is
    the one thing this guard must not have: a NEW canvas component saying "model"
    would have been invisible to it, which is the failure mode of a guard rather
    than a gap in one. Every `.tsx` under `features/boards` is customer-facing —
    it is the customer's canvas — so the whole tree is the population and a file
    cannot be added without joining it.
  */
  const FILES: readonly string[] = (function walk(dir: string): string[] {
    return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : entry.name.endsWith(".tsx")
          ? [`${dir}/${entry.name}`]
          : [],
    );
  })(BOARDS);

  const found = FILES.flatMap((file) =>
    [...source(file).matchAll(VISIBLE_VALUE)]
      .map((m) => ({ file, value: m[1] ?? m[2] ?? "" }))
      .filter((row) => row.value.trim().length > 0),
  );

  it("has a population to read — a guard over nothing passes for the wrong reason", () => {
    /* Measured the day this landed: 39 labels across 39 files. The floor sits
       just under it, not far under: a floor of 30 against a real 39 would let a
       quarter of the population vanish silently, which is the same defect as no
       floor at all wearing a number. A refactor may move labels about; it may
       not empty this suite. */
    expect(found.length).toBeGreaterThanOrEqual(35);
  });

  it("and none of those labels calls a person a model", () => {
    const offenders = found.filter((row) => /\bmodels?\b/i.test(row.value));
    expect(
      offenders.map((row) => `${row.file}: "${row.value}"`),
      "a user-visible label on the canvas must say cast, never model (#1545)",
    ).toEqual([]);
  });

  /*
    JSX TEXT — the words between an opening and a closing tag. Braces are
    excluded by the character class, so `{title}` and every interpolation is
    out; a value is kept only if it holds a letter, which drops punctuation and
    whitespace nodes.
  */
  const JSX_TEXT = />([^<>{}]*?)</gs;

  /*
    ⚠ A TYPESCRIPT GENERIC CLOSES WITH `>` AND THE NEXT ONE OPENS WITH `<`, so
    `useState<Foo>(null); // a comment … useRef<` matches the reader above as
    though it were a text node. Two such artifacts were in the first reading.
    Prose in a button does not carry a statement terminator, an assignment or a
    line comment, so those three are what separates text from code here — and
    the population floor below is what stops this filter from quietly emptying
    the arm instead of narrowing it.
  */
  const CODE_MARKERS = /[;=]|\/\//;

  const prose = FILES.flatMap((file) =>
    [...source(file).matchAll(JSX_TEXT)]
      .map((m) => ({ file, value: (m[1] ?? "").trim() }))
      .filter((row) => /[A-Za-z]/.test(row.value) && !CODE_MARKERS.test(row.value)),
  );

  it("has JSX text to read — the same floor, for the same reason", () => {
    /* Measured the day this landed: 63 text nodes. */
    expect(prose.length).toBeGreaterThanOrEqual(55);
  });

  it("and none of that text calls a person a model", () => {
    const offenders = prose.filter((row) => /\bmodels?\b/i.test(row.value));
    expect(
      offenders.map((row) => `${row.file}: "${row.value}"`),
      "JSX text on the canvas must say cast, never model (#1545) — this arm is here because FirstRunIntro slipped through without it",
    ).toEqual([]);
  });
});
