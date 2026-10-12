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
/* The dialog shell portals into `document.body`, which the server renderer has
   no copy of; the shell is driven on its own, so here it only passes children. */
vi.mock("@/foundation/CastingModal", () => ({
  ModalScrim: ({ children }: { children: unknown }) => createElement("div", null, children as never),
}));

const { CastCampaignsPanel, campaignLibraryHref } = await import("./CastCampaignsCard");
const { NewCampaignDialog } = await import("./NewCampaignDialog");

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
    expect(text(html)).toContain("Summer refill 3 characters");
    expect(text(html)).toContain("Autumn launch 1 character");
    /* NEGATIVE CONTROL (#2318): the count no longer says "cast" — customers call them characters. */
    expect(text(html)).not.toMatch(/\b\d+ casts?\b/);
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
    expect(text(picker)).toContain("Winter 0 characters");
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

/*
  THE CLAPPERBOARD MARK — #2308, his word 2026-10-12: "build D". Every campaign
  row carries one mark in its tile (memberships and the picker alike), the add
  row carries none, and the mark is hidden from assistive technology because
  the name beside it carries the meaning.
*/
describe("every campaign row carries the clapperboard mark, and only campaign rows do", () => {
  const ICON = '<span class="dpc-camp__icon" aria-hidden="true">';
  const rowsOf = (html: string) => html.match(/<li>[\s\S]*?<\/li>/g) ?? [];

  it("each membership row leads with one tile holding the clapperboard, before the name", () => {
    const rows = rowsOf(render());
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.split(ICON).length - 1).toBe(1);
      expect(row).toContain("lucide-clapperboard");
      expect(row.indexOf(ICON)).toBeLessThan(row.indexOf("dpc-camp__name"));
    }
  });

  it("the picker's rows carry it too, so the lists match", () => {
    const html = render({ defaultOpen: true });
    const picker = html.slice(html.indexOf("dpc-camp__picker"));
    const rows = rowsOf(picker);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(ICON);
  });

  it("NEGATIVE CONTROL: the add row and the empty state carry no mark", () => {
    const empty = render({ memberships: [] });
    expect(empty).not.toContain("dpc-camp__icon");
    expect(empty).toContain("dpc-camp__add");
    const add = render().slice(render().indexOf('class="dpc-camp__add"'));
    expect(add).not.toContain("dpc-camp__icon");
  });

  it("the tile is 36px, rounded, and filled and inked from tokens only", () => {
    const css = readFileSync(new URL("../castingV2.css", import.meta.url), "utf8");
    const start = css.indexOf(".dpc-camp__icon {");
    expect(start).toBeGreaterThan(-1);
    expect(css.indexOf(".dpc-camp__icon {", start + 1)).toBe(-1);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toMatch(/width: 36px; height: 36px;/);
    expect(rule).toMatch(/border-radius: 8px;/);
    expect(rule).toMatch(/background: var\(--fillStrong\);/);
    expect(rule).toMatch(/color: var\(--secondary\);/);
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl/i);
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

/*
  #2318 — his word, 2026-10-12: "campaign wording should say 'character', not
  'cast'. Customers call them characters." The counts are pinned above, in the
  panel's own render; these pin the other three sentences on the campaign path.
*/
describe("the campaign path says character, not cast", () => {
  const dialog = (currentName?: string) =>
    text(
      renderToStaticMarkup(
        createElement(NewCampaignDialog, { busy: false, error: null, onCancel: () => {}, onCreate: () => {}, currentName }),
      ),
    );

  it("naming a new campaign says a character can be in more than one", () => {
    const words = dialog();
    expect(words).toContain("A character can be in more than one campaign.");
    expect(words).not.toMatch(/\bcast member/i);
  });

  it("renaming says the characters in it stay as they are", () => {
    const words = dialog("Summer refill");
    expect(words).toContain("Only the name changes. The characters in it stay as they are.");
    expect(words).not.toMatch(/\bcast member/i);
    /* NEGATIVE CONTROL: each mode carries its own sentence and not the other's. */
    expect(words).not.toContain("more than one campaign");
  });

  it("a filing the server refused without words falls back to a sentence naming a character", () => {
    /* The fallback lives in the store-wired `file`, which needs a tRPC client the
       server renderer has none of; read out of that function's own body. */
    const source = readFileSync(new URL("./CastCampaignsCard.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const file = async (campaignId: string)");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("const onCreate = async", start));
    expect(body).toContain(`readableFailure(error, "This character couldn't be added to that campaign.")`);
    expect(body).not.toMatch(/This cast couldn.t be added/);
  });
});
