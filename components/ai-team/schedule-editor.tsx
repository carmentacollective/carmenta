"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Edit3, Check, X, ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    getTimezoneAbbreviation,
    generateDisplayTextFromCron,
    SCHEDULE_PRESETS,
    type SchedulePreset,
} from "@/lib/schedule/utils";

interface ScheduleEditorProps {
    /** Current cron expression */
    scheduleCron: string;
    /** Human-readable display text (may be null for legacy jobs) */
    scheduleDisplayText: string | null;
    /** IANA timezone string */
    timezone: string;
    /** Called when schedule changes */
    onScheduleChange: (schedule: {
        cron: string;
        displayText: string;
        timezone: string;
    }) => void;
    /** Show raw cron (for developer mode) */
    showCron?: boolean;
}

/**
 * ScheduleEditor - Human-friendly schedule editing
 *
 * Shows schedule in readable format with:
 * - Quick presets (Every morning, Weekdays, etc.)
 * - Natural language input for custom schedules
 * - Compact timezone display
 * - Developer mode cron visibility
 */
export function ScheduleEditor({
    scheduleCron,
    scheduleDisplayText,
    timezone,
    onScheduleChange,
    showCron = false,
}: ScheduleEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isParsingSchedule, setIsParsingSchedule] = useState(false);
    const [naturalInput, setNaturalInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
    const timezoneDropdownRef = useRef<HTMLDivElement>(null);

    // Get display text - use stored value or generate from cron
    const displayText =
        scheduleDisplayText || generateDisplayTextFromCron(scheduleCron, timezone);
    const tzAbbr = getTimezoneAbbreviation(timezone);

    // Click-outside handler for timezone dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                timezoneDropdownRef.current &&
                !timezoneDropdownRef.current.contains(event.target as Node)
            ) {
                setShowTimezoneDropdown(false);
            }
        }

        if (showTimezoneDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showTimezoneDropdown]);

    const handlePresetSelect = useCallback(
        (preset: SchedulePreset) => {
            const tz = getTimezoneAbbreviation(timezone);
            const displayWithTz =
                timezone === "UTC" ? preset.displayText : `${preset.displayText} ${tz}`;

            onScheduleChange({
                cron: preset.cron,
                displayText: displayWithTz,
                timezone,
            });
            setIsEditing(false);
            setError(null);
        },
        [timezone, onScheduleChange]
    );

    const handleNaturalLanguageSubmit = useCallback(async () => {
        if (!naturalInput.trim()) {
            setError("Please enter a schedule description");
            return;
        }

        setIsParsingSchedule(true);
        setError(null);

        try {
            const response = await fetch("/api/schedule/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: naturalInput.trim(),
                    currentTimezone: timezone,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to parse schedule");
            }

            const {
                cron,
                displayText: newDisplayText,
                timezone: newTimezone,
            } = await response.json();

            onScheduleChange({
                cron,
                displayText: newDisplayText,
                timezone: newTimezone || timezone,
            });
            setIsEditing(false);
            setNaturalInput("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to parse schedule");
        } finally {
            setIsParsingSchedule(false);
        }
    }, [naturalInput, timezone, onScheduleChange]);

    const handleTimezoneChange = useCallback(
        (newTimezone: string) => {
            // Regenerate display text for the new timezone
            const newDisplayText = generateDisplayTextFromCron(
                scheduleCron,
                newTimezone
            );

            onScheduleChange({
                cron: scheduleCron,
                displayText: newDisplayText,
                timezone: newTimezone,
            });
            setShowTimezoneDropdown(false);
        },
        [scheduleCron, onScheduleChange]
    );

    // Common timezones for dropdown
    const timezones = [
        { value: "UTC", label: "UTC" },
        { value: "America/New_York", label: "Eastern (ET)" },
        { value: "America/Chicago", label: "Central (CT)" },
        { value: "America/Denver", label: "Mountain (MT)" },
        { value: "America/Los_Angeles", label: "Pacific (PT)" },
        { value: "America/Phoenix", label: "Arizona (MST)" },
        { value: "Europe/London", label: "London (GMT/BST)" },
        { value: "Europe/Paris", label: "Paris (CET)" },
        { value: "Asia/Tokyo", label: "Tokyo (JST)" },
        { value: "Australia/Sydney", label: "Sydney (AEST)" },
    ];

    return (
        <div className="space-y-2">
            <label className="text-foreground/70 text-sm font-medium">Schedule</label>

            {!isEditing ? (
                // Display mode
                <div className="space-y-2">
                    <div className="border-foreground/10 bg-foreground/[0.02] flex items-center justify-between rounded-xl border px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Clock className="text-foreground/40 h-4 w-4" />
                            <span className="text-foreground">{displayText}</span>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-foreground/60 hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                        </button>
                    </div>

                    {/* Compact timezone - inline with option to change */}
                    <div className="relative" ref={timezoneDropdownRef}>
                        <button
                            onClick={() =>
                                setShowTimezoneDropdown(!showTimezoneDropdown)
                            }
                            className="text-foreground/50 hover:text-foreground/70 flex items-center gap-1 text-xs transition-colors"
                        >
                            Timezone: {tzAbbr}
                            <ChevronDown className="h-3 w-3" />
                        </button>

                        <AnimatePresence>
                            {showTimezoneDropdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="border-foreground/10 bg-background absolute top-6 left-0 z-10 w-48 rounded-lg border shadow-lg"
                                >
                                    {timezones.map((tz) => (
                                        <button
                                            key={tz.value}
                                            onClick={() =>
                                                handleTimezoneChange(tz.value)
                                            }
                                            className={cn(
                                                "hover:bg-foreground/5 w-full px-3 py-2 text-left text-sm",
                                                timezone === tz.value
                                                    ? "text-primary font-medium"
                                                    : "text-foreground/80"
                                            )}
                                        >
                                            {tz.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Developer mode: show cron */}
                    {showCron && (
                        <details className="text-foreground/40 text-xs">
                            <summary className="hover:text-foreground/60 cursor-pointer">
                                Technical details
                            </summary>
                            <code className="text-foreground/60 mt-1 block font-mono">
                                {scheduleCron}
                            </code>
                        </details>
                    )}
                </div>
            ) : (
                // Edit mode
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                >
                    {/* Presets */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {SCHEDULE_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handlePresetSelect(preset)}
                                className={cn(
                                    "border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5 rounded-lg border px-3 py-2 text-left transition-colors",
                                    scheduleCron === preset.cron &&
                                        "border-primary bg-primary/5"
                                )}
                            >
                                <div className="text-foreground text-sm font-medium">
                                    {preset.label}
                                </div>
                                <div className="text-foreground/50 text-xs">
                                    {preset.description}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Natural language input */}
                    <div className="space-y-2">
                        <p className="text-foreground/50 text-xs">
                            Or describe your schedule:
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={naturalInput}
                                onChange={(e) => setNaturalInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isParsingSchedule) {
                                        handleNaturalLanguageSubmit();
                                    }
                                }}
                                placeholder="e.g., every weekday at 8am Austin time"
                                className="border-foreground/10 bg-foreground/[0.02] text-foreground placeholder:text-foreground/40 focus:border-primary flex-1 rounded-lg border px-3 py-2 text-sm transition-colors outline-none"
                                disabled={isParsingSchedule}
                            />
                            <button
                                onClick={handleNaturalLanguageSubmit}
                                disabled={isParsingSchedule || !naturalInput.trim()}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                            >
                                {isParsingSchedule ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                            </button>
                        </div>

                        {error && <p className="text-xs text-red-500">{error}</p>}
                    </div>

                    {/* Cancel button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setNaturalInput("");
                                setError(null);
                            }}
                            className="text-foreground/60 hover:text-foreground flex items-center gap-1 text-sm transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
