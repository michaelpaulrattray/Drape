/**
 * SearchField — quiet inline search for the lobby collection pages.
 * Text-forward: icon + hairline underline, no box.
 */
import { Search } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <label
      className="flex items-center gap-2"
      style={{ borderBottom: '1px solid var(--borderInput)', paddingBottom: 4 }}
    >
      <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--meta)' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="outline-none bg-transparent placeholder:text-[var(--meta)]"
        style={{ fontSize: 13, color: 'var(--ink)', width: 170 }}
      />
    </label>
  );
}
