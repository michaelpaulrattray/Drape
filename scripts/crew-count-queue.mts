/**
 * COUNT THE QUEUE — the numbers under his background-work switches (issue #277).
 *
 * Run at shift start, beside the switch read:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-count-queue.mts
 *
 * # WHAT IT COUNTS, AND WHY THERE IS NO LIST HERE
 *
 * ⚠ **AND SINCE #324 IT IS HOW MANY ARE ON OFFER, NOT HOW MANY EXIST.** He
 * asked at the live panel: *"how do we know they are not already scheduled to
 * be fixed in current pipeline or work?"* — and two of his thirteen bugs were
 * `founder-ordered` cards already sitting in NEXT UP, offered a second time as
 * background work a shift may take on its own judgement. A card he has queued,
 * or one parked on his own ruling, is subtracted and **named** in the same row
 * (`shared/crewQueueExclusions.ts`), so the panel reads *Bugs (11, 2 already
 * queued)* rather than a number that quietly got smaller.
 *
 * One number per category: **how many OPEN cards carry that category's label**.
 * The labels are `shared/crewWorkSwitches.ts`'s `queueLabel`, and **not one of
 * them was invented for this feature** — `bug`, `seat:warden`,
 * `seat:machinist`, `seat:janitor` and `seat:retro` were already in use by the
 * seats. His card says it in capitals: *the counts and the categories are
 * derived from the queue's own labels, never a second list*, so **a card
 * relabelled in GitHub moves category on his page without anyone touching the
 * panel.**
 *
 * # ⚠ WHY THE COUNT IS CACHED RATHER THAN LIVE, SAID OUT LOUD
 *
 * A truly live count means the SERVER calling the GitHub API, which means a
 * repo-scoped token as a production environment variable — a credential that
 * can read this private repository, living in the app's environment, plus an
 * outbound dependency on his admin page. **That is a founder-level decision
 * about a credential, not a shift's**, so it is named as the upgrade rather
 * than taken.
 *
 * What lands instead is a DERIVED CACHE with its own timestamp: nobody types
 * these numbers, and `countedAt` rides every row so the panel says **"counted
 * 14 min ago"** rather than implying an instant it does not have. That is the
 * difference between this and the lists that rotted — the
 * standing-exceptions ranking went stale because a PERSON typed it.
 *
 * # THE TITLES BESIDE THE NUMBER (#285)
 *
 * Founder, at the live panel: *"am i suppose to see a list under these
 * categories?"* Up to five card titles ride each row, most recent first, and
 * **they cost nothing extra to produce** — this script already has the cards in
 * hand when it counts them, so the titles come out of the SAME `gh` response
 * and land in the SAME statement. That is what makes his card's bar — *the
 * count and the titles share one `countedAt`* — hold by construction rather
 * than by two writes agreeing.
 *
 * ⚠ **AND IT STILL WRITES THE COUNT WHERE THE COLUMN DOES NOT EXIST.** The
 * column is migration 0057 and production takes it by ceremony, which is a
 * founder act; between the deploy and that command this script runs at every
 * shift start against a table without it. So it asks `SHOW COLUMNS` first and
 * falls back to the count-only INSERT — a shift must never leave his panel
 * uncounted because a feature it cannot see is not installed yet.
 *
 * # THE CARDS THAT MAY ALREADY BE DONE (#494)
 *
 * His question at the live panel: *"does the agent know when a bug or any other
 * category item has already been fixed etc? i dont want want it trying to fix an
 * irrelevant bug"* — and the 2 September triage had already found five cards
 * whose fix landed and whose card nobody closed. So beside each count this now
 * reads **which offered cards a merged pull request named and nobody answered**,
 * writes them into the same row, and — the part that matters at 3am — NAMES
 * every one of them in the log with the pull request to open first.
 *
 * ⚠ **IT FLAGS AND NEVER SUBTRACTS.** A flagged card is still inside
 * `openCount`; the panel reads `Bugs (14, 2 already queued, 2 possibly fixed)`,
 * where the queued two are OUT of the fourteen and the flagged two are two OF
 * them. His card: *"No card closes from this instrument."*
 *
 * ⚠ **AND IT IS A FLOOR, NOT COVERAGE** — `shared/crewQueuePossiblyDone.ts`
 * states the limits it was measured against: two of those five cards are named
 * by no merged pull request at all. A category with no flags means this reading
 * found nothing, never that nothing is stale. The re-read-before-take standing
 * order is the control; this says which to re-read FIRST.
 *
 * # ⚠ THIS IS A WRITER, AND IT IS THE ONLY TABLE IT MAY NAME
 *
 * `crew_queue_counts` and nothing else; no DDL, no DELETE. In particular it may
 * never touch `crew_work_switches` — those are HIS rows, and a shift that could
 * write them could switch its own permission on.
 * `server/crewShiftWriterBoundary.test.ts` pins that at the source, with a
 * positive control.
 */
/**
 * # WHERE THE READING ITSELF LIVES NOW (#618)
 *
 * Everything above still describes what this command counts and why. What
 * moved is only WHERE the code sits: the reading is
 * `scripts/lib/crewQueueCount.mts` and this file is its command-line front
 * door - resolve a database, open it, call it, close it, choose an exit code.
 *
 * It moved because the numbers on his panel were only ever as new as the last
 * shift START. His words, 2026-09-07: *"how many bugs has it done and worked on
 * its still reading as 18 but its been working all night"*. The SHIFT CLOSE
 * calls the same function now, so a night that closes ten cards leaves his
 * panel saying so.
 *
 * The output of this command is unchanged, which is the property to keep: a
 * shift reads this log at 3am and the extraction must not have edited what it
 * says.
 */
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { refreshQueueCounts } from "./lib/crewQueueCount.mts";

/** WHICH WORLD, named plainly - see `crew-shift-start.mts`'s note. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

const conn = await openDatabase(url);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  const outcome = await refreshQueueCounts(conn);
  if (!outcome.ok) {
    console.error(`REFUSING: ${outcome.reason}`);
    await conn.end();
    process.exit(1);
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
