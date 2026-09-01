import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief 06's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/06-staff-tables.md`).
 *
 * His §8 is the definition of done and four of its lines are the ones a later
 * brief would casually undo: a surface hand-rolling rows again, a second
 * flexible column, an Actions column coming back, a destructive button losing
 * its consequence note. Those are what this file holds.
 *
 * ⚠ **THE POPULATION IS DERIVED, NOT TYPED.** Section 05's guard learned this
 * the hard way one card ago: a hand-written list of staff surfaces had the
 * same blind spot the mockup did, and missed a whole second header. Here the
 * population is *every file under `features/admin` and `features/moderator`
 * that mounts a `DataTable`* — so a twelfth surface, or a thirteenth, is
 * measured the moment it exists without anyone remembering to add it.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL.** An absence arm
 * alone is green when its subject is deleted and green when its own matcher is
 * wrong — both have happened in this repo (working law 2).
 *
 * **What a source read cannot see**, stated rather than implied: whether the
 * table actually fits at 1024px, whether an expansion animates, whether either
 * theme survives. Those were DRIVEN in the running app and recorded in
 * `docs/specs/STAFF_TABLES_396_EVIDENCE.md`.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const PAGES = path.resolve(CLIENT_SRC, "pages");
const ADMIN = path.resolve(CLIENT_SRC, "features/admin");
const MODERATOR = path.resolve(CLIENT_SRC, "features/moderator");

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PRIMITIVES = read("foundation/primitives.tsx");
const FOUNDATION_CSS = read("foundation/foundation.css");

/**
 * THE POPULATION — every file that mounts the shared table OR its head.
 *
 * Derived from `<DataTable` and `<TableHead` rather than from a list of
 * surface names, because the question every arm below asks is *"of the things
 * that draw a staff list, do they all obey the pattern"* — and a file that
 * draws rows without mounting `DataTable` is caught by the hand-rolling arm.
 *
 * ⚠ **`<TableHead` was added by the negative control, which is the only way it
 * could have been.** The first shape read `<DataTable` alone, so
 * `UserFilters.tsx` and `AuditLogsFilters.tsx` — the two files where the
 * separate Search button actually LIVED — were in no population at all: the
 * Search-button arm passed over a file it could not see, and the sabotage that
 * put the button back reddened nothing. **A surface's head is part of the
 * surface**, and 14 of 15 sabotages caught is what found it.
 */
const tableSurfaces = () => {
  const files: { name: string; text: string }[] = [];
  for (const dir of [ADMIN, MODERATOR, PAGES]) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".tsx")) continue;
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      if (text.includes("<DataTable") || text.includes("<TableHead")) {
        files.push({ name, text });
      }
    }
  }
  return files;
};

/** The staff pages, on section 05's own derivation. */
const staffPages = () =>
  fs
    .readdirSync(PAGES)
    .filter((name) => /^(Admin|Moderator).*\.tsx$/.test(name))
    .map((name) => ({ name, text: fs.readFileSync(path.join(PAGES, name), "utf8") }));

describe("brief 06 — the population is real", () => {
  it("finds every surface that mounts the shared table", () => {
    /*
      An absence assertion over an empty list is the cheapest false pass there
      is, and section 05's guard shipped FIVE of them one card ago — arms that
      passed over zero tabs and reported it in the words of a success. So the
      population is asserted before anything iterates it.

      Twelve is the count this brief converted: five admin lists, six
      moderation lists, and the admin blocked-IP list his §1 did not know
      about. The bar is "at least", because a thirteenth surface arriving is
      correct and must be MEASURED rather than rejected.
    */
    const surfaces = tableSurfaces();
    expect(surfaces.length, "the population reader found nothing").toBeGreaterThanOrEqual(12);

    /*
      And the two filter files are IN it — named, because they are the ones the
      population reader missed on its first shape and the reason it now reads
      `<TableHead` as well.
    */
    const names = surfaces.map((surface) => surface.name);
    expect(names, "the surfaces' heads must be measured too").toContain("UserFilters.tsx");
    expect(names).toContain("AuditLogsFilters.tsx");
  });
});

describe("brief 06 §8 — one pattern, and no surface hand-rolls rows", () => {
  it("no staff surface builds its own <table> or a row list of its own", () => {
    for (const { name, text } of [...tableSurfaces(), ...staffPages()]) {
      const source = code(text);
      expect(source, `${name} draws its own <table>`).not.toMatch(/<table[\s>]/);
      expect(
        source,
        `${name} has a horizontal scroller — a staff table that slides sideways hides columns behind an edge`,
      ).not.toContain("overflow-x-auto");
    }

    /* POSITIVE CONTROLS — both matchers fire on the shapes that were there. */
    expect('<div className="overflow-x-auto"><table className="w-full">').toMatch(/<table[\s>]/);
    expect('<div className="overflow-x-auto">').toContain("overflow-x-auto");
  });

  it("exactly one flexible column per table, and never two", () => {
    /*
      *"One flexible column is what makes eleven tables look like one table"*
      (§4). Two of them and the columns stop lining up between surfaces, which
      is the whole visual claim of this brief.
    */
    let checked = 0;
    for (const { name, text } of tableSurfaces()) {
      const source = code(text);
      for (const block of source.match(/columns=\{\[[\s\S]*?\]\}/g) ?? []) {
        checked += 1;
        const flexible = block.match(/width:\s*"1 1 0"/g) ?? [];
        expect(flexible.length, `${name} has ${flexible.length} flexible columns, not 1`).toBe(1);
      }
    }
    expect(checked, "the arm read no column lists at all").toBeGreaterThanOrEqual(10);

    /* POSITIVE CONTROL — the matcher counts two when there are two. */
    expect(
      'columns={[{ label: "A", width: "1 1 0" }, { label: "B", width: "1 1 0" }]}'.match(
        /width:\s*"1 1 0"/g,
      )?.length,
    ).toBe(2);
  });

  it("no surface keeps an Actions column", () => {
    /*
      *"Twelve rows, twelve identical Manage buttons — a column whose every
      cell is the same"* (§2). The column is gone; its actions live in the
      expansion.
    */
    for (const { name, text } of tableSurfaces()) {
      const source = code(text);
      expect(source, `${name} still declares an Actions column`).not.toMatch(
        /label:\s*"Actions"/i,
      );
    }

    /* POSITIVE CONTROL. */
    expect('{ label: "Actions", width: "0 0 92px" }').toMatch(/label:\s*"Actions"/i);
  });

  it("no control sits inside a row's cells", () => {
    /*
      The subtler form of the same rule: an Actions column with its header
      renamed is still an Actions column. Cells hold text, pills and dots —
      three kinds and only three (§4).
    */
    let checked = 0;
    for (const { name, text } of tableSurfaces()) {
      const source = code(text);
      for (const block of source.match(/cells:\s*\[[\s\S]*?\n\s{6}\]/g) ?? []) {
        checked += 1;
        expect(block, `${name} puts a Button in a row cell`).not.toMatch(/<Button[\s>]/);
        expect(block, `${name} puts a click handler in a row cell`).not.toContain("onClick=");
      }
    }
    expect(checked, "the arm read no cell lists at all").toBeGreaterThanOrEqual(10);

    /* POSITIVE CONTROLS. */
    expect("cells: [<Button size=\"small\">Manage</Button>]").toMatch(/<Button[\s>]/);
    expect('cells: [<span onClick={open}>x</span>]').toContain("onClick=");
  });
});

describe("brief 06 §5 — a destructive action cannot be written without its consequence", () => {
  it("the type refuses it, rather than a reviewer noticing", () => {
    const source = code(PRIMITIVES);
    const union = source.slice(source.indexOf("export type RowAction ="), source.indexOf("export type DataRow"));

    expect(union, "the arm is reading nothing").toContain("destructive: true");
    expect(
      union,
      "`consequence` must be required on the destructive arm — an optional one is a note that goes missing on the fourth surface",
    ).toMatch(/destructive:\s*true;\s*\n[\s\S]{0,200}?consequence:\s*string;/);
    expect(union, "consequence must not be optional").not.toMatch(/consequence\?:/);

    /* POSITIVE CONTROL — the optional matcher fires on the weaker shape. */
    expect("      consequence?: string;").toMatch(/consequence\?:/);
  });

  it("a link action cannot also be disabled — the shape is unrepresentable", () => {
    /*
      From the review of this card: an `<a>` has no disabled state, so
      `{ href, disabled }` would have type-checked, read ordinarily at the call
      site, and produced a control that says it is unavailable and navigates
      anyway. The link arm carries `disabled?: never`.
    */
    const source = code(PRIMITIVES);
    const union = source.slice(
      source.indexOf("export type RowAction ="),
      source.indexOf("export type DataRow"),
    );

    expect(union, "the arm is reading nothing").toContain("href: string;");
    expect(union, "a link action must not accept disabled").toContain("disabled?: never;");
    expect(union, "a button action must not accept href").toContain("href?: never;");
  });

  /*
    ⚠ **THE FIRST SHAPE OF THIS MATCHER COULD NOT TELL THE TWO CASES APART.**
    It was `key: "approve",[\s\S]{0,160}destructive: true`, and the wrong shape
    — approve as a plain primary followed immediately by a destructive deny —
    sits well inside 160 characters, so the positive control matched too. The
    matcher must not cross into the NEXT action, which is what the tempered
    `(?:(?!key:)…)` does.
  */
  const APPROVE_IS_DESTRUCTIVE = /key: "approve",(?:(?!key:)[\s\S])*?destructive: true/;

  it("the change-request approve button is the one the type guards", () => {
    /*
      Also from the review, and it is a real inversion: Deny closes a request
      and does nothing to the account it names, while APPROVE issues the Stripe
      refund. The compile-time guarantee was hung on the reversible half.
    */
    const source = code(read("features/admin/ChangeRequestList.tsx"));

    expect(source, "the arm is reading nothing").toContain("IRREVERSIBLE_TYPES");
    for (const type of ["stripe_refund", "refund_credits", "suspend_user"]) {
      expect(source, `${type} must be treated as irreversible on approve`).toContain(`"${type}"`);
    }
    expect(
      source,
      "the approve branch for an irreversible type must be the destructive one",
    ).toMatch(APPROVE_IS_DESTRUCTIVE);

    /* POSITIVE CONTROL — the matcher does not fire on the shape that was wrong. */
    expect(
      'key: "approve", onClick: onApprove, variant: "primary" }); actions.push({ key: "deny", destructive: true',
    ).not.toMatch(APPROVE_IS_DESTRUCTIVE);
  });

  it("no consequence note claims a control the product does not run", () => {
    /*
      ⚠ THE SHARPEST ARM HERE, AND IT EXISTS BECAUSE THIS CARD SHIPPED THE
      DEFECT INTO REVIEW.

      Two consequence sentences said blocking an IP "turns away everyone behind
      it". CLAUDE.md's "Currently not enforced" list says IP blocking is
      recorded and never checked, and it is true at the bytes: `isIpBlocked`
      has no request-path caller. A note describing an inert control as a live
      one is the worst possible use of a mechanism whose whole value is that it
      is accurate.

      ⚠ **AND IT WAS NARROW BY ONE INSTANCE, WHICH THE REVIEW OF THE FIX
      CAUGHT.** The first shape held only claims containing the word `block`,
      so the sentence *"Approving asks Slack to confirm"* walked straight past
      it — and `sendApprovalToSlack` **auto-approves when the admin-actions
      webhook is unconfigured**, which production's is. Same defect, same
      commit, one word away from the matcher. That is working law 7 exactly:
      the fix without its sweep is half done.

      **The population is now the enumerated set of controls CLAUDE.md's
      "Currently not enforced" list names as inert**, and each carries the
      phrases that would claim it works. Adding a row is how a later inert
      control joins; it is a small list on purpose, because a rule that tried
      to judge English generally is a rule nobody could satisfy.
    */
    const INERT_CONTROLS = [
      {
        control: "IP blocking",
        mentions: /\bblock/i,
        overclaims: /turns away|blocks .* for everyone|will be refused|cannot reach/i,
        why: "an IP block is recorded and never checked on the request path",
        specimen:
          "Blocking an IP turns away everyone behind it, which on a shared office network is more people.",
      },
      {
        control: "the Slack approval flow",
        mentions: /slack/i,
        /* "asks Slack to confirm" / "requires Slack confirmation" — the claim
           that a second person is in the loop. Saying the words WITH the
           caveat is fine, which is why the caveat's own phrasing is excluded
           below rather than the word "Slack" being banned. */
        overclaims: /asks Slack to confirm|requires Slack confirmation|wait for Slack approval/i,
        why: "the approval flow auto-approves when the admin-actions webhook is unconfigured, and production has none",
        specimen: "Approving asks Slack to confirm, and then signs this person out.",
      },
    ];

    /*
      ⚠ **IT READS EVERY USER-VISIBLE STRING, NOT ONLY THE ONES WRITTEN AT A
      `consequence:` KEY — AND THE NEGATIVE CONTROL IS WHAT FORCED THAT.**

      The first shape matched `consequence:` followed by a literal. Change
      requests writes `consequence: approvalConsequence(detail)` — a CALL — and
      composes its seven sentences inside a function, so the arm was blind to
      the entire file the second finding was about. It caught the IP-block
      sentence only because that one happened to be written inline.

      Comments are stripped first, so this file and the docblocks explaining
      the rule can quote the wrong sentences freely.
    */
    let read = 0;
    for (const { name, text } of tableSurfaces()) {
      const source = code(text);
      for (const match of source.matchAll(/["`]([^"`\n]{25,})["`]/g)) {
        const sentence = match[1];
        read += 1;
        for (const inert of INERT_CONTROLS) {
          if (!inert.mentions.test(sentence)) continue;
          expect(
            sentence,
            `${name}: ${inert.why} — this string claims otherwise`,
          ).not.toMatch(inert.overclaims);
        }
      }
    }
    expect(read, "the arm read no sentences at all").toBeGreaterThanOrEqual(20);

    /* POSITIVE CONTROLS — each matcher fires on the sentence that shipped. */
    for (const inert of INERT_CONTROLS) {
      expect(inert.specimen, `${inert.control}'s matcher is blind`).toMatch(inert.overclaims);
      expect(inert.specimen).toMatch(inert.mentions);
    }
  });

  it("every destructive action in the product carries a real sentence", () => {
    /*
      The type proves a string is PRESENT. This proves the strings are not the
      button label wearing a full stop: each is at least a clause long, and no
      two destructive actions in one file share one.
    */
    const seen: string[] = [];
    for (const { name, text } of tableSurfaces()) {
      for (const match of text.matchAll(/consequence:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)) {
        const sentence = match[1];
        expect(
          sentence.length,
          `${name} has a consequence note too short to say anything: "${sentence}"`,
        ).toBeGreaterThan(40);
        seen.push(sentence);
      }
    }
    expect(seen.length, "the arm found no consequence notes at all").toBeGreaterThanOrEqual(6);
    expect(new Set(seen).size, "two destructive actions share one consequence note").toBe(
      seen.length,
    );
  });
});

describe("brief 06 §6 — loading and empty are states, not gaps", () => {
  it("the table draws skeleton ROWS, never a centred spinner", () => {
    const source = code(PRIMITIVES);
    const table = source.slice(source.indexOf("export function DataTable("), source.indexOf("export function TableSearch("));

    expect(table, "the arm is reading nothing").toContain("loadingRows");
    expect(table, "loading must draw rows at row height").toMatch(
      /dp-table__rowgroup[\s\S]{0,200}dp-table__skeleton/,
    );
    expect(
      table,
      "an empty table must use EmptyState, so it says what is missing AND what to do",
    ).toContain("<EmptyState");

    /* The skeleton class must exist in the stylesheet, or the rows collapse. */
    expect(FOUNDATION_CSS).toContain(".dp-table__skeleton");
  });

  it("every surface says what is missing and what to do about it", () => {
    let checked = 0;
    for (const { name, text } of tableSurfaces()) {
      for (const block of text.match(/empty=\{\{[\s\S]*?\}\}/g) ?? []) {
        checked += 1;
        expect(block, `${name}'s empty state has no title`).toContain("title:");
        expect(block, `${name}'s empty state offers no next step`).toContain("body:");
      }
    }
    expect(checked, "the arm read no empty states at all").toBeGreaterThanOrEqual(10);
  });
});

describe("brief 06 §4 — status may carry accent, a role may never", () => {
  it("the colour rule lives in ONE function, so eleven surfaces cannot each decide it", () => {
    const staffTable = code(read("features/staff/staffTable.tsx"));
    expect(staffTable, "the arm is reading nothing").toContain("export function StatePill");
    expect(
      staffTable,
      "RolePill must be greyscale by construction — not by a caller passing attention={false}",
    ).toMatch(/export function RolePill[\s\S]{0,300}tone="neutral"/);
    expect(
      staffTable.slice(staffTable.indexOf("export function RolePill")),
      "RolePill must not take an attention argument at all",
    ).not.toContain("attention");
  });

  it("no surface tints a role pill itself", () => {
    for (const { name, text } of tableSurfaces()) {
      const source = code(text);
      expect(source, `${name} passes attention to a role pill`).not.toMatch(
        /<RolePill[^>]*attention/,
      );
    }

    /* POSITIVE CONTROL. */
    expect("<RolePill role={u.role} attention />").toMatch(/<RolePill[^>]*attention/);
  });
});

describe("brief 06 §7 — the four detail surfaces are DELETED, not orphaned", () => {
  it("none of them exists anywhere in the client", () => {
    /*
      *"If `UserDetailModal` still exists at the end, this failed."* A file
      left behind with no importer is the dead-code shape this repo has spent
      a month digging out, so the arm reads the FILESYSTEM rather than the
      import graph — a deleted export and a kept file look identical to a
      grep for the symbol.
    */
    const gone = [
      "features/admin/UserDetailModal.tsx",
      "features/admin/AuditLogDetailModal.tsx",
      "features/admin/ChangeRequestDetail.tsx",
      "features/moderator/LogDetailModal.tsx",
    ];
    for (const relative of gone) {
      expect(
        fs.existsSync(path.resolve(CLIENT_SRC, relative)),
        `${relative} still exists`,
      ).toBe(false);
    }

    /* POSITIVE CONTROL — the existence check is not simply always false. */
    expect(fs.existsSync(path.resolve(CLIENT_SRC, "foundation/primitives.tsx"))).toBe(true);
  });

  it("nothing imports them, including the feature barrels", () => {
    const names = ["UserDetailModal", "AuditLogDetailModal", "ChangeRequestDetail", "LogDetailModal"];
    for (const dir of [ADMIN, MODERATOR, PAGES]) {
      for (const file of fs.readdirSync(dir)) {
        if (!/\.tsx?$/.test(file)) continue;
        const source = code(fs.readFileSync(path.join(dir, file), "utf8"));
        for (const name of names) {
          expect(source, `${file} still references ${name}`).not.toContain(`from "./${name}"`);
          expect(source, `${file} still references ${name}`).not.toContain(`/${name}"`);
        }
      }
    }

    /* POSITIVE CONTROL. */
    expect('export { UserDetailModal } from "./UserDetailModal";').toContain(
      'from "./UserDetailModal"',
    );
  });

  it("the form modals that SHOULD survive are still here", () => {
    /*
      The other half of the rule, and the one an over-eager sweep would break:
      a dialog is right for "type a reason and confirm". Deleting these would
      take the reason field off a suspension.
    */
    for (const relative of [
      "features/admin/UserActionModals.tsx",
      "features/admin/ReviewModal.tsx",
      "features/admin/AuditActionModals.tsx",
      "features/moderator/ChangeRequestModal.tsx",
    ]) {
      expect(
        fs.existsSync(path.resolve(CLIENT_SRC, relative)),
        `${relative} is a FORM modal and must survive`,
      ).toBe(true);
    }
  });
});

describe("brief 06 §3 — search is real where the feature is real", () => {
  it("the table's search is an input, and the topbar's stub is still a span", () => {
    const source = code(PRIMITIVES);
    const search = source.slice(source.indexOf("export function TableSearch("), source.indexOf("export type FilterOption"));

    expect(search, "the arm is reading nothing").toContain("dp-tablesearch");
    expect(search, "TableSearch must render a real input").toContain("<input");
    expect(search, "typing must filter as you go").toContain("setTimeout");

    /* The stub the founder ruled on stays a span — this brief must not have
       converted the topbar by copying a shape one file over. */
    const stubs = code(read("foundation/ChromeStubs.tsx"));
    const stub = stubs.slice(stubs.indexOf("export function SearchStub"));
    expect(stub, "the global search stub must remain a span, not an input").not.toContain("<input");
  });

  it("no surface keeps a separate Search button", () => {
    /*
      *"It is a filled bg-[#0A0A0A] — the app's primary-action treatment —
      spent on submitting a search box."* Enter submits; the button is gone.
    */
    for (const { name, text } of [...tableSurfaces(), ...staffPages()]) {
      const source = code(text);
      expect(source, `${name} still has a Search button`).not.toMatch(
        /<Button[^>]*>[\s\n]*Search[\s\n]*<\/Button>/,
      );
    }

    /* POSITIVE CONTROL. */
    expect("<Button onClick={onSearch}>\n            Search\n          </Button>").toMatch(
      /<Button[^>]*>[\s\n]*Search[\s\n]*<\/Button>/,
    );
  });
});

describe("brief 06 §4 — the facts grid survives a 64-character value", () => {
  it("fact values break anywhere", () => {
    /*
      Not tidiness: these are ids, hashes, IPs, emails and user agents. One
      unbroken value otherwise blows the grid open and the table beside it.
    */
    const block = FOUNDATION_CSS.slice(
      FOUNDATION_CSS.indexOf(".dp-table__factvalue"),
      FOUNDATION_CSS.indexOf(".dp-table__evidence"),
    );
    expect(block, "the arm is reading nothing").toContain("font:");
    expect(block, "fact values must break-all").toContain("word-break: break-all");
  });
});
