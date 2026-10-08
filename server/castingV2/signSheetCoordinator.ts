/**
 * THE SHEET COORDINATOR — one judgement per rendered panel, and ONE silent
 * re-render of a whole sheet when a catastrophe lands on any of its views.
 *
 * **His ruling, 2026-10-08 (terminal), verbatim and entire: *"go with A"***, on
 * option A of #1904:
 *
 * > *"Re-render that one sheet once, at our cost, same prompt and references.
 * > Replace **all** of that sheet's views together, so the views on a sheet
 * > always come from one render and stay consistent with each other. The other
 * > sheet is untouched. Judge the new cuts the same way. If a view still fails,
 * > refund that view. Views that pass are delivered. At most one automatic
 * > re-render per sheet per Sign. No loop."*
 *
 * ⚠ **IT CANNOT LIVE IN THE PER-VIEW ATTEMPT LOOP, AND THE DECISIVE REASON IS
 * COMMIT ORDERING RATHER THAN THE OBVIOUS RACE.** `buildCastPackage` dispatches
 * its views concurrently and each commits its asset row as it lands. So with a
 * per-view latch, `frontFull` can pass, commit a sheet-1 panel and finish
 * before `backFull`'s catastrophe triggers the body re-render — and the two
 * delivered views would then come from different renders, which is exactly what
 * *"replace all of that sheet's views together"* forbids. The only repair from
 * that position is deleting a committed asset row mid-Sign, on a money table.
 * **So every judgement for a sheet happens HERE, above the views, before any of
 * them can commit**, and the per-view road only ever CONSUMES the settled map.
 *
 * ⚠ **NOT ONE LINE OF MONEY MOVES THROUGH THIS MODULE, and that is deliberate
 * rather than incidental.** It takes no `userId` balance, no refund, no audit
 * row and no ledger reference: a refused panel is handed back as a refusal and
 * `failView` refunds that slice exactly as it did before this file existed, per
 * slice, under the reference it has always used. The re-render is ~$0.11 of
 * HOUSE money with no customer-facing entry anywhere — the Sign's price is
 * unchanged and a customer who never sees a catastrophe pays nothing different
 * from one who does.
 *
 * ⚠ **ONE HONEST CONSEQUENCE OF HIS RULING, said out loud because a customer
 * can feel it: a view that PASSED on sheet 1 can fail on sheet 2 and refund.**
 * Replacing a sheet's views together means the good panel is discarded with the
 * bad one. That is inside his *"replace all of that sheet's views together"* —
 * consistency across a sheet is the thing the sheet road exists to buy — but it
 * is a real trade and not a free win, so it is named here rather than
 * discovered later.
 */

import type { CastViewAngle } from "../../shared/boardTypes";
import { createModuleLogger } from "../logging/logger";
import type { ImageResult } from "../providers/types";
import { captureRefusedRender } from "./diagnosticCapture";
import {
  type RenderedSignSheet,
  type SignSheetKind,
  signSheetKindFor,
} from "./signSheet";
import {
  judgeUnjudgedOnFailure,
  type ConformanceAxis,
  type ViewConformanceJudge,
  type ViewConformanceVerdict,
  viewConformanceRefuses,
} from "./viewConformance";

const log = createModuleLogger("castingV2/signSheetCoordinator");

/**
 * HOW MANY TIMES ONE SHEET MAY BE RENDERED IN ONE SIGN — his *"at most one
 * automatic re-render per sheet per Sign. No loop."*
 *
 * ⚠ **ITS OWN CONSTANT, AND DELIBERATELY NOT A MIRROR OF
 * `VIEW_JUDGED_ATTEMPTS`.** The two numbers happen to be 2 today and they
 * answer different questions about different money: `VIEW_JUDGED_ATTEMPTS` is
 * how many draws a CUSTOMER's paid slice gets against the judge on the per-view
 * road, and this is how many frames the HOUSE pays for to rescue a sheet.
 * Deriving one from the other would make his ruling on either silently move the
 * other (working law 4), and the per-view budget is on a money path.
 *
 * A re-render costs ~$0.11 and ~70 s of the customer's wait, so 2 is the whole
 * budget: the slot simply shows *being made* a little longer, and a third frame
 * would be the slot machine D-39/D-40 named, paid for by us.
 */
export const SHEET_MAX_RENDERS = 2;

/** One panel's settled fate — decided here, consumed by the per-view road. */
export type SheetPanelOutcome =
  | {
      readonly status: "delivered";
      /** The bytes to store, shaped exactly like anything else a view can land. */
      readonly image: ImageResult;
      /** The verdict this picture earned — the LAST of {@link verdicts}. */
      readonly verdict: ViewConformanceVerdict;
      /**
       * EVERY judgement this panel got, oldest first — one per sheet render
       * (D-114). A panel that passed on the re-render carries the generation-1
       * verdict too, because what the judge rejected before the draw the
       * customer heard about is the thing that makes the judge improvable.
       */
      readonly verdicts: readonly ViewConformanceVerdict[];
      /** Which render it came from, 1-based. */
      readonly generation: number;
    }
  | {
      readonly status: "refused";
      /** The axes that failed on the LAST judgement — what the customer is told. */
      readonly failedAxes: readonly ConformanceAxis[];
      readonly verdicts: readonly ViewConformanceVerdict[];
      readonly generation: number;
    };

export type SettledSignSheet = {
  readonly kind: SignSheetKind;
  /** Renders actually spent on this sheet: 1, or 2 when a catastrophe landed. */
  readonly renders: number;
  readonly panels: Readonly<Partial<Record<CastViewAngle, SheetPanelOutcome>>>;
};

/**
 * ONE PANEL OUT OF A SHEET, shaped like anything else a view can land.
 *
 * ⚠ **The provenance is the sheet's, not a constant**, which is what keeps the
 * asset rows honest about a delivered view's real size — a sheet whose
 * provenance never reached its panels would make every row claim the view
 * engine of whichever road happened to be live. Latency and cost are the
 * SHEET's and are deliberately attributed in full to each panel rather than
 * divided: dividing would invent a per-view figure nobody measured, and a
 * reader summing the rows would read one sheet as several renders either way.
 * The sheet's own log line is where the single true reading lives.
 *
 * ⚠ **Moved here from `packageOrchestrator.signSheetPanelFor` rather than
 * copied** — a second expression of "what a panel looks like to a view" would
 * be the parallel copy working law 4 is about, and it decides what a paying
 * customer's asset row records.
 */
function panelImage(sheet: RenderedSignSheet, angle: CastViewAngle): ImageResult {
  const panel = sheet.panels[angle];
  if (!panel) {
    /*
      A view the sheet has no panel for cannot be delivered, and it must not be
      delivered as somebody else's panel. This reaches the per-view attempt
      loop's catch as an ordinary failure, so the slice refunds.
    */
    throw new Error(`the Sign sheet carries no panel for the ${angle} view`);
  }
  return {
    bytes: panel.bytes,
    contentType: panel.contentType,
    provenance: sheet.provenance,
    latencyMs: sheet.latencyMs,
    ...(sheet.estimatedCostUsd === null ? {} : { estimatedCostUsd: sheet.estimatedCostUsd }),
  };
}

/** The axes a verdict turned down — the same read the per-view road makes. */
function failedAxesOf(verdict: ViewConformanceVerdict): readonly ConformanceAxis[] {
  return (Object.keys(verdict.axes) as ConformanceAxis[]).filter(
    (axis) => !verdict.axes[axis].pass,
  );
}

export type SettleSignSheetInput = {
  readonly kind: SignSheetKind;
  /** The panels this sheet carries, in the package's own order. */
  readonly panelOrder: readonly CastViewAngle[];
  /**
   * RENDER THE SHEET — called once, or twice when a catastrophe lands.
   *
   * ⚠ **It takes no argument, on purpose.** His ruling is *"same prompt and
   * references"*, so there is nothing about the second render that may differ
   * from the first; a `generation` parameter here would be a value handed over
   * and never read, and the only thing it could buy is the ability to compose a
   * different second frame — which is the one thing this must not do. It is a
   * thunk rather than a pre-awaited promise because the second call has to be
   * a second render.
   */
  readonly render: () => Promise<RenderedSignSheet>;
  readonly judge: ViewConformanceJudge;
  /** Her signed master — the face every panel is judged against. */
  readonly anchor: { bytes: Buffer; contentType: string };
  readonly pronouns: Parameters<ViewConformanceJudge>[0]["pronouns"];
  readonly userId: number;
  readonly operationId: string;
  /** Injected on both roads for the reason the per-view capture is. */
  readonly capture?: typeof captureRefusedRender;
};

/**
 * RENDER, CUT, JUDGE EVERY PANEL ONCE — then, on a catastrophe, do it again
 * once and settle from the second frame.
 *
 * ⚠ **A fault in the FIRST render propagates**, because there is no sheet and
 * therefore nothing to deliver: it reaches each of that sheet's views as an
 * ordinary arrival failure, every slice refunds itself, and the Cast still
 * activates and confesses. That is the existing total-loss road, reached
 * without a line of new money code.
 *
 * ⚠ **A fault in the RE-RENDER DOES NOT, and that asymmetry is the money
 * decision in this file.** The second frame is ours, bought to rescue one
 * refused slice; letting it fail the sheet would take two or three views the
 * customer already paid for and that the judge had already passed, to pay for
 * OUR outage — which is precisely what the confession law forbids. So the fault
 * is logged loudly and the sheet settles from generation 1, with the refusal
 * that triggered it standing.
 */
export async function settleSignSheet(
  input: SettleSignSheetInput,
): Promise<SettledSignSheet> {
  const judgeAll = async (sheet: RenderedSignSheet, generation: number) => {
    /*
      Judged concurrently, which is what the per-view road did when each view
      called the judge for itself: two or three independent reads of independent
      pictures, and serialising them would only make the customer wait longer
      for the same answers.
    */
    const judged = await Promise.all(
      input.panelOrder.map(async (angle) => {
        const image = panelImage(sheet, angle);
        const verdict = await judgeUnjudgedOnFailure(input.judge, {
          angle,
          anchor: input.anchor,
          candidate: { bytes: image.bytes, contentType: image.contentType },
          /*
            ⚠ The same face the generator was asked for — #1480 finding A's
            third site. A judge given different pronouns from the generator is
            that finding exactly, and on this road there is no per-view
            composition to borrow them from at all.
          */
          ...(input.pronouns ? { pronouns: input.pronouns } : {}),
        });
        return { angle, image, verdict, generation };
      }),
    );
    return judged;
  };

  /*
    ⚠ **A JUDGE THAT CANNOT BE REACHED DELIVERS THE PANEL — D-246, and the
    first draft of this file got it backwards.**

    It let a judge fault propagate, reasoning that delivering a picture nobody
    looked at would be dishonest. That is D-246's founder ruling exactly
    inverted — *detectors must not block real generations because the detectors
    are flawed* — and on this road it is worse than on the per-view one: one
    unreachable judge would have rejected a SHEET, which is two or three paid
    slices, and the Sign's own arm *"DELIVERS a view it could not check"* is
    what caught it. `judgeUnjudgedOnFailure` is the one expression of the rule,
    shared with the per-view road, and the verdict it returns says plainly that
    nobody looked (`method: "unavailable"`, `unjudged: true`) — which lands on
    the asset row and is the honest record D-246 asks for.
  */

  const first = await input.render();
  let judged = await judgeAll(first, 1);

  const refusedIn = (
    rows: readonly { angle: CastViewAngle; verdict: ViewConformanceVerdict }[],
  ) => rows.filter((row) => viewConformanceRefuses(row.verdict));

  /*
    ⚠ **AN `unjudged` PANEL DELIVERS AND MUST NOT BUY A RE-RENDER.**
    `viewConformanceRefuses` is `unjudged !== true && some(!pass)`, so the test
    below already excludes it — and the reason is worth stating where the
    spending decision is made: a dead judge fails every axis closed, so a judge
    outage would otherwise re-render BOTH sheets of every Sign at our cost while
    knowing nothing about the pictures. D-246 says *"we could not tell"* and
    *"we decided it was wrong"* are different facts; only the second is a reason
    to spend.
  */
  const refusedFirst = refusedIn(judged);
  let renders = 1;
  const priorVerdicts = new Map<CastViewAngle, ViewConformanceVerdict[]>();

  if (refusedFirst.length > 0) {
    await keepRefusedFrames(input, judged, 1);

    if (SHEET_MAX_RENDERS > 1) {
      log.warn(
        {
          operationId: input.operationId,
          sheet: input.kind,
          refused: refusedFirst.map((row) => row.angle),
          failedAxes: refusedFirst.map((row) => failedAxesOf(row.verdict).join("+")),
        },
        "[signSheetCoordinator] a catastrophe landed on this sheet — re-rendering it once at "
        + "our cost, and all of its views will come from the new frame",
      );
      try {
        const second = await input.render();
        renders = 2;
        /*
          Generation 1's verdicts are kept beside generation 2's for every panel
          on this sheet, not only the refused ones (D-114): a panel that passed
          twice is the control that says the engine was not merely re-rolled
          until the judge blinked.
        */
        for (const row of judged) {
          priorVerdicts.set(row.angle, [row.verdict]);
        }
        judged = await judgeAll(second, 2);
        const refusedSecond = refusedIn(judged);
        if (refusedSecond.length > 0) {
          await keepRefusedFrames(input, judged, 2);
          log.warn(
            {
              operationId: input.operationId,
              sheet: input.kind,
              refused: refusedSecond.map((row) => row.angle),
            },
            "[signSheetCoordinator] the re-rendered sheet still has refused views — those "
            + "slices refund and the rest are delivered; there is no third render",
          );
        } else {
          log.info(
            { operationId: input.operationId, sheet: input.kind },
            "[signSheetCoordinator] the re-rendered sheet came back clean — every view delivered "
            + "from it, at no cost to the customer",
          );
        }
      } catch (error) {
        /*
          See this function's docblock: the second frame is HOUSE money bought to
          rescue one slice, so its failure must not take the views the customer
          already paid for and the judge already passed.
        */
        log.error(
          { err: error, operationId: input.operationId, sheet: input.kind },
          "[signSheetCoordinator] the free re-render did not arrive — settling this sheet from "
          + "its first frame, so the views that passed are still delivered",
        );
      }
    }
  }

  const panels: Partial<Record<CastViewAngle, SheetPanelOutcome>> = {};
  for (const row of judged) {
    const verdicts = [...(priorVerdicts.get(row.angle) ?? []), row.verdict];
    panels[row.angle] = viewConformanceRefuses(row.verdict)
      ? {
          status: "refused",
          failedAxes: failedAxesOf(row.verdict),
          verdicts,
          generation: row.generation,
        }
      : {
          status: "delivered",
          image: row.image,
          verdict: row.verdict,
          verdicts,
          generation: row.generation,
        };
  }

  return { kind: input.kind, renders, panels };
}

/**
 * KEEP THE FRAMES THE JUDGE TURNED DOWN — #1492, his own Jingu (2026-09-29).
 *
 * ⚠ **The key carries the SHEET GENERATION, and a key that did not would be
 * worse than no capture at all.** `diagnosticKey` is
 * `…/<userId>/<operationId>/<name>.png`, so a bare `view-<angle>` would have
 * the re-render's refusal silently overwrite the first frame's — and the PAIR
 * is the whole diagnostic: it is what says whether the engine drew the same
 * wrong thing twice or something new.
 *
 * ⚠ **`.catch()`, and it is not belt-and-braces.** The production capture
 * promises in its own docblock never to throw, and a promise in a docblock is
 * not a control (working law 3) — least of all one standing between a
 * diagnostic and a decision to spend house money. A keeper that threw here
 * would abort the sheet and turn every one of its paid slices into a refund.
 */
async function keepRefusedFrames(
  input: SettleSignSheetInput,
  judged: readonly {
    angle: CastViewAngle;
    image: ImageResult;
    verdict: ViewConformanceVerdict;
  }[],
  generation: number,
): Promise<void> {
  const refused = judged.filter((row) => viewConformanceRefuses(row.verdict));
  if (refused.length === 0) return;
  await (input.capture ?? captureRefusedRender)({
    userId: input.userId,
    operationId: input.operationId,
    reason: `sheet_view_refused:${refused
      .map((row) => `${row.angle}:${failedAxesOf(row.verdict).join("+")}`)
      .join(",")}`,
    frames: refused.map((row) => ({
      name: `view-${row.angle}-sheet${generation}`,
      bytes: row.image.bytes,
    })),
  }).catch((error: unknown) => {
    log.warn(
      { err: error, operationId: input.operationId, sheet: input.kind, generation },
      "[signSheetCoordinator] the refused frames were not kept — the refusal stands unchanged",
    );
  });
}

/**
 * THE SETTLED PANEL FOR ONE VIEW — derived from the angle, never passed in.
 *
 * One reader ({@link signSheetKindFor}) answers which sheet a view belongs to
 * for the dispatch, the prompt and this read alike, so a view cannot be
 * rendered on one sheet and read off the other.
 */
export async function settledPanelFor(
  sheets: Readonly<Record<SignSheetKind, Promise<SettledSignSheet>>>,
  angle: CastViewAngle,
): Promise<SheetPanelOutcome> {
  const settled = await sheets[signSheetKindFor(angle)];
  const panel = settled.panels[angle];
  if (!panel) {
    /*
      The sheet settled without this view on it — a split that forgot an angle.
      It reaches the attempt loop's catch as an ordinary failure, so the slice
      refunds rather than being delivered as somebody else's panel.
    */
    throw new Error(`the settled ${settled.kind} sheet carries no panel for the ${angle} view`);
  }
  return panel;
}
