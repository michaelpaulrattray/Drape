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
