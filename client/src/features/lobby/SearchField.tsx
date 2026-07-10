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
      style={{ borderBottom: '1px solid rgba(0,0,0,0.15)', paddingBottom: 4 }}
    >
      <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#B0AFA8' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="outline-none bg-transparent placeholder:text-[#B0AFA8]"
        style={{ fontSize: 13, color: '#1a1a1a', width: 170 }}
      />
    </label>
  );
}
