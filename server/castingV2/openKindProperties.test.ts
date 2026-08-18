/**
 * THE KIND-PROPERTY READ, driven with a fake transport.
 *
 * The subject is the DOOR rather than the model: what this function does with a
 * reply, not whether the reply is right. Whether a real reader can answer these
 * two questions is a court with its own controls and it is bought with house
 * money (`scripts/court-kind-properties-disposable.mts`) — a suite that mocked
 * the answer and called the property measured would be the pipeline-claim
 * defect.
 *
 * Every arm here is a way of NOT knowing, and they all have to land on `null`,
 * because `null` is what makes the mint gate conservative: no answer, no crop,
 * words carry the ask exactly as they do today.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* The store is a recording double, so the CACHE arms can count model calls and
   database writes rather than infer them from a return value. */
let kept: Record<string, unknown> | null = null;
const written: Array<Record<string, unknown>> = [];
vi.mock("../db/castingV2OpenKindProperties", () => ({
  readOpenKindProperties: async () => kept,
  writeOpenKindProperties: async (row: Record<string, unknown>) => {
    written.push(row);
    return true;
  },
}));

const {
  KIND_PROPERTY_PROMPT_VERSION,
  KIND_PROPERTY_SYSTEM,
  ensureKindProperties,
  readKindProperties,
} = await import("./openKindProperties");
import type { TextEngine } from "../providers/types";

beforeEach(() => {
  kept = null;
  written.length = 0;
});

function engineSaying(text: string, extra: { truncated?: boolean; served?: string } = {}): {
  engine: TextEngine;
  asked: Array<{ system?: string; user?: string }>;
} {
  const asked: Array<{ system?: string; user?: string }> = [];
  const engine: TextEngine = {
    id: "fake",
    complete: async (request) => {
      asked.push({ system: request.system, user: request.user });
      return {
        text,
        provenance: {
          provider: "openrouter" as const,
          model: "anthropic/claude-sonnet-5",
          ...(extra.served ? { servedModel: extra.served } : {}),
        },
        latencyMs: 1,
        ...(extra.truncated ? { truncated: true } : {}),
      };
    },
  };
  return { engine, asked };
}

describe("the kind-property read", () => {
  it("reads a locality and a place, and stores the locality as answered", async () => {
    const { engine, asked } = engineSaying('{"locality":"distributed","anchor":"torso"}');
    const read = await readKindProperties("wings", { engine });

    expect(read).toEqual({
      locality: "distributed",
      anchorRegion: "torso",
      model: "anthropic/claude-sonnet-5",
      promptVersion: KIND_PROPERTY_PROMPT_VERSION,
    });
    /* THE WORD ALONE reaches the model — no sentence, no frame. Both answers are
       facts about the thing, and letting the ask in would make this a second
       interpreter with an opinion about it. */
    expect(asked).toHaveLength(1);
    expect(asked[0]!.user).toBe("wings");
  });

  /*
    THE THREE ANSWERS SURVIVE THE READ, which is the whole of the founder's fangs
    ruling (fable-951). The old question asked HOW MANY and folded three answers
    to a boolean, so `coLocated` and `distributed` arrived at the gate wearing
    one word — and fangs were refused a crop for being several, when several
    things sitting together is exactly the case one crop CAN hold.
  */
  it("keeps all three localities apart — the fold is gone", async () => {
    const single = await readKindProperties("tail", {
      engine: engineSaying('{"locality":"single","anchor":"belowWaist"}').engine,
    });
    expect(single).toMatchObject({ locality: "single", anchorRegion: "belowWaist" });

    const together = await readKindProperties("scales", {
      engine: engineSaying('{"locality":"coLocated","anchor":"wholeBody"}').engine,
    });
    expect(together).toMatchObject({ locality: "coLocated", anchorRegion: "wholeBody" });

    const apart = await readKindProperties("wings", {
      engine: engineSaying('{"locality":"distributed","anchor":"torso"}').engine,
    });
    expect(apart).toMatchObject({ locality: "distributed", anchorRegion: "torso" });
  });

  /*
    NOT CASE-FOLDED, and this is the one that would hide a disobedient reader:
    the instruction lists the words and `coLocated` is the spelling. A reply of
    `colocated` is a reader that did not obey, and folding it here would make the
    control run print a pass it did not earn.
  */
  it("refuses a locality that is spelled differently from the one word asked for", async () => {
    const { engine } = engineSaying('{"locality":"colocated","anchor":"head"}');
    expect(await readKindProperties("fangs", { engine })).toBeNull();
  });

  it("names the SERVED snapshot when the provider reports one", async () => {
    const { engine } = engineSaying('{"locality":"single","anchor":"head"}', { served: "sonnet-5-20260801" });
    expect(await readKindProperties("halo", { engine })).toMatchObject({ model: "sonnet-5-20260801" });
  });

  it("refuses a place outside the eight rather than folding it to the nearest", async () => {
    /* The bound: a reader may not invent anatomy. `elbows` is a place the framing
       table has no row for, and mapping it onto `arms` would be the unowned-axis
       collapse with a model's guess inside it. */
    const { engine } = engineSaying('{"locality":"distributed","anchor":"elbows"}');
    expect(await readKindProperties("wings", { engine })).toBeNull();
  });

  it("refuses a locality outside the three", async () => {
    const { engine } = engineSaying('{"locality":"pair","anchor":"torso"}');
    expect(await readKindProperties("wings", { engine })).toBeNull();
  });

  it("refuses a reply that is prose, empty, or missing a field", async () => {
    for (const reply of [
      "wings are a pair, on the back",
      "",
      "{}",
      '{"locality":"distributed"}',
      '{"anchor":"torso"}',
      '{"locality":null,"anchor":"torso"}',
    ]) {
      expect(await readKindProperties("wings", { engine: engineSaying(reply).engine })).toBeNull();
    }
  });

  it("reads a fenced reply, because a model that obeys in markdown still obeyed", async () => {
    const { engine } = engineSaying('```json\n{"locality":"single","anchor":"head"}\n```');
    expect(await readKindProperties("halo", { engine })).toMatchObject({ locality: "single", anchorRegion: "head" });
  });

  it("answers nothing when the reply was TRUNCATED — our ceiling, not their sentence", async () => {
    const { engine } = engineSaying('{"locality":"distributed","anch', { truncated: true });
    expect(await readKindProperties("wings", { engine })).toBeNull();
  });

  it("answers nothing when the call throws, and nothing when there is no engine", async () => {
    const throwing: TextEngine = { id: "x", complete: async () => { throw new Error("transport down"); } };
    expect(await readKindProperties("wings", { engine: throwing })).toBeNull();
    expect(await readKindProperties("wings", {})).toBeNull();
    expect(await readKindProperties("wings", { engine: null })).toBeNull();
    expect(await readKindProperties("   ", { engine: engineSaying('{"locality":"distributed","anchor":"torso"}').engine })).toBeNull();
  });

  it("NAMES NO CONTROL SPECIMEN IN THE PROMPT", async () => {
    /* fable-897's own discipline, mechanized: a control whose answer is written
       into the instruction is not a control. This is the `specimen-joins-the-
       vocabulary` defect made unable to happen by editing, because the next
       person to add a helpful example is who it happens to. */
    for (const specimen of ["tail", "halo", "beak", "horn", "wings", "fang", "nail"]) {
      expect(KIND_PROPERTY_SYSTEM.toLowerCase()).not.toContain(specimen);
    }
    /* And the positive control on that assertion: the prompt DOES carry the
       examples it is supposed to, so `not.toContain` is not passing over an empty
       string. */
    expect(KIND_PROPERTY_SYSTEM).toContain("tusks");
    expect(KIND_PROPERTY_SYSTEM).toContain("quills");
  });

  it("never asks whether the thing EXTENDS — extension is derived, not read", async () => {
    /* fable-897 §3c. The prompt asks WHERE, and `bodyAnchorRegions` answers
       whether that place is in a given framing. One model opinion fewer. */
    expect(KIND_PROPERTY_SYSTEM.toLowerCase()).not.toContain("extend");
    expect(KIND_PROPERTY_SYSTEM.toLowerCase()).not.toContain("frame");
  });
});

/**
 * THE CACHE — one text call per new noun, ever, and a table read after that.
 *
 * The whole cost argument of the design rests on this, so it is asserted at the
 * SEAM rather than reasoned about: the arms count the model calls. A cache that
 * silently re-bought every ask would look identical from the return value, which
 * is the shape `collected-never-asserted` and the face-scan re-buy both wore.
 */
describe("the kind-property cache", () => {
  it("asks NOBODY when the store already holds the kind", async () => {
    kept = { locality: "distributed", anchorRegion: "torso", model: "m", promptVersion: "kp-1" };
    const { engine, asked } = engineSaying('{"locality":"single","anchor":"head"}');
    const got = await ensureKindProperties({ kind: "wings", noun: "wings", engine });
    expect(got).toEqual(kept);
    /* THE ARM THAT MAKES IT A CACHE. Not the return value — the absence of a
       call. */
    expect(asked).toHaveLength(0);
  });

  it("asks, and WRITES, when the store holds nothing", async () => {
    kept = null;
    const { engine, asked } = engineSaying('{"locality":"single","anchor":"belowWaist"}');
    const got = await ensureKindProperties({ kind: "tail", noun: "tail", engine });
    expect(got).toMatchObject({ locality: "single", anchorRegion: "belowWaist" });
    expect(asked).toHaveLength(1);
    expect(written).toEqual([{
      kind: "tail",
      locality: "single",
      anchorRegion: "belowWaist",
      model: "anthropic/claude-sonnet-5",
      promptVersion: KIND_PROPERTY_PROMPT_VERSION,
    }]);
  });

  it("asks about the NOUN and keys on the KEY", async () => {
    /* `cat-ears` is an identifier; `cat ears` is the word English has an answer
       about. Asking the reader the key would be asking about a token nobody
       says. */
    kept = null;
    const { engine, asked } = engineSaying('{"locality":"distributed","anchor":"head"}');
    await ensureKindProperties({ kind: "cat-ears", noun: "cat ears", engine });
    expect(asked[0]!.user).toBe("cat ears");
    expect(written[0]!.kind).toBe("cat-ears");
  });

  it("writes NOTHING when the reader declined, and answers unknown", async () => {
    /* The conservative side: no row, so the mint gate reads
       `openKindLocalityUnread` and cuts no crop. A row holding a guess is what would file one wing under
       the name of two. */
    kept = null;
    const { engine } = engineSaying("wings are a pair");
    expect(await ensureKindProperties({ kind: "wings", noun: "wings", engine })).toBeNull();
    expect(written).toHaveLength(0);
  });
});
