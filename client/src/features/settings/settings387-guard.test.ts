import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/* #385 moved the window out of the pane and into a module both the pane and
   the two money modals read, so the window cannot mean two things. ⚠ #624 then
   moved the window itself to the SERVER — a day-keyed reassembly cannot see a
   period that begins mid-day — and what stayed on the client is the COPY. The
   window's own arms live in `server/cycleSpend.test.ts`; these are the arms
   about what the pane SAYS, which is what card 387 was about. */
import { spendWindowCopy } from "./usageWindow";

/**
 * #387 — his five corrections to the built Settings panes, held where each one
 * can actually fail.
 *
 * ## Why the window arms DRIVE rather than grep
 *
 * The defect this card is mostly about was never visible in the source: the
 * arithmetic was correct and rendered `0`. What was wrong was the WINDOW it was
 * correct over. A source-reading arm would have passed on every version of this
 * pane, including both wrong ones — so `windowStart` is exported and called
 * with a frozen clock and his own real dates.
 *
 * ⚠ **THE PREMISE IS PINNED TOO, and it is the load-bearing part.** The whole
 * ruling rests on one measured fact: a free account's credits NEVER refresh, so
 * `of 5,000 this month` promised a refill that does not come. That fact lives
 * in `server/stripe/webhooks.ts`, not in this pane. If somebody later makes free
 * credits renew, this pane's design becomes wrong and nothing here would
 * otherwise say so.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const REPO = join(HERE, "..", "..", "..", "..");
const read = (path: string) => readFileSync(path, "utf8");
/** Strip comments — a rule quoted in prose is not a rule shipped. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

afterEach(() => vi.useRealTimers());

describe("card 387 item 2 — the window follows the account", () => {
  /*
    His words: *"its also showing that i've used no credits"*. Measured at his
    production rows: last spend 2026-08-30, month rolled over 2026-09-01, so the
    invented calendar month held nothing and the sum was RIGHT.
  */
  const HIS_LAST_SPEND = "2026-08-30";

  it("⚠ the window that reaches back past his last roll is the SERVER's, and this says where", () => {
    /*
      ⚠ THIS ARM MOVED RATHER THAN DIED (#624). It used to call `windowStart`
      and read a first UTC day; the window is now `spendWindow` in
      `server/db/billing.ts`, driven there against his own dates — a rolling 30
      days in real time, which reaches ${HIS_LAST_SPEND} from 1 September just
      as the day-keyed one did.

      What is kept HERE is the pointer, because a reader arriving at card 387's
      complaint must be able to find the thing that answers it. A grep for the
      symbol is the cheapest form of that and it goes red if the window is
      renamed or moved again.
    */
    const server = code(read(join(REPO, "server", "db", "billing.ts")));
    expect(server, "the spend window is no longer in the billing reader").toContain(
      "export function spendWindow",
    );
    expect(server, "the rolling fallback his complaint depends on is gone").toContain(
      "ROLLING_DAYS = 30",
    );
    expect(HIS_LAST_SPEND, "his date is quoted so the arm above stays legible").toBe("2026-08-30");
  });

  it("and it does not call itself a month, because no month is being measured", () => {
    /*
      The naming half, deliberately its OWN arm rather than a second assertion
      on the one above — a pane can reach the right rows under a label that
      still promises a monthly cycle nothing runs. Split so the negative control
      can tell the two failures apart.
    */
    const w = spendWindowCopy("rolling30", 24_535, 5_000);
    expect(w.heading).toBe("Usage in the last 30 days");
    expect(w.heading, "the window is claiming a month again").not.toMatch(/month/i);
    expect(w.over, "the phrase under a RATE claims a month").not.toMatch(/month/i);
  });

  it("no billing period means NO monthly-allowance claim — it says what is left", () => {
    /*
      ⚠ THE SECOND HALF OF THE DEFECT. `refreshMonthlyCredits` is never reached
      for the free tier, so `of 5,000 this month` promised a refill that never
      arrives. The only true figure beside a pool that does not refill is the
      pool.
    */
    const w = spendWindowCopy("rolling30", 24_535, 5_000);
    expect(w.note).toBe("24,535 credits left");
    expect(w.note, "the allowance that never renews is being claimed again").not.toContain("5,000");
    expect(w.note).not.toMatch(/month/i);
  });

  it("a billing period keeps its period and its allowance — both true there", () => {
    const w = spendWindowCopy("period", 12_000, 75_000);
    expect(w.heading).toBe("Usage this billing period");
    expect(w.note).toBe("of 75,000 this billing period");
    /* ⚠ TWO PHRASINGS, ONE WINDOW. A group heading and a note under a rate need
       different English (*"averaged over in the last 30 days"* is what one
       string for both produces), and a surface writing its own second one is
       how two labels come apart. Both are here. */
    expect(w.over).toBe("this billing period");
  });

  it("⚠ a window nobody has summed yet is NAMED AS NOTHING — PR #634's one review finding", () => {
    /*
      The first draft defaulted a missing basis to `rolling30`, so a SUBSCRIBED
      account opening the pane read *"Usage in the last 30 days"* over the note
      *"61,000 credits left"* for one render beat before it flipped to the
      period. The figures were honestly em-dashed; the WORDS were not, and they
      are the half a customer reads first — real data attached to a claim about
      a window that had not been summed.

      ⚠ Driven as three separate assertions rather than one object equality,
      because each is a different way of claiming a window: the heading, the
      note, and the span under the rate.
    */
    const loading = spendWindowCopy(null, 24_535, 5_000);
    expect(loading.heading, "the loading heading names a window").toBe("Usage");
    expect(loading.note, "a note was attached to a window nobody summed").toBeUndefined();
    expect(loading.over, "a span was claimed under a rate nobody has").toBeNull();

    /* And the pane passes the absence through rather than defaulting it. */
    const pane = code(read(join(HERE, "sections", "UsageSection.tsx")));
    expect(pane, "the pane defaults a missing basis to a real window again").not.toContain(
      '?? "rolling30"',
    );
  });

  it("⚠ the 90-day cap and the future-period fallback are the SERVER's arms now", () => {
    /*
      ⚠ TWO ARMS LEFT THIS FILE IN #624 AND THIS ONE SAYS WHERE THEY WENT,
      because an arm that vanishes reads exactly like an arm nobody replaced.

      They were *"a period longer than the 90-day cap reports the SEEDED edge"*
      and *"a period start in the FUTURE falls back"*. Both were about the
      WINDOW, and the window is `spendWindow` in `server/db/billing.ts` now.
      The first has also changed its verdict rather than moved unchanged: there
      IS no 90-day cap any more — it belonged to `usage.getDailyUsage`, the
      chart endpoint the surfaces no longer reassemble — so an annual period is
      summed from its own start, which is what `server/cycleSpend.test.ts`
      asserts. Keeping a client arm that still demanded the seeded edge would
      have pinned the workaround as though it were the rule.
    */
    const server = code(read(join(REPO, "server", "cycleSpend.test.ts")));
    expect(server, "the annual-period arm did not arrive with the window").toContain(
      "there is no 90-day edge left",
    );
    expect(server, "the future-period arm did not arrive with the window").toContain(
      "a period start in the FUTURE falls back",
    );
  });
});

describe("card 387 item 2 — the premise the window design rests on", () => {
  it("a free account's credits are never refreshed, which is why there is no monthly allowance to show", () => {
    /*
      Read at the code, not remembered: `refreshMonthlyCredits` has exactly one
      non-test caller and that caller returns before reaching it for `free`.
      When this stops being true, the pane owes a free account a real monthly
      window again — and this arm is the thing that will say so.
    */
    const webhooks = code(read(join(REPO, "server", "stripe", "webhooks.ts")));
    expect(webhooks, "the free-tier refresh skip is gone — free credits may renew now").toMatch(
      /planTier\s*===\s*"free"[\s\S]{0,200}return/,
    );
    expect(
      webhooks.indexOf('planTier === "free"'),
      "the free skip no longer precedes the refresh call",
    ).toBeLessThan(webhooks.indexOf("refreshMonthlyCredits("));
  });
});

describe("card 387 item 2 — the law-7 sweep: no cycle claimed where none runs", () => {
  /*
    The class item 2 belongs to is *a figure measured against a cycle the
    product does not run*, and the sweep found two more of it in BillingSection,
    one of them worse than the reported one: `Bar` clamps its ratio to 1 and the
    SENTENCE beside it does not, so on his own production row — 24,535 credits
    against a free allowance of 5,000 — the pane read *"491% of this month's
    allowance left"*.

    Both are now gated on `renews` (`currentPeriodEnd` being present). These
    arms are on that gate rather than on the copy, because the copy is correct
    wherever a period exists.
  */
  const billing = () =>
    code(readFileSync(join(HERE, "sections", "BillingSection.tsx"), "utf8"));

  it("the plan card claims `credits/mo` only where a month actually renews", () => {
    expect(billing(), "the /mo allowance is claimed without a renewal again").toMatch(
      /renews && allowance > 0 \? `\$\{allowance\.toLocaleString\(\)\} credits\/mo`/,
    );
  });

  it("the percentage-of-allowance sentence is gated the same way", () => {
    expect(
      billing(),
      "the allowance percentage can print again without a renewing period — this is the 491% line",
    ).toMatch(/renews && allowance > 0[\s\S]{0,120}allowance left/);
  });

  it("the bar is not drawn without a denominator", () => {
    /*
      An empty track under a real balance reads as nothing left, which is the
      opposite of true — so where there is no allowance to measure against,
      there is no bar.
    */
    expect(billing(), "a ratio bar came back without a renewing allowance behind it").toMatch(
      /renews && allowance > 0 \? <Bar/,
    );
  });

  it("`renews` is read from the period, never from the plan name", () => {
    /*
      A tier string is what made this wrong in the first place: the free tier
      HAS a `monthlyCredits` figure in the plan table and no monthly anything in
      the product. The period is the only thing that knows.
    */
    expect(billing()).toMatch(/const renews = renewsAt !== null;/);
    expect(billing(), "the gate went back to reading a plan name").not.toMatch(
      /const renews[^;]*planName/,
    );
  });
});

describe("card 387 item 3 — `Frames made` is gone because it was not frames", () => {
  it("the pane no longer renders a frame count", () => {
    /*
      > *"frames made not sure what that should be or even means to be honest"*

      It was `generationCount`, a count of SPEND ROWS. On his 622 rows those are
      19 different operations — `Casting roll` 237, `Refine a face` 221, `Mint
      package` 20, `Evidence package synchronization` 6 — several of which make
      no frame, while `Refresh views` makes several for one charge. His rule:
      *"do not keep a number nobody can interpret."*
    */
    const usage = code(read(join(HERE, "sections", "UsageSection.tsx")));
    expect(usage, "a frame count came back over a row count").not.toMatch(/Frames made/i);
    expect(usage, "generationCount is being summed again").not.toContain("generationCount");
  });
});

describe("card 387 item 4 — the referral footer links are the size of the sentence beside them", () => {
  it("the foot supplies the type, and the link class keeps `font: inherit`", () => {
    /*
      His words: *"the reddeem a code and who has joined text fonts are huge and
      dont match the prototype."*

      ⚠ THE FIX IS ON THE FOOT, NOT ON THE LINK. `.dp-set__linkbtn`'s third
      consumer sits INSIDE a `.dp-set__note` sentence in BillingSection (`more
      credits`) and must take that sentence's size — sizing the class would have
      made the in-sentence case wrong to fix the standalone one.
    */
    const css = read(join(HERE, "settings.css"));

    const foot = css.slice(css.indexOf(".dp-ref__foot {"), css.indexOf(".dp-ref__foot {") + 260);
    expect(foot, "the referral foot stopped setting the type its links inherit").toMatch(
      /font:\s*400 11px\/1\.5 var\(--font-sans\)/,
    );

    const link = css.slice(
      css.indexOf(".dp-set__linkbtn {"),
      css.indexOf(".dp-set__linkbtn {") + 200,
    );
    expect(link, "the link class stopped inheriting — the in-sentence one breaks").toContain(
      "font: inherit",
    );
  });
});

describe("card 387 item 5 — Remove is real, and the bio field is gone without the bio", () => {
  const removeAvatarBody = () => {
    const profile = code(read(join(REPO, "server", "routes", "profile.ts")));
    return profile.slice(
      profile.indexOf("removeAvatar:"),
      profile.indexOf("uploadBanner:"),
    );
  };

  it("`profile.removeAvatar` exists and scopes the owner in the writing statement", () => {
    /*
      Invariants 1 and 3: the owner is in the statement that writes, and the id
      comes from `ctx.user.id` and never from input.
    */
    const body = removeAvatarBody();

    expect(body.length, "removeAvatar is not declared").toBeGreaterThan(100);
    expect(body, "removeAvatar left protectedProcedure").toContain("protectedProcedure");
    expect(body, "the write is not owner-scoped from the session").toContain(
      "updateUserProfile(ctx.user.id",
    );
    expect(body, "the avatar row is not actually cleared").toMatch(/avatarUrl:\s*null/);
    expect(body, "the key is not cleared, so the object can never be swept").toMatch(
      /avatarKey:\s*null/,
    );
    expect(body, "the old object is left orphaned in the bucket").toContain("storageDelete(");
    expect(body, "a userId arrived from somewhere other than the session").not.toMatch(
      /input\.userId/,
    );
  });

  it("the row is cleared BEFORE the object is deleted", () => {
    /*
      The other order leaves a row pointing at bytes that are gone — the failure
      the customer actually sees. A failed delete costs a stray object; a failed
      clear after a delete costs a broken picture.
    */
    const body = removeAvatarBody();
    expect(body.indexOf("updateUserProfile(ctx.user.id")).toBeLessThan(
      body.indexOf("storageDelete("),
    );
  });

  it("Remove is offered from the SERVER's picture, not from a prop two hosts fill differently", () => {
    /*
      `AppChrome` resolves `avatarUrl` (`profileImage ?? user?.avatarUrl`) while
      `DrapeStudio` passes a session-local `useState(null)` — so a Remove gated
      on the prop is invisible on the legacy studio to somebody who HAS a
      picture. Working law 4: ask the one thing that knows.
    */
    const section = code(read(join(HERE, "sections", "ProfileSection.tsx")));
    expect(section, "the Remove control is gated on the passed-down prop again").toContain(
      "profile?.avatarUrl ? (",
    );
    expect(section, "Remove went back to being a stub").toContain("removeAvatar.mutate()");
    expect(section, "the stub chip came back beside a working control").not.toContain("StubNote");
  });

  it("the bio FIELD is gone and the customer's bio is NOT", () => {
    /*
      His word: *"remove the bio line from profile its not required."* A bio is
      still read in the customer's own GDPR export and on the admin user view,
      so this removes a control, never a person's words — which is also the
      reversible half if he wants the field back.
    */
    const section = code(read(join(HERE, "sections", "ProfileSection.tsx")));
    expect(section, "the bio field came back").not.toMatch(/label="Bio"/);
    expect(section, "the bio field came back").not.toContain("PROFILE_BIO_MAX_LENGTH");

    const routes = code(read(join(REPO, "server", "routes", "profile.ts")));
    expect(routes, "removing the FIELD also removed the writer — that is data, not a control").toMatch(
      /bio:\s*z\.string\(\)/,
    );
    const schema = read(join(REPO, "drizzle", "schema.ts"));
    expect(schema, "users.bio was dropped — his words are gone from his own export").toMatch(
      /bio:\s*text\("bio"\)/,
    );
  });
});
