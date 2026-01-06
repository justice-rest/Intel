"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowCounterClockwise } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { isValidHexColor, getContrastColor } from "@/lib/pdf-branding"

interface ColorPickerProps {
  label: string
  description?: string
  value: string
  defaultValue: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function ColorPicker({
  label,
  description,
  value,
  defaultValue,
  onChange,
  disabled = false,
}: ColorPickerProps) {
  // Local state for the text input (allows typing invalid values temporarily)
  const [inputValue, setInputValue] = useState(value)
  const [isInputValid, setIsInputValid] = useState(true)

  // Sync input value when prop changes
  useEffect(() => {
    setInputValue(value)
    setIsInputValid(isValidHexColor(value))
  }, [value])

  // Handle color picker change (always valid)
  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value.toUpperCase()
      setInputValue(color)
      setIsInputValid(true)
      onChange(color)
    },
    [onChange]
  )

  // Handle text input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let color = e.target.value.toUpperCase()

      // Add # if missing and user typed something
      if (color && !color.startsWith("#")) {
        color = `#${color}`
      }

      setInputValue(color)

      // Validate and propagate if valid
      if (isValidHexColor(color)) {
        setIsInputValid(true)
        onChange(color)
      } else {
        setIsInputValid(false)
      }
    },
    [onChange]
  )

  // Handle blur - reset to last valid value if invalid
  const handleBlur = useCallback(() => {
    if (!isInputValid) {
      setInputValue(value)
      setIsInputValid(true)
    }
  }, [isInputValid, value])

  // Handle reset to default
  const handleReset = useCallback(() => {
    setInputValue(defaultValue)
    setIsInputValid(true)
    onChange(defaultValue)
  }, [defaultValue, onChange])

  const isModified = value !== defaultValue
  const contrastColor = getContrastColor(value)

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

      <div className="flex items-center gap-3">
        {/* Color preview swatch with picker */}
        <div className="relative">
          <div
            className={cn(
              "size-10 rounded-md border shadow-sm transition-colors",
              disabled && "opacity-50"
            )}
            style={{ backgroundColor: value }}
          >
            {/* Color picker input (invisible, overlays the swatch) */}
            <input
              type="color"
              value={value}
              onChange={handleColorPickerChange}
              disabled={disabled}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              title="Click to pick a color"
            />
            {/* Show current color value in center for visual feedback */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[8px] font-medium opacity-0 hover:opacity-100 transition-opacity"
              style={{ color: contrastColor }}
            >
              Pick
            </span>
          </div>
        </div>

        {/* Hex input */}
        <div className="relative flex-1">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="#000000"
            maxLength={7}
            className={cn(
              "font-mono text-sm uppercase",
              !isInputValid && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {!isInputValid && (
            <p className="text-destructive absolute -bottom-5 left-0 text-xs">
              Invalid hex color
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
