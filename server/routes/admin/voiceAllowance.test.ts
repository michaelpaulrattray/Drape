import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { adminRouter } from "./index";
import {
  readVoiceAllowanceForStaff,
  resetVoiceAllowanceStaffCache,
} from "../../castingV2/voiceService";
import { ProviderError } from "../../providers/types";
import type { VoiceAllowance, VoiceEngine } from "../../providers/voiceTypes";

/**
 * THE HOUSE'S VOICE RATION ON THE ADMIN PANEL — N4b-3 (#2471).
 *
 * His card: *"The month's remaining voice operations on the admin panel: a
 * count, staff-only, no creative content."*
 *
 * The reader is driven DIRECTLY with a stub engine (working law 3 — a control
 * tested only through the thing that usually behaves is untested), and the
 * declaration arms read the router's own source the way `bugReportInbox.test.ts`
 * does, because `adminProcedure` versus `moderatorProcedure` is a fact about
 * the DECLARATION that no call through an admin context could ever reveal:
 * admins pass the moderator middleware, so both spellings answer an admin
 * identically and only the source says which boundary shipped.
 *
 * Every absence arm carries a positive control, per this repository's rule
 * that a green absence over an empty read proves nothing.
 */

const HERE = __dirname;
const ROUTER_SOURCE = path.join(HERE, "voiceAllowance.ts");
const PROCEDURE = "getVoiceAllowance";

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

/** Strip comments so a word quoted in a docblock cannot satisfy a source arm. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FULL: VoiceAllowance = {
  slotsTotal: 30,
  slotsUsed: 1,
  operationsTotal: 95,
  operationsUsed: 4,
  instantCloning: true,
  tier: "creator",
};

function engineReading(allowance: Partial<VoiceAllowance> = {}): {
  engine: VoiceEngine;
  calls: () => number;
} {
  let calls = 0;
  const engine = {
    id: "stub",
    async readAllowance() {
      calls += 1;
      return { ...FULL, ...allowance };
    },
  } as unknown as VoiceEngine;
  return { engine, calls: () => calls };
}

function engineThrowing(error: unknown): { engine: VoiceEngine; calls: () => number } {
  let calls = 0;
  const engine = {
    id: "stub",
    async readAllowance() {
      calls += 1;
      throw error;
    },
  } as unknown as VoiceEngine;
  return { engine, calls: () => calls };
}

beforeEach(() => {
  resetVoiceAllowanceStaffCache();
  vi.restoreAllMocks();
});

describe("the ration reaches the admin panel and stops there", () => {
  it("is merged into the real admin router — an arm over an empty set is not an arm", () => {
    const merged = (adminRouter as unknown as Record<string, any>)._def.procedures;
    expect(merged[PROCEDURE], `${PROCEDURE} is not merged into adminRouter`).toBeDefined();

    /* POSITIVE CONTROL: this reader really does see the router's procedures,
       so the arm above is a reading and not an empty object. */
    expect(merged.getBugReports, "the reader found no known procedure at all").toBeDefined();
  });

  it("is declared with adminProcedure, never moderatorProcedure", () => {
    const source = code(read(ROUTER_SOURCE));

    expect(
      source,
      `${PROCEDURE} must be declared with adminProcedure — admins inherit the moderator middleware, so moderatorProcedure would ship this to moderators and no admin account could tell`,
    ).toMatch(new RegExp(`${PROCEDURE}:\\s*adminProcedure`));

    expect(
      source,
      "moderatorProcedure must not appear in this router at all",
    ).not.toContain("moderatorProcedure");

    /* POSITIVE CONTROL for the absence above. */
    expect(`${PROCEDURE}: moderatorProcedure`).toContain("moderatorProcedure");
  });

  it("stays its own query and is never folded into getOverview", () => {
    /* The architectural decision this card turned on: getOverview is seven
       database reads in one Promise.all, and this is an HTTP call to a vendor.
       Folded in, a hung provider stops every KPI on the page. */
    const overview = code(read(path.join(HERE, "overview.ts")));
    expect(
      overview,
      "the vendor read has leaked into getOverview — a hung provider would now stop every KPI on the admin dashboard",
    ).not.toContain("readVoiceAllowanceForStaff");

    /* POSITIVE CONTROL: that file is really being read. */
    expect(overview).toContain("getOverview");
  });
});

describe("what it projects, and what it must not (invariant 8)", () => {
  it("returns the four counts and nothing else", async () => {
    const { engine } = engineReading();
    const result = await readVoiceAllowanceForStaff({ engine });

    expect(result).toEqual({
      state: "read",
      operationsLeft: 91,
      operationsTotal: 95,
      slotsLeft: 29,
      slotsTotal: 30,
    });
  });

  it("never carries the vendor's plan name or its capability flag", async () => {
    const { engine } = engineReading();
    const result = await readVoiceAllowanceForStaff({ engine });
    const keys = Object.keys(result);

    expect(keys, "tier is the VENDOR's plan name and has no place on a rendered surface").not.toContain("tier");
    expect(keys, "instantCloning is N4b-4's receipt flag, not a ration").not.toContain("instantCloning");
    expect(JSON.stringify(result)).not.toContain("creator");

    /* POSITIVE CONTROL: the stub really did offer both, so the absences above
       are a projection and not a provider that never sent them. */
    expect(FULL.tier).toBe("creator");
    expect(FULL.instantCloning).toBe(true);
  });

  it("reports none left rather than a negative count when a counter passes its ceiling", async () => {
    /* A ration lowered mid-period, or a counter past its ceiling, is a real
       provider state and `91 of 95` must never read as `-3`. */
    const { engine } = engineReading({ operationsUsed: 98, slotsUsed: 44 });
    const result = await readVoiceAllowanceForStaff({ engine });

    expect(result).toMatchObject({ state: "read", operationsLeft: 0, slotsLeft: 0 });
  });
});

describe("it returns a verdict and never throws", () => {
  it("answers unreadable with the failure class, for a ProviderError", async () => {
    const { engine } = engineThrowing(new ProviderError("timeout", "slow"));
    const result = await readVoiceAllowanceForStaff({ engine });

    expect(result).toEqual({ state: "unreadable", failureClass: "timeout" });
  });

  it("answers unreadable for a non-provider throw too, rather than escaping", async () => {
    const { engine } = engineThrowing(new TypeError("something else entirely"));
    const result = await readVoiceAllowanceForStaff({ engine });

    expect(result).toEqual({ state: "unreadable", failureClass: "unknown" });
  });

  it("says not set up — never a fault — when there is no transport at all", async () => {
    const before = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      /* No injected engine: this is the question the real panel asks on a
         machine where voice is off. Boot refuses when the scope names anyone
         and this is absent, so a running process without it gives NOBODY a
         voice road — there is no ration to read, not a ration we failed to
         read, and crying wolf here is the silence direction in alarm's
         clothing. */
      await expect(readVoiceAllowanceForStaff()).resolves.toEqual({ state: "not_configured" });
    } finally {
      if (before === undefined) delete process.env.ELEVENLABS_API_KEY;
      else process.env.ELEVENLABS_API_KEY = before;
    }
  });

  it("an injected engine answers its own question — the key is not required to drive it", async () => {
    const before = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      const { engine, calls } = engineReading();
      const result = await readVoiceAllowanceForStaff({ engine });
      expect(result).toMatchObject({ state: "read" });
      expect(calls(), "the injected engine was skipped for an env read").toBe(1);
    } finally {
      if (before === undefined) delete process.env.ELEVENLABS_API_KEY;
      else process.env.ELEVENLABS_API_KEY = before;
    }
  });
});

describe("the cache bounds the vendor, and never pins a failure", () => {
  it("serves a second read inside the window without calling the provider again", async () => {
    const { engine, calls } = engineReading();

    const first = await readVoiceAllowanceForStaff({ engine });
    const second = await readVoiceAllowanceForStaff({ engine });

    expect(second).toEqual(first);
    expect(calls(), "every staff tab's poll became its own provider round trip").toBe(1);
  });

  it("a failure is NOT cached — a recovered provider reads correctly at once", async () => {
    const failing = engineThrowing(new ProviderError("transport", "down"));
    expect(await readVoiceAllowanceForStaff({ engine: failing.engine })).toMatchObject({
      state: "unreadable",
    });

    /* The very next read, inside the TTL, must reach the provider again:
       pinning "not readable" for a cadence after one blip is how a recovered
       provider keeps reading as broken. */
    const healthy = engineReading();
    expect(await readVoiceAllowanceForStaff({ engine: healthy.engine })).toMatchObject({
      state: "read",
    });
    expect(healthy.calls(), "the failure was cached and the recovery went unseen").toBe(1);
  });

  it("a later read past the window asks the provider again", async () => {
    const { engine, calls } = engineReading();
    await readVoiceAllowanceForStaff({ engine });

    /* Drive the clock rather than sleeping: the TTL is 30s. */
    const realNow = Date.now;
    try {
      vi.spyOn(Date, "now").mockImplementation(() => realNow() + 31_000);
      await readVoiceAllowanceForStaff({ engine });
    } finally {
      vi.spyOn(Date, "now").mockImplementation(realNow);
    }

    expect(calls(), "the cache never expired").toBe(2);
  });

  it("the not-configured answer is given BEFORE the cache, so it cannot be served a stale reading", async () => {
    const { engine } = engineReading();
    await readVoiceAllowanceForStaff({ engine });

    const before = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      /* A cached success must not answer a process that now has no transport. */
      await expect(readVoiceAllowanceForStaff()).resolves.toEqual({ state: "not_configured" });
    } finally {
      if (before === undefined) delete process.env.ELEVENLABS_API_KEY;
      else process.env.ELEVENLABS_API_KEY = before;
    }
  });
});

describe("the panel's own wiring", () => {
  const PAGE = path.resolve(HERE, "..", "..", "..", "client", "src", "pages", "AdminOverview.tsx");
  const CARD = path.resolve(
    HERE,
    "..",
    "..",
    "..",
    "client",
    "src",
    "features",
    "admin",
    "overview",
    "SystemStatusCard.tsx",
  );

  it("the page declares the query and the Refresh button reaches it", () => {
    const page = code(read(PAGE));
    expect(page).toContain("trpc.admin.getVoiceAllowance.useQuery");
    expect(
      page,
      "the page's own Refresh button must reach this query — #766's class",
    ).toContain("voiceAllowanceQuery.refetch()");
  });

  it("both numbers are drawn, because either one ends a Keep", () => {
    const card = code(read(CARD));

    /* SLICED TO THE ROWS, and the reason is a defect this arm had: a
       whole-file `toContain("slotsLeft")` is satisfied by the PROP TYPE at the
       top of the file, so the arm stayed green with the slots row rewritten to
       draw operations twice. Sabotage S7 found it. The subject is the leader
       group, so that is what is read. */
    const rowsStart = card.indexOf('"dp-leaders dp-leaders--divided"');
    const rows = card.slice(rowsStart, card.indexOf("</div>", rowsStart));

    expect(rowsStart, "the leader group was not found at all").toBeGreaterThan(-1);
    expect(rows).toContain("a.operationsLeft");
    expect(
      rows,
      "the slots row is missing or draws something else — an account with operations left and every slot full cannot keep a voice, and this card would read healthy while customers met a wall",
    ).toContain("a.slotsLeft");

    /* POSITIVE CONTROL: the slice is the row region and not the whole file —
       it holds a row this card had before #2471 and none of the prop type. */
    expect(rows).toContain('label="Active banners"');
    expect(rows, "the slice reached the prop type, so it is not row-scoped").not.toContain(
      "slotsTotal: number",
    );
  });

  it("the quiet-vendor row never lights the server's Unreachable badge", () => {
    const card = code(read(CARD));
    /* The badge means /api/health did not answer. One lamp for both facts
       would say the platform is down when a third party is.

       Sliced from the card HEAD, where the badge and its condition both live —
       the first cut of this arm started AT the class name, which is after the
       `{error &&` it meant to find, and the positive control caught it. */
    const headStart = card.indexOf('className="dp-ov__cardhead"');
    const head = card.slice(headStart, card.indexOf("dp-leaders", headStart));

    expect(headStart, "the card head was not found at all").toBeGreaterThan(-1);
    expect(
      head,
      "the voice reading has reached the card head — a quiet vendor must not light the badge that means OUR server did not answer",
    ).not.toContain("voiceAllowance");

    /* POSITIVE CONTROL: the slice really holds the badge AND the condition it
       is drawn by, so the absence above is a reading of the right region. */
    expect(head).toContain("dp-ov__unreachable");
    expect(head).toContain("{error &&");
  });

  it("names no vendor and no engine anywhere a staff member reads", () => {
    const card = code(read(CARD));
    const page = code(read(PAGE));
    for (const [name, body] of [
      ["SystemStatusCard", card],
      ["AdminOverview", page],
    ] as const) {
      expect(body.toLowerCase(), `${name} names the vendor`).not.toContain("elevenlabs");
      expect(body.toLowerCase(), `${name} names the vendor`).not.toContain("eleven labs");
    }

    /* POSITIVE CONTROL: the matcher fires on the string it is looking for. */
    expect("createElevenLabsVoiceEngine".toLowerCase()).toContain("elevenlabs");
  });
});
