/**
 * BRIEFING EDITION 101 — the lobby segment proposal (#228), shift 97, disposable.
 *
 * Every write below asserts what it REPLACES first: a target that has already
 * moved says so and refuses, rather than reporting a change it did not make.
 * The result is parsed through the REAL schema at the end.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { crewBriefingSchema } from "../server/crew/crewBriefing";

const PATH = "server/crew/crew-briefing.json";
const raw = readFileSync(PATH, "utf8");
const b = JSON.parse(raw);

const wrong: string[] = [];
const before = {
  edition: b.edition,
  needsYou: b.needsYou.length,
  pipeline: b.pipeline.length,
  journal: b.journal.length,
  chips: b.program.chips.length,
};

if (before.edition !== 100) wrong.push(`edition is ${before.edition}, expected 100`);
if (b.needsYou.some((c: { id: string }) => c.id === "lobby-segments-228")) {
  wrong.push("the lobby segment card already exists — this edition has been written");
}

/* ── 1. The #219 card's own number, one shift on ─────────────────────────── */
const cap = b.needsYou.find((c: { id: string }) => c.id === "fable-cap-review-arm-219");
if (!cap) wrong.push("the fable-cap card is gone");
else if (!cap.productImpact.includes("the twelfth refusal in a row")) {
  wrong.push("the fable-cap card no longer says 'the twelfth refusal in a row' — re-read it before editing");
}

/* ── 2. The chip that says nothing is waiting ────────────────────────────── */
const chipIndex = b.program.chips.findIndex((c: { label: string }) =>
  c.label.startsWith("Nothing is waiting on your eye"),
);
if (chipIndex === -1) wrong.push("the 'nothing is waiting' chip is gone — re-read the chip strip");

if (wrong.length === 0) {
  cap.title =
    "Your Claude usage limit has now been out for over nine hours — 85% longer than the one time it healed itself (#219)";
  cap.productImpact = cap.productImpact.replace(
    "I probed it again at the top of this shift and it refused again — the twelfth refusal in a row. The span is now 8 hours 44 minutes, against about five hours the last time this happened and healed itself.",
    "I probed it again at the top of this shift and it refused again — the thirteenth refusal in a row. The span is now about 9 hours 20 minutes, against about five hours the last time this happened and healed itself.",
  );

  b.program.chips[chipIndex] = {
    label: "One thing waiting on you: pick the lobby's first segment",
    tone: "warn",
    source: "needsYou card lobby-segments-228",
  };

  /* ── 3. THE CARD ───────────────────────────────────────────────────────── */
  b.needsYou.unshift({
    id: "lobby-segments-228",
    title:
      "The lobby redesign, broken into six pieces — tell me which one you want first (#228)",
    productImpact:
      "You authorised the lobby redesign as a side lane while your Claude credits are out, in segments, with your eye between each. Here are the six pieces, in the order I would land them. Nothing is built until you name the first one. One thing you should know before you pick, because it is the biggest single object on the design's home screen: the prompt box across the top — Image / Video / Try-on / UGC / Upscale / Voice — is the one thing this lane cannot honestly build. Five of those six are capabilities the product does not have at all (there is no video, no UGC, no voice, no upscale anywhere in the server), and the sixth is the casting entrance, which is frozen in this lane so it cannot muddy the milestone review. Everything in the six segments below is a piece the product can genuinely serve today, with no new capability and no casting change.",
    workedExample:
      "Segment 1 (Home) is the clearest example of the difference. Today /app is a page title, a grid of your recent work, and three numbered text rows (Casting Studio / Wardrobe / New Canvas). After segment 1 it is the designed landing: a greeting, then WHAT IS RUNNING RIGHT NOW — we already have live job data and have never once shown it on the lobby — then WHAT JUST LANDED, then YOUR CAST with a 'New cast member' tile first. Same data we already hold, arranged the way your design handoff arranges it.",
    options: [
      {
        key: "home",
        label: "Segment 1 — HOME",
        consequence:
          "The landing page becomes what is running, what just landed, and who you can cast, with a two-card quick start (cast a model / wire a canvas). Largest of the six, and the one that establishes the card grammar every later segment is assembled from — building it first is what stops a rework pass later. Not drawn: the prompt box, for the reason above.",
      },
      {
        key: "library",
        label: "Segment 2 — LIBRARY, organised by when you made it",
        consequence:
          "One library grouped TODAY / YESTERDAY / EARLIER THIS WEEK / EARLIER with search, instead of the three separate list pages the rail points at now. It also settles where things live: your design splits Library (what we generated) from Assets (what you supplied), and our data already knows which is which. Not built: the 'Kept / All' lens, because there is no 30-day clearing rule to be honest about.",
      },
      {
        key: "canvas",
        label: "Segment 3 — THE CANVAS TAB",
        consequence:
          "Your boards page reads as a designed collection — a dashed 'New canvas' tile first, then board cards with a real picture, node count and last-run line. This is where your own old note L3 gets answered: what a canvas card's picture actually is, and where archived canvases go. Both are your calls; the segment brings you the options rather than choosing. Not built: the template strip and the 'wire it' prompt box (we have no templates and no board-writing agent).",
      },
      {
        key: "assets",
        label: "Segment 4 — ASSETS (the first of the three dead rail items made real)",
        consequence:
          "The Assets item stops being an icon that does nothing and holds what you supplied — your garments today, upload tile first, with real counts. The reference pictures you attach to a Cast are also supplied material, but they belong to a Cast behind a casting flag, so pulling them in here is a casting change: v1 is garments only and the reference question gets carded rather than guessed.",
      },
      {
        key: "stubs",
        label: "Segment 5 — CREATE and TEMPLATES made honest",
        consequence:
          "Clicking Create or Templates lands on a page that says in one line what will live there, instead of an icon that does nothing. Declared scaffolding under your own placeholder rule, each linking the real capability's card. One sitting, and it blocks nothing.",
      },
      {
        key: "icons",
        label: "Segment 6 — THE RAIL'S ICONS",
        consequence:
          "Your own note L5: the seven rail icons become marks drawn for us in the house language rather than the off-the-shelf set they are today — your words, 'explicitly not generic AI-slop icons'. Pure taste, no capability, entirely your eye. One sitting.",
      },
    ],
    recommendation:
      "Start with Segment 1, HOME. It is the surface you land on every time you open the app, it is the biggest visible change for the work, and it establishes the card grammar segments 2 to 4 reuse — so building it first is what stops a reconciliation pass later. It is also the largest of the six: if you would rather see something land tonight, segment 6 (the icons) or segment 5 (the two honest pages) are single sittings and neither blocks anything. Full reasoning, the capability audit behind it, and the six things this lane deliberately will NOT build are in docs/specs/LOBBY_REDESIGN_SEGMENT_PROPOSAL.md and on #228.",
    state: "open",
    filedAt: "2026-08-29T18:05:00+10:00",
    issueNumber: 228,
  });

  /* ── 4. Pipeline — a SIDE LANE, never the milestone (#228) ─────────────── */
  b.pipeline.unshift({
    id: "lobby-segment-proposal-228",
    title: "Side lane — the lobby redesign: segment proposal, waiting on your pick",
    status: "waiting-founder",
    prNumber: null,
    note: "No code. Six segments proposed in landing order, each with what a customer would see change; the capability audit names what this lane cannot honestly build. The milestone stays N1 — when your Claude credits refresh, the N1 review outranks any lobby work.",
  });

  /* ── 5. Journal (newest first) ─────────────────────────────────────────── */
  b.journal.unshift({
    at: "2026-08-29T18:05:00+10:00",
    shift: "foreman-97",
    text:
      "Your lobby side lane has its first deliverable: the redesign broken into six segments, in the order I would land them, with one line each on what you would actually see change — the card above. Nothing is built and nothing will be until you name the first one. The honest part you should read before picking: I audited your design handoff against what the server can actually do, and the prompt box across the top of the home screen — Image, Video, Try-on, UGC, Upscale, Voice — is the one thing this lane cannot build. Five of the six are capabilities that do not exist anywhere in the product, and the sixth is the casting entrance, which is frozen in this lane on purpose so the lobby work cannot muddy the casting review waiting for your credits. Templates, the project switcher at the top, team members and rail notifications are out for the same reason and are named on the card's record. What is left is genuinely buildable today with no new capability: the landing page, the library, the canvas page, the Assets tab, honest pages behind the two dead rail items, and your own note L5 about the icons. My recommendation is Home first. The milestone has not moved: N1 is still the task, and the moment your Claude credits are back the team goes straight back to it.",
  });

  b.journal.length = Math.min(b.journal.length, 40);

  b.edition = 101;
  b.updatedAt = "2026-08-29T18:05:00+10:00";
  b.shift = "foreman-97";
}

if (wrong.length > 0) {
  console.error("REFUSED — a target has already moved:");
  for (const line of wrong) console.error("  - " + line);
  process.exit(1);
}

const parsed = crewBriefingSchema.safeParse(b);
if (!parsed.success) {
  console.error("REFUSED — the result does not parse through the real schema:");
  console.error(JSON.stringify(parsed.error.issues.slice(0, 10), null, 2));
  process.exit(1);
}

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
console.log("edition", before.edition, "->", b.edition);
console.log("needsYou", before.needsYou, "->", b.needsYou.length);
console.log("pipeline", before.pipeline, "->", b.pipeline.length);
console.log("journal", before.journal, "->", b.journal.length);
console.log("chips", before.chips, "->", b.program.chips.length);
console.log("parsed through the real schema: OK");
process.exit(0);
