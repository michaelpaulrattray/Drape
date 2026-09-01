import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SECTION 03's contract, held at the source.
 *
 * Brief: `docs/specs/Casting-ui-ux-design/drape-redesign/03-settings-billing-credits.md`.
 * Its §10 is a list of things not to do and its §11 a definition of done; what
 * is here is the half a machine can hold, and each arm says which clause it is.
 *
 * ⚠ **DERIVED WHERE IT CAN BE.** The stub sweep and the section list read the
 * directory rather than a list in this file — a second list of the sections is
 * the very thing that drifts (working law 4), and a hand-kept one would have
 * been silently satisfied the day a seventh section arrived.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CLIENT = join(HERE, "..", "..");
const SECTIONS_DIR = join(HERE, "sections");

const read = (path: string) => readFileSync(path, "utf8");
/** Strip block and line comments — a rule quoted in prose is not a rule shipped. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("section 03 — five modals became three surfaces", () => {
  it("the five retired modals are GONE, not restyled", () => {
    /*
      §10: *"Do not keep the five modals and style them alike. If a separate
      `ProfileSettingsModal` exists at the end, this failed."* An absence arm,
      so its own control is the arm below it, which proves the replacements are
      really there — otherwise "all five gone" passes on an empty tree.
    */
    for (const gone of [
      "components/ProfileSettingsModal.tsx",
      "features/billing/BillingModal.tsx",
      "features/billing/CreditTopupModal.tsx",
      "features/billing/DowngradeConfirmModal.tsx",
      "features/referral/ReferralModal.tsx",
    ]) {
      expect(existsSync(join(CLIENT, gone)), `${gone} is back`).toBe(false);
    }
    for (const present of [
      "features/settings/SettingsModal.tsx",
      "features/billing/ChangePlanModal.tsx",
      "features/billing/AddCreditsModal.tsx",
    ]) {
      expect(existsSync(join(CLIENT, present)), `${present} is missing`).toBe(true);
    }
  });

  it("SIX sections, and the directory agrees with the modal", () => {
    /*
      §10: *"Do not add a seventh Settings section. Six is the set."* Both ends
      are read — the nav list in the modal and the files on disk — because a
      seventh could arrive as either.
    */
    const modal = code(read(join(HERE, "SettingsModal.tsx")));
    const ids = [...modal.matchAll(/\{ id: "(\w+)", label: "([\w ]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["profile", "usage", "billing", "members", "notifications", "security"]);

    const files = readdirSync(SECTIONS_DIR).filter((f) => f.endsWith("Section.tsx"));
    expect(files.sort()).toEqual([
      "BillingSection.tsx",
      "MembersSection.tsx",
      "NotificationsSection.tsx",
      "ProfileSection.tsx",
      "SecuritySection.tsx",
      "UsageSection.tsx",
    ]);
  });

  it("Sign out is in the NAV, never beside Done, and there is no Save", () => {
    /*
      §4 and §10, and the reason is in the brief: Sign out is
      destructive-adjacent and a mis-click beside Done ends the session. The
      order in the source is what carries it — the sign-out button must appear
      before the footer opens.
    */
    const modal = code(read(join(HERE, "SettingsModal.tsx")));
    const signOut = modal.indexOf("dp-set__signout");
    const nav = modal.indexOf("dp-set__nav");
    const foot = modal.indexOf("dp-set__foot");
    expect(nav).toBeGreaterThan(-1);
    expect(signOut).toBeGreaterThan(nav);
    expect(signOut, "Sign out has moved into the footer").toBeLessThan(foot);

    expect(modal).toContain("Changes save as you edit");
    expect(modal, "a Save button is back").not.toMatch(/>\s*Save\s*</);
  });

  it("every inert control is a real stub — out of the tab order and it says why", () => {
    /*
      The founder's placeholder law, held mechanically: a stub is
      `aria-disabled`, `tabIndex={-1}` and carries a reason. Read at the ONE
      component that draws them, so a section cannot invent a second shape —
      and the sweep then proves no section hand-rolls one.
    */
    /*
      ⚠ **READ PER COMPONENT, NOT PER FILE — the first draft of this arm could
      not fail.** `parts.tsx` writes `tabIndex={-1}` three times, so a
      whole-file `toContain` stayed green with one of them deleted, and the
      sabotage driver caught exactly that (working law 2). Each component's own
      body is sliced out and asked separately.
    */
    const parts = code(read(join(HERE, "parts.tsx")));
    const bodyOf = (name: string) => {
      const from = parts.indexOf(`export function ${name}(`);
      expect(from, `${name} is gone`).toBeGreaterThan(-1);
      const next = parts.indexOf("export function ", from + 20);
      return parts.slice(from, next === -1 ? parts.length : next);
    };
    const stub = bodyOf("StubControl");
    for (const required of ['aria-disabled="true"', "tabIndex={-1}", "title={reason}"]) {
      expect(stub, `StubControl lost ${required}`).toContain(required);
    }
    const toggle = bodyOf("SettingsToggle");
    for (const required of ['aria-disabled="true"', "tabIndex={-1}", "title={reason}"]) {
      expect(toggle, `SettingsToggle lost ${required}`).toContain(required);
    }
    /* The toggle must never be a real <button> — an inert control that still
       takes a click is the "looks functional, does nothing" his law forbids. */
    expect(toggle, "the notification toggle became a real control").not.toContain("onClick");

    const files = readdirSync(SECTIONS_DIR).filter((f) => f.endsWith(".tsx"));
    expect(files.length, "no sections found — the sweep is broken").toBeGreaterThan(4);
    for (const file of files) {
      const body = code(read(join(SECTIONS_DIR, file)));
      /* A hand-rolled `aria-disabled` outside the two shared components is how
         a stub loses half its treatment. */
      const hand = [...body.matchAll(/aria-disabled="true"/g)];
      const declared = [...body.matchAll(/<(StubControl|SettingsToggle|div className="dp-mem__invite")/g)];
      expect(
        hand.length,
        `${file} writes aria-disabled by hand — use StubControl or SettingsToggle`,
      ).toBeLessThanOrEqual(declared.length);
    }
  });

  it("Members ships as UNBUILT, never as empty, with the role notes whole", () => {
    /*
      #365: *"Do not render an invited-members table with nothing in it, which
      reads as **you have no colleagues yet** rather than **this is not
      built**."* And §8: the Reviewer line is the one that sells the feature.
    */
    const members = read(join(SECTIONS_DIR, "MembersSection.tsx"));
    expect(members).toContain("designed and not built yet");
    expect(members).toContain(
      "Cannot generate, so never spends your credits — free, and the safe way to bring a client in.",
    );
    /* No invented seat count and no invented member list. */
    expect(code(members), "Members counts seats it cannot count").not.toMatch(
      /\d+ of \d+ seats/,
    );
  });

  it("Product news and project-joins default OFF", () => {
    /*
      §5: *"Opting people into marketing by default is the kind of small
      dishonesty that costs more trust than the emails are worth."*
    */
    const rows = code(read(join(SECTIONS_DIR, "NotificationsSection.tsx")));
    const off = (label: string) => {
      const at = rows.indexOf(`label: "${label}"`);
      expect(at, `${label} is gone`).toBeGreaterThan(-1);
      expect(rows.slice(at, at + 200), `${label} defaults ON`).toContain("on: false");
    };
    off("Product news");
    off("Someone joins a project");
  });

  it("the savings badge is DERIVED and no percentage survives anywhere", () => {
    /*
      §6b: *"`2 MONTHS FREE` rather than `−17%`: identical arithmetic, far more
      vivid. Use one framing everywhere; the prototype briefly had the badge on
      one modal and the percentage on the other."*
    */
    for (const file of [
      join(CLIENT, "features", "billing", "ChangePlanModal.tsx"),
      join(CLIENT, "features", "billing", "AddCreditsModal.tsx"),
    ]) {
      const body = code(read(file));
      expect(body, `${file} hard-codes the badge`).toContain("{monthsFree()} MONTHS FREE");
      expect(body, `${file} still shows a percentage`).not.toMatch(/[-−]\s?17\s?%/);
    }
  });

  it("exactly one ink button is OFFERED, and both modes read the same offer", () => {
    /*
      §6c: *"Exactly one ink button per view … Three identical primaries is the
      single biggest failing of the current `BillingModal`."* Held at the shape
      rather than at a render: the card grid's variant is a comparison against
      one id, and the compare grid's own action row is unconditionally
      secondary with the primary in the footer (§6e).
    */
    const plan = code(read(join(CLIENT, "features", "billing", "ChangePlanModal.tsx")));
    expect(plan).toContain('variant={plan.id === primaryId ? "primary" : "secondary"}');
    const compareStart = plan.indexOf("function CompareGrid");
    expect(compareStart).toBeGreaterThan(-1);
    const compare = plan.slice(compareStart);
    expect(compare, "the compare table has a primary in a column").not.toContain(
      'variant="primary"',
    );
    /* And the footer primary exists — the arm above is an absence one. */
    const footer = plan.slice(plan.indexOf("dp-plan__foot"), compareStart);
    expect(footer, "compare mode lost its footer primary").toContain('variant="primary"');
  });

  it("no green, no auto margin in a wrapping row, and no bare label track", () => {
    /*
      §10 and §3's three structural rules. The auto-margin one is the sharp
      one: it renders correctly and breaks every export, so nothing behavioural
      can see it.
    */
    /*
      ⚠ COMMENTS ARE STRIPPED FIRST, AND THE FIRST DRAFT OF THIS ARM WAS RED
      BECAUSE OF ITS OWN SUBJECT: the stylesheet quotes §6b's rule — *"never
      grey and never green"* — beside the badge, and a naive grep for the word
      caught the sentence forbidding it. A rule written in prose is not a rule
      shipped, so the ban is asked of the declarations alone.
    */
    const css = code(read(join(HERE, "settings.css")));
    expect(css.toLowerCase(), "green entered the system").not.toMatch(
      /green|#0[0-9a-f]?f[0-9a-f]?0/i,
    );

    /* Any rule that wraps must not also set an auto margin. */
    for (const block of css.split("}")) {
      if (!/flex-wrap:\s*wrap/.test(block)) continue;
      expect(block, `a wrapping row sets an auto margin:\n${block}`).not.toMatch(
        /margin(-\w+)?:\s*[^;]*auto/,
      );
    }

    /* §3 rule 3 — the spacer exists and the label class never takes the track. */
    expect(css).toContain(".dp-set__spacer { flex: 1; }");
    const label = css.slice(css.indexOf(".dp-set__label"), css.indexOf(".dp-set__label") + 160);
    expect(label, "a text label was given the flexible track").not.toContain("flex: 1");
  });


  /* ==========================================================================
     #381 — HIS FORM CORRECTIONS. Every arm below exists because he read the
     built pane against his own prototype and the two disagreed, so each one
     names the shape the prototype draws rather than the shape the brief
     described. His ruling, verbatim: *"where my brief describes a row inline
     and the prototype draws a card, the prototype wins."*
     ========================================================================== */

  it("card 381 — the Usage stats are ONE bordered card in three columns, never three stacked rows", () => {
    const usage = code(read(join(SECTIONS_DIR, "UsageSection.tsx")));
    const css = code(read(join(HERE, "settings.css")));

    expect(usage, "the stats went back to stacked rows").not.toContain("dp-set__statrow");
    expect(usage, "the stat card is not used").toContain("StatCard");

    const card = css.slice(
      css.indexOf(".dp-set__statcard"),
      css.indexOf(".dp-set__statcard") + 260,
    );
    expect(card, "the stat card lost its three columns").toContain("repeat(3, 1fr)");
    expect(card, "the stat card lost its border").toMatch(/border:\s*1px solid var\(--borderCard\)/);

    /* Item 2: each COLUMN stacks label above value above note. A three-column
       grid whose cells lay their contents out in a row is the same defect in a
       nicer box. */
    const cell = css.slice(
      css.indexOf(".dp-set__statcell {"),
      css.indexOf(".dp-set__statcell {") + 200,
    );
    expect(cell, "a stat column stopped stacking").toContain("flex-direction: column");
  });

  it("card 381 — the bar has a track you can see, and `--fill` is the value it must not be", () => {
    /*
      He read the bars as having NO track. The track existed and was `--fill`,
      which in dark is #232326 against a #1A1A1D pane — nine points, on a 6px
      bar. His prototype's own track is `var(--rule)`.

      This arm is written as a POSITIVE CONTROL on the wrong value rather than
      only on the right one: `background: var(--fill)` is the exact declaration
      that shipped and read as absent, and it is what a future tidy-up would
      most plausibly restore.
    */
    const css = code(read(join(HERE, "settings.css")));
    const bar = css.slice(css.indexOf(".dp-set__bar {"), css.indexOf(".dp-set__barfill"));
    expect(bar, "the bar has no track at all").toMatch(/background:\s*var\(--/);
    expect(bar, "the track went back to --fill, which cannot be seen against the pane").not.toMatch(
      /background:\s*var\(--fill\)/,
    );
    expect(bar, "the track lost the ring that separates it from the pane").toContain("box-shadow");
  });

  it("card 381 — nothing renders a LIFETIME counter against a MONTHLY allowance", () => {
    /*
      His first live defect: `115,695 credits used · of 5,000 this month`.
      `points.creditsUsed` is set to 0 at row creation and only incremented, so
      it is an all-time figure; the allowance beside it is monthly.

      The arm is on the WIRE — what `AccountSurfaces` hands the modal — because
      that is where the wrong number entered, and a check on the pane's copy
      would pass the day somebody re-plumbs the same field under another name.
    */
    const surfaces = code(read(join(HERE, "AccountSurfaces.tsx")));
    expect(surfaces, "the lifetime counter is being passed into Settings again").not.toContain(
      "creditsUsed",
    );
    expect(surfaces, "the period the window is scoped to is not passed").toContain("periodStart");

    const usage = code(read(join(SECTIONS_DIR, "UsageSection.tsx")));
    expect(usage, "Usage takes a credits figure it cannot scope to a window").not.toMatch(
      /creditsUsed:\s*number/,
    );
    expect(usage, "Usage no longer sums a real per-day window").toContain("getDailyUsage");
  });

  it("card 381 — the one-bar chart is gone, and it is gone because it was measured", () => {
    /*
      His item 6, and his own option 2. Measured on his 622 real spend rows
      before anything was built: every one of them is `type: "generation"`, so
      the fold the block drew produced ONE bar at 100% — *"a single bar at 100%
      conveys less than nothing"* — and `engineUsed`, the column his preferred
      option 1 would map, is NULL on 53% of his spend by credits and holds a
      subsystem name and a model id on the rest.
    */
    const usage = code(read(join(SECTIONS_DIR, "UsageSection.tsx")));
    expect(usage, "the by-type fold came back").not.toContain("byType");
    expect(usage, "a per-tool ramp came back without a reader behind it").not.toContain(
      "RANK_TOKENS",
    );
  });

  it("card 381 — the workspace name has ONE source, and it is not the product name", () => {
    /*
      He read the header as `Klieg` against a pane he remembered as `Klieg
      Studio`. Driven before the change: nothing in the product rendered `Klieg
      Studio` at all — `BRAND_NAME` stood in for the workspace in both places.
      Both of his own specifications say otherwise (brief §4's header line, and
      the prototype's `{{ workspace }}`), so the workspace got its own constant.

      The arm is that the two surfaces read the SAME one. That is the class; the
      string is the instance.
    */
    const modal = code(read(join(HERE, "SettingsModal.tsx")));
    const profile = code(read(join(SECTIONS_DIR, "ProfileSection.tsx")));
    expect(modal, "the header names the workspace with the product name again").not.toContain(
      "BRAND_NAME",
    );
    expect(modal, "the header stopped reading the workspace constant").toContain("WORKSPACE_NAME");
    expect(profile, "the Profile note stopped reading the same constant").toContain(
      "WORKSPACE_NAME",
    );
  });

  it("card 381 — Notifications and Security rows are CARDS, and the destructive one is the accent card", () => {
    const notifications = code(read(join(SECTIONS_DIR, "NotificationsSection.tsx")));
    const security = code(read(join(SECTIONS_DIR, "SecuritySection.tsx")));
    expect(notifications, "the toggle rows went back to hairline rows").not.toContain(
      "<SettingsRow",
    );
    expect(notifications, "the toggle rows are not cards").toContain("<SettingsCard");
    expect(security, "the action rows went back to hairline rows").not.toContain("<SettingsRow");
    expect(security, "Delete account lost the accent card that sets it apart").toContain(
      'tone="accent"',
    );

    const css = code(read(join(HERE, "settings.css")));
    const cardRow = css.slice(css.indexOf(".dp-set__cardrow {"), css.indexOf(".dp-set__cardrow +"));
    expect(cardRow, "a card row lost its border").toMatch(
      /border:\s*1px solid var\(--borderCard\)/,
    );
  });

  it("card 381 — Profile's fields STACK, which is one of the four questions he named", () => {
    /*
      *"what is a CARD vs a ROW · what carries a BORDER · what STACKS vs sits
      inline · where notes belong and how long."* The prototype stacks every
      Profile field — label, then the box, then the note — inside a capped
      column; the built pane had them as leader rows with a 220px input in a
      `flex: none` track.
    */
    const profile = code(read(join(SECTIONS_DIR, "ProfileSection.tsx")));
    expect(profile, "Profile went back to leader rows").not.toContain("<SettingsRow");
    expect(profile, "Profile's fields do not stack").toContain("<SettingsField");
    expect(profile, "the field lost its full width inside the capped column").toContain(
      "dp-set__fullfield",
    );
  });

  it("the mutations are untouched — every retired call site still calls the same procedure", () => {
    /*
      §1: *"Excluded from this brief: what the mutations do. Same profile
      update, same billing calls, same top-up, same referral logic. Only where
      they live and how they look."* So the set of billing procedures the client
      calls must be the same set it called before. Derived from the tree, not
      listed twice: every `trpc.billing.*` the three surfaces call.
    */
    const surfaces = [
      read(join(CLIENT, "features", "billing", "ChangePlanModal.tsx")),
      read(join(CLIENT, "features", "billing", "AddCreditsModal.tsx")),
      read(join(SECTIONS_DIR, "BillingSection.tsx")),
    ].join("\n");
    for (const call of [
      "trpc.billing.getPlans",
      "trpc.billing.getStatus",
      "trpc.billing.getInvoices",
      "trpc.billing.previewPlanChange",
      "trpc.billing.changePlan",
      "trpc.billing.createSubscriptionCheckout",
      "trpc.billing.cancelSubscription",
      "trpc.billing.createPortalSession",
    ]) {
      expect(surfaces, `${call} lost its call site in the rebuild`).toContain(call);
    }
  });
});
