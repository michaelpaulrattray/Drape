/**
 * Settings → Usage (brief §5).
 *
 * ## ⚠ THE PER-TOOL BARS HAVE NO SERVER, AND THIS IS THE SECTION THE
 * RECONCILIATION CHANGED MOST (BRIEF-RECONCILIATION Q3)
 *
 * The brief draws five bars — *"Video 2,140 (72%) · Image 1,380 (46%) · Try-on
 * 780 (26%) · UGC 340 (12%) · Upscale 120 (5%)"*. Measured at the code:
 *
 * - **Four of those five tools do not exist.** Video, Try-on, UGC and Upscale
 *   are four of the five greyed entries in the prompt box — his own section-00b
 *   ruling put them there as stubs, *"visible, greyed, not built yet on hover"*.
 * - **Nothing records a tool against a spend.** `credit_transactions` carries a
 *   `type` (`generation`, `purchase`, `refund`, …) and an `engineUsed`, and
 *   `usage.getStats` folds by that `type`. There is no tool column, so there is
 *   no reader that could answer the question the bars ask.
 *
 * His own 00b words settle what to do: *"A number in a screenshot that no
 * server produces is a lie that survives into the build."* So the bars are
 * drawn from the fold that DOES exist — spend by kind of transaction — and the
 * five tool names are not printed at all. The greyscale-by-rank treatment,
 * which is the design decision in that paragraph, is kept exactly.
 *
 * **What is real here:** credits used and the allowance (`billing.getStatus` +
 * `PLAN_TIERS`), frames made (`usage.getStats.totalGenerations`), and storage
 * (`profile.storageInfo`). Cast members and *"84 kept"* have no reader either
 * and are absent rather than invented.
 */
import { trpc } from "@/lib/trpc";

import { Bar, SettingsGroup } from "../parts";

/**
 * The greyscale ramp, widest first — §5: *"Greyscale, not colour-coded. Tool is
 * a category, and colour never encodes a category. Rank is carried by bar
 * length and the ramp."*
 */
const RANK_TOKENS = ["--ink", "--secondary", "--metaStrong", "--meta", "--muted"];

/** `1.2 GB` — bytes at the precision a storage line is read at. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** `purchase` → `Purchase`. The fold's keys are its own vocabulary. */
function titleCase(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

export function UsageSection({
  allowance,
  creditsUsed,
}: {
  allowance: number;
  creditsUsed: number;
}) {
  const { data: stats } = trpc.usage.getStats.useQuery({ days: 30 });
  const { data: storage } = trpc.profile.storageInfo.useQuery();

  const spendRows = Object.entries(stats?.byType ?? {})
    .filter(([, value]) => value.credits > 0)
    .sort((a, b) => b[1].credits - a[1].credits)
    .slice(0, RANK_TOKENS.length);
  const widest = spendRows[0]?.[1].credits ?? 0;

  const storageUsed = storage?.used ?? 0;
  const storageLimit = storage?.limit ?? 0;

  return (
    <>
      <SettingsGroup title="Usage" note="The last 30 days on this account.">
        <div className="dp-set__statrow">
          <span className="dp-set__statvalue">{creditsUsed.toLocaleString()}</span>
          <span className="dp-set__statnote">
            credits used{allowance > 0 ? ` · of ${allowance.toLocaleString()} this month` : ""}
          </span>
        </div>
        <div className="dp-set__statrow">
          <span className="dp-set__statvalue">
            {(stats?.totalGenerations ?? 0).toLocaleString()}
          </span>
          <span className="dp-set__statnote">frames made</span>
        </div>
        <div className="dp-set__statrow">
          <span className="dp-set__statvalue">
            {Math.round(stats?.averagePerDay ?? 0).toLocaleString()}
          </span>
          <span className="dp-set__statnote">credits a day, on average</span>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Where the credits went"
        note="Grouped the way the ledger groups them. The studio does not yet record which tool spent a credit, so this is by kind of movement rather than by tool."
      >
        {spendRows.length === 0 ? (
          <p className="dp-set__note">Nothing spent in the last 30 days.</p>
        ) : (
          spendRows.map(([key, value], index) => (
            <div className="dp-set__row" key={key}>
              <span className="dp-set__rowtext" style={{ flex: "0 0 120px" }}>
                <span className="dp-set__label">{titleCase(key)}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <Bar
                  ratio={widest > 0 ? value.credits / widest : 0}
                  token={RANK_TOKENS[index] ?? "--muted"}
                />
              </span>
              <span className="dp-set__value">{value.credits.toLocaleString()}</span>
            </div>
          ))
        )}
      </SettingsGroup>

      <SettingsGroup
        title="Storage"
        note="Unkept frames clear after 30 days, which is most of what you free up."
      >
        <div className="dp-set__row">
          <span style={{ flex: 1, minWidth: 0 }}>
            <Bar ratio={storageLimit > 0 ? storageUsed / storageLimit : 0} token="--ink" />
          </span>
          <span className="dp-set__value">
            {formatBytes(storageUsed)}
            {storageLimit > 0 ? ` of ${formatBytes(storageLimit)}` : ""}
          </span>
        </div>
      </SettingsGroup>
    </>
  );
}
