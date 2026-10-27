/**
 * ⚠ SERVED, A GARMENT AT SITE 5 IS LOGGED AS A ROUTING MISS — the diagnostic
 * half of the relay's #2600 finding (`foreman-20261017-0728`).
 *
 * # Why this is its own file and not two more arms next door
 *
 * The outcome half of that finding is armed in `outfitEditServed.test.ts`,
 * where it belongs: served, a garment the wardrobe nouns do not list refuses
 * rather than being filed as an open kind. **This file arms the one line of
 * that repair the outcome cannot see.** Site 5 refuses a garment under every
 * flag, so the branch that tells a scenery refusal from a garment MISROUTE
 * moves nothing a caller can read — delete it and no arm anywhere reddens.
 *
 * It needed a module-level `vi.mock` of the logger, and that mock is
 * file-level: dropping it into a 33-arm suite would put every one of those arms
 * behind a faked logger to assert one `warn`. So the mock gets its own file and
 * the suite next door keeps the real one.
 *
 * # And the branch is load-bearing rather than decoration
 *
 * The finding's second bullet — widen the wardrobe nouns so common two-word
 * garments reach `wardrobe` in the first place — is filed as its own card, a
 * capability on a fixed list rather than a repair. **This `warn` is the
 * instrument that card will be read from**: it names the noun a customer
 * actually typed, so the gap in the noun list is countable instead of guessed.
 * An `info` saying *"wall (b) holds"* would file a clothing ask under the
 * sentence for a backdrop and the gap would stay invisible.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Logged = { level: string; fields: Record<string, unknown>; message: string };
const logged: Logged[] = [];
vi.mock("../logging/logger", () => {
  const at = (level: string) => (fields: Record<string, unknown>, message: string) => {
    logged.push({ level, fields, message });
  };
  const logger = {
    info: at("info"), warn: at("warn"), error: at("error"),
    debug: at("debug"), trace: at("trace"), fatal: at("fatal"),
  };
  return { createModuleLogger: () => logger, logger };
});

const { acceptOpenKind } = await import("./openLaneAccept");
const { GARMENT_STAGE_WORDS, SCENERY_WORDS, stageWordIn } = await import("./refineDelta");

const scripted = (reply: string): never => ({
  complete: async () => ({ text: reply }),
} as never);

const openAsk = async (noun: string, served: boolean) => acceptOpenKind({
  instruction: `put them in a ${noun}`,
  unowned: [{ subject: noun, value: `put them in a ${noun}` }],
  engine: scripted(JSON.stringify({ kind: noun })),
  ...(served ? { outfitEditServed: true } : {}),
});

/** The line site 5 writes, whichever branch it took. */
const atSite5 = () => logged.filter((row) => row.message.includes("[openLaneAccept]"));

describe("served, site 5 tells a garment misroute from a scenery refusal", () => {
  beforeEach(() => {
    logged.length = 0;
  });

  it("⚠ served, a garment the wardrobe nouns do not list is a WARN naming the noun", async () => {
    const result = await openAsk("trench coat", true);
    expect(result?.ok).toBe(false);

    const rows = atSite5();
    expect(rows.length, "exactly one line about this ask").toBe(1);
    expect(rows[0]!.level).toBe("warn");
    expect(rows[0]!.message).toContain("routing miss");
    /* The NOUN is the whole point — a card about the gap in the noun list is
       read from these lines, and `kind` is the hyphenated identifier. */
    expect(rows[0]!.fields.noun).toBe("trench coat");
    expect(rows[0]!.fields.word).toBe("coat");
  });

  it("CONTROL — unserved, the very same ask keeps wall (b)'s own INFO line", async () => {
    const result = await openAsk("trench coat", false);
    expect(result?.ok).toBe(false);

    const rows = atSite5();
    expect(rows.length).toBe(1);
    expect(rows[0]!.level, "nothing about an unserved account is a routing miss").toBe("info");
    expect(rows[0]!.message).toContain("wall (b) holds");
  });

  it("⚠ CONTROL — served, SCENERY is never a routing miss, whatever the flag says", async () => {
    for (const word of SCENERY_WORDS) {
      logged.length = 0;
      const result = await openAsk(`grey ${word}`, true);
      expect(result?.ok, word).toBe(false);

      const rows = atSite5();
      expect(rows.length, word).toBe(1);
      expect(rows[0]!.level, `${word} is the set, not a garment`).toBe("info");
      expect(rows[0]!.message, word).toContain("wall (b) holds");
    }
  });

  it("⚠ every garment word the lexicon answers for earns the warn, served", async () => {
    /* The population is asked of the reader rather than typed, because
       `wearing` is in the garment half and `ACCESSORY_ALLOWED` means
       `stageWordIn` never answers for it — the same derivation the outcome arm
       next door uses, and for the same reason. */
    const answered = GARMENT_STAGE_WORDS.filter((word) => stageWordIn(word) !== null);
    expect(answered.length, "a floor — this must not pass by reading no words")
      .toBeGreaterThanOrEqual(4);

    for (const word of answered) {
      logged.length = 0;
      const result = await openAsk(`velvet ${word}`, true);
      expect(result?.ok, word).toBe(false);

      const rows = atSite5();
      expect(rows.length, word).toBe(1);
      expect(rows[0]!.level, word).toBe("warn");
      expect(rows[0]!.fields.noun, word).toBe(`velvet ${word}`);
    }
  });
});
