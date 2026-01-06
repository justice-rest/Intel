"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowCounterClockwise } from "@phosphor-icons/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type hsl = {
  h: number
  s: number
  l: number
}

type hex = {
  hex: string
}

type Color = hsl & hex

interface ColorPickerProps {
  label: string
  description?: string
  value: string
  defaultValue: string
  onChange: (color: string) => void
  disabled?: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================

function hslToHex({ h, s, l }: hsl) {
  s /= 100
  l /= 100

  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1)
  const r = Math.round(255 * f(0))
  const g = Math.round(255 * f(8))
  const b = Math.round(255 * f(4))

  const toHex = (x: number) => {
    const hex = x.toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }

  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function hexToHsl({ hex }: hex): hsl {
  // Ensure the hex string is formatted properly
  hex = hex.replace(/^#/, "")

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }

  // Pad with zeros if incomplete
  while (hex.length < 6) {
    hex += "0"
  }

  // Convert hex to RGB
  let r = parseInt(hex.slice(0, 2), 16) || 0
  let g = parseInt(hex.slice(2, 4), 16) || 0
  let b = parseInt(hex.slice(4, 6), 16) || 0

  // Then convert RGB to HSL
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s: number
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
    h *= 360
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function sanitizeHex(val: string) {
  const sanitized = val.replace(/[^a-fA-F0-9]/g, "").toUpperCase()
  return sanitized.slice(0, 6)
}

// ============================================================================
// Hashtag Icon
// ============================================================================

const HashtagIcon = (props: React.ComponentPropsWithoutRef<"svg">) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M11.097 1.515a.75.75 0 0 1 .589.882L10.666 7.5h4.47l1.079-5.397a.75.75 0 1 1 1.47.294L16.665 7.5h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.2 6h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103h-4.47l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103H3.75a.75.75 0 0 1 0-1.5h3.885l1.2-6H5.25a.75.75 0 0 1 0-1.5h3.885l1.08-5.397a.75.75 0 0 1 .882-.588ZM10.365 9l-1.2 6h4.47l1.2-6h-4.47Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ============================================================================
// Draggable Color Canvas
// ============================================================================

const DraggableColorCanvas = ({
  h,
  s,
  l,
  handleChange,
  disabled,
}: hsl & {
  handleChange: (e: Partial<Color>) => void
  disabled?: boolean
}) => {
  const [dragging, setDragging] = useState(false)
  const colorAreaRef = useRef<HTMLDivElement>(null)

  const calculateSaturationAndLightness = useCallback(
    (clientX: number, clientY: number) => {
      if (!colorAreaRef.current || disabled) return
      const rect = colorAreaRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const xClamped = Math.max(0, Math.min(x, rect.width))
      const yClamped = Math.max(0, Math.min(y, rect.height))
      const newSaturation = Math.round((xClamped / rect.width) * 100)
      const newLightness = 100 - Math.round((yClamped / rect.height) * 100)
      handleChange({ s: newSaturation, l: newLightness })
    },
    [handleChange, disabled]
  )

  // Mouse event handlers
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      calculateSaturationAndLightness(e.clientX, e.clientY)
    },
    [calculateSaturationAndLightness]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    setDragging(true)
    calculateSaturationAndLightness(e.clientX, e.clientY)
  }

  // Touch event handlers
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      if (touch) {
        calculateSaturationAndLightness(touch.clientX, touch.clientY)
      }
    },
    [calculateSaturationAndLightness]
  )

  const handleTouchEnd = useCallback(() => {
    setDragging(false)
  }, [])

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    const touch = e.touches[0]
    if (touch) {
      setDragging(true)
      calculateSaturationAndLightness(touch.clientX, touch.clientY)
    }
  }

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      window.addEventListener("touchmove", handleTouchMove, { passive: false })
      window.addEventListener("touchend", handleTouchEnd)
    } else {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [
    dragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ])

  return (
    <div
      ref={colorAreaRef}
      className={cn(
        "h-48 w-full touch-auto overscroll-none rounded-xl border border-zinc-200 dark:border-zinc-700",
        disabled && "pointer-events-none opacity-50"
      )}
      style={{
        background: `linear-gradient(to top, #000, transparent, #fff), linear-gradient(to left, hsl(${h}, 100%, 50%), #bbb)`,
        position: "relative",
        cursor: disabled ? "not-allowed" : "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        className="color-selector border-4 border-white ring-1 ring-zinc-200 dark:border-zinc-900 dark:ring-zinc-700"
        style={{
          position: "absolute",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: `hsl(${h}, ${s}%, ${l}%)`,
          transform: "translate(-50%, -50%)",
          left: `${s}%`,
          top: `${100 - l}%`,
          cursor: disabled ? "not-allowed" : dragging ? "grabbing" : "grab",
        }}
      />
    </div>
  )
}

// ============================================================================
// Advanced Color Picker Panel
// ============================================================================

interface ColorPickerPanelProps {
  color: Color
  setColor: React.Dispatch<React.SetStateAction<Color>>
  disabled?: boolean
}

function ColorPickerPanel({ color, setColor, disabled }: ColorPickerPanelProps) {
  const handleHexInputChange = (newVal: string) => {
    const hex = sanitizeHex(newVal)
    if (hex.length === 6) {
      const hsl = hexToHsl({ hex })
      setColor({ ...hsl, hex: hex })
    } else if (hex.length < 6) {
      setColor((prev) => ({ ...prev, hex: hex }))
    }
  }

  return (
    <div className="flex w-full select-none flex-col items-center gap-3 overscroll-none">
      <DraggableColorCanvas
        {...color}
        disabled={disabled}
        handleChange={(partial) => {
          setColor((prev) => {
            const value = { ...prev, ...partial }
            const hex_formatted = hslToHex({
              h: value.h,
              s: value.s,
              l: value.l,
            })
            return { ...value, hex: hex_formatted }
          })
        }}
      />

      {/* Hue Slider */}
      <input
        type="range"
        min="0"
        max="360"
        value={color.h}
        disabled={disabled}
        className={cn(
          "h-3 w-full cursor-pointer appearance-none rounded-full border border-zinc-200 dark:border-zinc-700",
          "[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_#e4e4e7] [&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:shadow-[0_0_0_1px_#e4e4e7] [&::-moz-range-thumb]:cursor-pointer",
          "dark:[&::-webkit-slider-thumb]:border-zinc-900 dark:[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_#3f3f46]",
          "dark:[&::-moz-range-thumb]:border-zinc-900 dark:[&::-moz-range-thumb]:shadow-[0_0_0_1px_#3f3f46]",
          disabled && "pointer-events-none opacity-50"
        )}
        style={{
          background: `linear-gradient(to right,
            hsl(0, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(360, 100%, 50%))`,
        }}
        onChange={(e) => {
          const hue = e.target.valueAsNumber
          setColor((prev) => {
            const { hex, ...rest } = { ...prev, h: hue }
            const hex_formatted = hslToHex({ ...rest })
            return { ...rest, hex: hex_formatted }
          })
        }}
      />

      {/* Hex Input */}
      <div className="relative h-fit w-full">
        <div className="absolute inset-y-0 flex items-center px-[5px]">
          <HashtagIcon className="text-muted-foreground size-4" />
        </div>
        <input
          id="color-value"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-2 text-sm focus:ring-1 focus:outline-none",
            "pl-[26px] pr-[38px]",
            "bg-muted/50 text-foreground",
            "border-border",
            "hover:border-border/80",
            "focus:border-ring focus:ring-ring",
            "selection:bg-primary/20 selection:text-primary",
            disabled && "pointer-events-none opacity-50"
          )}
          value={color.hex}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            handleHexInputChange(e.target.value)
          }}
        />
        <div className="absolute inset-y-0 right-0 flex h-full items-center px-[5px]">
          <div
            className="size-7 rounded-md border border-zinc-200 dark:border-zinc-800"
            style={{
              backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Color Picker Component (Exported)
// ============================================================================

export function ColorPicker({
  label,
  description,
  value,
  defaultValue,
  onChange,
  disabled = false,
}: ColorPickerProps) {
  // Parse the incoming hex value to HSL + hex state
  const parseColor = useCallback((hexValue: string): Color => {
    const cleanHex = sanitizeHex(hexValue.replace("#", ""))
    const paddedHex = cleanHex.padEnd(6, "0")
    const hsl = hexToHsl({ hex: paddedHex })
    return { ...hsl, hex: paddedHex }
  }, [])

  const [color, setColor] = useState<Color>(() => parseColor(value))
  const [isOpen, setIsOpen] = useState(false)

  // Sync color state when value prop changes externally
  useEffect(() => {
    const newColor = parseColor(value)
    setColor(newColor)
  }, [value, parseColor])

  // Propagate color changes to parent
  useEffect(() => {
    if (color.hex.length === 6) {
      const hexWithHash = `#${color.hex}`
      if (hexWithHash.toUpperCase() !== value.toUpperCase()) {
        onChange(hexWithHash)
      }
    }
  }, [color.hex, onChange, value])

  // Handle reset to default
  const handleReset = useCallback(() => {
    const defaultColor = parseColor(defaultValue)
    setColor(defaultColor)
    onChange(defaultValue)
  }, [defaultValue, onChange, parseColor])

  const isModified = value.toUpperCase() !== defaultValue.toUpperCase()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
        {isModified && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
          >
            <ArrowCounterClockwise className="mr-1 size-3" />
            Reset
          </Button>
        )}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
              "border-border hover:border-border/80 hover:bg-muted/30",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            {/* Color swatch */}
            <div
              className="size-8 shrink-0 rounded-md border shadow-sm"
              style={{ backgroundColor: `#${color.hex}` }}
            />
            {/* Hex value */}
            <span className="text-muted-foreground font-mono text-sm">
              #{color.hex}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-4"
          align="start"
          sideOffset={8}
        >
          <ColorPickerPanel
            color={color}
            setColor={setColor}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
