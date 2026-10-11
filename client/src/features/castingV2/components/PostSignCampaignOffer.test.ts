import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";

/*
  AFTER A SIGN, ONE OFFER TO FILE THE NEW CAST — #2253 (rung N2c, slice S7).

  His ruling on the rung's parent card: the post-Sign prompt is "never shown to
  an account with no shoots — with none, its only offer is 'create a shoot', a
  setup step wearing a question" (the noun is Campaign). The brief's refusals:
  "dismissible, don't-ask-again, never blocks Sign, never silent auto-filing."

  The decision, the once-only marker and the "don't ask again" store are pure
  and driven directly here; the panel is drawn through React's own renderer
  with real data; the Sign's wire is read off the sheet's own success handler.
  The presses themselves are driven in the running app (frames on the PR).
*/
vi.mock("@/lib/trpc", () => ({ trpc: {} }));

const offerModule = await import("./PostSignCampaignOffer");
const {
  POST_SIGN_OFFER_SILENCED_KEY,
  isPostSignOfferSilenced,
  markJustSigned,
  peekJustSigned,
  postSignOfferState,
  silencePostSignOffer,
  takeJustSigned,
} = offerModule;
const { CastCampaignsPanel } = await import("./CastCampaignsCard");

const SUMMER = { campaignId: "a".repeat(32), name: "Summer refill", castCount: 3 };
const AUTUMN = { campaignId: "b".repeat(32), name: "Autumn launch", castCount: 1 };

describe("the offer is decided by whether the customer keeps campaigns", () => {
  it("waits while the list is loading", () => {
    expect(postSignOfferState("pending", undefined)).toBe("pending");
  });

  it("shows for an account with campaigns", () => {
    expect(postSignOfferState("pending", [SUMMER])).toBe("showing");
  });

  it("NEVER shows for an account with no campaigns — and that answer is final", () => {
    expect(postSignOfferState("pending", [])).toBe("gone");
    /* A campaign made afterwards on this page does not bring the offer up. */
    expect(postSignOfferState("gone", [SUMMER])).toBe("gone");
  });

  it("once showing, a refreshed list does not take it away under the customer", () => {
    expect(postSignOfferState("showing", [SUMMER, AUTUMN])).toBe("showing");
  });
});

describe("the offer comes once per Sign", () => {
  it("the marker is the Sign's, for that cast only, and is spent on first take", () => {
    expect(peekJustSigned("KI-ONCE")).toBe(false);
    markJustSigned("KI-ONCE");
    expect(peekJustSigned("KI-OTHER")).toBe(false);
    expect(peekJustSigned("KI-ONCE")).toBe(true);
    /* Peeking never spends it, so a render that runs twice cannot lose it. */
    expect(peekJustSigned("KI-ONCE")).toBe(true);
    expect(takeJustSigned("KI-ONCE")).toBe(true);
    expect(takeJustSigned("KI-ONCE")).toBe(false);
    expect(peekJustSigned("KI-ONCE")).toBe(false);
  });

  it("an empty id marks nothing", () => {
    markJustSigned("");
    expect(peekJustSigned("")).toBe(false);
  });
});

describe("don't ask again is kept, and storage that fails never breaks the page", () => {
  function memoryStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      map,
    };
  }

  it("not silenced until asked; silenced after, under the versioned key", () => {
    const storage = memoryStorage();
    expect(isPostSignOfferSilenced(storage)).toBe(false);
    silencePostSignOffer(storage);
    expect(storage.map.get(POST_SIGN_OFFER_SILENCED_KEY)).toBe("never");
    expect(isPostSignOfferSilenced(storage)).toBe(true);
    expect(POST_SIGN_OFFER_SILENCED_KEY).toMatch(/_v1$/);
  });

  it("a throwing store reads as not silenced, and a write to it does not throw", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isPostSignOfferSilenced(broken)).toBe(false);
    expect(() => silencePostSignOffer(broken)).not.toThrow();
    expect(isPostSignOfferSilenced(undefined)).toBe(false);
  });
});

type PanelProps = Parameters<typeof CastCampaignsPanel>[0];

function render(props: Partial<PanelProps> = {}): string {
  return renderToStaticMarkup(
    createElement(Router, {
      ssrPath: "/app/casting/cast/KI-TEST",
      children: createElement(CastCampaignsPanel, {
        memberships: [],
        campaigns: [SUMMER, AUTUMN],
        busy: false,
        onAdd: async () => null,
        onCreate: async () => null,
        ...props,
      }),
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function offerProps(overrides: Partial<NonNullable<PanelProps["offer"]>> = {}): NonNullable<PanelProps["offer"]> {
  return {
    castName: "Leave Test",
    refusal: null,
    onFile: () => {},
    onNotNow: () => {},
    onNever: () => {},
    ...overrides,
  };
}

describe("the offer, drawn inside IN CAMPAIGNS", () => {
  it("asks in the customer's words, lists their campaigns, and has two ways out", () => {
    const words = text(render({ offer: offerProps() }));
    expect(words).toContain("Add Leave Test to a campaign?");
    expect(words).toContain("Summer refill 3 casts");
    expect(words).toContain("Autumn launch 1 cast");
    expect(words).toContain("Not now");
    expect(words).toContain("Don’t ask again");
    /* It stands in for the empty line and the add row rather than stacking on them. */
    expect(words).not.toContain("Not in any campaign yet.");
    expect(words).not.toContain("Use in a campaign");
  });

  it("NEGATIVE CONTROL: without an offer the panel is exactly the #2252 panel", () => {
    const words = text(render());
    expect(words).not.toContain("to a campaign?");
    expect(words).not.toContain("Don’t ask again");
    expect(words).toContain("Not in any campaign yet.");
    expect(words).toContain("Use in a campaign");
  });

  it("never offers a campaign the cast is already in", () => {
    const html = render({ offer: offerProps(), memberships: [{ campaignId: SUMMER.campaignId, name: SUMMER.name }] });
    const offerHtml = html.slice(html.indexOf("dpc-camp__offer"));
    expect(text(offerHtml)).toContain("Autumn launch");
    expect(text(offerHtml)).not.toContain("Summer refill");
  });

  it("draws nothing over no choice: no campaigns, or none still open to this cast", () => {
    expect(render({ offer: offerProps(), campaigns: [] })).not.toContain("dpc-camp__offer");
    expect(
      render({
        offer: offerProps(),
        memberships: [SUMMER, AUTUMN].map(({ campaignId, name }) => ({ campaignId, name })),
      }),
    ).not.toContain("dpc-camp__offer");
  });

  it("draws nothing while either list is still loading", () => {
    expect(render({ offer: offerProps(), memberships: undefined })).not.toContain("dpc-camp__offer");
    expect(render({ offer: offerProps(), campaigns: undefined })).not.toContain("dpc-camp__offer");
  });

  it("files nothing by itself: drawing the offer calls neither the store nor the offer", () => {
    const onAdd = vi.fn(async () => null);
    const onFile = vi.fn();
    render({ onAdd, offer: offerProps({ onFile }) });
    expect(onAdd).not.toHaveBeenCalled();
    expect(onFile).not.toHaveBeenCalled();
  });

  it("a refused filing says why, in place", () => {
    const words = text(render({ offer: offerProps({ refusal: "This cast could not be filed there." }) }));
    expect(words).toContain("This cast could not be filed there.");
  });
});

/* The slice of `source` between `start` and `end`, each found exactly once. */
function slice(source: string, start: string, end: string): string {
  expect(source.split(start).length - 1).toBe(1);
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("the Sign is unchanged except for one line written into memory", () => {
  const sheet = readFileSync(new URL("../../../pages/CastingSheet.tsx", import.meta.url), "utf8");

  it("marks the cast it just made, then navigates to it exactly as before", () => {
    const success = slice(sheet, "onSuccess: (result) => {\n                  setSigning(null);", "onError:");
    const mark = success.indexOf("markJustSigned(result.castPublicId);");
    const go = success.indexOf("navigate(`/app/casting/cast/${result.castPublicId}`);");
    expect(mark).toBeGreaterThan(-1);
    expect(go).toBeGreaterThan(mark);
    /* Nothing is awaited and nothing else is added between the Sign and its page. */
    expect(success).not.toMatch(/await|setTimeout|\.then\(/);
    const statements = success
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith(";"));
    expect(statements).toEqual([
      "setSigning(null);",
      "markJustSigned(result.castPublicId);",
      "navigate(`/app/casting/cast/${result.castPublicId}`);",
    ]);
  });

  it("the room hands the panel the cast's name and a fresh panel per cast", () => {
    const room = readFileSync(new URL("../../../pages/CastingRoom.tsx", import.meta.url), "utf8");
    expect(room).toContain(
      '<CastCampaignsCard key={data.castId} castId={data.castId} castName={data.name ?? "this cast"} />',
    );
  });
});
