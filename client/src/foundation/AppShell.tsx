import type { ReactNode } from "react";

import { Rail, type RailAccount, type RailDestinationId } from "./Rail";
import { Topbar } from "./Topbar";

/**
 * The app shell (plan §D.4): 76px rail + 56px topbar + centred content column.
 *
 * `.dp-root` is also the token scope at M1 — see the header of tokens.css.
 * One shell instance should wrap a route family so navigation never remounts
 * the rail.
 *
 * Content width is a shell decision, not a feature's: 1180px for browsing and
 * detail, 1240px for working surfaces that need grid room (README §7).
 */
export function AppShell({
  breadcrumb,
  current,
  account,
  topbarRight,
  width = "browse",
  children,
}: {
  breadcrumb?: string;
  current?: RailDestinationId;
  account?: RailAccount;
  topbarRight?: ReactNode;
  width?: "browse" | "working";
  children: ReactNode;
}) {
  return (
    <div className="dp-root">
      <Rail current={current} account={account} />
      <div className="dp-main">
        <Topbar breadcrumb={breadcrumb} right={topbarRight} />
        <div className={width === "working" ? "dp-content dp-content--working" : "dp-content"}>
          {children}
        </div>
      </div>
    </div>
  );
}
