/**
 * THE MAILBOX AS CANDIDATES — the IO half of #960's previous-shift reader.
 *
 * The DECISION (which entry was the previous shift, and when to refuse) is
 * `choosePreviousShift` in `shiftDigest.mts`, which is pure and takes plain
 * data. This module is the only part that touches a disk, and it lives apart
 * for two reasons rather than tidiness:
 *
 * 1. **`scripts/lib/shiftDigest.mts` imports NOTHING.** Its arms run in CI with
 *    no filesystem of the team's to read, and that is what makes them arms
 *    rather than a description of this machine. Putting `statSync` in it would
 *    end that quietly.
 * 2. **The CLI cannot be imported.** `scripts/shift-digest.mts` ends in
 *    `process.exit(main(...))`, so a test importing it would take the vitest
 *    process down with it. A collector nothing can import is a collector
 *    nothing can drive — which is how `previousShift()` came to have no arm at
 *    all while being the first thing every shift reads.
 *
 * ⚠ **The filename stamp is carried out of here as a STRING and never parsed
 * into an instant.** It is the SECOND reader — the one that cross-examines and
 * is named when it disagrees — and the moment this module turned it into a
 * `Date` it would be competing to choose, which is the bug (#960).
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { statIfPresent } from "./listedEntry.mts";
import type { MailboxEntry, Unreadable } from "./shiftDigest.mts";

/** Where the team's entries live, relative to a repository root. */
export const MAILBOX = ".agents/mailbox";

/**
 * Every timestamped mailbox entry with its WRITE TIME off the filesystem.
 *
 * The names are `foreman-20260904-2340.md` / `retro-…` / `runner-close-…`; a
 * file whose name carries no stamp is not a shift entry and is not a candidate.
 */
export function mailboxEntries(root: string): MailboxEntry[] | Unreadable {
  const dir = path.join(root, MAILBOX);
  if (!existsSync(dir)) return { unreadable: `${MAILBOX} is not there` };
  const NAME = /^([a-z-]+)-(\d{8})-(\d{4})\.md$/;
  const entries: MailboxEntry[] = [];
  for (const name of readdirSync(dir)) {
    const match = NAME.exec(name);
    if (!match) continue;
    /* ⚠ `statIfPresent`, NOT a bare `statSync` — a file listed a moment ago can
       be gone by the time it is touched, and a shift writing its own entry
       while another walk is running is the ordinary case here (#223). This
       module is the FIRST real customer of that stat-shaped tolerance: it was
       written for "a walker that classifies listed entries and never reads
       their bytes" when the population was zero (PR #592 review, finding 4),
       and `server/testing/listedSource.test.ts` flagged this file the moment it
       existed. A candidate that vanished is dropped, never guessed at. */
    const stats = statIfPresent(path.join(dir, name));
    if (!stats) continue;
    entries.push({ name, mtimeMs: stats.mtimeMs, filenameStamp: `${match[2]}${match[3]}` });
  }
  return entries;
}
