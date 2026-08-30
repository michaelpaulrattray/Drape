/**
 * Briefing edition 124 — foreman-114, second edition of the shift.
 *
 * Six founder replies (#31-#36) landed DURING the shift, after its start-of-
 * shift read returned "no new replies". Two of them (#31, #32) rule the very
 * card the shift was working. So this edition acknowledges all six, marks the
 * items he answered, and — the part that matters — REWRITES the #246 decision
 * card, which edition 123 shipped asking him to choose between three options
 * he had already answered a different and better way twenty minutes earlier.
 *
 * Leaving that card as it stood would ask him a question he has answered,
 * which is the one thing a decision surface must never do.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 124;
b.shift = "foreman-114";
b.updatedAt = "2026-08-30T11:45:00+10:00";

const NEW_REPLIES = [31, 32, 33, 34, 35, 36];

const find = <T extends { id: string }>(list: T[], id: string): T => {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`briefing item "${id}" is gone — refusing to write an edition that silently drops it`);
  return hit;
};

/* HIS RULING ON #246. Edition 123 asked him to pick a, b or c; he had already
   answered, twice, in the same words on both eye items. The card becomes a
   RECORD of his ruling rather than a question. */
const lookalike = find(b.needsYou, "lookalike-reader-246");
lookalike.state = "answered";
lookalike.title = "The lookalike reader - you ruled it to N3, and the note is in the plan";
lookalike.productImpact =
  "You answered this twice in the same sitting, once on each of the two pictures, in the same words: \"You are correct - add a note to N3 in the plan so we can fix this at that milestone as it contains of the image analyzing and bounding box tech and design.\"\n\n"
  + "Done - the note is in the plan at N3, and it carries everything needed to build the fix there rather than re-derive it: what the fault is, the three words it has been measured on, and where in the product it actually lands.\n\n"
  + "That last part was tonight's work, and it is worth one paragraph because it is why N3 is the right home. The faulty answer is used in 28 places in the studio. 16 of them are switched on right now. The widest by far is the FACE PANEL - it is on every account, and its rule for drawing a rectangle on a feature is \"the reader found any pixels at all\", with no minimum whatsoever. That rule was written deliberately, with a reason attached: anatomy was assumed to answer honestly about whether it is there. That is precisely the assumption the last three sittings disproved. The panel asks twelve questions, and hair, eyebrows AND horns are three of them - the first two are the measured ones and the third is the floating rectangle you reported yourself. So the bounding-box work N3 owns cannot be designed as though the reader is trustworthy about absence; the absent case has to be a real state of the panel, not an error path. That is exactly the tech you named.\n\n"
  + "One thing I have put in the plan as explicitly NOT covered by N3, so that finishing N3 is never mistaken for finishing this: the refund decision on a paid removal reads the same reader, with a minimum that is zero for everything except glasses and earrings. If the reader draws the thing back onto a picture we correctly cleaned, the studio decides its own render failed and refunds. Your money rule holds - what she loses is the picture she paid for and which was right. That is a fix on the editing road, not on the panel, and it stays open.\n\n"
  + "Your other question, on the two-face strip, is answered on the card - and you were right on both. I opened both pictures at full size rather than answering from the numbers. Left is horns; right is tusks, not teeth (the mouth is closed, so there are no teeth in shot).\n\n"
  + "And your question found something three sittings of measurement had not: the RIGHT-HAND face has BOTH horns and tusks, and asked for tusks it correctly picked the tusks and ignored the horns. So the reader is not confusing the two words - it knows the difference perfectly well with both on screen. It only reaches for a lookalike when the real thing is ABSENT. That kills the cheapest theory (that the words are too similar and need separating) before anyone spends a night on it.";
lookalike.workedExample =
  "Nothing to do here - this card is now a record rather than a question. The next thing that happens to it is at N3, and the note is waiting in the plan for whoever builds that rung.";
lookalike.options = [];
lookalike.recommendation = null;

/* The three eye items his replies pointed at. The state sweep refuses an
   acknowledged reply that still points at an `open` item, and it is right to:
   an answered question left open is a question. */
for (const id of ["hair-on-a-bald-head-246", "brows-on-a-bare-ridge-246", "lookalike-reader-246-strip", "creature-widening-243-strips"]) {
  find(b.eyeItems, id).state = "answered";
}
for (const id of ["bug-reports-no-reader-255", "max-author-refusals-252"]) {
  find(b.needsYou, id).state = "answered";
}

b.journal.unshift({
  at: "2026-08-30T11:45:00+10:00",
  shift: "foreman-114",
  text:
    "Second note tonight, because six replies from you landed while I was working and two of them ruled the exact thing I was working on. All six are now recorded against their cards, in your words, so none of them lives only in a message.\n\n"
    + "On the lookalike reader: you said add a note to N3 and fix it at that milestone. Done, and the note carries what tonight's work found so nobody has to re-derive it. The short version is that the faulty answer is used in 28 places in the studio, 16 of them switched on, and the widest one is the face panel - on every account, drawing a rectangle whenever the reader finds any pixels at all, with no minimum. Two of the words I have measured this fault on are panel words, and a third panel word is horns, which is the floating rectangle you reported yourself. So it belongs exactly where you put it.\n\n"
    + "I have flagged one thing in the plan as NOT covered by N3, so finishing that rung is never read as finishing this: the refund decision on a paid removal reads the same reader. If it draws the thing back onto a picture we correctly cleaned, we call our own render a failure and refund. Your money is safe; the customer loses the picture. That is an editing-road fix, not a panel fix.\n\n"
    + "Your question about the two faces was the best thing that happened tonight, and I want to say why. You asked whether the left one was horns and the right one tusks. Both right - I opened them full size to check rather than answering from the numbers. But the right-hand face has BOTH horns and tusks in shot, and asked for tusks it picked the tusks and left the horns alone. So the reader is not muddling the two words; it knows them apart perfectly well when both are there. It only invents when the real thing is missing. Three sittings of measuring had not made that distinction, and it kills the cheapest theory - that the words are too alike and need separating - before anyone spends a night on it.\n\n"
    + "Your other three: the creature lane is filed as an order to ship, with your two \"don't trust the pixel counter\" sentences kept verbatim because you said it twice and that makes it the point rather than an aside. Bug reports - option D, admin panel first, and I have written down that you said FIRST and not ONLY so nobody builds it in a way that makes adding the moderator view later a rewrite. The MAX author - (a) and (c) are go, and (b) is written down with your condition attached rather than as a maybe, because your bar is a real one: a measured test showing a specific phrase blocks a GOOD draft, not a clumsy first one.\n\n"
    + "None of those three were built tonight. They arrived mid-shift and they are somebody's whole brief each, so they are filed as instructions for the next shift rather than half-started.",
});

const JOURNAL_CAP = 40;
if (b.journal.length > JOURNAL_CAP) {
  const dropped = b.journal.slice(JOURNAL_CAP);
  if (dropped.some((e: { shift: string }) => e.shift === "foreman-114")) {
    throw new Error("the trim would drop this shift's own entry — refusing");
  }
  b.journal = b.journal.slice(0, JOURNAL_CAP);
}

const before = b.acknowledgedReplyIds.length;
b.acknowledgedReplyIds = [...new Set([...b.acknowledgedReplyIds, ...NEW_REPLIES])].sort((x: number, y: number) => x - y);
if (b.acknowledgedReplyIds.length !== before + NEW_REPLIES.length) {
  throw new Error(`acknowledgement count moved by ${b.acknowledgedReplyIds.length - before}, expected ${NEW_REPLIES.length}`);
}

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
console.log(`edition ${b.edition} · acknowledged ${b.acknowledgedReplyIds.length} (+${NEW_REPLIES.length}) · journal ${b.journal.length}`);

/* Exit discipline (#249): a script ends by exiting, so a stray handle can never
   leave it resident. */
process.exit(0);
