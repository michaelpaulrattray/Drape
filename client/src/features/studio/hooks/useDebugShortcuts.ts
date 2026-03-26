/**
 * useDebugShortcuts — Admin keyboard shortcuts for the casting form.
 *
 * Ctrl+Shift+D → populate form with random preferences
 * Ctrl+Shift+G → populate + auto-click generate
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { generateRandomPreferences } from '@/features/casting/castingHelpers';

export function useDebugShortcuts() {
  const { prefs, setPrefs } = useCastingFormStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Form populated with random preferences');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Auto-generating model...');
        setTimeout(() => {
          const generateBtn = document.querySelector(
            '[data-debug-generate]'
          ) as HTMLButtonElement;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
          }
        }, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prefs, setPrefs]);
}
