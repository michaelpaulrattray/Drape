import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  required?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}

export function CollapsibleSection({
  title,
  required = false,
  children,
  defaultOpen = true,
  id,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="border-b border-gray-200/50 last:border-0 group/section scroll-mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 group focus:outline-none select-none hover-scale"
      >
        <div className="flex items-center space-x-3">
          {/* Section indicator dot */}
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isOpen ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'bg-slate-accent group-hover:bg-slate-accent'}`} />
          <h3 className={`text-xs font-semibold tracking-tight transition-colors duration-300 ${isOpen ? 'text-obsidian' : 'text-subtle group-hover:text-charcoal'}`}>
            {title}
          </h3>
          {required && <span className="text-red-500/70 text-xs group-hover:text-red-400 transition-colors">*</span>}
        </div>
        <div className={`transform transition-transform duration-300 text-gray-400 group-hover:text-subtle ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[3000px] opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
        {/* Section content with subtle background for visual hierarchy */}
        <div className="space-y-4 pl-4 border-l border-gray-200/30 ml-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
