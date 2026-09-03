/**
 * THE CREW PAGE'S LOADING STATE (#414 item 8) — skeletons at the real height,
 * never a sentence and never a spinner.
 *
 * **His words, and this is the one item on that card that is not cosmetic:**
 * he asked for *"the cards the loading spinners the layout"* from his own
 * drawing. What the page did instead was render one line —
 * `Loading the briefing…` in a quiet card — and the briefing is the longest
 * thing in the product. So the column stood at ~40px and then jumped to
 * several thousand, with the bar, the breadcrumb and every scroll position
 * moving under him.
 *
 * ⚠ **A SPINNER WAS THE NEARER THING AND IS DECLINED BY NAME.**
 * `StaffLoading`'s `dp-staff__spinner` already exists from brief 05 and would
 * have been one import. It collapses the layout exactly the way the sentence
 * does — the fidelity law's *"convenient substitute"* wearing a nicer face.
 * Briefs 06, 07 and 09 all ruled the same way for the same reason.
 *
 * # THE HEIGHTS ARE MEASURED, NOT GUESSED
 *
 * Each block below is one of the page's real sections, at the height that
 * section actually renders at the reading measure. The numbers come from
 * driving the page and reading `getBoundingClientRect().height` off the live
 * sections, not from eyeballing the mockup — a skeleton at an invented height
 * is a jump with extra steps.
 *
 * ⚠ **THE WRAPPER IS `display: contents`, NOT A CONTAINER.** The real sections
 * are direct children of `.dp-crew` and take its `gap: 26px`; a wrapper that
 * held them would swallow it, and the first build's did — the cards drew flush
 * and the column was 104px short. Caught by the gate reviewer at this shift's
 * own frame.
 *
 * ⚠ **IT NAMES NO SECTION AND SHOWS NO NUMBER.** A skeleton that printed
 * `Problems` would be asserting there are problems, and `CrewProblems` returns
 * `null` when there are none — so on a good night the page would promise a
 * section and then not have one. The blocks are shapes; only the real render
 * says what is there. This is the same rule that keeps mock data off this page
 * (his own *"no i dont want the mock data"*).
 */
import { Skeleton } from "@/foundation";

/**
 * One section's stand-in: the head's eyebrow rule, then body lines.
 *
 * `lines` is what the section's own body occupies — a count rather than a
 * height, so the row rhythm matches the page's and a section cannot be given
 * an arbitrary slab.
 */
function Block({ lines, wide = false }: { lines: number; wide?: boolean }) {
  return (
    <section className="dp-crew__card" aria-hidden="true">
      <div className="dp-crew__skelhead">
        <Skeleton className="dp-crew__skeleyebrow" />
        <span className="dp-crew__skelrule" />
      </div>
      <div className="dp-crew__skelbody">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            className="dp-crew__skelline"
            /* The last line of a block runs short, the way a paragraph does.
               A stack of identical full-width bars reads as a table. */
            style={index === lines - 1 && !wide ? { width: "62%" } : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The page's sections, in the page's order (#437's order, which is his).
 *
 * The program banner is first and is by far the tallest — chips, mission,
 * focus, his quote, the milestone, the bar, the steps and the ladder — which
 * is precisely why the jump was worst at the top.
 */
export function CrewSkeleton() {
  /* ⚠ `dp-crew__skel` is `display: contents` — see its rule for why a plain
     wrapper is a defect here rather than a neutral container. */
  return (
    <div className="dp-crew__skel" data-testid="crew-skeleton">
      {/* The program */}
      <Block lines={9} wide />
      {/* Working now */}
      <Block lines={4} />
      {/* Next up */}
      <Block lines={5} />
      {/* Background work */}
      <Block lines={6} wide />
      {/* Needs you */}
      <Block lines={3} />
    </div>
  );
}
