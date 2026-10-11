import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";

/*
  THE CAST PAGE'S IN CAMPAIGNS PANEL, MADE REAL — #2252.

  His word, 2026-09-29, verbatim and entire: "yes." — to the note that N2c
  builds this panel (memberships by name, plus one add row) and removes the
  header's campaign button.

  The panel is driven through React's own renderer with real data, so what is
  asserted is what the browser would draw: the count, a link per membership to
  that campaign's view of the library, an honest empty state, and an add
  control that never offers a campaign the cast is already in. The store
  wiring is stubbed only because the server renderer has no tRPC client; the
  procedures themselves are driven in `server/castCampaignsRoute.test.ts` and
  against a real database in `server/castCampaigns-db.test.ts`.
*/
vi.mock("@/lib/trpc", () => ({ trpc: {} }));

const { CastCampaignsPanel, campaignLibraryHref } = await import("./CastCampaignsCard");

const SUMMER = { campaignId: "a".repeat(32), name: "Summer refill" };
const AUTUMN = { campaignId: "b".repeat(32), name: "Autumn launch" };
const WINTER = { campaignId: "c".repeat(32), name: "Winter" };
const ALL = [
  { ...SUMMER, castCount: 3 },
  { ...AUTUMN, castCount: 1 },
  { ...WINTER, castCount: 0 },
];

function render(props: Partial<Parameters<typeof CastCampaignsPanel>[0]> = {}): string {
  /* The server renderer has no `location`; wouter's own SSR path stands in. */
  return renderToStaticMarkup(
    createElement(Router, {
      ssrPath: "/app/casting/cast/KI-TEST",
      children: createElement(CastCampaignsPanel, {
        memberships: [SUMMER, AUTUMN],
        campaigns: ALL,
        busy: false,
        onAdd: async () => null,
        onCreate: async () => null,
        ...props,
      }),
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("a cast in campaigns lists them, by name, with a real count", () => {
  it("each membership is a link to that campaign in the library, with its cast count", () => {
    const html = render();
    expect(html).toContain(`href="${campaignLibraryHref(SUMMER.campaignId)}"`);
    expect(html).toContain(`href="${campaignLibraryHref(AUTUMN.campaignId)}"`);
    expect(campaignLibraryHref(SUMMER.campaignId)).toBe(`/app/casting?campaign=${SUMMER.campaignId}`);
    expect(text(html)).toContain("Summer refill 3 casts");
    expect(text(html)).toContain("Autumn launch 1 cast");
    /* NEGATIVE CONTROL: a campaign the cast is not in is not listed as one. */
    expect(html).not.toContain(`href="${campaignLibraryHref(WINTER.campaignId)}"`);
  });

  it("the count in the corner is the number of memberships, not a constant", () => {
    expect(render()).toContain('<span class="dpc-camp__count">2</span>');
    expect(render({ memberships: [SUMMER] })).toContain('<span class="dpc-camp__count">1</span>');
    expect(render({ memberships: [] })).toContain('<span class="dpc-camp__count">0</span>');
  });

  it("while the first read is in flight it claims no count and no emptiness", () => {
    const html = render({ memberships: undefined });
    expect(html).not.toContain("dpc-camp__count");
    expect(html).not.toContain("Not in any campaign yet.");
  });
});

describe("a cast in no campaign reads honestly", () => {
  it("says it is in none yet, and never that campaigns aren't built", () => {
    const html = render({ memberships: [] });
    expect(text(html)).toContain("Not in any campaign yet.");
    expect(html).not.toMatch(/aren.t built/i);
    /* POSITIVE CONTROL: the sentence is the empty state's alone. */
    expect(render()).not.toContain("Not in any campaign yet.");
  });
});

describe("one add row, and it is live", () => {
  it("is enabled once both reads are in, and names the act", () => {
    const html = render();
    expect(html).toMatch(/<button type="button" class="dpc-camp__add">/);
    expect(text(html)).toContain("Use in a campaign");
    expect(text(html)).not.toContain("Use in a new campaign");
    /* Loading: there is nothing to choose from yet. */
    expect(render({ campaigns: undefined })).toMatch(/<button type="button" class="dpc-camp__add" disabled="">/);
  });

  it("offers only the campaigns the cast is not already in, plus a new one", () => {
    const html = render({ defaultOpen: true });
    const picker = html.slice(html.indexOf("dpc-camp__picker"));
    expect(text(picker)).toContain("Winter 0 casts");
    expect(picker).not.toContain("Summer refill");
    expect(picker).not.toContain("Autumn launch");
    expect(picker).toContain('placeholder="New campaign name"');
  });

  it("with no other campaign to offer, it says a NEW one and opens straight to the name", () => {
    const html = render({ memberships: [SUMMER, AUTUMN, WINTER] });
    expect(text(html)).toContain("Use in a new campaign");
    const open = render({ memberships: [], campaigns: [], defaultOpen: true });
    expect(open).not.toContain('aria-label="Your campaigns"');
    expect(open).toContain('placeholder="New campaign name"');
  });
});

describe("the cast page header", () => {
  const room = readFileSync(new URL("../../../pages/CastingRoom.tsx", import.meta.url), "utf8");

  it("no longer carries the dead campaign button; the canvas promise stays", () => {
    expect(room).not.toMatch(/Use in a campaign/);
    expect(room).toContain("Open in canvas · soon");
  });

  it("draws the real panel and not the stub", () => {
    expect(room).toMatch(/<CastCampaignsCard key=\{data\.castId\} castId=\{data\.castId\} castName=\{[^}]+\} \/>/);
    expect(room).not.toMatch(/Campaigns aren.t built yet/);
    expect(room).not.toContain("Use in a new campaign");
  });
});
