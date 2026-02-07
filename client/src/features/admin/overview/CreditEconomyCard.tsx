/**
 * CreditEconomyCard — credit consumption, purchases, refunds, and generation type breakdown.
 */
import {
  Coins,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Wallet,
} from "lucide-react";

interface CreditEconomyData {
  creditsConsumed24h: number;
  creditsPurchased7d: number;
  creditsRefunded7d: number;
  totalCreditsInCirculation: number;
  generationsByType24h: Array<{ type: string; count: number; totalCost: number }>;
}

const TYPE_LABELS: Record<string, string> = {
  casting_image: "Casting Image",
  full_body: "Full Body",
  multi_view: "Multi View",
  iterate: "Iterate",
  upscale: "Upscale",
};

export function CreditEconomyCard({ data }: { data: CreditEconomyData }) {
  const sortedTypes = [...data.generationsByType24h].sort(
    (a, b) => b.totalCost - a.totalCost
  );
  const maxCost = sortedTypes.length > 0 ? sortedTypes[0].totalCost : 1;

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">
          Credit Economy
        </h3>
        <Coins className="w-4 h-4 text-[#757575]" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-2xl font-semibold tabular-nums text-[#0A0A0A]">
              {data.creditsConsumed24h.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-[#757575] mt-0.5">Consumed (24h)</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-2xl font-semibold tabular-nums text-emerald-600">
              {data.creditsPurchased7d.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-[#757575] mt-0.5">Purchased (7d)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-lg font-semibold tabular-nums text-[#0A0A0A]">
              {data.creditsRefunded7d.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-[#757575] mt-0.5">Refunded (7d)</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-[#757575]" />
            <span className="text-lg font-semibold tabular-nums text-[#0A0A0A]">
              {data.totalCreditsInCirculation.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-[#757575] mt-0.5">In circulation</p>
        </div>
      </div>

      {/* Generation type breakdown */}
      {sortedTypes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#757575] uppercase tracking-wider mb-2.5">
            Generation Breakdown (24h)
          </p>
          <div className="space-y-2">
            {sortedTypes.map((gen) => (
              <div key={gen.type} className="flex items-center gap-3">
                <span className="text-xs text-[#0A0A0A] w-28 truncate">
                  {TYPE_LABELS[gen.type] || gen.type}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0A0A0A]/15 rounded-full transition-all duration-500"
                    style={{ width: `${(gen.totalCost / maxCost) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[#757575] w-20 text-right">
                  {gen.count}× · {gen.totalCost.toLocaleString()}cr
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {sortedTypes.length === 0 && (
        <p className="text-xs text-[#757575] italic">
          No generations in the last 24 hours
        </p>
      )}
    </div>
  );
}
