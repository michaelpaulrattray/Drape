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

/** Every `mailto:` target the client ships, with the file it lives in. */
const clientMailtoTargets = (): { file: string; address: string }[] =>
  sourceFiles(CLIENT_SRC).flatMap((full) =>
    [...fs.readFileSync(full, "utf8").matchAll(/mailto:([^"'`\s>)]+)/g)].map((m) => ({
      file: path.relative(CLIENT_SRC, full),
      address: m[1],
    })),
  );

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
      .filter(({ address }) => address.toLowerCase().endsWith(`@${RETIRED_MAIL_DOMAIN}`))
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

  it("POSITIVE CONTROL — the matcher sees a retired address when there is one", () => {
    const sabotage = `<a href="mailto:support@${RETIRED_MAIL_DOMAIN}">Contact Support</a>`;
    const found = [...sabotage.matchAll(/mailto:([^"'`\s>)]+)/g)].map((m) => m[1]);
    expect(found).toEqual([`support@${RETIRED_MAIL_DOMAIN}`]);
    expect(found[0].toLowerCase().endsWith(`@${RETIRED_MAIL_DOMAIN}`)).toBe(true);
  });

  it("⚠ the server's fixture address is deliberately NOT in this population", () => {
    /*
      `server/referral.test.ts` uses `mike@drape.ai` as a DISPOSABLE-EMAIL
      fixture — the address is that test's INPUT, and changing it changes what
      the test proves. The card says so by name. This arm reads `client/src`
      only, and this line is why.
    */
    expect(clientMailtoTargets().every(({ file }) => !file.includes("referral.test"))).toBe(true);
  });
});
