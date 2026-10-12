/**
 * READ THE WORDS THAT WERE REFUSED — the refusal loop's slice 2 (#129), the
 * patrol's own reader.
 *
 * # The bill this pays
 *
 * His order (Crew reply #8): *"log every refused and passed prompt, find
 * trigger words, measured word→replacement pairs into the author's rewrite
 * list."* Slice 1 (`refusalLoopCapture.ts`, PR #1007) keeps the words. This is
 * the half that READS them, and it exists because the first three patrol runs
 * each had to write their own reader and each one read something different:
 * run #1 read candidate rows, run #2 re-read the same rows with a moved id
 * floor, run #3 read a court's arms. A standing duty with a new reader every
 * run cannot compare its own findings across runs.
 *
 * # What the corpus can and cannot support — the one thing to read before using it
 *
 * ⚠ **N IS COUNTED AT DISTINCT TEXTS, NEVER AT SLICES, AND THAT IS NOT A
 * PREFERENCE.** On the author road a roll sends ONE prompt for the whole sheet
 * — all eight slices carry byte-identical text (patrol run #1 §2, measured:
 * `distinctPrompts = 1` on rolls 221/222/223). So a word in a roll where five
 * slices refused appears in five refused OBJECTS and in exactly ONE piece of
 * evidence. Counting the objects turns one observation into five, which is
 * pseudo-replication: it would clear the n ≥ 2 bar on a single roll and put a
 * guess into the author's list wearing a measurement's clothes. It is the
 * sibling of run #3's own finding — *an arm-major refusal reading is a LEAD,
 * never a finding* — and it is why every bar in this module counts
 * `refusedTexts` / `passedTexts` (distinct `promptSha256`) and reports the
 * slice counts beside them only so the inflation stays visible.
 *
 * ⚠ **AND A TEXT THAT BOTH REFUSED AND PASSED DISQUALIFIES EVERY WORD IN
 * ITSELF.** Run #1 §2's structural finding was that the checker is *"a coin per
 * render, not a function of the text"* — roll 222 delivered 3 of 8 on the text
 * that refused 5. `identicalTextOutcomes` is that finding made mechanical: when
 * one `promptSha256` carries both outcomes, no word inside it can be a trigger,
 * because the same bytes were allowed. The trigger bar below needs
 * `passedTexts === 0`, so such a word is excluded automatically rather than by
 * a second rule that could drift from this one.
 *
 * # The bar, which is his (build item 3)
 *
 * > *a trigger enters the author's rewrite list ONLY as a MEASURED PAIR — word
 * > → refused n ≥ 2, replacement → passed n ≥ 2 — never a guess.*
 *
 * Both halves are gates and only one of them can be read off this corpus:
 *
 * - **The word half** is observational — `triggerCandidates` answers it.
 * - **The replacement half is NOT.** A replacement is a word nobody has sent
 *   yet; its pass count can only come from a court that sends it. So this
 *   module cannot propose a pair, and it does not pretend to: it offers
 *   `measuredPairVerdict`, which JUDGES a proposed pair against the corpus and
 *   refuses it by name when either half is short. That is the gate item 3 asks
 *   for — the thing standing between a lead and the list — and it is the honest
 *   shape, because the only pair ever to clear this bar (#125's *"the crop just
 *   below the sternum"* → *"collarbones"*) was found by a controlled swap and
 *   never by a diff.
 *
 * # What it never does
 *
 * **No prompt text leaves this module.** A composed prompt is the cast's recipe
 * in sentences — the `masterPrompt` class, which `CLAUDE.md` says to treat the
 * way you would treat a password — so the reader returns counts, hashes and
 * single WORDS that met a stated bar, and never a sentence, a fragment or a
 * prompt body. The capture half holds the same line in its own logging.
 */
import { createHash } from "node:crypto";

import {
  REFUSAL_LOOP_KEY_PREFIX,
  type RefusalLoopOutcome,
} from "./refusalLoopCapture";

/** One captured slice, as the patrol reads it. */
export type RefusalLoopEntry = {
  userId: number;
  operationId: string;
  candidatePublicId: string;
  outcome: RefusalLoopOutcome;
  /** The words the engine was handed, verbatim. Never printed, never returned. */
  prompt: string;
  /** The capture's own hash of `prompt`. */
  promptSha256: string;
};

export type ParsedRefusalLoopKey = {
  userId: number;
  operationId: string;
  candidatePublicId: string;
  outcome: RefusalLoopOutcome;
};

/**
 * The inverse of `refusalLoopKey`, so a census can be taken from the keys alone
 * without opening a single customer sentence.
 *
 * ⚠ It is held to that claim by a ROUND TRIP against the real builder in
 * `refusalLoopCorpus.test.ts` rather than by two shapes agreeing on paper
 * (working law 4): a parser written from the format's description is a second
 * copy of the format, and a second copy drifts.
 */
export function parseRefusalLoopKey(key: string): ParsedRefusalLoopKey | null {
  const prefix = `${REFUSAL_LOOP_KEY_PREFIX}/`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const parts = rest.split("/");
  if (parts.length !== 3) return null;
  const [rawUserId, operationId, leaf] = parts as [string, string, string];
  if (!/^[0-9]+$/.test(rawUserId)) return null;
  const userId = Number(rawUserId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  if (operationId.length === 0) return null;
  const match = /^(.+)\.(refused|passed)\.json$/.exec(leaf);
  if (!match) return null;
  const candidatePublicId = match[1]!;
  if (candidatePublicId.length === 0) return null;
  return {
    userId,
    operationId,
    candidatePublicId,
    outcome: match[2] as RefusalLoopOutcome,
  };
}

/**
 * The words of one prompt, as the diff counts them: lowercased, split on
 * everything that is not a letter, a digit or an inner hyphen, de-duplicated.
 *
 * De-duplicated because every bar in this module is a DOCUMENT count — a word
 * said three times in one brief is still one piece of evidence about that
 * brief, exactly as eight slices of one roll are one piece of evidence about
 * that roll.
 */
export function tokenisePrompt(prompt: string): ReadonlySet<string> {
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 0);
  return new Set(words);
}

/** The hash the capture writes, recomputed so a corrupt body cannot pass as evidence. */
export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export type CorpusCensus = {
  slices: number;
  refusedSlices: number;
  passedSlices: number;
  operations: number;
  users: number[];
  distinctTexts: number;
  refusedTexts: number;
  passedTexts: number;
  /** Operations whose every slice carries one and the same text. */
  singleTextOperations: number;
  /** The worst case for a diff: one text, both outcomes, inside one operation. */
  coinOperations: number;
};

/**
 * What is in the corpus, counted both ways so the gap between them is readable.
 *
 * `slices` is how many objects there are; `distinctTexts` is how much evidence
 * they amount to. On the author road the second is a small fraction of the
 * first, and a patrol that quotes the first as its n has overstated its case by
 * that factor.
 */
export function censusCorpus(entries: readonly RefusalLoopEntry[]): CorpusCensus {
  const byOperation = new Map<string, Set<string>>();
  const outcomesByOperation = new Map<string, Set<RefusalLoopOutcome>>();
  const refusedTexts = new Set<string>();
  const passedTexts = new Set<string>();
  const users = new Set<number>();
  for (const entry of entries) {
    users.add(entry.userId);
    const texts = byOperation.get(entry.operationId) ?? new Set<string>();
    texts.add(entry.promptSha256);
    byOperation.set(entry.operationId, texts);
    const outcomes = outcomesByOperation.get(entry.operationId) ?? new Set<RefusalLoopOutcome>();
    outcomes.add(entry.outcome);
    outcomesByOperation.set(entry.operationId, outcomes);
    (entry.outcome === "refused" ? refusedTexts : passedTexts).add(entry.promptSha256);
  }
  const distinct = new Set<string>([...Array.from(refusedTexts), ...Array.from(passedTexts)]);
  let singleTextOperations = 0;
  let coinOperations = 0;
  for (const [operationId, texts] of Array.from(byOperation.entries())) {
    if (texts.size !== 1) continue;
    singleTextOperations += 1;
    if ((outcomesByOperation.get(operationId)?.size ?? 0) > 1) coinOperations += 1;
  }
  return {
    slices: entries.length,
    refusedSlices: entries.filter((entry) => entry.outcome === "refused").length,
    passedSlices: entries.filter((entry) => entry.outcome === "passed").length,
    operations: byOperation.size,
    users: Array.from(users).sort((a, b) => a - b),
    distinctTexts: distinct.size,
    refusedTexts: refusedTexts.size,
    passedTexts: passedTexts.size,
    singleTextOperations,
    coinOperations,
  };
}

export type IdenticalTextOutcome = {
  promptSha256: string;
  refusedSlices: number;
  passedSlices: number;
  operationIds: string[];
};

/**
 * THE COIN, MEASURED: every text that was both refused and delivered.
 *
 * Each row is a proof that no word in that text is a trigger, and the set of
 * them is the strongest statement this corpus can make — it is run #1's
 * *"a coin per render, not a function of the text"*, taken at scale instead of
 * on one roll.
 */
export function identicalTextOutcomes(
  entries: readonly RefusalLoopEntry[],
): IdenticalTextOutcome[] {
  const byText = new Map<string, { refused: number; passed: number; operations: Set<string> }>();
  for (const entry of entries) {
    const row = byText.get(entry.promptSha256)
      ?? { refused: 0, passed: 0, operations: new Set<string>() };
    if (entry.outcome === "refused") row.refused += 1;
    else row.passed += 1;
    row.operations.add(entry.operationId);
    byText.set(entry.promptSha256, row);
  }
  return Array.from(byText.entries())
    .filter(([, row]) => row.refused > 0 && row.passed > 0)
    .map(([promptSha256, row]) => ({
      promptSha256,
      refusedSlices: row.refused,
      passedSlices: row.passed,
      operationIds: Array.from(row.operations).sort(),
    }))
    .sort((a, b) => b.refusedSlices + b.passedSlices - (a.refusedSlices + a.passedSlices));
}

export type WordEvidence = {
  word: string;
  /** Distinct prompt texts containing this word that were refused. THE n THAT COUNTS. */
  refusedTexts: number;
  /** Distinct prompt texts containing this word that were delivered. */
  passedTexts: number;
  /** Objects, kept only so the slice-level inflation is visible beside the real n. */
  refusedSlices: number;
  passedSlices: number;
  /** Distinct roll operations the word was refused in. */
  refusedOperations: number;
};

/**
 * Every word in the corpus with the counts both bars are read from.
 *
 * Distinct-text counts are the measurement; slice counts ride along so a reader
 * can see how much of an apparent n is one roll said eight times.
 */
export function wordEvidence(
  entries: readonly RefusalLoopEntry[],
): Map<string, WordEvidence> {
  const evidence = new Map<string, {
    word: string;
    refusedTexts: Set<string>;
    passedTexts: Set<string>;
    refusedSlices: number;
    passedSlices: number;
    refusedOperations: Set<string>;
  }>();
  for (const entry of entries) {
    for (const word of Array.from(tokenisePrompt(entry.prompt))) {
      const row = evidence.get(word) ?? {
        word,
        refusedTexts: new Set<string>(),
        passedTexts: new Set<string>(),
        refusedSlices: 0,
        passedSlices: 0,
        refusedOperations: new Set<string>(),
      };
      if (entry.outcome === "refused") {
        row.refusedTexts.add(entry.promptSha256);
        row.refusedSlices += 1;
        row.refusedOperations.add(entry.operationId);
      } else {
        row.passedTexts.add(entry.promptSha256);
        row.passedSlices += 1;
      }
      evidence.set(word, row);
    }
  }
  const out = new Map<string, WordEvidence>();
  for (const [word, row] of Array.from(evidence.entries())) {
    out.set(word, {
      word,
      refusedTexts: row.refusedTexts.size,
      passedTexts: row.passedTexts.size,
      refusedSlices: row.refusedSlices,
      passedSlices: row.passedSlices,
      refusedOperations: row.refusedOperations.size,
    });
  }
  return out;
}

/** His bar's left half: a word is a candidate at two refused TEXTS and no passed one. */
export const MIN_REFUSED_TEXTS = 2;

/**
 * The words that clear the left half of his bar: refused in at least
 * `MIN_REFUSED_TEXTS` distinct texts and delivered in none.
 *
 * ⚠ **A CANDIDATE IS NOT A PAIR AND NEVER ENTERS THE LIST ON ITS OWN.** It is
 * what a swap court is pointed at. The right half of the bar — a replacement
 * that PASSED n ≥ 2 — cannot be observed here, because a replacement is a word
 * nobody has sent; `measuredPairVerdict` is where a court's answer is judged.
 */
export function triggerCandidates(
  entries: readonly RefusalLoopEntry[],
  options: { minRefusedTexts?: number } = {},
): WordEvidence[] {
  const minRefusedTexts = options.minRefusedTexts ?? MIN_REFUSED_TEXTS;
  return Array.from(wordEvidence(entries).values())
    .filter((row) => row.refusedTexts >= minRefusedTexts && row.passedTexts === 0)
    .sort((a, b) => b.refusedTexts - a.refusedTexts || a.word.localeCompare(b.word));
}

export type VocabularyReach = {
  /** Distinct words across the whole corpus. */
  distinctWords: number;
  /** Words that appear in at least one refused text. */
  refusedWords: number;
  /** Of those, how many ALSO appear in a delivered text. */
  refusedWordsAlsoDelivered: number;
};

/**
 * COULD THIS READING HAVE FOUND ANYTHING? — the instrument's own positive
 * control, reported beside every verdict rather than kept in a suite.
 *
 * ⚠ **It exists because "no candidates" and "read nothing" print the same
 * number.** A tokeniser that silently returned empty sets, a body field read
 * under the wrong name, a prefix listing nothing — each produces zero
 * candidates while looking like a finding, and that is the fifth of the five
 * ways a green instrument can be inert. So a run says how many words it
 * actually held, how many of them were ever refused, and how many of THOSE
 * were also delivered: when the last two numbers are equal, every refused word
 * in the corpus was also allowed, and zero candidates is a measurement rather
 * than a silence.
 */
export function vocabularyReach(entries: readonly RefusalLoopEntry[]): VocabularyReach {
  const rows = Array.from(wordEvidence(entries).values());
  const refused = rows.filter((row) => row.refusedTexts > 0);
  return {
    distinctWords: rows.length,
    refusedWords: refused.length,
    refusedWordsAlsoDelivered: refused.filter((row) => row.passedTexts > 0).length,
  };
}

export type MeasuredPairProposal = {
  /** The word a court refused. */
  word: string;
  /** The word a court delivered in its place. */
  replacement: string;
};

export type MeasuredPairVerdict = {
  proposal: MeasuredPairProposal;
  admitted: boolean;
  /** Why it was refused, in the bar's own terms. Absent when admitted. */
  reason?: string;
  word: WordEvidence;
  replacement: WordEvidence;
};

const EMPTY_EVIDENCE = (word: string): WordEvidence => ({
  word,
  refusedTexts: 0,
  passedTexts: 0,
  refusedSlices: 0,
  passedSlices: 0,
  refusedOperations: 0,
});

/**
 * THE GATE ON HIS LIST — judge one proposed pair against the corpus.
 *
 * Both halves of his bar, each refused by name: the word refused in ≥ 2
 * distinct texts, the replacement delivered in ≥ 2 distinct texts, and — the
 * clause the bar leaves implicit and the corpus makes checkable — the word must
 * not itself have been delivered, because a word that passed is not what was
 * refused.
 *
 * It is a CHECK and never a write: admitting a pair does not add it anywhere.
 * Where the list lives is item 4, which is deferred, and a reader that wrote
 * into it would be building item 4 under item 3's name.
 */
export function measuredPairVerdict(
  entries: readonly RefusalLoopEntry[],
  proposal: MeasuredPairProposal,
  options: { minTexts?: number } = {},
): MeasuredPairVerdict {
  const minTexts = options.minTexts ?? MIN_REFUSED_TEXTS;
  const evidence = wordEvidence(entries);
  const word = evidence.get(proposal.word.toLowerCase()) ?? EMPTY_EVIDENCE(proposal.word.toLowerCase());
  const replacement = evidence.get(proposal.replacement.toLowerCase())
    ?? EMPTY_EVIDENCE(proposal.replacement.toLowerCase());
  const refuse = (reason: string): MeasuredPairVerdict => ({
    proposal,
    admitted: false,
    reason,
    word,
    replacement,
  });
  if (word.word === replacement.word) {
    return refuse("the word and its replacement are the same word");
  }
  if (word.refusedTexts < minTexts) {
    return refuse(
      `the word was refused in ${word.refusedTexts} distinct text(s), and the bar is ${minTexts}`
      + (word.refusedSlices > word.refusedTexts
        ? ` — ${word.refusedSlices} objects carry it, which is one roll's text counted more than once`
        : ""),
    );
  }
  if (word.passedTexts > 0) {
    return refuse(
      `the word was also DELIVERED in ${word.passedTexts} distinct text(s), so it is not what was refused`,
    );
  }
  if (replacement.passedTexts < minTexts) {
    return refuse(
      `the replacement was delivered in ${replacement.passedTexts} distinct text(s), and the bar is ${minTexts}`,
    );
  }
  return { proposal, admitted: true, word, replacement };
}
