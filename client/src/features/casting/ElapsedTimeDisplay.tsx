import React, { useState, useEffect } from "react";
import { LOADING_TIPS } from "./castingHelpers";

export function ElapsedTimeDisplay({ startTime, estimatedDuration }: { startTime: number; estimatedDuration?: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);
  
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
    }, 3000);
    return () => clearInterval(tipInterval);
  }, []);
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };
  
  return (
    <div className="text-center space-y-2">
      <div className="text-xs font-medium text-[#0A0A0A]">
        <span>{formatTime(elapsed)}</span>
        {estimatedDuration && elapsed < estimatedDuration && (
          <span className="text-[#757575]"> / ~{formatTime(estimatedDuration)}</span>
        )}
      </div>
      <div className="text-xs font-medium text-[#757575] max-w-xs mx-auto animate-pulse">
        {LOADING_TIPS[tipIndex]}
      </div>
    </div>
  );
}
