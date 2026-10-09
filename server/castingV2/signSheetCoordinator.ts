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
 * ⚠ **AND A SHEET THAT NEVER ARRIVES IS ASKED FOR AGAIN, SPACED, BEFORE ANY OF
 * ITS VIEWS REFUND — #1966, his *"2) go with your recc"* of 2026-10-08.** That
 * is a TRANSPORT fault, not a judged catastrophe: no frame came back, so
 * nothing was drawn and nothing was judged. It is a separate budget from
 * {@link SHEET_MAX_RENDERS} and does not touch `renders`;
 * {@link renderWithArrivalRetries} carries why the per-view road's own three
 * attempts could never have covered it.
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
import { createRenderBudget, type RenderBudget } from "../providers/renderBudget";
import {
  ProviderError,
  mayStillArrive,
  providerAlreadyBilled,
  type ImageResult,
  type ProviderFailureClass,
} from "../providers/types";
import { ARRIVAL_ATTEMPTS, arrivalBackoffMs, waitMs } from "./arrivalRetry";
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
 *
 * ⚠ **AND IT IS NOT THE ARRIVAL BUDGET EITHER — #1966, a third number this one
 * must not be confused with.** This counts frames that ARRIVED and were judged.
 * A request that produced no frame at all drew nothing, was judged by nobody
 * and cost nothing, and {@link renderWithArrivalRetries} asks again for it,
 * spaced, without touching `renders`. A reader who merged the two would either
 * refuse to re-ask for a dropped request or let a judged catastrophe buy a
 * third drawn frame; both are wrong, in opposite directions.
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
  readonly render: (budget: RenderBudget) => Promise<RenderedSignSheet>;
  readonly judge: ViewConformanceJudge;
  /** Her signed master — the face every panel is judged against. */
  readonly anchor: { bytes: Buffer; contentType: string };
  readonly pronouns: Parameters<ViewConformanceJudge>[0]["pronouns"];
  readonly userId: number;
  readonly operationId: string;
  /** Injected on both roads for the reason the per-view capture is. */
  readonly capture?: typeof captureRefusedRender;
  /**
   * The wait between ARRIVAL retries (#1966).
   *
   * Injected so a suite can PROVE the spacing happened — recording the
   * requested milliseconds — without actually sleeping for them. A test that
   * only asserts the call count cannot tell "spaced" from "hammered", which is
   * the per-view road's own stated reason for the same injection.
   */
  readonly wait?: (ms: number) => Promise<void>;
};

/**
 * ASK FOR THE SHEET, AND ASK AGAIN — SPACED — WHEN NOTHING CAME BACK (#1966).
 *
 * **His word, 2026-10-08 (terminal), verbatim and entire: *"2) go with your
 * recc"***, answering #1904's question 1.
 *
 * ## The defect
 *
 * Since the sheet road landed, each sheet was asked for exactly ONCE: this
 * module called its `render` thunk and let a throw out. So a TRANSPORT fault —
 * nothing came back at all, as opposed to a picture that came back and was
 * refused — lost **two or three views together**, and every one of them
 * refunded. The per-view road has asked three times, spaced, since #1208,
 * because a render that never arrives is OUR failure to deliver something
 * already paid for. The sheet road quietly dropped that promise for every view
 * on it.
 *
 * ⚠ **AND THE PER-VIEW BUDGET COULD NOT COVER IT, which is why the repair has
 * to live here.** `packageOrchestrator` holds ONE promise per sheet, so a
 * settled rejection re-throws instantly to every view awaiting it: the three
 * arrival attempts were spent waiting on an answer that could never change.
 * The thing that can be re-asked is the SHEET, and only this module holds it.
 *
 * ## What it is NOT
 *
 * ⚠ **It is not a second RENDER in {@link SHEET_MAX_RENDERS}'s sense, and the
 * two budgets must not be confused.** His #1904 ruling buys ONE re-render per
 * sheet per Sign — *"at most one automatic re-render per sheet per Sign. No
 * loop."* — and that is about a frame that ARRIVED and was judged a
 * catastrophe. This is about a request that produced no frame at all: nothing
 * was drawn, nothing was judged, nothing was spent on a picture. So it does not
 * touch `renders`, which stays the count of frames this sheet actually cost.
 *
 * ⚠ **The decision of whether to ask again is not made here either.**
 * `mayStillArrive` owns it, beside the failure classes themselves — #1212's
 * finding was that a road holding a private opinion about that union drifts
 * from it, and this would have been the fourth such place.
 *
 * ⚠ **BUT ONLY A `ProviderError` IS ASKED ABOUT, AND THE FIRST SHAPE OF THIS
 * LOOP RE-BOUGHT SHEETS THAT HAD ALREADY ARRIVED** (the relay's finding on PR
 * #1982). It read a non-`ProviderError` as `unknown` and handed that to
 * `mayStillArrive`, which keeps retrying — the right default on the PER-VIEW
 * road, where the thunk is the engine call and nothing else, and the wrong one
 * here. **This thunk is `renderSignSheet`, which is the engine call PLUS the
 * decode, the panel geometry, the cut and the provenance check.** Every one of
 * those throws a plain `Error` (`signSheet.ts` 477, 511, 512, 578, 780, ~839),
 * and every one of them is a frame that ARRIVED and was paid for — about
 * $0.11 of Sunburst each, deterministic, so each re-ask bought another one and
 * failed the same way, up to `ARRIVAL_ATTEMPTS` times, per generation.
 *
 * **Nothing legitimate is lost by making them terminal, and that was read
 * rather than assumed.** `server/providers/falTransport.ts` maps every fault it
 * can meet to a `ProviderError` — an unreachable host, a bad status, no
 * request id, a completed job with no image, a malformed data URI, a failed
 * download — so a transport fault NEVER arrives here as a bare `Error`. What
 * is left before the engine returns is prompt composition, which is
 * deterministic: asking again cannot change its answer either.
 *
 * ## Both calls, not only the first
 *
 * The re-render is HOUSE money bought to rescue a refused slice, so a transport
 * fault there costs the customer the rescue and the slice refunds. Asking again
 * costs only wait time on a road that is already failing, and the alternative
 * is giving up on a view because of our own outage — which is the confession
 * law's own reasoning, one level in.
 */
async function renderWithArrivalRetries(
  input: SettleSignSheetInput,
  generation: number,
  budget: RenderBudget,
): Promise<RenderedSignSheet> {
  const wait = input.wait ?? waitMs;
  let arrivalFailures = 0;

  for (;;) {
    try {
      return await input.render(budget);
    } catch (error) {
      /*
        ⚠ **A NON-`ProviderError` IS TERMINAL — it means the frame arrived.**
        See the docblock: this thunk carries the cut and the judge as well as
        the engine call, and the transport layer never lets a bare `Error`
        out. `null` rather than `"unknown"` so the reasoning is in the type:
        there is no failure CLASS to ask `mayStillArrive` about, because the
        thing that failed was not the arrival.
      */
      const failureClass = error instanceof ProviderError ? error.failureClass : null;
      arrivalFailures += 1;
      log.warn(
        {
          err: error,
          operationId: input.operationId,
          sheet: input.kind,
          generation,
          arrivalFailures,
          failureClass,
        },
        "[signSheetCoordinator] the sheet did not arrive",
      );
      /* Terminal: asking again cannot change the answer, and the wait would be
         charged to a customer who is already going to be refunded. */
      if (failureClass === null || !mayStillArrive(failureClass)) throw error;
      /*
        ⚠ **AND A FRAME THE PROVIDER ALREADY FINISHED IS TERMINAL TOO,
        WHATEVER ITS CLASS** — the relay's second finding on PR #1982.

        The arm above reads the failure CLASS, and three of fal's faults land
        AFTER the job reports `COMPLETED`: no image in the payload and a
        malformed data URI are `unknown`, a failed download is `transport`, and
        a non-ok result fetch is whatever its status says. None of those is in
        `VIEW_ARRIVAL_TERMINAL` — correctly, for a job that never ran — so this
        loop re-asked and **bought another sheet**, on top of the engine's own
        `withRetry`. Worst case per sheet was about 3 x ARRIVAL_ATTEMPTS 3 x
        SHEET_MAX_RENDERS 2 = 18 engine calls against 6 before this card, under
        a flat price.

        The question is asked of the ERROR rather than of its class because it
        is a fact about THAT request: `providerAlreadyBilled` carries why, and
        the per-view arrival loop asks the same predicate.
      */
      if (providerAlreadyBilled(error)) throw error;
      if (arrivalFailures >= ARRIVAL_ATTEMPTS) throw error;
      await wait(arrivalBackoffMs(arrivalFailures));
    }
  }
}

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

  /*
    ⚠ **ONE POOL FOR THIS SHEET, AND THIS IS WHERE "PER SIGN, PER SHEET" IS
    MADE TRUE (#1968).** Cid's reprice holds only at *"at most 2 head-sheet and
    2 body-sheet renders per Sign, re-makes and arrival retries from one pool"*,
    and it is created here because this function IS one sheet of one Sign: the
    head and body sheets each get their own two, and the redo inherits the same
    bound by sharing this road.

    The limit is `SHEET_MAX_RENDERS` rather than a 2 typed again — the re-make
    below is exactly the second paid render, so the two facts are one number and
    a second copy of it is the drift working law 4 is about.
  */
  const budget = createRenderBudget(SHEET_MAX_RENDERS);

  const first = await renderWithArrivalRetries(input, 1, budget);
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
        /*
          The SAME budget, which is the whole of Cid's condition: a first
          generation that spent both its renders on arrival retries leaves no
          room here, so this call refuses before it submits and the existing
          catch below settles from generation 1 — the asymmetry this function's
          docblock already describes, now reached for a money reason as well as
          an outage one.
        */
        const second = await renderWithArrivalRetries(input, 2, budget);
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
            "[signSheetCoordinator] the re-rendered sheet still has refused views — they are "
            + "kept with the rest and nothing refunds per view; there is no third render",
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
 * THE SHEET IS SETTLED AND DID NOT ARRIVE — a terminal fact, not a retryable
 * one (#1966).
 *
 * ⚠ **IT EXISTS BECAUSE THE ARRIVAL BUDGET MOVED, and leaving it out would
 * have let one budget be spent twice.** `buildCastPackage` holds ONE promise
 * per sheet, so a settled rejection re-throws the SAME error instantly to every
 * view awaiting it — and the per-view loop, reading that error's failure class,
 * would read it as *"may still arrive"* and wait out its own three attempts on
 * an answer that cannot change. Before this card that waiting was the only
 * asking anybody did; now the sheet has asked three times itself, so the views
 * repeating it is pure delay in front of a refund.
 *
 * It is a distinct type rather than a mapped `ProviderError` class on purpose:
 * the failure is OURS — a settled promise — and dressing it as a provider
 * failure class would put a lie about the transport into the asset rows and the
 * logs. `mayStillArrive` keeps answering only the question it owns.
 */
export class SignSheetUnavailableError extends Error {
  /**
   * WHY THE SHEET DID NOT ARRIVE, read off the provider's own error — #2125.
   *
   * ⚠ **The wrapper used to hide it, and the per-view log lied as a result.**
   * Every view on a refused sheet logged `failureClass: "unknown"` while the
   * coordinator's own line, one statement earlier, said `content_policy`
   * (cast 71, 2026-10-09). The class is the PROVIDER's fact about the request,
   * so it is carried rather than re-mapped — and `null` when the sheet failed
   * after it arrived (a cut or a provenance refusal), which is the same `null`
   * {@link renderWithArrivalRetries} logs for the same reason.
   */
  readonly failureClass: ProviderFailureClass | null;

  constructor(kind: SignSheetKind, options: { cause?: unknown } = {}) {
    super(`the ${kind} Sign sheet did not arrive`, options);
    this.name = "SignSheetUnavailableError";
    this.failureClass = options.cause instanceof ProviderError ? options.cause.failureClass : null;
  }
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
  const kind = signSheetKindFor(angle);
  let settled: SettledSignSheet;
  try {
    settled = await sheets[kind];
  } catch (error) {
    /* The sheet is settled and it failed. It has already spent its own arrival
       budget (#1966), so this is terminal for every view on it. */
    throw new SignSheetUnavailableError(kind, { cause: error });
  }
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
