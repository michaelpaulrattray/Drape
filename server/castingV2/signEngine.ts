/**
 * The transports the Sign ceremony uses, and the door in front of them.
 *
 * Sibling of `rollEngine.ts`, and it follows the same two rules for the same
 * reasons: one process-wide queue per provider so admission and dispatch cannot
 * disagree, and a **missing credential fails before the money moves**, never at
 * dispatch — reaching dispatch means the customer has already been charged, and
 * a key we forgot to set is a configuration fault, not a generation failure
 * they should have to be refunded for.
 *
 * Two engines, because they answer different questions: one makes the picture,
 * and the judge decides whether it may land. They must not be the same model —
 * a generator grading its own output is not a second opinion, and prompt
 * compliance as the sole check is the settled anti-pattern (§I).
 *
 * ⚠ **AND THERE ARE THREE NOW, BECAUSE PATH E SPLIT THE OUTFIT FROM THE
 * PICTURE (#1278 part 2, his ruling 2026-09-29).** His two courts did not
 * cancel — they each answered about a different job, and he said so in one
 * line: *"Sunburst was only chosen because it was more creative in outfit
 * design. NBP2k was a better quality rersult though."* So:
 *
 *   `castingViewEngine`       Nano Banana Pro `2K` — every DELIVERED view.
 *   `castingOutfitPlateEngine` GPT Image 2.5 Sunburst `high` — the wardrobe
 *                              plate only, which no customer is ever handed.
 *   `castingIdentityEngine`   Nano Banana Pro `1K` — the paid refine's
 *                              non-repaint edit (`refineService.ts`).
 *
 * ⚠ **THIS SUPERSEDES #1459 AND DOES SO HERE RATHER THAN IN A REVERT** — his
 * own instruction: *"#1459's switch of the delivered views to Sunburst is
 * superseded WHEN path E lands, inside E's own PR — not reverted separately
 * beforehand."* #1459 was right on its own question and is kept in the record
 * for it; what changed is that the outfit stopped being the delivered
 * picture's problem.
 *
 * ⚠ **ALL THREE SHARE ONE QUEUE AND THAT IS THE WHOLE BUDGET STORY.** The fal
 * account's ceiling is spent by four DECLARED paths (`falBudget.ts`) summing to
 * 20 of 20 (19 until #2206 put region reads back to 6), and
 * `assertFalBudget()` refuses to boot on a fifth. The plate is a
 * new road, not a new path: it draws from `SIGN_VIEW_CONCURRENCY` like the
 * views beside it, so the arithmetic that table exists to protect is unmoved.
 */
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import { createFalIdentityEngine } from "../providers/falQueue";
import { createFalSunburstPlateEngine, createFalSunburstSheetEngine } from "../providers/falImages";
import { falAllowanceOf } from "./falBudget";
import { SIGN_SHEET_SIZES, type SignSheetKind } from "./signSheet";
import { ProviderQueue } from "../providers/providerQueue";
import type { IdentityEngine } from "../providers/types";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import { createCastPersonaReader, type CastPersonaReader } from "./castPersona";
import {
  createViewConformanceJudge,
  forcedFailAnglesFromEnv,
  type ViewConformanceJudge,
} from "./viewConformance";
import { envInt } from "../_core/env";


let viewQueue: ProviderQueue | null = null;
let identityEngine: IdentityEngine | null = null;
let viewEngine: IdentityEngine | null = null;
let plateEngine: IdentityEngine | null = null;
/**
 * ONE MEMO PER SHEET KIND — his #1926 ruling renders two sheets of different
 * shapes, and the SIZE is baked into each engine at construction.
 *
 * ⚠ **A single memo would hand the second caller the FIRST sheet's pixels**,
 * silently: both engines share a door, a quality and a queue, so the wrong one
 * returns a perfectly good picture of the wrong shape, the cut succeeds, and
 * #1903's three surviving judge axes cannot see framing.
 */
const sheetEngines: Record<SignSheetKind, IdentityEngine | null> = { head: null, body: null };
let judge: ViewConformanceJudge | null = null;
let personaReader: CastPersonaReader | null = null;

function castPackageQueue(): ProviderQueue {
  if (!viewQueue) {
    viewQueue = new ProviderQueue({
      name: "fal-cast-views",
      /*
        Lower than the sheet's eight on purpose. A package is five 2K identity
        generations against one account-level fal concurrency ceiling that the
        sheet is also drawing on; a Sign that starves the rolls behind it trades
        one customer's wait for everybody's.
      */
      concurrency: falAllowanceOf("SIGN_VIEW_CONCURRENCY"),
      maxQueueDepth: envInt("SIGN_VIEW_MAX_QUEUE_DEPTH"),
    });
  }
  return viewQueue;
}

export function castingIdentityEngine(): IdentityEngine {
  if (!identityEngine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to build a signed Cast package");
    identityEngine = createFalIdentityEngine({ apiKey, queue: castPackageQueue() });
  }
  return identityEngine;
}

/**
 * WHAT A SIGNED VIEW RENDERS ON — Nano Banana Pro at the `2K` tier.
 *
 * **His word, 2026-09-29 (terminal), path E:** *"NBP2k was a better quality
 * rersult though."* The delivered views are the pictures a customer keeps, so
 * they render on the engine his eye picked for QUALITY; the outfit they wear is
 * settled one call earlier by {@link castingOutfitPlateEngine}, which is the
 * engine his eye picked for INVENTION.
 *
 * `packageOrchestrator`'s attempt loop takes this one, so the Sign and a Try
 * again are one engine — they must be, or one cast wears two looks.
 *
 * ⚠ **IT IS A SEPARATE MEMO FROM `castingIdentityEngine` DESPITE BUILDING THE
 * SAME FACTORY, AND DELIBERATELY SO.** The two roads ask for different tiers
 * (`2K` here, `1K` there) and have moved apart once already this week. A door
 * with its own name is a door the next ruling can move without touching the
 * refine; collapsing them would save one line and re-merge two paid roads his
 * rulings keep treating separately.
 *
 * The missing-credential refusal is the same one, for the same reason stated at
 * the top of this file: it fires before the money moves, not at dispatch.
 */
export function castingViewEngine(): IdentityEngine {
  if (!viewEngine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to build a signed Cast package");
    viewEngine = createFalIdentityEngine({ apiKey, queue: castPackageQueue() });
  }
  return viewEngine;
}

/**
 * WHAT THE WARDROBE PLATE RENDERS ON — GPT Image 2.5 Sunburst at `high`.
 *
 * **His word, 2026-09-29 (terminal):** *"Sunburst was only chosen because it
 * was more creative in outfit design."* That sentence is this engine's entire
 * job description. It draws one two-panel plate per Sign, the plate is cut in
 * memory and handed to the two full-length views as a reference, and **nothing
 * it paints is ever delivered to a customer or stored** (`outfitPlate.ts`).
 *
 * ⚠ **A MISSING CREDENTIAL IS THE ONE PLACE THIS DOOR IS STRICTER THAN IT
 * LOOKS, AND IT IS STILL SAFE.** It throws like its siblings — but every caller
 * of the plate road turns a throw into "no plate" and renders master-only, so
 * an unset `FAL_KEY` cannot reach here in practice: `castingViewEngine` above
 * refuses on the same variable first, before any money moves. The refusal is
 * kept anyway rather than softened, because a door that returns `null` for a
 * configuration fault is how a silently disabled feature ships.
 */
export function castingOutfitPlateEngine(): IdentityEngine {
  if (!plateEngine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to render a Sign's wardrobe plate");
    plateEngine = createFalSunburstPlateEngine({ apiKey, queue: castPackageQueue() });
  }
  return plateEngine;
}

/**
 * WHAT THE SIGN SHEET RENDERS ON — GPT Image 2.5 Sunburst at `high`.
 *
 * **His word, 2026-10-07 (terminal), closing #1690:** *"and then we go with the
 * sunburst 2.5 max quality for the sign sheet"*, after judging the three-engine
 * A/B and the cut views by eye. ⚠ **This is the fourth engine this file has
 * named in nine days and the record above is why the dates matter**: #1459
 * moved the delivered views to Sunburst, path E moved them back to Nano Banana
 * Pro 2K with Sunburst keeping the plate, and this card replaces all five views
 * AND the plate with ONE Sunburst frame. Each move was his eye on real frames,
 * and none of them cancels the one before — they answered different questions.
 *
 * ⚠ **`castingViewEngine` ABOVE IS STILL LIVE AND MUST STAY**, which is the one
 * thing a reader could get wrong here. The Sign no longer calls it, but a **Try
 * again** renders one view against its delivered sibling on that engine
 * (`viewRetryService.ts`), and so does the paid refine's road. Deleting it as
 * "the old Sign engine" would take two live roads with it — the path-three
 * death this file's siblings have paid for four times.
 *
 * ⚠ **IT IS A NEW ROAD, NOT A NEW DECLARED PATH, so `assertFalBudget()` is
 * unmoved.** It draws from `SIGN_VIEW_CONCURRENCY` through the queue below,
 * exactly as the plate does — and the arithmetic gets *easier* rather than
 * tighter: a Sign used to put one plate and five views through that allowance
 * and now puts ONE sheet through it, so the account ceiling this table protects
 * sees a sixth of the pressure it did yesterday.
 *
 * The missing-credential refusal is its siblings', for the reason at the top of
 * this file: it fires before the money moves, never at dispatch.
 */
export function castingSignSheetEngine(kind: SignSheetKind): IdentityEngine {
  let engine = sheetEngines[kind];
  if (!engine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to render a signed Cast's sheet");
    engine = createFalSunburstSheetEngine({
      apiKey,
      /* The size is the sheet's own, from the one table that also owns its
         panel list — so the pixels and the panels cannot disagree. */
      size: SIGN_SHEET_SIZES[kind],
      queue: castPackageQueue(),
    });
    sheetEngines[kind] = engine;
  }
  return engine;
}

export function castingViewConformanceJudge(): ViewConformanceJudge {
  if (!judge) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      /*
        No judge, no Sign — and this refusal is UNTOUCHED by D-246.

        There is a difference between "the checker broke mid-render, after the
        customer paid" and "this deployment has no checker at all". The first is
        the founder's flawed-detector case and now delivers (see
        `packageOrchestrator`); the second is a configuration mistake caught
        BEFORE any spend, which costs nobody a picture and nobody a credit.
        §I's law lives here, at the door, where refusing is free.
      */
      throw new Error("OPENROUTER_API_KEY is required to validate a signed Cast package");
    }
    /*
      ⚠ **THE SEGMENTER REFUSAL THAT STOOD HERE IS GONE — #1903, AND IT HAD TO
      GO IN THIS COMMIT OR THE SIGN WOULD NOT CONSTRUCT.**

      It read *"FAL_KEY is required to measure a signed Cast view's framing
      band"*, and it was right for as long as there was a band: `framingReader`
      was optional on the judge's config only so a test could skip it, and a
      production judge built without one would have gone quietly back to asking
      a vision model the question #1612 took away from it. Invariant 7, which is
      why it was a throw rather than a fallback.

      **His ruling removed the question, so the dependency it guarded no longer
      exists** — the judge reads no geometry at all. Named here rather than
      deleted silently, because this is the shape law 7's ruling sweep is about:
      a correct control dying because the road it sat on closed.

      ⚠ **Nothing else loses a refusal.** `castingViewEngine` above still
      refuses on `FAL_KEY` before any money moves — a deployment that cannot
      render a view still cannot start one — and the OpenRouter refusal
      immediately above is untouched, so *"this deployment has no checker at
      all"* is still caught at the door where refusing is free.
    */
    judge = createViewConformanceJudge({
      engine: createOpenRouterTextEngine({
        apiKey,
        // Vision-capable, and the same slug the interpreter is pinned to — one
        // model to reason about, one retention conversation.
        model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
        queue: new ProviderQueue({ name: "openrouter-view-judge", concurrency: 3, maxQueueDepth: 24 }),
      }),
      ...(function forced() {
        const angles = forcedFailAnglesFromEnv(
          process.env.CASTING_V2_SIGN_FORCE_FAIL_VIEWS,
          CAST_PACKAGE_VIEWS,
        );
        return angles ? { forceFail: angles } : {};
      })(),
    });
  }
  return judge;
}

/**
 * WHO SHE IS ON CAMERA, AND HOW SHE SOUNDS — N2b's reader, in production (#1242).
 *
 * ⚠ **THE SAME ROAD AND THE SAME MODEL AS THE CHECKER, deliberately** (the
 * card's own settled line). One vision-capable slug for this product to reason
 * about and one retention conversation to have about customers' frames — the
 * same argument the judge's own comment makes one function above.
 *
 * ⚠ **IT NEVER REFUSES THE SIGN, and that is the whole difference from the
 * judge.** No `OPENROUTER_API_KEY` means `null` here, where the judge throws:
 * a deployment with no checker cannot validate a package anybody paid for, but
 * a deployment that cannot draft two lines of text should still deliver five
 * pictures. The absent reader is the same outcome as a read that fails — no
 * lines, no badge, nothing on her page that looks broken — so there is exactly
 * one behaviour to reason about rather than two.
 *
 * Its own queue, at ONE in flight: a Sign makes exactly one of these calls, and
 * borrowing the judge's three would let a burst of Signs spend the checker's
 * allowance on prose while a view waited to be judged.
 */
export function castingCastPersonaReader(): CastPersonaReader | null {
  if (!personaReader) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    personaReader = createCastPersonaReader({
      engine: createOpenRouterTextEngine({
        apiKey,
        model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
        queue: new ProviderQueue({ name: "openrouter-cast-persona", concurrency: 1, maxQueueDepth: 16 }),
      }),
    });
  }
  return personaReader;
}

/** Test seam: drops the memoized engines so config changes take effect. */
export function resetSignEnginesForTests(): void {
  viewQueue = null;
  identityEngine = null;
  /* ⚠ BOTH OF THESE WERE MISSING. `viewEngine` was memoized by #1459 and never
     added here, so a suite that set `FAL_KEY` after another had built the
     engine kept the first one — a reset that silently resets less than it
     names is the shape every one of these leaks has. */
  viewEngine = null;
  plateEngine = null;
  /* The sheet engines join the reset in the SAME commit that memoizes them —
     the docblock above records what it cost when viewEngine did not. ⚠ Keyed
     off the record rather than written out, so a third sheet kind cannot be
     added and left un-reset. */
  for (const kind of Object.keys(sheetEngines) as SignSheetKind[]) sheetEngines[kind] = null;
  judge = null;
  personaReader = null;
}
