import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ⚠ **#392 — WHERE A LOCKED-OUT CUSTOMER'S ONLY MESSAGE GOES.**
 *
 * `client/src/pages/Login.tsx` offers *Contact Support* under one condition
 * and one only: `errorType === "suspended"`. So the person clicking it is
 * **somebody whose account we have suspended, writing to appeal it** — and it
 * is their only route, because a suspended account cannot get in to use
 * anything else.
 *
 * It pointed at `support@drape.ai`. **The founder's answer, 2026-09-01,
 * verbatim: *"klieg recieves all the mail its setup with the resend account"***
 * — and the product's own configured reply-to has said so since the rebrand
 * (`server/routes/emailVerification.ts`). The appeal was addressed outside that
 * setup.
 *
 * # ⚠ THIS IS NOT A REBRAND SWEEP, AND THE ARM IS SHAPED SO IT CANNOT BECOME ONE
 *
 * His standing ruling holds: *"we will change the old drape emails and branding
 * at a later date."* The visible name, the sender string and every UI mention
 * stay exactly as they are. The link's own words are `Contact Support` — the
 * domain never appears on screen — so this changed a destination and zero
 * branding.
 *
 * # ⚠ AND A GREP FOR THE NEW ADDRESS WOULD PROVE NOTHING
 *
 * It passes on a file that merely mentions it. **The arm that catches a
 * regression is the NEGATIVE one**: no `mailto:` anywhere in the client points
 * at the old domain. That is also the arm that would have caught this in the
 * first place, and it is why it is derived from the tree rather than aimed at
 * `Login.tsx`.
 */

const CLIENT_SRC = path.resolve(__dirname, "..", "client", "src");
const RETIRED_MAIL_DOMAIN = "drape.ai";

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css|html)$/.test(entry.name) ? [full] : [];
  });

/**
 * ⚠ **ONE REGEX, USED BY BOTH THE READING AND ITS CONTROL.** The first shape of
 * this file re-stated the pattern as a second literal inside the positive
 * control — so editing the extractor would have left the control validating a
 * frozen copy, unable to fail alongside the thing it exists to prove. Working
 * law 4: a second copy of a source of truth always drifts from it.
 */
const MAILTO = /mailto:([^"'`\s>)]+)/g;

/**
 * ⚠ **THE QUERY STRING IS STRIPPED, AND THAT IS NOT TIDINESS.**
 * `mailto:support@drape.ai?subject=Appeal` is a real, working link and a real
 * regression, and the address it yields does not END WITH the old domain — so
 * the arm below would have stayed green on it. A prefilled subject is exactly
 * what a helpful person would add to an appeal link.
 */
const addressOf = (raw: string) => raw.split("?")[0].toLowerCase();

/** Every `mailto:` target the client ships, with the file it lives in. */
const mailtoTargetsIn = (text: string, file: string): { file: string; address: string }[] =>
  [...text.matchAll(new RegExp(MAILTO.source, "g"))].map((m) => ({
    file,
    address: addressOf(m[1]),
  }));

const clientMailtoTargets = (): { file: string; address: string }[] =>
  sourceFiles(CLIENT_SRC).flatMap((full) =>
    mailtoTargetsIn(fs.readFileSync(full, "utf8"), path.relative(CLIENT_SRC, full)),
  );

/**
 * ⚠ **A SUBDOMAIN IS THE SAME DOMAIN FOR THIS PURPOSE.** The product's own
 * sender is `verify@mail.klieglabs.com`, so `support@mail.drape.ai` is the
 * shape a restored address would most plausibly take — and `@drape.ai` does not
 * match it.
 */
const onRetiredDomain = (address: string) =>
  address.endsWith(`@${RETIRED_MAIL_DOMAIN}`) || address.endsWith(`.${RETIRED_MAIL_DOMAIN}`);

describe("#392 — the client's contact addresses", () => {
  it("the population is real — the client ships at least one mailto", () => {
    /*
      An absence arm over an empty list is green when the extractor breaks, and
      this extractor is a regex over a folder walk. Assert it found something
      before believing it found nothing wrong.
    */
    const targets = clientMailtoTargets();
    expect(targets.length, "no mailto found in client/src — the extractor is broken").toBeGreaterThan(0);
  });

  it("no client mailto points at the retired mail domain", () => {
    const offenders = clientMailtoTargets()
      .filter(({ address }) => onRetiredDomain(address))
      .map(({ file, address }) => `${file} → ${address}`);

    expect(
      offenders,
      `A customer's mail is addressed to a domain outside the Resend setup:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the suspended account's appeal link is present and reaches the live domain", () => {
    /*
      ⚠ THE POSITIVE HALF. The negative arm above is green if the link is
      DELETED, and deleting a suspended customer's only route is a worse outcome
      than the wrong address. This asserts the route still exists.
    */
    const login = fs.readFileSync(path.join(CLIENT_SRC, "pages", "Login.tsx"), "utf8");
    expect(login).toMatch(/mailto:support@klieglabs\.com/);
    /* And the words on screen are unchanged — nothing visible moved. */
    expect(login).toMatch(/Contact Support/);
  });

  it("POSITIVE CONTROL — three evasion shapes, all driven through the real extractor", () => {
    /*
      ⚠ **DRIVEN THROUGH `mailtoTargetsIn`, NEVER THROUGH A COPY OF ITS REGEX.**
      A control that re-states the pattern validates a frozen copy and stops
      being able to fail with the instrument it guards.

      Two of these three were added by review and neither was hypothetical: the
      plain form was the only one the first shape caught, and both others are
      working links that a real regression would plausibly take.
    */
    const shapes = [
      `<a href="mailto:support@${RETIRED_MAIL_DOMAIN}">Contact Support</a>`,
      `<a href="mailto:support@${RETIRED_MAIL_DOMAIN}?subject=Appeal">Contact Support</a>`,
      `<a href="mailto:support@mail.${RETIRED_MAIL_DOMAIN}">Contact Support</a>`,
    ];

    for (const shape of shapes) {
      const found = mailtoTargetsIn(shape, "sabotage.tsx");
      expect(found.length, `the extractor found nothing in: ${shape}`).toBe(1);
      expect(
        onRetiredDomain(found[0].address),
        `this evades the arm and would ship: ${shape} → ${found[0].address}`,
      ).toBe(true);
    }

    /* And the live address is NOT caught — an arm that flags everything is not an arm. */
    const live = mailtoTargetsIn(`href="mailto:support@klieglabs.com"`, "live.tsx");
    expect(onRetiredDomain(live[0].address)).toBe(false);
  });

  it("⚠ the server's fixture address is deliberately NOT in this population", () => {
    /*
      `server/referral.test.ts` uses `mike@drape.ai` as a DISPOSABLE-EMAIL
      fixture — the address is that test's INPUT, and changing it changes what
      the test proves. The card says so by name.

      ⚠ **THIS ARM IS DOCUMENTATION AND SAYS SO**, because review pointed out
      that its first shape could not fail: the walker only ever visits
      `client/src`, so no path it returns can contain `referral.test`. What is
      asserted instead is the thing that COULD change — that the fixture is
      still there, still on the old domain, and still outside the walked tree —
      so deleting or moving it reddens here rather than silently widening the
      population this file measures.
    */
    const fixture = fs.readFileSync(path.resolve(__dirname, "referral.test.ts"), "utf8");
    expect(fixture, "the disposable-email fixture moved or changed").toContain(
      `mike@${RETIRED_MAIL_DOMAIN}`,
    );
    expect(
      path.relative(CLIENT_SRC, path.resolve(__dirname, "referral.test.ts")).startsWith(".."),
      "the fixture is inside the walked tree — the exclusion is no longer structural",
    ).toBe(true);
  });
});
