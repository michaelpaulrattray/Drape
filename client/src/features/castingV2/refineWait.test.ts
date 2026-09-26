import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE REFINING WAIT, AND THE ANSWER CHIPS — the laws, mechanized (D-169, D-180).
 *
 * The founder's UI contract: a design law that can be checked belongs in the
 * suite rather than in review memory. These are the ones that can, and every
 * one of them is a rule somebody could quietly undo in a later edit without a
 * single existing test going red.
 *
 * What is deliberately NOT here: whether the wait *feels* supervised. That was
 * judged on pixels, in a mock, before any of this was wired (D-101), and it is
 * not a thing an assertion can hold.
 */
const CSS = new URL("./castingV2.css", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/**
 * WHAT THE FILE SAYS OUT LOUD, with everything it merely DISCUSSES removed.
 *
 * Needed because this suite's strongest law — no duration printed on the
 * picture — has to survive a file that keeps the record of the duration it
 * deleted, quotation marks and all. A reader that could not tell those apart
 * would have to choose between an assertion that is wrong and a history that
 * is missing, and the history is the more valuable of the two.
 *
 * Deliberately crude, and proven crude-in-the-safe-direction by its own control
 * below: it strips block and line comments only, so at worst it leaves MORE
 * text standing than it should — never less. A stripper that ate code would
 * make every law here pass for the wrong reason.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

async function rule(selector: string): Promise<string> {
  const css = await readFile(CSS, "utf8");
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} must exist`).toBeGreaterThan(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the picture is the loader, and it claims nothing it cannot know", () => {
  it("softens the image itself rather than covering it with a panel", async () => {
    const waiting = await rule('.dpc-viewer__frame[data-wait="true"] img');
    expect(waiting).toContain("animation: dpc-settle");
    const css = await readFile(CSS, "utf8");
    const keyframes = css.slice(css.indexOf("@keyframes dpc-settle"));
    expect(keyframes.slice(0, 200)).toContain("blur(");
    /* Colour drains while it waits and returns when it lands — the arrival. */
    expect(keyframes.slice(0, 200)).toContain("saturate(");
  });

  /*
    THE CLIP IS LOAD-BEARING. Unclipped, `filter: blur()` feathers past the
    corner radius and the picture reads as a light leak rather than as a
    photograph going soft — which is the difference between "working" and
    "broken", and it is one deleted line away at all times.
  */
  it("clips the blur to the plate", async () => {
    const plate = await rule(".dpc-viewer__plate");
    expect(plate).toContain("overflow: hidden");
    expect(plate).toContain("position: relative");
  });

  /*
    NO TRAVELLING HIGHLIGHT. A band moving across a face captioned "the hair"
    claims the model is working that region. The dot field is uniform and
    full-frame precisely so it can claim nothing about where work happens.
  */
  it("keeps the dot field uniform across the whole frame", async () => {
    const dots = await rule(".dpc-viewer__dots");
    expect(dots).toContain("position: absolute");
    expect(dots).toContain("inset: 0");
  });

  it("never sets an animation that could read as progress", async () => {
    const css = await readFile(CSS, "utf8");
    const wait = css.slice(css.indexOf(".dpc-viewer__dots"), css.indexOf(".dpc-viewer__caption"));
    /* A width or a transform-scaleX growing over time IS a progress bar,
       whatever it is called. The wave moves a mask; nothing grows. */
    expect(wait).not.toMatch(/@keyframes[^}]*width:/);
  });

  it("sets the status in the type everything else uses, never mono", async () => {
    const said = await rule(".dpc-viewer__waitSaid");
    expect(said).toContain("font-family: var(--font-sans)");
    expect(said).not.toContain("--font-mono");
  });

  /*
    THE BAR MOVES BECAUSE THE ROAD MOVED, AND FOR NO OTHER REASON (#55).

    His spec: one bar, one line, its fill the fraction of REAL stages completed.
    The width therefore comes from the row, inline, every time — and the
    stylesheet must never be able to advance it on its own. A keyframe that
    animates a width IS an invented percentage whatever it is named, and this is
    the assertion that says so at the one place somebody would add one.
  */
  it("never animates the bar's fill on a clock", async () => {
    const css = await readFile(CSS, "utf8");
    const fill = await rule(".dpc-viewer__barFill");
    expect(fill, "the fill is a width the component sets").not.toContain("animation:");
    expect(fill).toContain("transition: width");
    /*
      And nothing in this stylesheet may hand it one. Scoped to the bar's own
      names rather than to every keyframe in the file: `dpc-deck-tick` grows a
      width and always has — it is the deck's tick mark drawing itself, not a
      claim about a render — and a law that had to redden over it would be a law
      somebody deletes rather than obeys.
    */
    for (const name of css.match(/@keyframes\s+([\w-]+)/g) ?? []) {
      expect(name, "a keyframe named for the bar is a bar that moves on a clock")
        .not.toMatch(/bar|fill|progress|stage/i);
    }
    const track = await rule(".dpc-viewer__bar");
    expect(track).not.toContain("animation:");
  });

  it("keeps the bar and the word when motion is off", async () => {
    const css = await readFile(CSS, "utf8");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .dpc-viewer__frame"));
    const block = reduced.slice(0, reduced.indexOf("\n}\n"));
    /* His clause 7: the motion goes, the bar and the word stay. So the only
       thing the query may do to them is stop the fill travelling. */
    expect(block).toContain(".dpc-viewer__barFill { transition: none; }");
    expect(block, "the bar itself is never hidden here").not.toMatch(/dpc-viewer__(bar|step)\b[^;]*display: none/);
  });
});

describe("the wait says only what the row knows", () => {
  /*
    THE READER BEFORE ITS VERDICT (working law 2). `withoutComments` is the
    only thing standing between "the picture promises nothing" and "the file
    happens not to contain a word", so it is driven both ways before anything
    is believed on its say-so.
  */
  it("the comment stripper keeps code and drops prose", () => {
    expect(withoutComments('/* usually three minutes */\nconst a = "kept";'))
      .not.toMatch(/usually/);
    expect(withoutComments('/* dropped */\nconst a = "kept";')).toContain('"kept"');
    expect(withoutComments('const url = "https://x/y"; // note\n')).toContain("https://x/y");
    expect(withoutComments('const url = "https://x/y"; // note\n')).not.toMatch(/note/);
  });

  /*
    THE STAGE WORDS ARE THE ROAD'S, AND THE ROAD IS THE ONLY PLACE THEY COME
    FROM (#55, 2026-09-26).

    ⚠ THIS LAW CHANGED ON PURPOSE AND ITS PREDECESSOR IS QUOTED HERE RATHER
    THAN DELETED. It read *"names two stages of progress, a settling state, and
    nothing else"* and counted exactly three keys in `STAGE_WORDS` — `in line`,
    `being drawn`, `this one didn't make it` — closing with *"a fourth would
    need this line changed on purpose."* This is that purpose. The founder's
    directive of fable-020 (*a thin progress indicator advancing on REAL stage
    transitions only*) was finally buildable once the road was made to announce
    itself; his filed spec names the four words, and `refineProgress.test.ts`
    drives them.

    What has NOT changed, and is the reason the old law existed: the viewer
    must not grow a vocabulary of its own. The four words live in one module
    beside the derivation that chooses between them, and `settling` stays out
    of that list because it is not a point on the road at all.
  */
  it("keeps the settling sentence out of the stage words, and holds no stage vocabulary of its own", async () => {
    const source = await readFile(VIEWER, "utf8");
    const at = source.indexOf("const SETTLING_WORD");
    expect(at, "the settling sentence must still be named here").toBeGreaterThan(-1);
    expect(source.slice(at, source.indexOf("\n", at))).toContain("this one didn't make it");
    /* The four words are not spelled in this file — a second copy of them here
       is how a surface and its derivation start disagreeing (law 4). */
    const body = source.slice(source.indexOf("export type ViewerWait"));
    for (const word of ["sending", "painting", "checking", "finishing"]) {
      expect(body, `"${word}" belongs in refineProgress, not in the viewer`).not.toContain(`"${word}"`);
    }
    expect(source).toContain("refineProgress(");
  });

  /*
    AND IT MUST NOT KEEP PROMISING A WAIT THAT IS OVER. Over a row the sweep has
    taken, the only fact the customer needs is where their credits went — and
    the bar and the stage word must be absent, because nobody is rendering it.
  */
  it("says where the money went over a settling row, and draws no bar there", async () => {
    const source = await readFile(VIEWER, "utf8");
    const at = source.indexOf("const SETTLING_NOTE");
    expect(at).toBeGreaterThan(-1);
    expect(source.slice(at, source.indexOf("\n", at))).toContain("credits come back on their own");
    expect(source).toContain("{SETTLING_NOTE}");
    /* The bar is drawn only from a derivation that returns null for settling —
       never from the stage directly, which is how the two would drift. */
    expect(source).toContain("{progress ? (");
  });

  /*
    NO EXPECTED TIME ANYWHERE ON THE PICTURE — his word, 2026-09-26, verbatim
    while drawing the loader: *"dont put the excpected time either"*, and the
    filed spec states it flatly.

    This is the one assertion that would go quietly green if somebody helpfully
    put the sentence back, so it is spelled out: the constant is gone, the
    record of why it went is not, and no duration is printed on the photograph.
  */
  it("promises no duration on the picture at all", async () => {
    const source = await readFile(VIEWER, "utf8");
    expect(source).not.toContain("const TYPICAL_WAIT");
    /* And the removal keeps its reason where the next person will read it —
       which is also why this assertion has to read past the comments: the
       record of the deleted sentence QUOTES it. */
    expect(source).toContain("THE EXPECTED-TIME LINE LIVED HERE");
    const said = withoutComments(source);
    expect(said).not.toMatch(/usually (about )?(a|an|one|two|three|four|five|half)/i);
    expect(said).not.toMatch(/\b(minutes?|seconds?)\b/);
  });

  /*
    NO PERCENTAGE, NO COUNTER. The client receives nothing between dispatch and
    landing, so anything numeric here would be measuring nothing. The measured
    "usually" line is a copy constant and says so.
  */
  it("shows no percentage and no elapsed counter", async () => {
    const source = await readFile(VIEWER, "utf8");
    const wait = source.slice(source.indexOf("export type ViewerWait"));
    expect(wait).not.toMatch(/%\{|percent|Math\.round\(.*elapsed/i);
    expect(wait).not.toMatch(/setInterval|Date\.now\(\)/);
  });

  /*
    THE MEASUREMENT OUTLIVES THE SENTENCE IT JUSTIFIED.

    ⚠ THIS LAW USED TO GUARD `TYPICAL_WAIT`'s provenance in the viewer, and the
    founder removed that copy on 2026-09-26. The argument for it did not go with
    it: the ONE remaining number about how long a refine takes is
    `LONG_WAIT_MS`, and a number nobody can date is a number nobody has checked.
    So the same requirement, moved to the file that still holds a figure — the
    current reading's date and its n, where whoever edits the threshold will be
    standing.
  */
  it("keeps the dated reading beside the one duration the product still holds", async () => {
    const panel = await readFile(PANEL, "utf8");
    const constant = panel.slice(
      panel.indexOf("When a wait stops being ordinary"),
      panel.indexOf("const LONG_WAIT_MS"),
    );
    expect(constant.length).toBeGreaterThan(0);
    expect(constant, "the threshold needs the reading that justifies it").toMatch(/2026-08-16/);
    expect(constant).toMatch(/n=56/);
    expect(constant).toMatch(/median (paid )?edit at 204 s/);
    expect(panel).toMatch(/const LONG_WAIT_MS = 5 \* 60 \* 1000;/);
  });

  /*
    THE PAIR IS GONE AND ITS ABSENCE IS THE ASSERTION NOW.

    The defect the founder ruled on in 2026-08 was two sentences on one screen
    disagreeing about the same wait: the viewer promised "a minute or two" while
    the panel called two minutes "longer than usual". The pair was kept in step
    by each naming the other. He closed the question the other way on
    2026-09-26 by deleting the viewer's half — so what has to hold now is that
    it stays deleted, and that the panel's note is still not an expected time.
  */
  it("leaves one surface holding a duration, and it is not the picture", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    const panel = await readFile(PANEL, "utf8");
    expect(viewer, "the picture promises no duration").not.toMatch(/const TYPICAL_WAIT/);
    expect(panel, "the panel must record that its pair was removed").toMatch(/TYPICAL_WAIT/);
    /* The note says a wait has become unusual; it never says how long one is. */
    const note = panel.slice(panel.indexOf("This one is taking longer than usual"));
    expect(note.slice(0, 260)).not.toMatch(/\b(minutes?|seconds?)\b/);
  });

  it("shows the user's own words, from the record", async () => {
    const source = await readFile(VIEWER, "utf8");
    expect(source).toContain("{wait.instruction}");
  });
});

describe("the answer chips are the typed path, not a second one", () => {
  /*
    THE WHOLE POINT. A chip submits its own LABEL — exactly what someone typing
    the answer sends — so both routes are one code path on the server. A chip
    that posted its `resolves` instead would be a second implementation, and the
    two would drift the first time either changed.
  */
  it("submits the chip's label, the same string a person would type", async () => {
    const source = await readFile(PANEL, "utf8");
    const chips = source.slice(source.indexOf('className="dpc-refine__answers"'));
    /*
      RE-ANCHORED 2026-08-20, and the contract it protects got STRONGER rather
      than weaker.

      It read `onRefine(option.label)` — the whole call, exactly — which made
      "the chip sends the label" and "the chip sends NOTHING ELSE" one
      assertion. The second half was never the rule and it was hiding a dead
      end: the typed route also carries the attached picture, and this one did
      not, so a question raised ABOUT a picture could not be answered by tapping
      it (opus-857). The label is still the first argument and the `resolves` is
      still never sent; what rides beside it is asserted in
      `referenceAttachCopy.test.ts`, where the picture's own contract lives.
    */
    expect(chips).toContain("onRefine(option.label,");
    expect(chips).not.toContain("onRefine(option.resolves");
  });

  it("leaves the box live beside them", async () => {
    const source = await readFile(PANEL, "utf8");
    /* The field is disabled only while something is RUNNING — never because a
       question is open, which would make chips the only way to answer. */
    expect(source).toContain("disabled={busy}");
    const field = source.slice(source.indexOf('className="dpc-refine__field"'));
    expect(field.slice(0, 400)).not.toContain("reask");
  });

  it("renders them in the panel's own frame, never in a dialog", async () => {
    const source = await readFile(PANEL, "utf8");
    expect(source).not.toMatch(/role="dialog"|createPortal|<Modal|aria-modal/);
  });

  /*
    UNTIL DISMISSED MEANS UNTIL SUPERSEDED, TOO.

    The walk found a refusal about a necklace sitting above a live "Refining…"
    for something else entirely. Both the sentence and its chips go the moment
    the next instruction is submitted, or the panel is describing a request
    nobody made any more.
  */
  it("clears the question and its chips when the next instruction is sent", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /* The submit path is now the named `askRefine`, called by the ask box AND
       by the box that opens on the picture (fable-200) — one handler, because a
       second copy of it would drift on the thing that spends money. */
    /* Anchored on the NAME rather than the whole signature, and the anchor is
       asserted before it is used: `indexOf` on a signature that has since grown
       a parameter returns -1, and a slice from -1 is an empty string — a reader
       that says nothing, shaped exactly like a passing one. It cost this suite
       a red when `scope` arrived (fable-444). */
    const at = sheet.indexOf("function askRefine(instruction: string");
    expect(at).toBeGreaterThan(-1);
    const submit = sheet.slice(at);
    const beforeMutation = submit.slice(0, submit.indexOf("refine"));
    expect(beforeMutation.length).toBeGreaterThan(0);
    expect(beforeMutation).toContain("setRefineOutcome(null)");
    expect(beforeMutation).toContain("setReaskOptions(null)");
  });

  /*
    THE POLL MUST NOT DEADLOCK ON ITSELF — found by the production walk, not by
    any test that existed.

    The wait is read from the server, and the query that reads it was gated on
    `pending` alone: pending is empty when a refine is submitted, so nothing
    re-asked, so pending never became non-empty, so the loader never appeared
    for the one person actually waiting. It only showed up after a remount.
  */
  it("keeps polling while a refine is in flight, not only once one is known", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /* The VARIANTS query's interval — the session query has one too, and it is
       not the one this law is about. */
    const query = sheet.slice(sheet.indexOf("trpc.castingV2.variants.useQuery"));
    const options = query.slice(query.indexOf("refetchInterval:"));
    const interval = options.slice(0, options.indexOf("),") + 2);
    expect(interval.length).toBeGreaterThan(0);
    expect(interval).toContain("pending?.length");
    /*
      The client's own knowledge of an outstanding request — now asked about
      the face on screen rather than about the sheet, since one mutation hook
      serves all eight (fable-465). The deadlock this guards is unchanged: the
      poll must start before the server has anything to report.
    */
    expect(interval).toContain("refineIsOutForViewer");
  });

  it("withdraws the question when it is dismissed", async () => {
    const sheet = await readFile(SHEET, "utf8");
    const dismiss = sheet.slice(sheet.indexOf("onDismissOutcome={"));
    expect(dismiss.slice(0, 400)).toContain("pendingReask.current = null");
    expect(dismiss.slice(0, 400)).toContain("setReaskOptions(null)");
  });
});
