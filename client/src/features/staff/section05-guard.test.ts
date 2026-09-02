import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief 05's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/05-staff-shell.md`).
 *
 * The card's acceptance test is *"same data, same actions, same everything —
 * new frame"*, and the four later staff briefs (#396–#399) are all written
 * against what this one leaves behind. So the things most worth pinning are
 * the ones a later brief would casually undo: a page re-growing its own
 * `min-h-screen`, a tenth surface arriving with a second bar, the `Studio`
 * button coming back because somebody missed the rail.
 *
 * These are SOURCE guards, in the shape of `section02-guard.test.ts`. Their
 * limit is stated rather than implied: **a source read cannot see a rendered
 * page**, so the things that decide whether the frame actually works — does
 * the bar hold while a 4,000-row table scrolls under it, does it wrap at 1024,
 * does either theme survive — were DRIVEN in the running app and recorded in
 * `docs/specs/STAFF_SHELL_395_EVIDENCE.md`. The same instrument was run
 * against `main`, where it fails 44 readings, which is what makes the branch's
 * 56 passes mean something.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL** — a synthetic
 * string the same matcher must reject. An absence arm alone is green when its
 * subject is deleted and green when its own regex is wrong; both have happened
 * here (working law 2).
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const PAGES = path.resolve(CLIENT_SRC, "pages");

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const STAFF_BAR = read("features/staff/StaffBar.tsx");
const STAFF_SURFACE = read("features/staff/StaffSurface.tsx");
const PRIMITIVES = read("foundation/primitives.tsx");
const FOUNDATION_CSS = read("foundation/foundation.css");
const MODERATOR = read("pages/ModeratorDashboard.tsx");
const MODERATOR_TABS = read("features/moderator/moderatorTabs.ts");

/**
 * THE POPULATION — the nine staff pages, derived from the pages folder rather
 * than typed out.
 *
 * ⚠ It is derived because a typed list is the failure this whole brief is
 * about: `AdminHeader` was one component and `ModeratorHeader` was its
 * forgotten twin, and a hand-written population would have had the same blind
 * spot the mockup did. Anything named `Admin*` or `Moderator*` under `pages/`
 * is a staff page and is measured.
 */
const staffPages = () =>
  fs
    .readdirSync(PAGES)
    .filter((name) => /^(Admin|Moderator).*\.tsx$/.test(name))
    .map((name) => ({ name, text: fs.readFileSync(path.join(PAGES, name), "utf8") }));

describe("brief 05 — the population is real", () => {
  it("finds all nine staff pages", () => {
    /*
      An absence assertion over an empty list is the cheapest false pass there
      is. Every arm below iterates this population, so the population is
      asserted first — rename the folder or break the glob and these arms would
      otherwise report the frame is perfect.
    */
    const names = staffPages().map((p) => p.name);
    expect(names.length, `staff pages found: ${names.join(", ")}`).toBe(9);
    expect(names).toContain("ModeratorDashboard.tsx");
    expect(names).toContain("AdminBugReports.tsx");
  });
});

describe("brief 05 §3 — the shell owns the page, not the page", () => {
  it("no staff page sets min-h-screen, a page background, or its own max-w column", () => {
    const offenders = staffPages()
      .map(({ name, text }) => {
        const body = code(text);
        const hits: string[] = [];
        if (/min-h-screen/.test(body)) hits.push("min-h-screen");
        if (/max-w-(3xl|5xl|7xl)/.test(body)) hits.push("max-w-*");
        /*
          ⚠ THE PAGE BACKGROUND, NOT EVERY BACKGROUND. The first shape of this
          arm matched any `bg-[#…]` and flagged five pages for button and chip
          colours — content the brief explicitly DEFERS to briefs 06–09
          (*"expect to find hard-coded light values inside page content, and log
          them for the later briefs rather than fixing them here"*). An arm that
          fails on work the card forbids is an arm pushing the next shift to
          break the card.

          `#EBEBEB` is the specific value: it is the page colour all nine wrapped
          themselves in, and the shell owns it now. The surviving content hexes
          are counted and listed in the evidence doc rather than banned here.
        */
        if (/bg-\[#EBEBEB\]/i.test(body)) hits.push("the page background (#EBEBEB)");
        return hits.length ? `${name}: ${hits.join(", ")}` : null;
      })
      .filter(Boolean);

    expect(
      offenders,
      "The shell owns the page height, the page background and the content column.\n" +
        "A page stating any of them is brief 05 §3 undone:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("POSITIVE CONTROL — the same matchers reject a page that has them back", () => {
    const sabotage = `export default function X() {
      return <div className="min-h-screen bg-[#EBEBEB]"><main className="max-w-7xl mx-auto" /></div>;
    }`;
    expect(/min-h-screen/.test(code(sabotage))).toBe(true);
    expect(/max-w-(3xl|5xl|7xl)/.test(code(sabotage))).toBe(true);
    expect(/bg-\[#EBEBEB\]/i.test(code(sabotage))).toBe(true);
  });

  it("every staff page mounts the shared frame — except the specimen sheet, by his ruling", () => {
    /*
      `AdminFoundation` is deliberately outside `StaffSurface`: it is a
      component specimen, not a staff surface, and the founder ruled it gets no
      tab. Putting it in the frame would draw a staff bar whose tabs do not
      contain the page you are on.
    */
    const missing = staffPages()
      .filter(({ name }) => name !== "AdminFoundation.tsx")
      .filter(({ text }) => !/<StaffSurface[\s\n]/.test(code(text)))
      .map(({ name }) => name);
    expect(missing, `these pages do not mount StaffSurface:\n${missing.join("\n")}`).toEqual([]);

    expect(code(read("pages/AdminFoundation.tsx"))).not.toMatch(/<StaffSurface[\s\n]/);
  });

  it("the frame clips and the pane scrolls — the bar cannot scroll away", () => {
    /*
      §3's whole reason: staff surfaces are working tools, so the bar stays put
      while a 4,000-row audit table moves under it. Source can prove the two
      declarations exist; only the drive can prove the bar held, and it did
      (bar top 56px → 56px after the pane scrolled 1,475px).
    */
    expect(FOUNDATION_CSS).toMatch(/\.dp-staff\s*\{[^}]*overflow:\s*hidden/);
    expect(FOUNDATION_CSS).toMatch(/\.dp-staff__pane\s*\{[^}]*overflow-y:\s*auto/);
    expect(FOUNDATION_CSS).toMatch(/\.dp-staff\s*\{[^}]*height:\s*calc\(100vh - var\(--topbar-h\)\)/);
  });

  it("the two content measures are his, and there is no third", () => {
    expect(FOUNDATION_CSS).toMatch(/\.dp-staff__col\s*\{[^}]*max-width:\s*1240px/);
    expect(FOUNDATION_CSS).toMatch(/\.dp-staff__col--read\s*\{[^}]*max-width:\s*790px/);
    /* Crew is the ONE surface at the reading measure. */
    const readers = staffPages().filter(({ text }) => /measure="read"/.test(code(text)));
    expect(readers.map((r) => r.name)).toEqual(["AdminCrew.tsx"]);
  });
});

describe("brief 05 §4 — what the bar drops", () => {
  it("no staff surface keeps a Studio button — the rail is the way back", () => {
    const offenders = [...staffPages(), { name: "StaffBar.tsx", text: STAFF_BAR }]
      .filter(({ text }) => />\s*Studio\s*</.test(code(text)) || /"\/studio"/.test(code(text)))
      .map(({ name }) => name);
    expect(offenders, `these still offer a second way back:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no staff surface keeps the Live / Paused pair", () => {
    /*
      They were two `Button`s, one of them a filled `bg-[#0A0A0A]` — the app's
      primary-action treatment spent on a polling preference. The toggle
      replaces them.
    */
    const offenders = [...staffPages(), { name: "StaffBar.tsx", text: STAFF_BAR }]
      .filter(({ text }) => /\?\s*"Live"\s*:\s*"Paused"/.test(code(text)))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("POSITIVE CONTROL — both matchers reject a surface that has them back", () => {
    const sabotage = `<Link href="/studio"><Button>Studio</Button></Link>
      {autoRefresh ? "Live" : "Paused"}`;
    expect(/"\/studio"/.test(sabotage)).toBe(true);
    expect(/>\s*Studio\s*</.test(sabotage)).toBe(true);
    expect(/\?\s*"Live"\s*:\s*"Paused"/.test(sabotage)).toBe(true);
  });

  it("the two headers this replaced are gone from the tree", () => {
    /*
      ⚠ THE SECOND ONE IS THE POINT. The brief names `AdminHeader` only — it was
      drawn on a canvas with no codebase in view and could not know
      `ModeratorHeader` was its twin. A rename of the first alone would have
      left the moderator page wearing two headers, and nothing would have said
      so.
    */
    expect(fs.existsSync(path.resolve(CLIENT_SRC, "features/admin/AdminHeader.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve(CLIENT_SRC, "features/moderator/ModeratorHeader.tsx"))).toBe(
      false,
    );
    const importers = staffPages()
      .filter(({ text }) => /AdminHeader|ModeratorHeader/.test(code(text)))
      .map(({ name }) => name);
    expect(importers).toEqual([]);
  });
});

describe("brief 05 §4/§9 — the bar is the foundation's, not a second one", () => {
  it("StaffBar composes SurfaceBar rather than drawing its own", () => {
    /*
      §9: *"check `SurfaceBar` before writing a second bar, and if the staff bar
      needs something it lacks, fold it in rather than forking."* Two things
      were folded in — a count pill and an optional href — and nothing was
      forked.
    */
    expect(code(STAFF_BAR)).toMatch(/import\s*\{[^}]*SurfaceBar/);

    /*
      ⚠ COUNTED, NOT MERELY PRESENT. The first shape of this arm asked only that
      `<SurfaceBar` appear somewhere — and the negative control walked straight
      through it: forking ONE of the two bars left the other's usage behind and
      the arm stayed green. There is one exported bar per role, so there are two
      usages, and both must be the foundation's.
    */
    const exported = [...code(STAFF_BAR).matchAll(/export function StaffBar\w+\(/g)].length;
    const uses = [...code(STAFF_BAR).matchAll(/<SurfaceBar\s/g)].length;
    expect(exported, "one exported bar per staff role").toBe(2);
    expect(uses, `${exported} bars exported but only ${uses} use SurfaceBar`).toBe(exported);

    /* And it does not declare a competing bar of its own. */
    expect(code(STAFF_BAR)).not.toMatch(/className="dp-surfacebar"/);
  });

  it("the segmented control is the foundation's one, with the count pill folded in", () => {
    expect(code(PRIMITIVES)).toMatch(/dp-segmented__count/);
    expect(FOUNDATION_CSS).toMatch(/\.dp-segmented__count\s*\{/);
    /*
      Omitted at zero, never `(0)` — the pill is a reason to look.

      ⚠ THE MATCHER IS THE TERNARY, NOT `option.count ?`. That first form also
      matches `option.count ?? 0`, which is the exact defect it exists to catch,
      so the negative control sabotaged the rule and the arm stayed green. A
      nullish default is banned by name here, because `0 ?? x` is `0` and the
      pill would render every zero.
    */
    expect(code(PRIMITIVES)).toMatch(/option\.count\s*\?\s*</);
    expect(code(PRIMITIVES)).not.toMatch(/option\.count\s*\?\?/);
  });

  it("§4 item 4 — the spacer is an element, never margin-left: auto", () => {
    /*
      His reason, and it is a measured one: any computed-style read resolves an
      auto margin to hard pixels, which overflows a wrapping row and clips
      inside `overflow: hidden`.
    */
    const barCss = FOUNDATION_CSS.slice(
      FOUNDATION_CSS.indexOf(".dp-surfacebar {"),
      FOUNDATION_CSS.indexOf(".dp-segmented {"),
    );
    expect(barCss.length).toBeGreaterThan(100);
    expect(barCss).not.toMatch(/margin-left:\s*auto/);
    expect(barCss).toMatch(/\.dp-surfacebar__spacer\s*\{[^}]*flex:\s*1 1 0/);
    /* POSITIVE CONTROL — the matcher finds one when there is one. */
    expect(/margin-left:\s*auto/.test(".dp-x { margin-left: auto; }")).toBe(true);
  });
});

describe("brief 05 §5 — the tab sets are derived from the routes, not from the mockup", () => {
  it("admin has one tab per live route, in his order, and never /admin/foundation", () => {
    const app = code(read("App.tsx"));
    const routed = [...app.matchAll(/path="(\/admin\/[a-z-]+)"/g)].map((m) => m[1]);
    const barred = [...code(STAFF_BAR).matchAll(/value:\s*"(\/admin\/[a-z-]+)"/g)].map((m) => m[1]);

    /* Every tab points at a route that exists. */
    for (const href of barred) expect(routed, `${href} is a tab with no route`).toContain(href);

    /* Bug reports IS the seventh tab — his own §5 correction. */
    expect(barred).toContain("/admin/bug-reports");

    /*
      ⚠ The specimen sheet is routed and is NOT a tab. His ruling: *"It does not
      get a tab."* This arm is the one that would catch somebody tidying the
      list by deriving it straight from the router.
    */
    expect(routed).toContain("/admin/foundation");
    expect(barred).not.toContain("/admin/foundation");
  });

  it("labels are sentence case, not Title Case", () => {
    const labels = [...code(STAFF_BAR).matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(5);
    const titleCased = labels.filter((l) => /^[A-Z]\w*\s+[A-Z]/.test(l));
    expect(titleCased, `Title Case labels: ${titleCased.join(", ")}`).toEqual([]);
    /* POSITIVE CONTROL — the matcher catches the shape it is looking for. */
    expect(/^[A-Z]\w*\s+[A-Z]/.test("Audit Logs")).toBe(true);
    expect(/^[A-Z]\w*\s+[A-Z]/.test("Audit logs")).toBe(false);
  });

  it("moderation keeps the tab set it already had — not the mockup's six", () => {
    const ids = [...MODERATOR_TABS.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([
      "audit-logs",
      "users",
      "blocked-ips",
      "flagged-referrals",
      "my-requests",
    ]);
    /* The prototype's names for tabs we do not have. */
    for (const invented of ["Referrals", "Reconciliation", "Flagged"]) {
      expect(
        [...MODERATOR_TABS.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]),
        `"${invented}" is the mockup's word, not ours`,
      ).not.toContain(invented);
    }
  });

  it("moderation's sub-tabs survive one level down — they are not flattened into the bar", () => {
    /*
      §7: *"Do not flatten Moderation's sub-tabs."* They live under User
      investigation, and this arm reads that the components still exist and are
      still mounted rather than trusting that nobody moved them.
    */
    for (const sub of ["ActivitySubTab", "CreditsSubTab", "GenerationsSubTab", "ReconciliationSubTab"]) {
      expect(
        fs.existsSync(path.resolve(CLIENT_SRC, `features/moderator/${sub}.tsx`)),
        `${sub} has gone missing`,
      ).toBe(true);
    }
  });

  it("counts come only from readers that already exist — no query was added", () => {
    /*
      §5: *"Where a tab has no reader for a number, no pill. Do not add a query
      in this PR."* The three counts are the three `TabNavigation` already drew.
    */
    const body = code(MODERATOR);
    expect(body).toMatch(/blockedIpsQuery\.data\?\.total/);
    expect(body).toMatch(/flaggedReferralsQuery\.data\?\.total/);
    expect(body).toMatch(/myRequestsQuery\.data\?\.summary\?\.pendingCount/);
    /* Admin's bar takes no counts at all — nothing reads them. */
    expect(code(STAFF_BAR)).not.toMatch(/useQuery/);
  });

  it("the Crew tab stays conditional on the query, never on a flag value", () => {
    expect(code(STAFF_BAR)).toMatch(/useCrewTabVisible\(\)/);
    /* No flag name may reach the client — the query succeeding IS the flag. */
    expect(code(STAFF_BAR)).not.toMatch(/CREW_TAB_SCOPE/);
  });
});

describe("brief 05 §6 — routing and the guards", () => {
  it("admin tabs are links, so deep links and the back button keep working", () => {
    expect(code(STAFF_BAR)).toMatch(/href:\s*tab\.value/);
    expect(code(PRIMITIVES)).toMatch(/option\.href\s*\?/);
    expect(code(PRIMITIVES)).toMatch(/<Link/);
  });

  it("no staff page fires a toast from its render body", () => {
    /*
      §6: a side effect in the wrong place, and it double-fires under strict
      mode. The moderator page's equivalent lives in a `useEffect` and is
      untouched — this arm is aimed at the render-body form only.
    */
    const offenders = staffPages()
      .filter(({ text }) =>
        /if\s*\([^)]*role[^)]*\)\s*\{\s*toast\.error/.test(code(text).replace(/\s+/g, " ")),
      )
      .map(({ name }) => name);
    expect(offenders, `render-body toasts:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("POSITIVE CONTROL — the render-body matcher catches the shape it hunts", () => {
    const sabotage = `if (user?.role !== "admin") { toast.error("Access denied."); return <Redirect to="/app" />; }`;
    expect(
      /if\s*\([^)]*role[^)]*\)\s*\{\s*toast\.error/.test(sabotage.replace(/\s+/g, " ")),
    ).toBe(true);
  });

  it("the frame mounts AppChrome, never AppShell directly", () => {
    /*
      The brief says `AppShell`; that is the layout primitive underneath, and a
      page mounting it gets no account menu, credits chip or settings gear.
      `appChrome.test.ts` guards the pages; this guards the frame they all now
      go through, which is the one place the mistake would reach all nine at
      once.
    */
    expect(code(STAFF_SURFACE)).toMatch(/<AppChrome/);
    expect(code(STAFF_SURFACE)).not.toMatch(/<AppShell/);
  });

  it("the frame lights no rail destination — staff is not one", () => {
    expect(code(STAFF_SURFACE)).not.toMatch(/current=/);
  });
});

/**
 * ⚠ **THE STAFF BAR'S TITLE (#417)** — his instruction, verbatim: *"in the top
 * bar where it says klieg studio change this on both the admin and the mod
 * pages to be somthing more relevant … whatever is industry standard."*
 *
 * Three things are pinned, and only the first is about the words:
 *
 *   1. Both bars say the same thing, and there is no tagline — the two pages
 *      differ by EYEBROW and tabs, which is what makes them one surface.
 *   2. ⚠ **It is COMPOSED from `BRAND_NAME`, never written out.** The card
 *      asked for an arm rather than an inspection, and it is the arm that
 *      matters most here: the rebrand is deferred and a literal would survive
 *      it silently, which is the exact shape of the pre-rebrand address still
 *      sitting on the login page.
 *   3. The eyebrows did NOT move. He changed the title; an arm that only
 *      checked the title would let the eyebrow drift on the next pass.
 *
 * ⚠ **AND THE POPULATION IS DERIVED, NOT LISTED.** Every `title=` prop in the
 * file is collected and compared, so a THIRD staff bar added later — the shape
 * that produced two headers before this component existed — cannot slip past by
 * simply not being on a list.
 */
describe("the staff bar's title is composed, never spelt", () => {
  const BAR = read("features/staff/StaffBar.tsx");

  /**
   * ⚠ **BUILT FROM TWO PIECES ON PURPOSE, AND THIS IS NOT CUTENESS.** The sweep
   * below is total — it walks every `.ts`/`.tsx`/`.css` under `client/src` with
   * no exclusion list — so if this file spelt the title out, the sweep would
   * report itself and the obvious repair would be *"skip test files"*. That
   * exclusion is the hole: the arm would then be blind to any surface a future
   * shift happens to put in a file matching it. Keeping the population total
   * and keeping the literal out of the source costs one concatenation.
   */
  const BRAND = "Klieg";
  const TITLE = `${BRAND} Console`;

  /**
   * Every `title=` given to a `SurfaceBar`, in source order, normalised to its
   * own delimiters so a template literal and a string literal are told apart.
   *
   * ⚠ **The first version of this read `\{[^}]*\}` and stopped at the FIRST
   * closing brace — which inside the composed title is the interpolation's own.**
   * It collected a truncated string and failed against a correct file. It was
   * caught because the expected value is written out here by hand rather than
   * derived from the same regex; had both sides shared the reader, the arm
   * would have passed while measuring nothing.
   */
  const surfaceBarTitles = (source: string) => {
    const found = [
      ...code(source).matchAll(/<SurfaceBar[\s\S]*?title=(?:\{`([^`]*)`\}|"([^"]*)")/g),
    ].map((m) => (m[1] !== undefined ? "`" + m[1] + "`" : JSON.stringify(m[2])));
    if (found.length === 0) throw new Error("no SurfaceBar title found — this arm is looking at the wrong file");
    return found;
  };

  it("both bars carry the same composed title, and there are exactly two", () => {
    const titles = surfaceBarTitles(BAR);
    expect(titles, "a third staff bar appeared, or one lost its title").toHaveLength(2);
    expect(new Set(titles).size, "the two bars disagree — they are one surface").toBe(1);
    expect(titles[0]).toBe("`${BRAND_NAME} Console`");
  });

  it("the collector tells a composed title from a spelt one", () => {
    const spelt = '<SurfaceBar eyebrow="ADMIN" title="' + BRAND + ' Console" />';
    expect(surfaceBarTitles(spelt)).toEqual([JSON.stringify(BRAND + " Console")]);
    const composed = '<SurfaceBar eyebrow="ADMIN" title={`${BRAND_NAME} Console`} />';
    expect(surfaceBarTitles(composed)).toEqual(["`${BRAND_NAME} Console`"]);
    expect(() => surfaceBarTitles("nothing here")).toThrow(/wrong file/);
  });

  /**
   * ⚠ The card's own bar: *"zero occurrences of the literal in the tree — an
   * arm proving that, not an inspection."* Swept over the whole
   * client rather than this one file, because the next place to hardcode it is
   * a page title or a document `<title>`, not this component.
   */
  it("the literal is written nowhere in the client", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          /* Comments are stripped: this very file names the literal on purpose,
             and so does the component's docblock explaining the decision. */
          if (code(text).includes(TITLE)) offenders.push(path.relative(CLIENT_SRC, full));
        }
      }
    };
    walk(CLIENT_SRC);
    expect(offenders, `the brand is spelt out here: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the sweep would see one — positive control", () => {
    expect(code(`const t = "${TITLE}";`).includes(TITLE), "a spelt title must be caught").toBe(true);
    expect(code(`/* the title is ${TITLE} */`).includes(TITLE), "a comment naming it must not").toBe(
      false,
    );
  });

  /**
   * ⚠ **THE ARM THAT CLOSES THE CLASS, AND IT IS HERE BECAUSE THE FIRST SWEEP
   * DID NOT.** The sweep above guards the string that arrived; this one guards
   * the two that LEFT. They are different failures and only the second is the
   * one a person notices: a surface still spelling `Klieg Studio — everything`
   * shows him the words his ruling removed.
   *
   * The gate review found exactly that — `pages/AdminFoundation.tsx` held a
   * THIRD hardcoded copy, on a live admin page, and the new arms could not see
   * it because the composed-title collector reads only `StaffBar.tsx` and the
   * sweep was watching the wrong string. **A sweep aimed only at what a change
   * ADDS is half a sweep** (working law 7: fix the class, not the instance).
   */
  it("the two retired titles are written nowhere in the client", () => {
    const RETIRED = [`${BRAND} Studio — everything`, `${BRAND} Studio — watch and propose`];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          const text = code(fs.readFileSync(full, "utf8"));
          for (const dead of RETIRED) {
            if (text.includes(dead)) offenders.push(`${path.relative(CLIENT_SRC, full)} → "${dead}"`);
          }
        }
      }
    };
    walk(CLIENT_SRC);
    expect(offenders, `a retired staff-bar title survives: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the retired-title sweep would see one — positive control", () => {
    const dead = `${BRAND} Studio — everything`;
    expect(code(`<SurfaceBar title="${dead}" />`).includes(dead)).toBe(true);
    expect(code(`/* it used to say ${dead} */`).includes(dead)).toBe(false);
  });

  it("the eyebrows did not move", () => {
    const eyebrows = [...code(BAR).matchAll(/eyebrow="([^"]+)"/g)].map((m) => m[1]);
    expect(eyebrows).toEqual(["ADMIN", "MODERATION"]);
  });

  it("no tagline survives either bar", () => {
    for (const title of surfaceBarTitles(BAR)) {
      expect(title, "a tagline came back — the eyebrow and the tabs already say it").not.toMatch(/—|--/);
    }
  });

  /**
   * ⚠ **`WORKSPACE_NAME` IS THE THING STAFF MUST NOT READ**, and this arm is
   * the one that outlives the wording. Staff sits above workspaces; the day a
   * workspace row exists, that constant becomes a customer's chosen string.
   */
  it("no staff surface reads the workspace name", () => {
    const staffDir = path.resolve(CLIENT_SRC, "features/staff");
    const offenders: string[] = [];
    for (const entry of fs.readdirSync(staffDir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      const full = path.join(entry.parentPath ?? staffDir, entry.name);
      if (/\.test\.tsx?$/.test(entry.name)) continue;
      if (code(fs.readFileSync(full, "utf8")).includes("WORKSPACE_NAME")) {
        offenders.push(path.relative(CLIENT_SRC, full));
      }
    }
    expect(offenders, `staff reads the workspace name in: ${offenders.join(", ")}`).toEqual([]);
  });
});
