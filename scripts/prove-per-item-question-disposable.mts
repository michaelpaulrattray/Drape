/**
 * CAN THE GATE FAIL ONCE THE QUESTION IS ASKED PER ITEM? — measured on the very
 * frames that were charged for, with the product's own reader and its own
 * prompt.
 *
 * fable-312 ruling 2 says a set is asked one item at a time because *"are there
 * dangly cross earrings"* is answerable where the stack question is not. That is
 * a claim about a stochastic reader, and the reader's prompt carries a clause
 * pointed the other way — *"An earring that is present but different from the
 * one described is still present"* — so shipping the split without measuring it
 * would be building a gate that still cannot fail and calling it a fix.
 *
 * # What the first run found (2026-08-13, 5 readings each)
 *
 * The split WORKS at the level of seeing: the joined line passed 5/5 and the
 * per-item line reported the crosses missing 5/5. And `absent` was false on all
 * five, so the miss had no teeth — with hoops on her ears the reader calls a
 * missing cross a matter of how it was done. That is the finding fable-314 ruled
 * on: **a different KIND of object at the asked site is absent; size, prominence,
 * thinness and finish stay degree.**
 *
 * # This is now the BEFORE/AFTER instrument for that sentence
 *
 * Two specimens, and the second is the load-bearing one:
 *
 *   KIND    crosses asked, plain hoops delivered → must FLIP to absent:true
 *   DEGREE  a size/finish objection about the very same hoops → must STAY
 *           present, because that is run-10, where refusing cost a customer a
 *           refund for a picture she got
 *
 * plus a positive control (her glasses, plainly there) and a negative control (a
 * septum ring, plainly not) on the same picture, so a flip can never be blamed
 * on a reader that answers everything the same way.
 *
 * No campaign credits: provider vision calls over stored artifacts. Nothing is
 * written anywhere.
 *
 *   npx tsx scripts/prove-per-item-question-disposable.mts            # 5 readings
 *   READINGS=3 npx tsx scripts/prove-per-item-question-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { aboutFacet, verifyRender } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";

const READINGS = Number(process.env.READINGS ?? 5);
const facet = facetOfSubject("statedAccessories");
const PAIR = ", one on each ear, a matching pair";

/** The walk's step 2: plain gold hoops on both ears, where crosses were asked. */
const CROSSES_FRAME = "output/shift59-fiveask/02-delivered.png";

type Question = {
  label: string;
  frame: string;
  asked: string;
  /** What this reading has to say for the sentence to be right. */
  want: "present" | "absent" | "not-absent";
};

const questions: Question[] = [
  {
    label: "JOINED    the walk's own line — the shape fix 1 retired",
    frame: CROSSES_FRAME,
    asked: `gold hoop earrings, dangly cross earrings${PAIR}`,
    /*
      It wanted `present` until the kind sentence landed, and that was the false
      pass: 5/5 yes on a picture with no crosses in it. It now answers absent
      5/5, which is the honest reading of a line one of whose two things is not
      there — and the ask lane no longer builds this line at all, because a
      replacement files the current set. Kept as a question so the retired shape
      keeps being measured rather than assumed gone.
    */
    want: "absent",
  },
  {
    label: "KIND      crosses asked, plain hoops found — MUST BECOME ABSENT",
    frame: CROSSES_FRAME,
    asked: `dangly cross earrings${PAIR}`,
    want: "absent",
  },
  {
    label: "DEGREE    run-10's class, on the same ears — MUST STAY PRESENT",
    frame: CROSSES_FRAME,
    /* Her hoops are there and they are chunkier and plainer than this asks for.
       Objecting to that is the objection D-187 and run-10 exist to protect: a
       hoop that is thinner or plainer than pictured is still a hoop that is
       there, and refusing it hands back credits for a picture she got. */
    asked: `delicate thin small gold hoop earrings${PAIR}`,
    want: "not-absent",
  },
  {
    label: "DEGREE    the same objection said about colour, not size",
    frame: CROSSES_FRAME,
    asked: `deep rose-gold hoop earrings${PAIR}`,
    want: "not-absent",
  },
  {
    label: "CONTROL+  the thing that was already there",
    frame: CROSSES_FRAME,
    asked: `gold hoop earrings${PAIR}`,
    want: "present",
  },
  {
    label: "CONTROL+  plainly in the frame (proves a yes is available)",
    frame: CROSSES_FRAME,
    asked: "tortoiseshell rectangular glasses",
    want: "present",
  },
  {
    label: "CONTROL−  plainly not in the frame (proves a no is available)",
    frame: CROSSES_FRAME,
    asked: "a silver septum ring through her nose",
    want: "absent",
  },
];

console.log(`readings  ${READINGS} per question, each its own call`);
console.log("");

let wrong = 0;
for (const question of questions) {
  const bytes = readFileSync(question.frame);
  const answers: string[] = [];
  let present = 0;
  let absentSaid = 0;
  let read = 0;
  for (let index = 0; index < READINGS; index += 1) {
    const verdict = await verifyRender({
      bytes,
      contentType: "image/png",
      facts: [{ subject: aboutFacet(facet), asked: question.asked, binding: true }],
    });
    const check = verdict.checks[0];
    if (!check) { answers.push("(no check)"); continue; }
    if (check.read) read += 1;
    if (check.verified) present += 1;
    if (check.absent === true) absentSaid += 1;
    answers.push(
      `${check.verified ? "PRESENT" : "missing"}`
      + `${check.absent === true ? "+absent" : check.verified ? "" : "+degree"}`
      + ` — ${check.saw ?? "(no saw)"}`,
    );
  }
  /*
    Unanimity is the bar for a claim about a gate that spends money — but over
    the readings that WERE read. A reply the transport mangles is not a verdict
    (one came back as unparseable JSON on the after-run), and counting a no-read
    as a disagreement is the symmetric mistake D-235 exists to refuse. It is
    still visible: `read N/N` prints beside every result.
  */
  const held = read === 0 ? false
    : question.want === "present" ? present === read
      : question.want === "absent" ? absentSaid === read
        : absentSaid === 0;
  if (!held) wrong += 1;
  console.log(`${held ? "HOLDS" : "BROKEN"}  ${question.label}`);
  console.log(`  asked      ${question.asked}`);
  console.log(`  wanted     ${question.want}`);
  console.log(`  present    ${present}/${READINGS}   read ${read}/${READINGS}   said-absent ${absentSaid}/${READINGS}`);
  for (const answer of answers) console.log(`    · ${answer}`);
  console.log("");
}

console.log(`${questions.length} question(s), ${wrong} not holding.`);
/* The reader's transport holds a keep-alive socket, so the work being finished
   is not the process being finished (`scriptExitDiscipline`). */
process.exit(wrong === 0 ? 0 : 1);
