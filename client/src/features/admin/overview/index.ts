export { HealthMetrics, GenerationChart } from "./HealthMetrics";
/* Brief 07 §2 — the section that leads the page, and the only one that can
   disappear. `attentionItems` is exported so the guard can drive the derivation
   directly rather than through a render. */
export { NeedsHuman, attentionItems } from "./NeedsHuman";
export type { AttentionItem } from "./NeedsHuman";
export { UserGrowthCard } from "./UserGrowthCard";
export { CreditEconomyCard } from "./CreditEconomyCard";
export { GovernanceCard } from "./GovernanceCard";
export { AlertsFeed } from "./AlertsFeed";
export { BannerManagement } from "./BannerManagement";
export { SystemStatusCard } from "./SystemStatusCard";
/* §7, §12 — the one reader of `:root` for recharts props. */
export { useChartTokens, tooltipStyle, axisTick } from "./chartTokens";
export type { ChartTokens } from "./chartTokens";
