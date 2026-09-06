/** DISPOSABLE — edition 273: the #535 Re-imagine design report lands on his desk. */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 273;
b.updatedAt = new Date().toISOString();
b.shift =
  "Fable — the Re-imagine design report is written: the imagination level goes, the writer becomes a small button on every brief box, and the report is on your desk for your word";

b.needsYou.unshift({
  id: "reimagine-design-535",
  issueNumber: 535,
  title: "Re-imagine is designed — read the report and say the word to build it (#535)",
  productImpact:
    "Your design decisions from the 5th are now one written report with everything the card's gate asked for. What a customer gets: one small glyph beside every brief box — the casting page, the sheet, the concept upload. Press it and the studio writes a new idea from their words, into the box, editable, with Undo; press again for another idea. Free until they cast. The Low/Max level, the Imagination column and the 'Max imagination' line all go; Style is the only setting left.\n\nTwo numbers from the measurement you ordered (your five test briefs, 30 runs through the real writer): **it came back with an idea 30 times out of 30** — the 'nothing to offer' case never fired — and a press takes **about 7 seconds** (worst seen: 20). So the button will feel alive, not broken, and the old silent failure (one in five Max casts quietly getting no writer) has no equivalent here: there is no hidden mode to fall out of.\n\nThe report also settles the two questions the card left open: creature age-bands stop mattering (nothing offers age pick-lists any more — your read-only-sentence ruling took them out), and 'sicker' stays yours to judge at the court.",
  workedExample:
    "In your eye gallery: the three surfaces in both themes with the glyph in place, the box AFTER a press holding your war-built woman, three glyph candidates for your eye, and your own two September-5 courts laid as strips — roll 244's four near-identical collars against roll 245's four different women, which is your '10x better' made visible.\n\nThe full report is `docs/specs/REIMAGINE_DESIGN_2026-09-06.md`. Nothing is built: your word on this card starts the build.",
  state: "open",
  filedAt: new Date().toISOString(),
  options: [],
  recommendation:
    "Look at the frames, then reply on #535. If the shape is right, 'build it' is enough — the deletion list, the instruction change and the court are all specified and priced (court under the $50 line). If the glyph is wrong, say which of the three — or 'redraw'.",
});

b.eyeItems.unshift({
  id: "reimagine-design-535-frames",
  state: "open",
  cardId: null,
  issueNumber: 535,
  filedAt: new Date().toISOString(),
  title: "Re-imagine on the three surfaces — is this the shape you meant?",
  question:
    "These are design mockups drawn onto the running app, not shipped UI. The small spiral is the proposed glyph — it sits where the sparkle sits today, hover reads 'Re-imagine'. The settings chip and the sheet's record line read 'Photoreal' alone: the level is gone everywhere. Then your own two courts as strips: the top rows kept your pieces, the bottom rows carried the register — the pairs you judged 10x and 'much better'.",
  frames: [
    { key: "crew-eye/5124e397-0ccc-4950-8487-0d586e83a2bd.png", caption: "The casting page: the glyph beside Cast it, the chip reading Photoreal alone.", arm: "hero" },
    { key: "crew-eye/66c4e41b-c576-4701-94c3-e4f6cd57e1df.png", caption: "After a press: your war-built woman written into the box, editable — one quiet line beneath with Undo.", arm: "hero-after" },
    { key: "crew-eye/dc30aba0-b98d-4bcd-bf72-5a0ea8d8146e.png", caption: "The sheet: the glyph where the sparkle sat, the record line and gear reading Photoreal, the reading sentence read-only.", arm: "sheet" },
    { key: "crew-eye/998738b0-8910-4b8f-b966-2c984a087604.png", caption: "The concept upload: the description is a brief box too, so it gets the same glyph.", arm: "concept" },
    { key: "crew-eye/77ec21f0-4e63-4dfe-beff-72612c7e0d95.png", caption: "Three glyph candidates at every size the product draws — the spiral is the one in the frames; the turn-arrow reads as Retry, the loop dies small. Yours to pick or redraw.", arm: "glyph" },
    { key: "crew-eye/ad63c7d0-7ba0-4103-a61d-b0e18e0e31cc.png", caption: "Your first court: roll 244 kept every piece (four of one collar), roll 245 carried the register (four different women). Your 10x verdict, as a picture.", arm: "court-1" },
    { key: "crew-eye/82ccce82-d2d4-4d17-b390-b7fdf9999221.png", caption: "Your second court: the sphinx with materials kept as pieces, against colours carried as register — your 'much better'.", arm: "court-2" },
  ],
});

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n");
console.log("edition 273 written");
process.exit(0);
