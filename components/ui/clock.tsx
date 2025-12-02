'use client';

import { cn } from '@/lib/utils';

interface ClockIconProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function ClockIcon({ size = 28, className, animate = false }: ClockIconProps) {
  return (
    <div className={cn(className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line
          x1="12"
          y1="12"
          x2="12"
          y2="6"
          style={{
            transformOrigin: '12px 12px',
            animation: animate ? 'clock-hour-hand 4s linear infinite' : 'none',
          }}
        />
        <line
          x1="12"
          y1="12"
          x2="16"
          y2="12"
          style={{
            transformOrigin: '12px 12px',
            animation: animate ? 'clock-minute-hand 1s linear infinite' : 'none',
          }}
        />
      </svg>
      <style jsx>{`
        @keyframes clock-hour-hand {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes clock-minute-hand {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export type ClockIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};
