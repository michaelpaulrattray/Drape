import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        // Position centered above the trigger icon
        top: rect.top - 8, 
        left: rect.left + rect.width / 2
      });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative inline-block ml-1.5 align-middle group text-subtle hover:text-charcoal cursor-help transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>

      {isVisible && createPortal(
        <div 
            className="fixed z-[100] w-48 p-3 bg-white border border-gray-200 text-xs text-charcoal rounded-lg shadow-lg pointer-events-none leading-relaxed font-sans animate-in fade-in duration-200"
            style={{ 
                top: position.top, 
                left: position.left,
                transform: 'translate(-50%, -100%)' 
            }}
        >
          {content}
          {/* Downward Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-200"></div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
