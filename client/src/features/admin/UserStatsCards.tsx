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
 * `admins` deliberately stays greyscale though it is arresting: a role is what
 * someone IS, not something needing attention, which is the same sentence that
 * took the purple crown off the role pill one file over.
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
