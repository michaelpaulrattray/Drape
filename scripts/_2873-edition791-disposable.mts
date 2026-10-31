/**
 * EDITION 791 — #2873's fix, in his words.
 *
 * ⚠ **IDEMPOTENT ON PURPOSE.** The previous shift ran its own edition cell a
 * second time by accident (`--help`, which it does not parse, so the script
 * RAN) and duplicated a pipeline row and a problem row. Every write here asks
 * whether it has already been made, so a second run is a no-op rather than a
 * second row.
 *
 *     npx tsx scripts/_2873-edition791-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const brief = JSON.parse(readFileSync(PATH, "utf8")) as Record<string, any>;

brief.edition = 791;
brief.updatedAt = "2026-10-30T22:40:00.000000Z";
brief.shift =
  "The lit-up picture now lights the garment instead of a scrap of it — and the test that found the problem had itself been measured on the wrong thing.\n\n" +
  "Last night's test said that splitting a real photo leaves about 27 pieces, so hovering a jacket would light a sleeve or a patch of wall. That is fixed. Point at the middle of a thing now and here is how much of it lights up, before and after: a tank top 20% → 98%, a sweater 21% → 98%, a belt 55% → 95%, a leather jacket 67% → 99%, a scarf 79% → 99%, a sneaker 82% → 99%. Six of the nine things on your three test pictures now light as themselves, where two did before. The picture goes from 26 pieces to 11.\n\n" +
  "What was wrong is worth a sentence because it is not what last night's note guessed. The studio was not keeping duplicate copies of the jacket; it was cutting the jacket into as many slivers as it had copies. Thirty-two near-identical answers to the same question went in, and each one walked away with a strip of the garment. That is why pointing at a tank top lit a fifth of it.\n\n" +
  "The merging rule now in the studio is a measured number, not a guessed one, and it is pinned from both sides. Merge too eagerly and a garment gets mistaken for the person wearing it — at one setting the tank top disappeared from the picture entirely. Merge too shyly and the duplicates survive, which is where we were. There is a wide band in the middle where the answer does not change at all, and the setting sits in the middle of that band. Then I asked the whole question again at the full size of the original photographs rather than the shrunk copies, because a number that is only right at one size is the same mistake one step along. It holds.\n\n" +
  "One correction to my own card: it said the measuring would cost nothing because the old test's results were saved. They were not — the old test tidied its results before saving them, so the untidied ones never existed on disk. That is the very mistake the card was about, one layer down. Buying them again cost about one and a half cents, and this time they are saved, so nobody pays for them again.\n\n" +
  "Finally, I went looking for the same mistake elsewhere, since once is a pattern until proven otherwise. I found it: when you tap a thing and the studio names it for the chip, the naming is done by showing a reader the whole photograph with everything but your piece painted grey. The test we quoted — which named things right eight times out of eight — showed the reader a tight close-up of the piece instead. Two comments in the code claimed that test had approved the way we do it. They had it backwards, and they are corrected. Which way actually names better is a measurement, and it is filed as its own job.\n\n" +
  "The setting for all of this is still off and nothing you can see has changed.";

/* ---- the pipeline row for tonight's pull request ---- */
const ROW_ID = "spotlight-hover-dedupe-2873";
if (!brief.pipeline.some((row: any) => row.id === ROW_ID)) {
  brief.pipeline.unshift({
    id: ROW_ID,
    title: "The lit-up picture lights the garment, not a sliver of it (#2873)",
    status: "merged",
    prNumber: 2876,
    note:
      "Merged on the gate alone — triage read the diff and applied no label, so no human read was owed. " +
      "Six of nine things light as themselves against two before; the picture goes 26 pieces to 11.",
  });
}

/* ---- the problem this closes ---- */
const solved = brief.problems.find((row: any) => row.id === "spotlight-hover-set-too-busy-2873");
if (solved) {
  solved.state = "resolved";
  solved.title = "Fixed — the lit-up picture lights the garment now, not a scrap of it (#2873)";
  solved.detail =
    "Point at the middle of a thing and it lights up almost entirely: a tank top went from 20% to 98%, " +
    "a sweater from 21% to 98%. Six of the nine things on your test pictures light as themselves, where " +
    "two did. One thing on this row was wrong and is worth recording: it said the fix would cost nothing " +
    "to measure because the old test's results were on disk. They were not — the old test tidied its " +
    "results before saving them. Buying them again cost about one and a half cents, and they are saved now.";
}

/* ---- and its successor, found by looking for the same mistake elsewhere ---- */
const SIBLING = "cut-named-from-whole-frame-2875";
if (!brief.problems.some((row: any) => row.id === SIBLING)) {
  brief.problems.unshift({
    id: SIBLING,
    severity: "warning",
    state: "open",
    title: "The studio names a tapped piece from the whole photograph, not from a close-up of the piece (#2875)",
    detail:
      "When you tap something in an attached photo, the chip's name comes from showing a reader the whole " +
      "picture with everything but your piece painted grey. The test we quote — which named things right " +
      "eight times out of eight — showed the reader a tight close-up instead. On a flat-lay that is the " +
      "difference between a belt filling the frame and a belt lost in a field of grey. Nobody can hit it, " +
      "because the setting is off. Which way names better is a measurement and it is cheap: the pieces are " +
      "on disk, so only the reading costs anything.",
  });
}

writeFileSync(PATH, `${JSON.stringify(brief, null, 1)}\n`);
console.log(`edition ${brief.edition} written · pipeline ${brief.pipeline.length} rows · problems ${brief.problems.length} rows`);
console.log(`  open problems: ${brief.problems.filter((r: any) => r.state === "open").length}`);

process.exit(0);
