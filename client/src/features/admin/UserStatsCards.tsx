/**
 * The six counts above Admin → Users.
 *
 * ⚠ **IT WAS SIX COLOURS AND IT IS NOW ONE, AND THAT WAS FOUND AT THE FRAME.**
 * Every figure had its own: black total, emerald active, red suspended, amber
 * locked, blue new-this-month, purple admins. Sat directly above a table whose
 * whole colour rule is *"status may carry accent, and only where somebody needs
 * to act"* (brief 06 §4), it read as a different product — and the founder's own
 * argument applies exactly: **when everything is coloured, nothing is.**
 *
 * Two of the six are states an admin acts on — `suspended` and `locked` — and
 * they carry accent **only when they are not zero.** A red `0 SUSPENDED` is the
 * loudest thing on the page saying nothing is wrong.
 *
 * `admins` deliberately stays greyscale though it is arresting — and ⚠ **its
 * reason changed under it in #422 (2026-09-02) without its behaviour changing,
 * which is exactly when a stale justification is most dangerous.** It used to
 * lean on the role pill's rule one file over; that rule now has a founder-named
 * exception and `admin` DOES carry accent there, so the citation would argue
 * for tinting this tile.
 *
 * It stays grey on his OWN separate ruling, in the same breath as the other:
 * **a count goes coloured only when it is non-zero.** This is a COUNT, not a
 * role pill — a red `4 ADMINS` is the loudest thing on the page saying nothing
 * is wrong, which is the same argument as the `0 SUSPENDED` above it. The role
 * pill answers *who is this one person*; the tile answers *how many*, and only
 * the first is the security-legibility case he made.
 *
 * These stay TILES rather than becoming a table — they are not a list of
 * records, and the dashboard shape belongs to brief 07.
 */
interface UserStatsData {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  lockedUsers: number;
  newUsersThisMonth: number;
  adminCount: number;
}

interface UserStatsCardsProps {
  stats: UserStatsData | undefined;
}

const statCards = [
  { key: "totalUsers", label: "Total" },
  { key: "activeUsers", label: "Active" },
  /* The two an admin is scanning for — accent, but only when non-zero. */
  { key: "suspendedUsers", label: "Suspended", attentionWhenSet: true },
  { key: "lockedUsers", label: "Locked", attentionWhenSet: true },
  { key: "newUsersThisMonth", label: "New this month" },
  { key: "adminCount", label: "Admins" },
] as const;

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  return (
    <div className="dp-countrow">
      {statCards.map((card) => {
        const value = stats?.[card.key] ?? 0;
        const alert = "attentionWhenSet" in card && card.attentionWhenSet && value > 0;
        return (
          <div key={card.key} className="dp-counttile">
            <span className="dp-chrome">{card.label}</span>
            <span className={`dp-counttile__value${alert ? " dp-counttile__value--alert" : ""}`}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
