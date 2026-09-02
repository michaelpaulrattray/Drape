import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief 09's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/09-moderator-investigations.md`).
 *
 * His §8 is the definition of done, and §7 is a list of nine things not to do.
 * What is held here is the half a later brief would casually undo: a green
 * coming back, the discrepancy sliding down the page or appearing twice, a
 * `grid-cols-2` returning, `ml-auto` returning, a second confirm dialog, an
 * "account in good standing" card.
 *
 * ⚠ **THE POPULATION IS DERIVED, NOT TYPED** — every `.tsx` in this directory
 * plus the page that mounts them. A seventh surface here is measured the moment
 * it exists. Three consecutive briefs have now had a typed population miss
 * something, most recently this one: `UserInvestigationWidgets.tsx` hand-rolled
 * a table through the brief that banned hand-rolled tables, because brief 06's
 * arm read a population derived from what a file MOUNTS.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL.** An absence arm
 * alone is green when its subject is deleted and green when its own matcher is
 * wrong — both have happened in this repo (working law 2).
 *
 * **What a source read cannot see**, stated rather than implied: whether the
 * verdict figure is actually the largest thing on screen, whether the evidence
 * columns collapse at 1024, whether either theme survives, whether the
 * unfreeze dialog arms only after typing. Those were DRIVEN in the running app
 * and recorded in `docs/specs/MODERATOR_INVESTIGATIONS_399_EVIDENCE.md`.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const PAGE = path.resolve(CLIENT_SRC, "pages/ModeratorDashboard.tsx");

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CSS = read(path.join(HERE, "investigations.css"));
const RECONCILIATION = read(path.join(HERE, "ReconciliationSubTab.tsx"));
const FLAGGED = read(path.join(HERE, "FlaggedDiscrepanciesCard.tsx"));
const WIDGETS = read(path.join(HERE, "UserInvestigationWidgets.tsx"));
const FOUNDATION_CSS = read(path.resolve(CLIENT_SRC, "foundation/foundation.css"));
const PRIMITIVES = read(path.resolve(CLIENT_SRC, "foundation/primitives.tsx"));

/**
 * THE POPULATION — every component under `features/moderator`, plus its page.
 *
 * ⚠ `ChangeRequestModal.tsx` is deliberately IN it. It is one of the five staff
 * FORM modals no brief owns, so the colour arm below cannot hold it yet — but
 * the structural arms (no second dialog shell, no `ml-auto`) apply to every
 * file on the surface, and excluding it by name is how a file stops being
 * measured at all.
 */
const section = (): { name: string; text: string }[] => {
  const files = fs
    .readdirSync(HERE)
    .filter((n) => n.endsWith(".tsx") && !n.includes(".test."))
    .map((n) => ({ name: n, text: read(path.join(HERE, n)) }));
  files.push({ name: "ModeratorDashboard.tsx", text: read(PAGE) });
  return files;
};

/** The six files brief 09 rebuilt — the colour and type bar applies to these. */
const REBUILT = [
  "CreditsSubTab.tsx",
  "FlaggedDiscrepanciesCard.tsx",
  "ReconciliationSubTab.tsx",
  "StatsCards.tsx",
  "UserInvestigationTab.tsx",
  "UserInvestigationWidgets.tsx",
];

const rebuilt = () => REBUILT.map((n) => ({ name: n, text: read(path.join(HERE, n)) }));

describe("brief 09 — the population is real", () => {
  it("finds every moderator surface and its page", () => {
    /*
      An absence assertion over an empty list is the cheapest false pass there
      is, and section 05's guard shipped five of them. So the population is
      asserted before anything iterates it.
    */
    const names = section().map((f) => f.name);
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const required of [...REBUILT, "ModeratorDashboard.tsx"]) {
      expect(names, `${required} is not in the population`).toContain(required);
    }
  });

  it("the six rebuilt files all exist and are readable", () => {
    for (const { name, text } of rebuilt()) {
      expect(text.length, `${name} is empty`).toBeGreaterThan(200);
    }
  });
});

describe("brief 09 §3, §7 — no green, and colour is not the encoding", () => {
  /*
    His §7, first line: *"Do not use green. Not for earned, not for refunds, not
    for 'all clear', not for a confirm button."* And §3's argument, which is the
    one that matters: *"when everything is coloured, the discrepancy is not."*
  */
  const BANNED = [
    "emerald",
    "text-green",
    "bg-green",
    "border-green",
    "amber",
    "text-red-",
    "bg-red-",
    "border-red-",
    "text-blue-",
    "bg-blue-",
    "border-blue-",
    "purple",
    "orange",
    "yellow",
  ];

  it("no Tailwind tint survives on any rebuilt surface", () => {
    for (const { name, text } of rebuilt()) {
      const source = code(text);
      for (const token of BANNED) {
        expect(source, `${name} still paints with ${token}`).not.toContain(token);
      }
    }
    /* POSITIVE CONTROLS — the shapes that were actually there. */
    expect(code('<div className="bg-emerald-600" />')).toContain("emerald");
    expect(code('<span className="text-red-700" />')).toContain("text-red-");
    expect(code('<span className="bg-purple-500" />')).toContain("purple");
  });

  it("no hex literal survives on any rebuilt surface or in the sheet", () => {
    const HEX = /#[0-9a-fA-F]{3,8}\b/g;
    for (const { name, text } of [...rebuilt(), { name: "investigations.css", text: CSS }]) {
      const found = code(text).match(HEX) ?? [];
      expect(found, `${name} holds a hex literal: ${found.join(", ")}`).toHaveLength(0);
    }
    expect(code("color: #BADA55;").match(HEX)).toHaveLength(1);
  });

  it("the discrepancy is the only thing wearing the error colour", () => {
    /*
      `--errorInk` on exactly two rules: the verdict figure when non-zero, and
      the flagged row's figure — every row of which IS the fault. A third would
      mean the one number that says "something is wrong" has company again.
    */
    const errorRules = CSS.split("\n").filter((line) => line.includes("var(--errorInk)"));
    expect(errorRules).toHaveLength(2);
    expect(CSS).toContain(".dp-inv__verdictvalue--fault { color: var(--errorInk); }");

    /*
      ⚠ ANCHORED — brief 07's finding, one section over: `--error` sets borders
      and fills, `--errorInk` sets text, and plain `--error` on the dark surface
      measures 3.40:1. `color:` is a substring of `border-color:`, so the check
      must anchor or it passes over the very thing it bans.
    */
    for (const line of CSS.split("\n")) {
      const trimmed = line.trim();
      expect(trimmed.startsWith("color: var(--error)"), `${trimmed} — text in --error`).toBe(false);
    }
    expect("color: var(--error);".startsWith("color: var(--error)")).toBe(true);
    expect("border-color: var(--error);".startsWith("color: var(--error)")).toBe(false);
  });
});

describe("brief 09 §2, §4b, §4d — verdict before workings, and once", () => {
  it("the discrepancy figure is drawn once — in the verdict, never in the workings", () => {
    /*
      His §4d: *"The discrepancy row is DELETED from this card. It is the
      verdict, it is at the top at 30px, and repeating it at the bottom in 12px
      is the same double-count the Crew work removed."*

      ⚠ **THE FIRST SHAPE OF THIS ARM COUNTED READS OF `reconciliation
      .discrepancy` AND EXPECTED ONE. It found two and was WRONG** — because his
      own §4b headline is *"`1,240 credits unaccounted for.`"*, a sentence that
      names the amount, sitting beside the figure that states it. Both are the
      verdict block; neither is the double-count he is describing.

      So the arm asserts the STRUCTURE rather than a count (the magic-number
      lesson): the figure appears once inside the verdict, and the workings card
      does not mention it at all. A count would also have gone stale the first
      time the headline was reworded.
    */
    const source = code(RECONCILIATION);

    /* The workings card — from its own eyebrow to the end of the file. */
    const workingsStart = source.indexOf('<TableHead eyebrow="Reconciliation" />');
    expect(workingsStart, "the workings card is gone").toBeGreaterThan(-1);
    const workings = source.slice(workingsStart);
    expect(workings, "the discrepancy is back in the workings").not.toContain("discrepancy");
    expect(workings).not.toMatch(/label="Discrepancy"/);

    /*
      And the figure ELEMENT is drawn exactly once. Counting the class name
      would have counted its own modifier and pinned a fixture at 2.
    */
    const figures = source.match(/className=\{`dp-inv__verdictvalue/g) ?? [];
    expect(figures.length, "the 30px figure element is not drawn exactly once").toBe(1);

    /* POSITIVE CONTROLS — both matchers fire on the shapes that were there. */
    expect('<LeaderRow label="Discrepancy" value={x} />').toMatch(/label="Discrepancy"/);
    expect('<td>{reconciliation.discrepancy}</td>').toContain("discrepancy");
  });

  it("the workings end at Recorded charges", () => {
    const source = code(RECONCILIATION);
    const recorded = source.indexOf("Recorded charges (all records)");
    expect(recorded, "the Recorded charges row is gone").toBeGreaterThan(-1);
    /* Nothing but the closing markup may follow it inside the workings card. */
    expect(source.slice(recorded)).not.toContain("<LeaderRow");
  });

  it("the verdict is above the evidence in source order", () => {
    const source = code(RECONCILIATION);
    const verdict = source.indexOf("dp-inv__verdict");
    const columns = source.indexOf("dp-inv__columns");
    expect(verdict).toBeGreaterThan(-1);
    expect(columns).toBeGreaterThan(-1);
    expect(verdict, "the evidence columns come before the verdict").toBeLessThan(columns);
  });

  it("the verdict figure is 30px mono and nothing else on the surface is", () => {
    expect(CSS).toContain("font: 500 30px var(--font-mono)");
    const large = CSS.match(/font:\s*\d+\s*(2[5-9]|[3-9]\d)px/g) ?? [];
    expect(large, `more than one large figure: ${large.join(", ")}`).toHaveLength(1);
  });

  it("a zero figure carries no sign, and the minus is the real one", () => {
    /*
      ⚠ **CAUGHT BY LOOKING AT A FRAME, NOT BY AN ARM.** The first shape wrote
      the minus unconditionally for a spend, so an account that has never spent
      anything read **`−0`** — a number that does not exist, printed in the one
      pane whose whole job is arithmetic. Twenty-eight source arms and ninety
      driven readings all passed over it.

      And the sign is U+2212, not the hyphen `toLocaleString` returns: under a
      column of `+` signs at mono 400 a hyphen is visibly the wrong length.
    */
    const source = code(RECONCILIATION);
    expect(source).toContain('if (n === 0) return "0";');
    expect(source).toContain('const negated = (n: number): string => (n === 0 ? "0"');

    /* The real minus, and no ASCII hyphen doing its job in a template. */
    expect(source).toContain("−");
    expect(source, "an ASCII hyphen is standing in for the minus sign").not.toMatch(
      /`-\$\{formatNumber/,
    );
    /* POSITIVE CONTROL — the matcher fires on the shape that was there. */
    expect("value={`-${formatNumber(credits.totalSpent)}`}").toMatch(/`-\$\{formatNumber/);
  });

  it("`The ledgers agree.` is the clean headline, and it carries no colour", () => {
    expect(code(RECONCILIATION)).toContain("The ledgers agree.");
    expect(code(RECONCILIATION)).not.toContain("All Clear");
    /*
      The clean verdict block takes NO modifier class, so it inherits
      `--borderCard` on `--surface` — his §4b's *"Clean"* row.
    */
    expect(code(RECONCILIATION)).toContain('      : "dp-inv__verdict";');
  });
});

describe("brief 09 §7 — the nine things not to do", () => {
  it("no `grid-cols-2`, and the evidence columns are auto-fit with a minmax", () => {
    for (const { name, text } of rebuilt()) {
      expect(code(text), `${name} uses grid-cols-2`).not.toContain("grid-cols-2");
    }
    expect(CSS).toContain("repeat(auto-fit, minmax(292px, 1fr))");
    /* Every grid in the sheet, not only the one the brief names. */
    for (const line of CSS.split("\n")) {
      if (!line.includes("grid-template-columns")) continue;
      expect(line, `${line.trim()} — a fixed track count`).toContain("auto-fit");
      expect(line, `${line.trim()} — auto-fit with no minmax collapses`).toContain("minmax");
    }
    expect('className="grid grid-cols-2"').toContain("grid-cols-2");
  });

  it("no `ml-auto` anywhere on the surface — a spacer instead", () => {
    for (const { name, text } of section()) {
      expect(code(text), `${name} uses ml-auto`).not.toContain("ml-auto");
    }
    expect(CSS).toContain(".dp-inv__filterspacer { flex: 1; }");
    expect('<div className="ml-auto">').toContain("ml-auto");
  });

  it("no second confirm dialog, second pager or second table", () => {
    for (const { name, text } of rebuilt()) {
      const source = code(text);
      expect(source, `${name} draws its own <table>`).not.toMatch(/<table[\s>]/);
      expect(source, `${name} has a horizontal scroller`).not.toContain("overflow-x-auto");
      expect(source, `${name} builds a second dialog shell`).not.toMatch(/<DialogContent[\s>]/);
      expect(source, `${name} builds a second pager`).not.toContain("ChevronRight");
    }
    /* POSITIVE CONTROLS — each matcher fires on the shape that was there. */
    expect('<table className="w-full">').toMatch(/<table[\s>]/);
    expect('<DialogContent className="bg-white">').toMatch(/<DialogContent[\s>]/);
  });

  it("no Actions column on the investigation list", () => {
    /*
      ⚠ Brief 06 §8 banned it and this file kept one for three briefs, because
      that guard's population could not contain a file that does not mount the
      table. `section06-guard.test.ts` now reads the directory; this arm holds
      the specific offender so the regression has a named owner too.
    */
    const source = code(WIDGETS);
    expect(source).not.toMatch(/label:\s*"Actions"/);
    expect('{ label: "Actions", width: "0 0 64px" }').toMatch(/label:\s*"Actions"/);
  });

  it("no `account in good standing` card — the band is conditional", () => {
    const source = code(RECONCILIATION);
    expect(source).toContain("{isFrozen && (");
    expect(source).not.toMatch(/good standing/i);
    expect("Account in good standing").toMatch(/good standing/i);
  });
});

describe("brief 09 §5 — dashed while unresolved, and no dead state", () => {
  it("the flagged card is dashed, and its only variant is the empty one", () => {
    expect(CSS).toContain("border: 1px dashed var(--dashed);");
    expect(CSS).toContain(".dp-inv__flagged--clear { border-style: solid;");
    /*
      ⚠ There is no `--handled` / `--solid` row-level variant, and that absence
      is the finding rather than an omission: nothing on this card can be
      handled in place, so a solid state would be a branch no data reaches.
    */
    expect(CSS).not.toContain(".dp-inv__flaggedrow--handled");
    expect(code(FLAGGED)).not.toContain("handled");
  });

  it("the severity ladder is gone", () => {
    const source = code(FLAGGED);
    expect(source).not.toContain("critical");
    expect(source).not.toContain("severity");
    expect('const severity = absDisc >= 2000 ? "critical" : "warning";').toContain("severity");
  });

  it("every flagged row links through with the SEARCH STRING, not the id alone", () => {
    /*
      ⚠ **THE ARM THAT USED TO LIVE HERE ASSERTED `onSelectUser(user.userId)` IS
      CALLED, AND THAT IS NOT THE QUESTION** (#412 review, finding 1).

      This PR moved the investigation inside the account's ROW, so selecting an
      id that is not on the visible page opens nothing — no error, no hint, on
      the one path this card exists for. The old arm passed over that happily:
      it could see the call and not the destination.

      ⚠ And the obvious repair does not work either: `listUsers` matches `name`,
      `email` and `openId` (`server/db/admin.ts`) and **never the numeric id**,
      so searching `String(userId)` finds nothing. The identity has to be the
      email, with the name as the fallback.
    */
    const source = code(FLAGGED);
    expect(source).toContain("onSelectUser(user.userId, user.email ?? user.userName)");
    expect(source).toContain("onSelectUser: (userId: number, identity: string | null) => void");

    /* And the page must actually use it to widen the list before selecting. */
    const page = read(PAGE);
    expect(page).toContain("setUserSearchQuery(identity ?? \"\")");
    expect(page).toContain("setUserPage(() => 0)");
    const handler = page.slice(page.indexOf("<FlaggedDiscrepanciesCard"));
    const select = handler.indexOf("setSelectedUserId(userId)");
    const search = handler.indexOf("setUserSearchQuery");
    expect(search, "the search is set AFTER the selection — the row is not in the list yet").toBeLessThan(select);

    /* POSITIVE CONTROL — the id-only shape, which is what was there. */
    expect("onClick={() => onSelectUser(user.userId)}").not.toContain("identity");
  });

  it("no surface claims a search by id — the server does not do one", () => {
    /*
      The placeholder read *"Search users by name, email, or ID…"* and typing an
      id returned nothing: a control naming a capability we do not have, which
      is `BRIEF-RECONCILIATION.md`'s question 4 and the founder's own ruling on
      the centred search.
    */
    for (const { name, text } of rebuilt()) {
      expect(code(text), `${name} still offers a search by id`).not.toMatch(/email,? or id/i);
    }
    expect('placeholder="Name, email or id"').toMatch(/email,? or id/i);
  });

  it("the flagged figures carry the pane's own sign and grouping rules", () => {
    /*
      Law 7's sweep, one file over (#412 review, finding 3). A discrepancy is
      flagged in BOTH directions, so a negative one is reachable and was
      rendering `-1240` — an ASCII hyphen and no thousands separator — on the
      same page where the pane insists on U+2212 and `toLocaleString`.
    */
    const source = code(FLAGGED);
    expect(source).toContain("{signed(user.discrepancy)}");
    expect(source).toContain('if (n === 0) return "0";');
    expect(source).toContain("grouped(user.grossDeductions)");
    expect(source, "an unformatted figure is back").not.toMatch(/\{user\.(discrepancy|grossDeductions|expectedCost)\}/);
    /* POSITIVE CONTROL — the raw shapes that were there. */
    expect("{user.discrepancy}").toMatch(/\{user\.(discrepancy|grossDeductions|expectedCost)\}/);
  });
});

describe("brief 09 §6 — type and tokens", () => {
  it("nothing is below 10.5px, except an uppercase mono eyebrow at 9px", () => {
    /*
      His §6: *"Nothing below 10.5px. `text-[10px]` and `text-[9px]` appear
      throughout; the floor is 10.5px for mono meta and 8.5px for uppercase mono
      eyebrows only."*
    */
    const sizes = [...CSS.matchAll(/font:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length, "no font sizes found — the matcher is wrong").toBeGreaterThan(10);
    const small = sizes.filter((s) => s < 10.5);
    /* The eyebrow, and only the eyebrow. */
    expect(small.every((s) => s >= 8.5), `a size below the 8.5px floor: ${small.join(", ")}`).toBe(true);
    for (const size of small) {
      expect(
        CSS.includes(`font: 500 ${size}px var(--font-mono)`),
        `${size}px is below 10.5 and is not an uppercase mono eyebrow`,
      ).toBe(true);
    }
    expect([...("font: 400 9px var(--font-sans)".matchAll(/font:[^;]*?(\d+(?:\.\d+)?)px/g))]).toHaveLength(1);
  });

  it("no arbitrary Tailwind text size survives", () => {
    for (const { name, text } of rebuilt()) {
      expect(code(text), `${name} sizes text by arbitrary value`).not.toMatch(/text-\[\d/);
    }
    expect('className="text-[10px]"').toMatch(/text-\[\d/);
  });

  it("every measured value is JetBrains Mono via the token, never Tailwind's font-mono", () => {
    for (const { name, text } of rebuilt()) {
      expect(code(text), `${name} uses Tailwind font-mono`).not.toContain("font-mono");
    }
    expect(CSS).toContain("var(--font-mono)");
    expect('<span className="font-mono">').toContain("font-mono");
  });

  it("no weight above 500 anywhere in the sheet", () => {
    /* The foundation forbids 600+; the webfonts ship it and it is never used. */
    const weights = [...CSS.matchAll(/font:\s*(\d{3})\s/g)].map((m) => Number(m[1]));
    expect(weights.length).toBeGreaterThan(10);
    expect(Math.max(...weights)).toBeLessThanOrEqual(500);
    for (const { name, text } of rebuilt()) {
      expect(code(text), `${name} uses font-semibold`).not.toContain("font-semibold");
      expect(code(text), `${name} uses font-bold`).not.toContain("font-bold");
    }
    expect('<p className="font-semibold">').toContain("font-semibold");
  });

  it("the primitives are the foundation's, not shadcn's", () => {
    for (const { name, text } of rebuilt()) {
      const source = code(text);
      expect(source, `${name} imports shadcn's skeleton`).not.toContain("@/components/ui/skeleton");
      expect(source, `${name} imports shadcn's badge`).not.toContain("@/components/ui/badge");
      expect(source, `${name} imports shadcn's button`).not.toContain("@/components/ui/button");
      expect(source, `${name} imports shadcn's dialog`).not.toContain("@/components/ui/dialog");
    }
    expect('import { Skeleton } from "@/components/ui/skeleton";').toContain(
      "@/components/ui/skeleton",
    );
  });
});

describe("brief 09 §4a, §9 — the promoted dialog and the promoted row", () => {
  it("the confirm dialog owns the required note, and both consumers use it", () => {
    /*
      His §4a asked for *"the promoted confirm dialog, with the notes field
      inside it"*. Two real consumers land with it, which is what
      `PROMOTION-PASS.md` asks of a foundation addition.
    */
    const dialog = read(path.resolve(CLIENT_SRC, "foundation/ConfirmDialog.tsx"));
    expect(dialog).toContain("notes?: { label: string; placeholder: string; maxLength: number }");
    expect(dialog).toContain("const armed = !notes || typed.trim().length > 0;");
    expect(dialog, "the trap must include the textarea it now contains").toContain(
      'querySelectorAll<HTMLElement>("button, textarea")',
    );
    expect(code(RECONCILIATION)).toContain("<ConfirmDialog");
    expect(code(WIDGETS)).toContain("<ConfirmDialog");
  });

  it("the confirm is inert until the note is typed, and the counter cannot drift", () => {
    const dialog = read(path.resolve(CLIENT_SRC, "foundation/ConfirmDialog.tsx"));
    expect(dialog).toContain("disabled={busy || !armed}");
    /* Counter and cap read the SAME prop — the third-copy defect from #396. */
    expect(dialog).toContain("{typed.length}/{notes.maxLength}");
    expect(dialog).toContain("maxLength={notes.maxLength}");
  });

  it("no green confirm survives on either freeze path", () => {
    for (const { name, text } of [
      { name: "ReconciliationSubTab.tsx", text: RECONCILIATION },
      { name: "UserInvestigationWidgets.tsx", text: WIDGETS },
    ]) {
      expect(code(text), `${name} still has a green confirm`).not.toContain("emerald");
    }
    expect('className="bg-emerald-600"').toContain("emerald");
  });

  it("LeaderRow is in the foundation and cannot bolden a figure", () => {
    expect(PRIMITIVES).toContain("export function LeaderRow(");
    expect(FOUNDATION_CSS).toContain(".dp-leader--subtotal .dp-leader__label { font-weight: 500; }");
    /*
      ⚠ The weight goes on the LABEL and the type offers no way to move it — his
      §6: *"No `font-medium` doing the work of a subtotal."* A `bold` or
      `strong` prop would be the reintroduction.
    */
    expect(PRIMITIVES).not.toMatch(/LeaderRow[\s\S]{0,900}?\bbold\?:/);
    expect(FOUNDATION_CSS).not.toContain(".dp-leader__value { font-weight: 500");
  });

  it("the leader row is not defined twice under this section", () => {
    /* The whole point of promoting it. The sheet may reference it; not define it. */
    expect(CSS).not.toContain(".dp-inv__leader {");
    expect(CSS).not.toContain(".dp-inv__leadervalue {");
  });
});
