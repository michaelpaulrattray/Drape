/**
 * IS HE IN THE MIDDLE OF SOMETHING — the courtesy freeze's one reading (#585,
 * from #508's design D8).
 *
 * Ten deploys landed in one night while the founder was dogfooding, and one of
 * them killed a roll he was watching. The 2026-08-01 ruling accepts that
 * collision class and forbids drain infrastructure — **it does not forbid
 * manners.** So a road that ships production REFUSES while he has casting work
 * from the last ten minutes, and says why.
 *
 * # ⚠ IT LIVES HERE BECAUSE THERE ARE TWO ROADS NOW, AND ONLY ONE HAD MANNERS
 *
 * Before the deploy-on-merge flip (#508, 2026-09-06) the rite was the only way
 * to production, so the freeze inside `scripts/deploy-rite.mts` was the whole
 * story. **After the flip a squash merge deploys**, and the road shifts
 * actually merge on — `scripts/pr-merge-in-order.mts` — had no such read. A PR
 * merged mid-roll kills the process holding his candidates and costs him the
 * D-85 window (≤ ~6 min, money conserved by per-slice billing and the sweep).
 *
 * **Extracted rather than copied**, which is the card's own bar and working law
 * 4: two readings of "is he busy" that could disagree is worse than one that is
 * sometimes wrong, because only the second kind can be fixed once.
 *
 * # WHAT THIS CAN AND CANNOT SEE — said in the receipt, not just here
 *
 * It reads ROWS: candidates and variants. **Browsing writes neither.** On
 * 2026-08-16 this line printed *"his last casting work was 138.5 minutes ago"*
 * while he was opening face panels — twelve production scans between 10:46Z and
 * 10:58Z, reconciled to the cent against fal's own balance — and two deploys
 * landed inside that session, one of them five seconds after a scan of his.
 *
 * The guard is unchanged, deliberately (fable-754 §4): what it protects against
 * is a killed roll, and reading request logs per deploy to catch a browsing
 * session buys a risk the kept-scan table is already retiring. What the
 * SENTENCE does is say which reading it took, so nobody quotes a quietness this
 * instrument cannot see. **An instrument that overstates its own reach is the
 * uptime-anchor family's defect wearing a politeness costume.**
 *
 * # ⚠ IT FAILS OPEN, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT
 *
 * An unreadable ledger returns `active: false` — the road proceeds. **The
 * freeze is manners, not a control** (D-85 accepts the collision outright), so
 * a database it cannot reach must never wedge a deploy or a merge. Every
 * unreadable path says so in its own note, so a receipt never shows a silence
 * that was really a failure.
 */

/** The window, in minutes, inside which a row of his counts as an active session. */
export const FOUNDER_ACTIVE_WINDOW_MINUTES = 10;

/** ⚠ His account, and the only one this reads. Deploys are not frozen for anyone else. */
export const FOUNDER_USER_ID = 1;

/** What the caller does about it, and the sentence it prints either way. */
export type FounderActivity = {
  /** True only when a row of his lands inside the window — never on a failure. */
  active: boolean;
  /** The line for the receipt. Always names what the reading could not see. */
  note: string;
};

/** The one blindness, quoted into every note so it travels with the number. */
const BLIND = "browsing writes no row and is invisible to this reading";

/**
 * The query. ⚠ **One statement over both tables** — a candidate is a roll's
 * unit and a variant is a version of one, and either means he is working.
 */
export const FOUNDER_ACTIVITY_SQL =
  `SELECT MAX(at) AS latest FROM (
         SELECT MAX(createdAt) AS at FROM casting_candidates WHERE userId = ${FOUNDER_USER_ID}
         UNION ALL
         SELECT MAX(createdAt) AS at FROM casting_candidate_variants WHERE userId = ${FOUNDER_USER_ID}
       ) AS his`;

/**
 * Is he mid-session?
 *
 * `url` absent means the caller could not read the production ledger's address;
 * that is a fail-open too, and it says so rather than reading as quiet.
 *
 * `openDatabase` and `now` are injected so this can be DRIVEN — the rite and
 * the merge helper each pass the real ones, and `server/founderActivity.test.ts`
 * passes fakes, including one that throws.
 */
export async function readFounderActivity(input: {
  url: string | undefined;
  openDatabase: (url: string) => Promise<{
    query: (sql: string) => Promise<[unknown, unknown]>;
    end: () => Promise<unknown>;
  }>;
  now?: () => number;
}): Promise<FounderActivity> {
  const { url, openDatabase, now = () => Date.now() } = input;
  if (!url) return { active: false, note: "(unread — MYSQL_PUBLIC_URL not readable)" };
  try {
    const connection = await openDatabase(url);
    let rows: unknown;
    try {
      [rows] = await connection.query(FOUNDER_ACTIVITY_SQL);
    } finally {
      /* ⚠ The connection is closed even when the query throws. The rite's
         original shape closed it only on the happy path, so a failing read
         leaked a handle into a script that then waits minutes on a deploy. */
      await connection.end();
    }
    const first = Array.isArray(rows) ? (rows[0] as { latest?: unknown } | undefined) : undefined;
    const latest = first?.latest ? new Date(first.latest as string).getTime() : 0;
    if (!latest) return { active: false, note: `no cast or version on record (${BLIND})` };
    const minutes = (now() - latest) / 60_000;
    return {
      active: minutes <= FOUNDER_ACTIVE_WINDOW_MINUTES,
      note: `his last CAST OR VERSION was ${minutes.toFixed(1)} minutes ago (${BLIND})`,
    };
  } catch {
    /* ⚠ NO ERROR TEXT. A driver's connection error can carry the DSN it was
       handed, and this line goes into a receipt and a mailbox report — the
       reading is either taken or it is not, and which driver said no does not
       belong beside a credential. */
    return { active: false, note: "(unread — the production ledger could not be reached)" };
  }
}

/**
 * THE PRODUCTION LEDGER'S ADDRESS, read by NAME out of `railway variables --kv`
 * and never printed.
 *
 * ⚠ **Shared for the same reason the reading is**: two consumers parsing the
 * same `KEY=value` block with two regexes is working law 4 with a credential
 * attached, and a parser that drifts here fails OPEN — the freeze silently
 * stops freezing and nothing looks wrong.
 *
 * `readVariables` is injected: the rite passes its own `railway()` runner, the
 * merge helper passes one built the same way, and an arm passes a string.
 * A runner that throws (an unlinked worktree — a worktree has no Railway link)
 * returns `undefined`, which every caller treats as fail-open.
 */
export function productionDatabaseUrl(readVariables: () => string): string | undefined {
  let printed: string;
  try {
    printed = readVariables();
  } catch {
    return undefined;
  }
  return printed.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
}
