import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import {
  chipFromLocation,
  chipHeading,
  isChip,
  rosterEmptyLine,
  rosterFilterInput,
} from "./rosterChips";

/**
 * THE LIBRARY'S CHIP RULES (card #2250), driven directly. The frames on the
 * PR show the row; these pin the two founder rulings it carries.
 */

const CAMPAIGN = "0123456789abcdef0123456789abcdef";
const SUMMER = { campaignId: CAMPAIGN, name: "Summer" };

describe("⚠ Unfiled is hidden until there is at least one campaign (his ruling on the rung's design)", () => {
  it("no campaigns — Unfiled is not a chip; one campaign — it is", () => {
    expect(isChip({ kind: "unfiled" }, [])).toBe(false);
    expect(isChip({ kind: "unfiled" }, [SUMMER])).toBe(true);
  });

  it("All is always a chip; a campaign only while it exists", () => {
    expect(isChip({ kind: "all" }, [])).toBe(true);
    expect(isChip({ kind: "campaign", campaignId: CAMPAIGN }, [SUMMER])).toBe(true);
    expect(isChip({ kind: "campaign", campaignId: CAMPAIGN }, [])).toBe(false);
  });

  it("the page draws the Unfiled chip through this rule, not a second copy of it", async () => {
    const page = withoutComments(await readFile(new URL("../../pages/CastingV2.tsx", import.meta.url), "utf8"));
    expect(page).toContain('isChip({ kind: "unfiled" }, campaignRows) ? (');
  });
});

describe("⚠ the search copy is honest about what is searched (his ruling on the rung's design)", () => {
  it("the box says 'by name', and never 'name or look'", async () => {
    const page = await readFile(new URL("../../pages/CastingV2.tsx", import.meta.url), "utf8");
    const code = withoutComments(page);
    expect(code).toContain('placeholder="Search cast by name"');
    expect(code).not.toMatch(/name or look/i);
  });

  it("the old All · Signed · Unsigned pills are gone", async () => {
    const code = withoutComments(await readFile(new URL("../../pages/CastingV2.tsx", import.meta.url), "utf8"));
    expect(code).not.toContain("ROSTER_SCOPES");
    expect(code).not.toMatch(/"Unsigned"\s*\]/);
  });
});

describe("the chip a link names", () => {
  it("a well-formed campaign id selects that campaign; anything else is All", () => {
    expect(chipFromLocation(`?campaign=${CAMPAIGN}`)).toEqual({ kind: "campaign", campaignId: CAMPAIGN });
    expect(chipFromLocation("")).toEqual({ kind: "all" });
    expect(chipFromLocation("?campaign=not-an-id")).toEqual({ kind: "all" });
  });
});

describe("what the roster is asked for", () => {
  it("a trimmed search, and a campaign id only under a campaign chip", () => {
    expect(rosterFilterInput({ kind: "all" }, "  ")).toEqual({ scope: "all" });
    expect(rosterFilterInput({ kind: "unfiled" }, " ines ")).toEqual({ scope: "unfiled", search: "ines" });
    expect(rosterFilterInput({ kind: "campaign", campaignId: CAMPAIGN }, ""))
      .toEqual({ scope: "campaign", campaignId: CAMPAIGN });
  });
});

describe("the heading and the empty line say what is true of THIS chip", () => {
  it("headings", () => {
    expect(chipHeading({ kind: "all" }, [SUMMER])).toBe("All cast");
    expect(chipHeading({ kind: "unfiled" }, [SUMMER])).toBe("Unfiled");
    expect(chipHeading({ kind: "campaign", campaignId: CAMPAIGN }, [SUMMER])).toBe("Summer");
  });

  it("empty lines", () => {
    expect(rosterEmptyLine({ kind: "all" }, "", 0)).toMatch(/^No one signed yet/);
    expect(rosterEmptyLine({ kind: "campaign", campaignId: CAMPAIGN }, "", 3)).toBe("No cast in this campaign yet");
    expect(rosterEmptyLine({ kind: "unfiled" }, "", 3)).toBe("Every cast member is in a campaign.");
    expect(rosterEmptyLine({ kind: "all" }, " zed ", 3)).toBe("No names here match “zed”.");
  });
});
