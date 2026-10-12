import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  THE PUBLIC CHECK PAGE AND ITS TOGGLE, RENDERED — N2d-3 (#2313).

  Drawn through React's own renderer with real data, so what is asserted is
  what the browser would draw. The store wiring is stubbed only because the
  server renderer has no tRPC client; the procedures are driven in
  `server/creationCheckRoute.test.ts` and their SQL in
  `server/db/castCreationCheck.test.ts`.

  What only this file holds:
   1. the toggle's sentence is card #2331's sentence, VERBATIM — it names the
      display name the page shows — and it is on the card in both states;
   2. the page CANNOT be turned on from the card without the preview showing:
      the only "Turn on" control is drawn inside the previewing state, under the
      record, and is disabled until the record has arrived;
   3. the record view draws six facts, the Klieg ID as its heading, NO cast
      name and NO picture — no <img>, no
      background image, no address;
   4. every customer string says "evidence of creation" and never claims
      ownership or names the machinery (design §2 Q3), with a positive control
      proving the reader catches a bad string. The one way the word may
      appear is the footer's DENIAL, "not a registration of ownership" (#2331),
      and the reader still catches the same words without the "not".
*/
vi.mock("@/lib/trpc", () => ({ trpc: {} }));

const { PublicCheckPanel } = await import("./PublicCheckCard");
const { CreationCheckRecordView, NoPublicRecordView } = await import("./CreationCheckRecord");
const copy = await import("@shared/creationCheckCopy");

const RECORD = {
  kliegId: "KI-AAAA-BBBB-CCCC-DDDD",
  makerName: "Ada Studio",
  createdAt: "2026-09-03T10:00:00.000Z",
  recordedAt: "2026-10-12T05:00:00.000Z",
  stampedAt: "2026-10-12T05:00:01.000Z",
  fingerprint: "d837f90d".padEnd(64, "a"),
};

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function panel(props: Partial<Parameters<typeof PublicCheckPanel>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(PublicCheckPanel, {
      isPublic: false,
      stage: "idle",
      preview: undefined,
      refusal: null,
      busy: false,
      pageUrl: "https://example.test/check/KI-AAAA-BBBB-CCCC-DDDD",
      onSwitch: () => {},
      onTurnOn: () => {},
      onCancel: () => {},
      onCopy: () => {},
      ...props,
    }),
  );
}

describe("the toggle states the whole consequence, in #2331's words", () => {
  it("carries the sentence verbatim — display name included — off, previewing and on", () => {
    const sentence =
      "Anyone with this ID can see that it is real, when this character was made, and your display name. They never see the picture, your brief, or your account. You can turn this off at any time.";
    expect(copy.PUBLIC_CHECK_CONSEQUENCE).toBe(sentence);
    expect(text(panel())).toContain(sentence);
    expect(text(panel({ stage: "previewing", preview: RECORD }))).toContain(sentence);
    expect(text(panel({ isPublic: true }))).toContain(sentence);
  });

  it("⚠ names what the page shows: the sentence mentions the display name, and the page draws it", () => {
    expect(copy.PUBLIC_CHECK_CONSEQUENCE).toContain("your display name");
    const page = text(renderToStaticMarkup(createElement(CreationCheckRecordView, { record: RECORD })));
    expect(page).toContain(RECORD.makerName);
  });

  it("is OFF by default and is a real switch saying so", () => {
    const html = panel();
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="switch"/);
    expect(text(html)).toContain("Off");
    expect(html).not.toContain("https://example.test/check/");
  });
});

describe("the page is SHOWN before it goes on", () => {
  it("idle and off: no Turn on control exists at all", () => {
    expect(text(panel())).not.toContain(copy.PUBLIC_CHECK_TOGGLE.turnOn);
  });

  it("previewing, record not yet here: Turn on is drawn DISABLED", () => {
    const html = panel({ stage: "previewing" });
    expect(text(html)).toContain(copy.PUBLIC_CHECK_TOGGLE.previewLoading);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Turn on<\/button>/);
  });

  it("previewing with the record: the record is drawn, then Turn on is live", () => {
    const html = panel({ stage: "previewing", preview: RECORD });
    expect(text(html)).toContain(copy.PUBLIC_CHECK_TOGGLE.previewIntro);
    expect(text(html)).toContain(RECORD.fingerprint);
    expect(html.indexOf(RECORD.fingerprint)).toBeLessThan(html.indexOf(">Turn on<"));
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Turn on<\/button>/);
  });

  it("ON: the link to the page is shown, and there is no preview or Turn on", () => {
    const html = panel({ isPublic: true });
    expect(html).toMatch(/aria-checked="true"/);
    expect(text(html)).toContain("https://example.test/check/KI-AAAA-BBBB-CCCC-DDDD");
    expect(text(html)).not.toContain(copy.PUBLIC_CHECK_TOGGLE.turnOn);
  });
});

describe("the record view: six facts and no picture", () => {
  const html = renderToStaticMarkup(createElement(CreationCheckRecordView, { record: RECORD }));

  it("draws the ID as the heading, the maker, both dates and the fingerprint", () => {
    const words = text(html);
    expect(html).toMatch(/<h1[^>]*>KI-AAAA-BBBB-CCCC-DDDD<\/h1>/);
    expect(words).toContain(RECORD.kliegId);
    expect(words).toContain("Ada Studio");
    expect(words).toContain("3 September 2026");
    expect(words).toContain("12 October 2026, independently timestamped");
    expect(words).toContain(RECORD.fingerprint);
    expect(words).toContain(copy.PUBLIC_CHECK_HEADING);
  });

  it("never draws a picture", () => {
    expect(html).not.toMatch(/<img|background-image|url\(|<picture|<video|src=/i);
    /* POSITIVE CONTROL: the reader sees a picture when one is there. */
    expect('<img src="x">').toMatch(/<img|background-image|url\(|<picture|<video|src=/i);
  });

  it("says only 'recorded' while no independent stamp has landed", () => {
    const unstamped = text(renderToStaticMarkup(createElement(CreationCheckRecordView, { record: { ...RECORD, stampedAt: null } })));
    expect(unstamped).toContain("12 October 2026");
    expect(unstamped).not.toContain("independently timestamped");
  });

  it("draws no 'Made by' row when the maker has no display name", () => {
    const anonymous = text(renderToStaticMarkup(createElement(CreationCheckRecordView, { record: { ...RECORD, makerName: null } })));
    expect(anonymous).not.toContain("Made by");
  });

  it("the no-record view says the one sentence and nothing that tells IDs apart", () => {
    const none = text(renderToStaticMarkup(createElement(NoPublicRecordView)));
    expect(none).toContain("No public record for this ID");
    expect(none).not.toMatch(/deleted|private|turned off|does not exist\b/i);
  });
});

describe("every customer string: evidence of creation, no ownership claim, no machinery", () => {
  /* Every string the module exports, read from the module itself — plus the
     strings the two components and the page write inline, read from source. */
  const strings: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string") strings.push(value);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  Object.values(copy).forEach(collect);
  strings.push(copy.recordedLine("1 January 2026", true));

  const FORBIDDEN = /\bowner|ownership|\bverified\b|\bproof\b|\bcertif|sha-?256|\bhash|signature|\btoken\b|ed25519|rfc ?3161|digicert|freetsa|\btsa\b|blockchain|scope\b/i;

  it("the population is whole before any claim about it", () => {
    expect(strings.length).toBeGreaterThan(20);
    expect(strings).toContain(copy.PUBLIC_CHECK_FOOTNOTE);
  });

  /* The footer's denial (#2331) is the one way "ownership" may appear: it is
     taken out WHOLE, "not" and all, before the reader looks. */
  const DENIAL = /\bis not a registration of ownership\b/gi;
  const claims = (value: string) => value.replace(DENIAL, "");

  it("no string claims ownership or names the machinery", () => {
    for (const value of strings) expect(claims(value), value).not.toMatch(FORBIDDEN);
  });

  it("POSITIVE CONTROL — the reader catches the strings it exists to catch", () => {
    for (const bad of [
      "Verified owner",
      "Proof of ownership",
      "SHA-256 hash",
      "Timestamped by DigiCert",
      "Signed with Ed25519",
      /* The denial's words without the denial are still a claim. */
      "This page is a registration of ownership.",
      "It is a registration of ownership, not merely evidence.",
    ]) {
      expect(claims(bad)).toMatch(FORBIDDEN);
    }
  });

  it("the page names itself as evidence of creation, and says it is not a registration of ownership", () => {
    expect(copy.PUBLIC_CHECK_HEADING).toBe("Evidence of creation");
    expect(copy.PUBLIC_CHECK_FOOTNOTE).toBe("This page is evidence of creation. It is not a registration of ownership.");
    /* "Nothing else" was false once the page showed the name and the fingerprint. */
    expect(copy.PUBLIC_CHECK_FOOTNOTE).not.toMatch(/nothing else/i);
    const page = text(renderToStaticMarkup(createElement(CreationCheckRecordView, { record: RECORD })));
    expect(page).toContain(copy.PUBLIC_CHECK_FOOTNOTE);
  });

  it("no component writes a customer sentence the copy module does not hold", () => {
    for (const file of ["PublicCheckCard.tsx", "CreationCheckRecord.tsx", "../../../pages/CreationCheck.tsx"]) {
      const source = readFileSync(resolve(__dirname, file), "utf8");
      /* JSX text children: >Words< with at least two letters, outside braces. */
      const inline = [...source.matchAll(/>\s*([A-Za-z][^<>{}]{2,})\s*</g)].map((m) => m[1]!.trim());
      expect(inline, file).toEqual([]);
    }
    /* POSITIVE CONTROL: the same reader finds an inline sentence when one is written. */
    expect([...'<p className="x">Verified owner</p>'.matchAll(/>\s*([A-Za-z][^<>{}]{2,})\s*</g)].length).toBe(1);
  });
});
