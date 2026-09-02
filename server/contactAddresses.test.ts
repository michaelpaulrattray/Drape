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

/**
 * ⚠ **#452 — THE SAME PERSON, THE OTHER HALF: WHAT THE *SERVER* SENDS THEM.**
 *
 * The arms above walk `client/src` and match `mailto:`. The freeze notification
 * is a **server** file sending an **`https:`** URL, so it was structurally
 * invisible to them — not missed, unreachable. `server/klaviyo.ts` sent every
 * frozen customer `https://drape.ai/support`, and **both live call sites omit
 * `supportUrl`** (`routes/admin/users.ts`, `routes/moderatorReconciliation.ts`),
 * so the default WAS the message.
 *
 * # ⚠ THE DOMAIN WAS THE SMALLER HALF — THE PATH DID NOT EXIST EITHER
 *
 * There has never been a `/support` route in `App.tsx`. **Swapping the domain
 * would have produced a tidier 404**, and a guard that only checked the host
 * would have gone green on it. That is why the second arm below resolves the
 * PATH against the client's own route table rather than reading the domain.
 *
 * His ruling, 2026-09-02, verbatim and entire: ***"Point it at
 * support@klieglabs.com"*** — the address #392 established for the same person
 * in the same situation, rather than inventing a page to make a URL true.
 *
 * # ⚠ STATED LIMITS, because a clean run here is a floor and not coverage
 *
 * - It reads **string literals in server source**. A pointer assembled at
 *   runtime, or read from an env var, is invisible to it.
 * - **Whether Klaviyo's template renders `support_url` at all is UNVERIFIED** —
 *   the template lives in Klaviyo, not in this repository. What is proven here
 *   is that the value we put on the wire is reachable, not that a customer's
 *   eye ever meets it.
 * - The dead-path arm compares a **literal** path against the route table, so a
 *   pointer into a parameterized route (`/casting/cast/123` against the declared
 *   `/casting/cast/:castId`) would false-red. Fail-LOUD, and deliberately not
 *   pre-solved: no server pointer has a path today, and a matcher written for a
 *   case that does not exist is a matcher nothing has ever driven.
 * - `server/routes/referral.ts` falls back to `https://drape.ai` for a referral
 *   link's base when the `Origin` header is absent. It is a **bare host with no
 *   path**, so it is not a dead destination in this arm's sense, and it belongs
 *   to the founder's parked branding pass — named in its own arm below so it is
 *   not mistaken for something this file missed.
 */

const SERVER_SRC = path.resolve(__dirname);
const APP_TSX = path.resolve(__dirname, "..", "client", "src", "App.tsx");

/**
 * ⚠ **ONE EXTRACTOR, SHARED BY THE READING AND ITS CONTROL** — the same
 * discipline as `MAILTO` above, for the same reason.
 *
 * It matches a declaration or property whose NAME says support/help/appeal and
 * whose value is a string literal, so it catches both shapes the product has
 * used: the inline `support_url: … || "https://drape.ai/support"` these arms
 * were written against, and the named constant that replaced it.
 *
 * ⚠ **ITS FIRST SHAPE REQUIRED A CHARACTER BEFORE THE KEYWORD**
 * (`[A-Za-z_$][\w$]*(?:support|…)`), so it matched `FROZEN_ACCOUNT_SUPPORT_URL`
 * and **could not see `support_url` — the very line this card is about.** Every
 * arm below was green on a tree that still shipped the bug. The positive
 * control caught it, which is the whole reason a control is written from the
 * real pre-fix bytes rather than from a plausible-looking imitation.
 */
const SUPPORT_POINTER =
  /\b([\w$]*(?:support|help|appeal)[\w$]*)\s*[:=]\s*(?:[^,;\n]*?\|\|\s*)?["'`]([^"'`\s]+)["'`]/gi;

const supportPointersIn = (
  text: string,
  file: string,
): { file: string; name: string; url: string }[] =>
  [...text.matchAll(new RegExp(SUPPORT_POINTER.source, "gi"))]
    .map((m) => ({ file, name: m[1], url: m[2] }))
    /* Only destinations. A `supportEmail: "…"` with no scheme is not a link. */
    .filter(({ url }) => /^(https?:|mailto:)/i.test(url));

const serverSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return serverSourceFiles(full);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [full] : [];
  });

const serverSupportPointers = (): { file: string; name: string; url: string }[] =>
  serverSourceFiles(SERVER_SRC).flatMap((full) =>
    supportPointersIn(fs.readFileSync(full, "utf8"), path.relative(SERVER_SRC, full)),
  );

/** Every path the client actually routes, read from `App.tsx`'s own declarations. */
const clientRoutePaths = (): string[] =>
  [...fs.readFileSync(APP_TSX, "utf8").matchAll(/<Route\s+path=["'`]([^"'`]+)["'`]/g)].map(
    (m) => m[1],
  );

/**
 * A destination on the retired domain, host or mailbox, subdomains included.
 *
 * ⚠ **The domain's own dots are ESCAPED** (gate review, PR #465). Interpolated
 * raw, `drape.ai` reads as `drape<any>ai`, so a host like `drapeXai` would have
 * reddened the suite. The error direction was fail-LOUD rather than silent, but
 * a guard that can cry wolf teaches people to widen it.
 */
const onRetiredDestination = (url: string) =>
  new RegExp(
    `(@|//)([\\w.-]*\\.)?${RETIRED_MAIL_DOMAIN.replace(/\./g, "\\.")}(/|$)`,
    "i",
  ).test(url);

/**
 * The path of an app URL, or `null` when there is no path at all. A bare host
 * (`https://drape.ai`) is a branding question, not a dead link.
 */
const appPathOf = (url: string): string | null => {
  const m = /^https?:\/\/[^/]+(\/[^?#]*)?/i.exec(url);
  if (!m) return null;
  const routePath = (m[1] ?? "").replace(/\/+$/, "");
  return routePath === "" ? null : routePath;
};

describe("#452 — the support pointers the SERVER sends a customer", () => {
  it("the population is real — the server ships at least one support pointer", () => {
    /*
      Same reason as #392's population arm: an absence assertion over an empty
      list is green when the extractor breaks, and this extractor is a regex
      over a folder walk.
    */
    const found = serverSupportPointers();
    expect(found.length, "no support pointer found in server/ — the extractor is broken").toBeGreaterThan(0);
  });

  it("the frozen customer's appeal route is present and reaches the live domain", () => {
    /*
      ⚠ THE POSITIVE HALF, and it is the arm that matters most: every arm below
      is green if the pointer is DELETED, and sending a frozen customer nothing
      at all is worse than sending them the wrong place.
    */
    const klaviyo = fs.readFileSync(path.join(SERVER_SRC, "klaviyo.ts"), "utf8");
    expect(klaviyo).toMatch(/FROZEN_ACCOUNT_SUPPORT_URL\s*=\s*"mailto:support@klieglabs\.com"/);
    expect(klaviyo).toMatch(/support_url:\s*params\.supportUrl\s*\|\|\s*FROZEN_ACCOUNT_SUPPORT_URL/);
  });

  it("no server support pointer names the retired domain", () => {
    const offenders = serverSupportPointers()
      .filter(({ url }) => onRetiredDestination(url))
      .map(({ file, name, url }) => `${file} → ${name} = ${url}`);

    expect(
      offenders,
      `The server sends a customer a destination on the retired domain:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("⚠ no server support pointer names an app path the client does not route", () => {
    /*
      THE ARM THE DOMAIN CHECK CANNOT REPLACE. `https://klieglabs.com/support`
      passes every host test there is and is still a 404, because `/support` has
      never existed. Derived from `App.tsx` rather than from a list, so a route
      being renamed reddens here instead of drifting.
    */
    const routes = clientRoutePaths();
    expect(routes.length, "no <Route> found in App.tsx — the route reader is broken").toBeGreaterThan(0);

    const dead = serverSupportPointers()
      .map((pointer) => ({ ...pointer, appPath: appPathOf(pointer.url) }))
      .filter(({ appPath }) => appPath !== null && !routes.includes(appPath))
      .map(({ file, name, url }) => `${file} → ${name} = ${url}`);

    expect(
      dead,
      `The server sends a customer to a path the client has no route for:\n${dead.join("\n")}`,
    ).toEqual([]);
  });

  it("POSITIVE CONTROL — the real pre-fix bytes, driven through the real extractor", () => {
    /*
      ⚠ **THE SHIPPED BUG, NOT A CARICATURE.** This is the exact line
      `server/klaviyo.ts` carried until 2026-09-02, and it must fail BOTH arms:
      the domain one and the dead-path one. A control that only trips the domain
      arm would have let a `klieglabs.com/support` "fix" straight through.
    */
    const before = `    support_url: params.supportUrl || "https://${RETIRED_MAIL_DOMAIN}/support",`;
    const found = supportPointersIn(before, "klaviyo.ts");
    expect(found.length, "the extractor no longer sees the shipped bug").toBe(1);
    expect(found[0].url).toBe(`https://${RETIRED_MAIL_DOMAIN}/support`);
    expect(
      onRetiredDestination(found[0].url),
      "the retired-domain arm would not have caught the shipped bug",
    ).toBe(true);
    expect(
      clientRoutePaths().includes(appPathOf(found[0].url) ?? ""),
      "the dead-path arm would not have caught the shipped bug",
    ).toBe(false);

    /* The tidier 404 — the "fix" a domain-only guard would have accepted. */
    const tidier = supportPointersIn(`  support_url: "https://klieglabs.com/support",`, "x.ts");
    expect(onRetiredDestination(tidier[0].url), "the rebranded dead path is not a domain finding").toBe(
      false,
    );
    expect(
      clientRoutePaths().includes(appPathOf(tidier[0].url) ?? ""),
      "a rebranded dead path evades the dead-path arm",
    ).toBe(false);

    /* And the live answer is caught by NEITHER — an arm that flags everything is not an arm. */
    const live = supportPointersIn(
      `const FROZEN_ACCOUNT_SUPPORT_URL = "mailto:support@klieglabs.com";`,
      "live.ts",
    );
    expect(live.length).toBe(1);
    expect(appPathOf(live[0].url)).toBeNull();
    expect(onRetiredDestination(live[0].url)).toBe(false);
  });

  it("⚠ the referral base-URL fallback is NAMED, not swept", () => {
    /*
      `routes/referral.ts` falls back to `https://drape.ai` when the `Origin`
      header is absent. It is on the retired domain and it is deliberately left
      alone: the founder parked branding (*"we will change the old drape emails
      and branding at a later date"*), and unlike the freeze link it is a bare
      host rather than a path that cannot exist.

      ⚠ This arm is DOCUMENTATION and says so. What it asserts is the thing that
      COULD change — that the fallback is still there and still a bare host — so
      if somebody gives it a path it stops being a branding question and this
      reddens.
    */
    const referral = fs.readFileSync(path.join(SERVER_SRC, "routes", "referral.ts"), "utf8");
    const fallbacks = [...referral.matchAll(/headers\.origin\s*\|\|\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(fallbacks.length, "the referral origin fallback moved or was renamed").toBeGreaterThan(0);
    for (const url of fallbacks) {
      expect(appPathOf(url), `the referral fallback grew a path: ${url}`).toBeNull();
    }
  });
});
