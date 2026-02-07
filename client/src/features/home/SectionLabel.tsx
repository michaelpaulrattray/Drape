/**
 * Reusable section label used across multiple Home page sections.
 */
export function SectionLabel({ label, number }: { label: string; number: string }) {
  return (
    <div className="flex items-center justify-between mb-section-label">
      <span className="text-base font-semibold text-[#0A0A0A] tracking-wide">/ {label}</span>
      <span className="text-base font-semibold text-gray-secondary">({number})</span>
    </div>
  );
}
