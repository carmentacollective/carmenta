"use client";

/**
 * SteppedSlider - Variant 2 style slider with emoji icons
 *
 * Features:
 * - Segment-based track between circles (no line going under bubbles)
 * - 5 preset levels with emoji indicators
 * - Two modes: position (no fill) vs progress (fill builds up)
 * - Compact design suitable for popovers
 * - Haptic feedback on selection changes
 */

import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

interface SteppedSliderProps {
    /** Current selected index */
    value: number;
    /** Callback when value changes */
    onChange: (index: number) => void;
    /** Presets with label and emoji */
    presets: readonly { label: string; emoji: string }[];
    /** Color theme */
    theme?: "primary" | "secondary";
    /** Label for the slider */
    label: string;
    /** Whether the slider is disabled */
    disabled?: boolean;
    /**
     * Progress mode: fills segments up to selection (for "building" values like Reasoning)
     * Position mode (default): no fill, just shows selection point (for spectrum values like Creativity)
     */
    progressMode?: boolean;
}

export function SteppedSlider({
    value,
    onChange,
    presets,
    theme = "primary",
    label,
    disabled,
    progressMode = false,
}: SteppedSliderProps) {
    const isPrimary = theme === "primary";
    const { trigger: triggerHaptic } = useHapticFeedback();

    const handleChange = (index: number) => {
        if (index !== value) {
            triggerHaptic();
            onChange(index);
        }
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-foreground/60">
                    {label}
                </label>
                <span
                    className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        isPrimary
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-secondary-foreground"
                    )}
                >
                    {presets[value].emoji} {presets[value].label}
                </span>
            </div>
            <div className="flex items-center">
                {presets.map((preset, i) => {
                    const isSelected = i === value;
                    const isBeforeSelected = i < value;
                    const isLast = i === presets.length - 1;

                    // In progress mode, circles before selection are "active"
                    // In position mode, only the selected circle is highlighted
                    const isActive = progressMode ? i <= value : isSelected;

                    return (
                        <div key={i} className="flex flex-1 items-center">
                            <button
                                onClick={() => handleChange(i)}
                                disabled={disabled}
                                className="group flex flex-col items-center"
                            >
                                <div
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                                        isSelected
                                            ? isPrimary
                                                ? "scale-110 border-primary bg-primary shadow-md"
                                                : "scale-110 border-secondary bg-secondary shadow-md"
                                            : isActive && progressMode
                                              ? isPrimary
                                                  ? "border-primary/40 bg-primary/10"
                                                  : "border-secondary/40 bg-secondary/10"
                                              : "border-foreground/10 bg-background group-hover:border-foreground/20",
                                        disabled && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "text-sm transition-transform",
                                            isSelected && "scale-110"
                                        )}
                                    >
                                        {preset.emoji}
                                    </span>
                                </div>
                                <span
                                    className={cn(
                                        "mt-1.5 text-[9px] transition-colors",
                                        isSelected
                                            ? isPrimary
                                                ? "font-semibold text-primary"
                                                : "font-semibold text-secondary-foreground"
                                            : "text-foreground/30"
                                    )}
                                >
                                    {preset.label}
                                </span>
                            </button>

                            {/* Connecting segment between circles */}
                            {!isLast && (
                                <div className="mx-1 h-0.5 flex-1 rounded-full bg-foreground/10">
                                    {progressMode && (
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                isPrimary
                                                    ? "bg-primary/60"
                                                    : "bg-secondary/60",
                                                isBeforeSelected ? "w-full" : "w-0"
                                            )}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
