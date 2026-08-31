/**
 * #278 — the chrome is one composition, and a page cannot ship without it.
 *
 * The founder found the defect himself: every casting page mounted the shell
 * and handed it no chrome, so on the four surfaces that spend credits there was
 * no account menu, no credits chip and no settings gear. His ruling was *"all
 * of them same as lobby"*.
 *
 * The fix wants to be structural — *"a new page is correct by construction
 * rather than by remembering"* — and it cannot be, quite: the composition needs
 * `features/` and `foundation/` is forbidden to import that (its own guard).
 * So `AppChrome` is the app-level shell, and THIS is the arm that stops the
 * next page repeating the mistake. Without it the whole fix is a convention.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = join(import.meta.dirname, "..");
const PAGES = join(CLIENT, "pages");

const pageFiles = () =>
  readdirSync(PAGES)
    .filter((n) => n.endsWith(".tsx"))
    .map((name) => ({ name, text: readFileSync(join(PAGES, name), "utf8") }));

/** Strip comments, so a docblock explaining the rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("#278 — every in-app page gets the chrome, from one composition", () => {
  it("no page mounts AppShell directly — pages mount AppChrome", () => {
    /*
      This is the arm that would have caught the original defect. `AppShell` is
      a layout primitive with four optional chrome slots; a page that mounts it
      renders a rail, a breadcrumb and an otherwise empty bar, and nothing in
      the build complains. That is exactly what four casting pages did.
    */
    const offenders = pageFiles()
      .filter(({ text }) => /<AppShell[\s/>]/.test(code(text)))
      .map(({ name }) => name);

    expect(
      offenders,
      `These pages mount AppShell directly and so draw no account menu, credits chip or settings gear.\n` +
        `Mount AppChrome instead (client/src/components/AppChrome.tsx).\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("READS A REAL POPULATION — the absence above is over pages that exist", () => {
    /*
      An absence assertion over an empty list is the cheapest false pass there
      is: move the folder, break the glob, and `[] === []` reports the
      architecture is sound. So the population is asserted, and the arm proves
      its own matcher works by finding the mounts it is supposed to find.
    */
    const files = pageFiles();
    expect(files.length).toBeGreaterThan(10);

    const mounts = files.filter(({ text }) => /<AppChrome[\s/>]/.test(code(text)));
    const names = mounts.map((f) => f.name).sort();
    /* The lobby plus the three casting surfaces his ruling was about — and the
       component specimen sheet, which wears the real chrome on purpose: it moved
       to /admin/foundation with #261, and comparing a component against the
       frame it ships inside is the whole reason the page exists. */
    expect(names).toEqual([
      "AdminFoundation.tsx",
      "AppLobby.tsx",
      "CastingRoom.tsx",
      "CastingSheet.tsx",
      "CastingV2.tsx",
    ]);
  });

  it("AppChrome is the only thing that composes the cluster — not five copies", () => {
    /*
      Working law 4: a second list shadowing a source of truth always drifts
      from it. The alternative shape here was passing the same four props at
      seven mount sites, and this month's own worked example of where that ends
      is the three popover implementations (#304).
    */
    const composers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!entry.name.endsWith(".tsx") || entry.name.endsWith(".test.tsx")) continue;
        const text = code(readFileSync(p, "utf8"));
        if (/<CreditsChip[\s/>]/.test(text) && /<LobbyUtilityMenu[\s/>]/.test(text)) {
          composers.push(entry.name);
        }
      }
    };
    walk(CLIENT);

    expect(composers, composers.join(", ")).toEqual(["AppChrome.tsx"]);
  });

  it("AppChrome actually mounts the shell and hands it all four chrome slots", () => {
    /*
      The positive control for the whole file: the three arms above are about
      what is ABSENT, and every one of them stays green if AppChrome quietly
      stops passing the chrome. This one reads what it passes.
    */
    const text = code(readFileSync(join(CLIENT, "components", "AppChrome.tsx"), "utf8"));
    expect(text).toMatch(/<AppShell/);
    for (const slot of ["topbarLeft=", "topbarRight=", "workspace=", "account="]) {
      expect(text, `AppChrome no longer passes ${slot}`).toContain(slot);
    }
  });

  it("the closed modals do not mount — a Stripe proration read is not page furniture", () => {
    /*
      Measured before this shipped: `BillingModal` fires `billing.getPlans` and
      `billing.getStatus` on mount, `CreditTopupModal` adds
      `getSubscriptionDetails` and `previewPlanChange`, and the last is gated on
      `!isFreeUser` — never on `isOpen`. The query client is `new QueryClient()`
      with stock defaults, so they refire on every mount.
      Mounting them unconditionally here would have made #278's fix cost a
      paying customer a Stripe proration preview on EVERY casting page view.
      The guard exists because the tempting simplification — copy the lobby's
      unconditional block — reads as more faithful and is the expensive one.
    */
    const text = code(readFileSync(join(CLIENT, "components", "AppChrome.tsx"), "utf8"));
    for (const [flag, component] of [
      ["isBillingOpen", "BillingModal"],
      ["isTopupOpen", "CreditTopupModal"],
      ["isReferralOpen", "ReferralModal"],
      ["showSettings", "ProfileSettingsModal"],
    ]) {
      const gate = text.indexOf(`{${flag} ?`);
      expect(gate, `${component}'s open-gate \`{${flag} ?\` is gone`).toBeGreaterThan(-1);
      /* The component must be the very next thing the gate renders. */
      expect(
        text.slice(gate, gate + 80),
        `${component} must be mounted only while open`,
      ).toContain(`<${component}`);
    }
  });
});
