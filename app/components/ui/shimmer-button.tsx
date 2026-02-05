"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function ShimmerButton({ children, className, ...props }: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        "shimmer-button group relative isolate overflow-hidden rounded-[0.66em] px-[1.4em] py-[0.8em] font-semibold transition-all duration-[1.33s]",
        "flex items-center justify-center", // Add flex layout
        "bg-gradient-to-br from-[#ffc4ec] via-[#efdbfd] to-[#ffedd6]",
        "shadow-[0_2px_3px_1px_hsl(222deg_50%_20%/50%),inset_0_-10px_20px_-10px_hsla(180deg_10%_90%/95%)]",
        "hover:scale-110 hover:shadow-[0_4px_8px_-2px_hsl(222deg_50%_20%/50%),inset_0_0_0_transparent]",
        "active:scale-105",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{
        // @ts-expect-error - CSS custom properties
        "--glow-hue": "222deg",
        "--shadow-hue": "180deg",
        "--inset": "40px",
        "--bg": "#1b1724",
        transitionTimingFunction: "linear(0, 0.002, 0.01 0.9%, 0.038 1.8%, 0.156, 0.312 5.8%, 0.789 11.1%, 1.015 14.2%, 1.096, 1.157, 1.199, 1.224 20.3%, 1.231, 1.231, 1.226, 1.214 24.6%, 1.176 26.9%, 1.057 32.6%, 1.007 35.5%, 0.984, 0.968, 0.956, 0.949 42%, 0.946 44.1%, 0.95 46.5%, 0.998 57.2%, 1.007, 1.011 63.3%, 1.012 68.3%, 0.998 84%, 1)",
      }}
      {...props}
    >
      <span className="button-content relative z-10 flex items-center gap-2">
        {children}
      </span>
      <span className="shimmer pointer-events-none absolute inset-[-40px] rounded-[inherit] mix-blend-plus-lighter" />
      <style jsx>{`
        @property --shimmer {
          syntax: "<angle>";
          inherits: false;
          initial-value: 33deg;
        }

        @keyframes shimmer {
          0% {
            --shimmer: 0deg;
          }
          100% {
            --shimmer: 360deg;
          }
        }

        @keyframes shine {
          0% {
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          55% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes text {
          0% {
            background-position: 100% center;
          }
          100% {
            background-position: -100% center;
          }
        }

        .shimmer {
          mask-image: conic-gradient(
            from var(--shimmer, 0deg),
            transparent 0%,
            transparent 20%,
            black 36%,
            black 45%,
            transparent 50%,
            transparent 70%,
            black 85%,
            black 95%,
            transparent 100%
          );
          mask-size: cover;
          animation: shimmer 1s linear infinite both;
        }

        .shimmer-button:hover .shimmer::before,
        .shimmer-button:hover .shimmer::after {
          opacity: 1;
          animation: shine 1.2s ease-in 1 forwards;
        }

        .shimmer::before,
        .shimmer::after {
          transition: all 0.5s ease;
          opacity: 0;
          content: "";
          border-radius: inherit;
          position: absolute;
          mix-blend-mode: color;
          inset: var(--inset);
          pointer-events: none;
        }

        .shimmer::before {
          box-shadow:
            0 0 calc(var(--inset) * 0.1) 2px hsl(var(--glow-hue) 20% 95%),
            0 0 calc(var(--inset) * 0.18) 4px hsl(var(--glow-hue) 20% 80%),
            0 0 calc(var(--inset) * 0.33) 4px hsl(var(--glow-hue) 50% 70%),
            0 0 calc(var(--inset) * 0.66) 5px hsl(var(--glow-hue) 100% 70%);
          z-index: -1;
        }

        .shimmer::after {
          box-shadow:
            inset 0 0 0 1px hsl(var(--glow-hue) 70% 95%),
            inset 0 0 2px 1px hsl(var(--glow-hue) 100% 80%),
            inset 0 0 5px 2px hsl(var(--glow-hue) 100% 70%);
          z-index: 2;
        }

        /* Button content - default state with dark text/icons */
        .button-content {
          color: var(--bg);
        }

        /* SVG icons get solid color */
        .button-content :global(svg) {
          color: var(--bg) !important;
          fill: currentColor;
        }

        /* On hover, apply gradient effect to the whole content */
        .shimmer-button:hover .button-content {
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          background-color: var(--bg);
          background-image: linear-gradient(
            120deg,
            var(--bg) 0%,
            hsla(var(--glow-hue), 100%, 80%, 0.66) 40%,
            hsla(var(--glow-hue), 100%, 90%, 0.9) 50%,
            var(--bg) 100%
          );
          background-repeat: no-repeat;
          background-size: 200% 100%;
          animation: text 0.66s ease-in-out 1 forwards;
        }

        /* Keep SVG visible on hover with solid color */
        .shimmer-button:hover .button-content :global(svg) {
          color: var(--bg) !important;
          opacity: 1;
          -webkit-text-fill-color: var(--bg);
        }
      `}</style>
    </button>
  )
}
