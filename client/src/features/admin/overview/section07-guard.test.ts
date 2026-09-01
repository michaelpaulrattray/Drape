import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attentionItems } from "./NeedsHuman";
import { actionLabel } from "./actionLabel";

/**
 * Brief 07's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/07-admin-overview.md`).
 *
 * His §11 is the definition of done. What is held here is the half a later
 * brief would casually undo: a green coming back, a category regaining a hue,
 * the five-column split returning, a chart hard-coding a light hex, the
 * attention section growing an "all clear" card.
 *
 * ⚠ **THE POPULATION IS DERIVED, NOT TYPED** — every `.tsx` in this directory
 * plus the page that mounts them. Section 05's guard learned why one card ago:
 * a hand-written list of surfaces had the same blind spot the mockup did and
 * missed a whole second header. An eighth card added here is measured the
 * moment it exists.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL.** An absence arm
 * alone is green when its subject is deleted and green when its own matcher is
 * wrong — both have happened in this repo (working law 2, and #396's own
 * sabotage found two holes of exactly this shape).
 *
 * **What a source read cannot see**, stated rather than implied: whether the
 * charts actually follow the theme at runtime, whether the sparkline reads as
 * a sparkline, whether either theme survives. Those were DRIVEN in the running
 * app and recorded in `docs/specs/ADMIN_OVERVIEW_397_EVIDENCE.md`.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..", "..");
const PAGE = path.resolve(CLIENT_SRC, "pages/AdminOverview.tsx");

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CSS = read(path.join(HERE, "overview.css"));
const PAGE_TEXT = read(PAGE);

/**
 * THE POPULATION — every component of this section, plus its page.
 *
 * Derived from the directory listing rather than named, and the page is
 * included because half of §4's rules (the column count, the section order,
 * the deleted footer) live there rather than in a card.
 */
const section = (): { name: string; text: string }[] => {
  const files = fs
    .readdirSync(HERE)
    .filter((n) => (n.endsWith(".tsx") || n.endsWith(".ts")) && !n.includes(".test."))
    .map((n) => ({ name: n, text: read(path.join(HERE, n)) }));
  files.push({ name: "AdminOverview.tsx", text: PAGE_TEXT });
  return files;
};

describe("brief 07 — the population is real", () => {
  it("finds every card in the section plus the page", () => {
    const names = section().map((f) => f.name);
    /* The seven the brief names, the two this card adds, the barrel, the page. */
    expect(names).toContain("HealthMetrics.tsx");
    expect(names).toContain("AlertsFeed.tsx");
    expect(names).toContain("NeedsHuman.tsx");
    expect(names).toContain("chartTokens.ts");
    expect(names).toContain("AdminOverview.tsx");
    expect(names.length).toBeGreaterThanOrEqual(10);
  });
});

/* ------------------------------------------------ §2 — what leads the page */

describe("§2 — needs a human leads, and vanishes when empty", () => {
  it("mounts NeedsHuman before HealthMetrics on the page", () => {
    const body = code(PAGE_TEXT);
    const needs = body.indexOf("<NeedsHuman");
    const health = body.indexOf("<HealthMetrics");
    expect(needs).toBeGreaterThan(-1);
    expect(health).toBeGreaterThan(-1);
    /* His §2: "Leading with metrics means the answer to the only urgent
       question is below three cards of reassurance." */
    expect(needs).toBeLessThan(health);
  });

  /*
    Driven directly rather than through a render — a backstop tested only
    through the component is a backstop tested through whatever the component
    happens to do that day (working law 3).
  */
  const quiet = {
    pendingChangeRequests: 0,
    urgentChangeRequests: 0,
    changeRequestsThisWeek: 4,
    activeReferrals: 2,
  };

  it("derives NOTHING from a quiet board — so the section disappears", () => {
    expect(attentionItems(quiet, [])).toEqual([]);
  });

  it("a warning-only alert is still not a thing needing a human", () => {
    const warning = [
      {
        id: 1,
        action: "security.rate_limit",
        severity: "warning",
        userId: 7,
        metadata: null,
        createdAt: new Date(),
      },
    ];
    expect(attentionItems(quiet, warning)).toEqual([]);
  });

  /* POSITIVE CONTROL — the two arms above must be able to produce a row. */
  it("POSITIVE CONTROL: a pending request and a critical alert each produce one", () => {
    const pending = attentionItems({ ...quiet, pendingChangeRequests: 4 }, []);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.line).toContain("4 change requests");

    const critical = attentionItems(quiet, [
      {
        id: 9,
        action: "abuse.global_attack_detected",
        severity: "critical",
        userId: null,
        metadata: null,
        createdAt: new Date(),
      },
    ]);
    expect(critical).toHaveLength(1);
    expect(critical[0]?.urgent).toBe(true);
  });

  it("only an urgent request pulses — an ordinary pending one does not", () => {
    const ordinary = attentionItems({ ...quiet, pendingChangeRequests: 2 }, []);
    expect(ordinary[0]?.urgent).toBe(false);

    const urgent = attentionItems(
      { ...quiet, pendingChangeRequests: 2, urgentChangeRequests: 1 },
      [],
    );
    expect(urgent[0]?.urgent).toBe(true);
  });

  it("no card claims an all-clear — the section has no empty state", () => {
    const needsHuman = read(path.join(HERE, "NeedsHuman.tsx"));
    expect(code(needsHuman)).not.toContain("EmptyState");
    /* And it can actually return nothing. */
    expect(code(needsHuman)).toContain("return null");
  });
});

/* --------------------------------- no raw machine string reaches his eye */

describe("an audit action is shown as words, never as an identifier", () => {
  /**
   * Found by LOOKING at the running page, not by a test: **nine of twelve rows
   * in the alerts feed printed a raw dotted identifier**, and the top card of
   * `NEEDS A HUMAN` — the first thing on the page — read
   * `security.unauthorized_admin_access`.
   *
   * The cause is structural rather than an omission: `getRecentAlerts` selects
   * `severity IN ('critical','warning') OR action IN (…)`, so the severity arm
   * admits **any** action the product ever writes, while a hand-written label
   * map only ever knows the thirteen named in the `IN` list. The map cannot be
   * completed; it can only be derived from.
   */
  it("turns an unmapped action into words", () => {
    expect(actionLabel("credits.admin_added")).toBe("Credits · admin added");
    expect(actionLabel("security.unauthorized_admin_access")).toBe(
      "Security · unauthorized admin access",
    );
    expect(actionLabel("auth.email_verification_failed")).toBe(
      "Auth · email verification failed",
    );
    expect(actionLabel("admin.action")).toBe("Admin · action");
  });

  it("keeps the hand-written phrase where one is better than the identifier", () => {
    expect(actionLabel("account.auto_frozen")).toBe("Auto-frozen");
    expect(actionLabel("billing.stripe_refund_issued")).toBe("Refund issued");
  });

  it("never returns something containing a raw dotted identifier", () => {
    /* Every action the alerts query can surface by name, plus the four found
       on the real dashboard that the map did not know. */
    const actions = [
      "account.auto_frozen",
      "admin.ip_blocked",
      "abuse.global_attack_detected",
      "credits.admin_added",
      "admin.action",
      "auth.email_verification_failed",
      "security.unauthorized_admin_access",
    ];
    for (const action of actions) {
      const label = actionLabel(action);
      expect(label, `${action} still reads as an identifier`).not.toMatch(/[a-z]\.[a-z]/);
      expect(label, `${action} still carries an underscore`).not.toContain("_");
    }
  });

  it("POSITIVE CONTROL: the matcher fires on the raw strings that were showing", () => {
    expect("credits.admin_added").toMatch(/[a-z]\.[a-z]/);
    expect("security.unauthorized_admin_access").toContain("_");
  });

  it("both surfaces use it — neither keeps its own fallback", () => {
    for (const name of ["AlertsFeed.tsx", "NeedsHuman.tsx"]) {
      const body = code(read(path.join(HERE, name)));
      expect(body, `${name} does not use the shared label`).toContain("actionLabel(");
      /* The shape that produced the defect: `?? alert.action`. */
      expect(body, `${name} still falls back to the raw action`).not.toMatch(
        /\?\?\s*(?:alert\.)?action\b/,
      );
    }
  });

  it("POSITIVE CONTROL: the fallback matcher fires on the line that was there", () => {
    expect("label: ALERT_LABELS[alert.action] ?? alert.action,").toMatch(
      /\?\?\s*(?:alert\.)?action\b/,
    );
  });
});

/* ------------------------------------------------- §3 — colour inverts */

/**
 * The tints §3 kills. `section00-guard.test.ts` counts seven across the staff
 * surfaces; these are the ones this section carried.
 */
const BANNED_TINTS =
  /\b(?:bg|text|border|ring|from|to|via)-(?:emerald|green|blue|amber|orange|red|purple|violet|indigo|teal|cyan|lime|yellow|pink|rose|fuchsia|sky)-\d{2,3}\b/;

describe("§3 — accent means state, and there is no green", () => {
  for (const file of section()) {
    it(`${file.name} carries no Tailwind tint`, () => {
      const found = code(file.text).match(BANNED_TINTS);
      expect(found, `${file.name} still tints with ${found?.[0]}`).toBeNull();
    });
  }

  it("POSITIVE CONTROL: the matcher catches the exact classes that were here", () => {
    /* Every one of these was in this directory before this card. */
    expect("text-emerald-600").toMatch(BANNED_TINTS);
    expect("bg-red-50").toMatch(BANNED_TINTS);
    expect("text-amber-600").toMatch(BANNED_TINTS);
    expect("bg-blue-100 text-blue-700").toMatch(BANNED_TINTS);
    expect("border-amber-200").toMatch(BANNED_TINTS);
    /* And does not fire on a legitimate neighbour. */
    expect("grid-cols-2").not.toMatch(BANNED_TINTS);
    expect("gap-3").not.toMatch(BANNED_TINTS);
  });

  it("the action map carries icons only — no colour, no background", () => {
    const feed = code(read(path.join(HERE, "AlertsFeed.tsx")));
    const config = feed.slice(feed.indexOf("ACTION_ICON"), feed.indexOf("function getTimeAgo"));
    /* The slice is real — if it were empty the arm would pass on nothing. */
    expect(config.length).toBeGreaterThan(400);
    expect(config).toContain("abuse.global_attack_detected");
    /* The two fields §3 deletes by name. */
    expect(config).not.toMatch(/\bcolor:/);
    expect(config).not.toMatch(/\bbg:/);
    /* And no label either — that is derived now, see below. */
    expect(config).not.toMatch(/\blabel:/);
  });

  it("POSITIVE CONTROL: that slice would show a colour field if one returned", () => {
    const feed = code(read(path.join(HERE, "AlertsFeed.tsx")));
    const config = feed.slice(feed.indexOf("ACTION_ICON"), feed.indexOf("function getTimeAgo"));
    expect(`${config} color: "text-red-600",`).toMatch(/\bcolor:/);
    expect(`${config} label: "Auto-Frozen",`).toMatch(/\blabel:/);
  });

  it("no weight above 500 anywhere in the section", () => {
    for (const file of section()) {
      expect(code(file.text), `${file.name}`).not.toMatch(/font-(?:bold|semibold)/);
    }
    /* The CSS half — the foundation states 600 is never used. */
    expect(CSS).not.toMatch(/font(?:-weight)?:\s*(?:600|700|800|900)\b/);
    expect(CSS).not.toMatch(/font:\s*(?:600|700|800|900)\s/);
  });

  it("POSITIVE CONTROL: the weight matcher fires on the string that was here", () => {
    expect("text-3xl font-bold tabular-nums").toMatch(/font-(?:bold|semibold)/);
    expect("font: 600 13px var(--font-sans);").toMatch(/font:\s*(?:600|700|800|900)\s/);
  });
});

describe("§3 — a pulse means in progress, so only urgent pulses", () => {
  it("the resting dot has no animation and the urgent one does", () => {
    const resting = CSS.slice(CSS.indexOf(".dp-attn__dot {"), CSS.indexOf(".dp-attn__dot--urgent"));
    expect(resting).not.toContain("animation");

    const urgent = CSS.slice(CSS.indexOf(".dp-attn__dot--urgent"));
    expect(urgent.slice(0, 200)).toContain("dp-pulse");
  });

  it("nothing in the section uses Tailwind's animate-pulse", () => {
    for (const file of section()) {
      expect(code(file.text), `${file.name}`).not.toContain("animate-pulse");
    }
  });

  it("POSITIVE CONTROL: both slices are real", () => {
    expect(CSS.indexOf(".dp-attn__dot {")).toBeGreaterThan(-1);
    expect(CSS.indexOf(".dp-attn__dot--urgent")).toBeGreaterThan(-1);
    expect("<div className=\"animate-pulse\" />").toContain("animate-pulse");
  });
});

/* --------------------------------------------------- §6 — the KPI cards */

describe("§6 — the KPI card", () => {
  it("the value is 500 26px mono with tabular numbers", () => {
    const block = CSS.slice(CSS.indexOf(".dp-kpi__value"), CSS.indexOf(".dp-kpi--critical .dp-kpi__value"));
    expect(block).toContain("500 26px var(--font-mono)");
    expect(block).toContain("tabular-nums");
  });

  it("no decorative icon sits in a KPI card", () => {
    const health = code(read(path.join(HERE, "HealthMetrics.tsx")));
    /* The four that were in the corners. §10: "the label already says what the
       number is, and four decorative glyphs across a KPI row is the pattern
       that makes dashboards look generic." */
    for (const glyph of ["Users", "Activity", "AlertTriangle", "CheckCircle2", "XCircle", "Loader2", "Clock"]) {
      expect(health, `${glyph} is back in a KPI card`).not.toContain(`<${glyph}`);
    }
  });

  it("the last sparkline bar is the only one that is --ink", () => {
    const bar = CSS.slice(CSS.indexOf(".dp-kpi__bar {"), CSS.indexOf(".dp-ov__card {"));
    expect(bar).toContain("var(--dotsStrong)");
    expect(bar).toContain(".dp-kpi__bar--today");
    expect(bar).toContain("var(--ink)");
  });
});

/* ------------------------------------------------------ §7 — the charts */

describe("§7 — charts follow the theme and carry no gradient", () => {
  const chartFiles = () =>
    section().filter((f) => f.text.includes("recharts"));

  it("there are charts to measure", () => {
    expect(chartFiles().length).toBeGreaterThanOrEqual(3);
  });

  it("no AreaChart and no gradient def survives", () => {
    for (const file of chartFiles()) {
      const body = code(file.text);
      expect(body, `${file.name}`).not.toContain("AreaChart");
      expect(body, `${file.name}`).not.toContain("linearGradient");
      expect(body, `${file.name}`).not.toContain("<Area");
    }
  });

  it("POSITIVE CONTROL: those matchers fire on what was here", () => {
    const was = `<AreaChart data={chartData}><defs><linearGradient id="gradCompleted" /></defs><Area dataKey="completed" /></AreaChart>`;
    expect(was).toContain("AreaChart");
    expect(was).toContain("linearGradient");
    expect(was).toContain("<Area");
  });

  it("every chart reads its colours from the token helper", () => {
    for (const file of chartFiles()) {
      expect(code(file.text), `${file.name} does not use the token helper`).toContain(
        "useChartTokens",
      );
    }
  });

  /*
    §12 — "If UserGrowthCard, CreditEconomyCard and GovernanceCard each read
    :root separately, that is three copies of the same six lines."
  */
  it("exactly ONE file reads :root, and it is the helper", () => {
    const readers = section().filter((f) => code(f.text).includes("getComputedStyle"));
    expect(readers.map((r) => r.name)).toEqual(["chartTokens.ts"]);
  });

  it("chart titles are sentence case", () => {
    const health = code(read(path.join(HERE, "HealthMetrics.tsx")));
    expect(health).toContain("Generation activity");
    expect(health).not.toContain("Generation Activity");
  });
});

/* ------------------------------------------------------ §4 — the layout */

describe("§4 — one column, every grid auto-fit", () => {
  it("the five-column split and its spans are gone", () => {
    const body = code(PAGE_TEXT);
    expect(body).not.toContain("lg:grid-cols-5");
    expect(body).not.toContain("col-span");
  });

  it("POSITIVE CONTROL: the matcher fires on the markup that was here", () => {
    expect(`<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">`).toContain("lg:grid-cols-5");
    expect(`<div className="lg:col-span-3 space-y-6">`).toContain("col-span");
  });

  it("every grid in the sheet is auto-fit with a minmax — never a fixed count", () => {
    const templates = CSS.match(/grid-template-columns:[^;]+;/g) ?? [];
    expect(templates.length).toBeGreaterThanOrEqual(3);
    for (const t of templates) {
      expect(t, `a fixed column count: ${t}`).toContain("auto-fit");
      expect(t, `no minmax: ${t}`).toContain("minmax");
    }
  });

  it("the minmax values are the ones his §4 table names", () => {
    expect(CSS).toContain("minmax(232px, 1fr)"); // needs a human
    expect(CSS).toContain("minmax(198px, 1fr)"); // last 24 hours
    expect(CSS).toContain("minmax(292px, 1fr)"); // system / banners
  });

  it("the `Data as of` footer is deleted (§9)", () => {
    expect(code(PAGE_TEXT)).not.toContain("Data as of");
  });

  it("POSITIVE CONTROL: that string is what the footer said", () => {
    expect(`Data as of {new Date(data.fetchedAt).toLocaleString()}`).toContain("Data as of");
  });
});

/* ------------------------------------------------- §8 — the alerts feed */

describe("§8 — the feed is full width and does not trap the wheel", () => {
  const feed = () => code(read(path.join(HERE, "AlertsFeed.tsx")));

  it("no inner scrolling region and no 280px truncation", () => {
    expect(feed()).not.toContain("overflow-y-auto");
    expect(feed()).not.toContain("max-h-");
    expect(feed()).not.toContain("max-w-[280px]");
    /* The CSS half — nothing in this sheet may scroll inside the pane. */
    expect(CSS).not.toMatch(/overflow-y:\s*auto/);
  });

  it("POSITIVE CONTROL: the matchers fire on the classes that were here", () => {
    const was = `className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1"`;
    expect(was).toContain("overflow-y-auto");
    expect(was).toContain("max-h-");
    expect(`<p className="truncate mt-0.5 max-w-[280px]">`).toContain("max-w-[280px]");
  });

  /*
    §8, his reason: "auto margins resolve to hard pixels under any
    computed-style read, overflow the row, and clip."
  */
  it("the alert row pushes its time with a spacer, not ml-auto", () => {
    expect(feed()).not.toContain("ml-auto");
    expect(feed()).toContain("dp-ov__spacer");
    const spacer = CSS.slice(CSS.indexOf(".dp-ov__spacer"), CSS.indexOf(".dp-ov__attngrid"));
    expect(spacer).toContain("flex: 1");
  });

  it("POSITIVE CONTROL: the ml-auto matcher fires on the span that was here", () => {
    expect(`<span className="text-[10px] text-[#bbb] ml-auto flex-shrink-0">`).toContain("ml-auto");
  });

  it("the list is capped and links out for the rest", () => {
    expect(feed()).toContain("VISIBLE_LIMIT = 12");
    expect(feed()).toContain("All audit entries");
    expect(feed()).not.toContain("View all");
  });

  it("the empty state is the primitive, not a 40px glyph", () => {
    expect(feed()).toContain("EmptyState");
    expect(feed()).not.toContain("opacity-20");
  });
});

/* -------------------------------------- §9 / tokens — the contrast trap */

describe("the --error family is used by role, not by name", () => {
  /**
   * `tokens.css` records it: plain `--error` on the dark surface (#1C1C1F)
   * measures 3.40:1, below the 4.5:1 AA floor, which is why `--errorInk`
   * exists and is overridden in dark while `--error` deliberately is not.
   *
   * So `--error` may set a border or a background and must never set text.
   * This is the arm most likely to save a later brief: it is invisible in
   * light, which is the theme a reviewer looks at.
   */
  /*
    ⚠ **ANCHORED ON PURPOSE, AND ITS OWN POSITIVE CONTROL IS WHY.** The first
    shape was `/color:\s*var\(--error\)/`, which reads `border-color:` as a
    match — `color:` is a substring of it. That arm failed on this very sheet,
    naming two legitimate border declarations as violations, and the control
    below is what said so before the arm was believed. A guard that cannot tell
    the banned role from the permitted one is worse than no guard: it teaches
    the next reader to delete it.
  */
  const COLOUR_IS_ERROR = /(?:^|[;{\s])color:\s*var\(--error\)/;

  it("nothing in the sheet sets `color: var(--error)`", () => {
    const colourRules = CSS.match(new RegExp(COLOUR_IS_ERROR, "g"));
    expect(colourRules).toBeNull();
  });

  it("POSITIVE CONTROL: it fires on the text role and spares the border role", () => {
    expect("color: var(--error);").toMatch(COLOUR_IS_ERROR);
    expect("  color: var(--error);").toMatch(COLOUR_IS_ERROR);
    /* The near neighbour it must not fire on — this is the one that broke it. */
    expect("border-color: var(--error);").not.toMatch(COLOUR_IS_ERROR);
    /* Nor on the token that IS allowed to be text. */
    expect("color: var(--errorInk);").not.toMatch(COLOUR_IS_ERROR);
  });

  it("the section does use --errorInk for its critical words", () => {
    expect(CSS).toContain("var(--errorInk)");
  });

  it("loading and empty use the primitives (§9)", () => {
    expect(code(PAGE_TEXT)).toContain("Skeleton");
    /* The bespoke `h-28 animate-pulse` boxes are gone. */
    expect(code(PAGE_TEXT)).not.toContain("animate-pulse");
  });
});

/* --------------------------------------- §1 / §11 — nothing else moved */

describe("§1 — the queries are untouched", () => {
  it("both readers are called exactly as before, with the same options", () => {
    const body = code(PAGE_TEXT);
    expect(body).toContain("trpc.admin.getOverview.useQuery(undefined,");
    expect(body).toContain("trpc.admin.getTimeSeries.useQuery(undefined,");
    expect(body).toContain("REFRESH_INTERVAL_MS = 30_000");
    expect(body).toContain("staleTime: 10_000");
  });

  it("no query or mutation was added to the section", () => {
    /* §10: "Do not add a query or change a mutation." The only file allowed to
       call tRPC here is the banner card, which owns three mutations that
       predate this brief. */
    const callers = section().filter((f) => code(f.text).includes("trpc."));
    expect(callers.map((f) => f.name).sort()).toEqual([
      "AdminOverview.tsx",
      "BannerManagement.tsx",
    ]);
  });

  it("every banner mutation survives with its invalidations", () => {
    const banners = code(read(path.join(HERE, "BannerManagement.tsx")));
    for (const m of ["createBanner", "toggleBanner", "deleteBanner", "listBanners"]) {
      expect(banners, `${m} was dropped`).toContain(m);
    }
    /* Both refreshes, on all three mutations. */
    expect(banners.match(/utils\.admin\.listBanners\.invalidate\(\)/g)).toHaveLength(3);
    expect(banners.match(/utils\.announcements\.getActive\.invalidate\(\)/g)).toHaveLength(3);
  });
});
