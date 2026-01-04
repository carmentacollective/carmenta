/**
 * Schedule Display Utilities
 *
 * Helpers for displaying schedules in human-friendly format.
 */

/**
 * Get a short timezone abbreviation (e.g., "CT" for America/Chicago)
 */
export function getTimezoneAbbreviation(timezone: string): string {
    try {
        // Use Intl API to get the short timezone name
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            timeZoneName: "short",
        });
        const parts = formatter.formatToParts(new Date());
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        return tzPart?.value ?? timezone;
    } catch {
        // Fallback for invalid timezone
        return timezone;
    }
}

/**
 * Common schedule presets with human-readable names and cron expressions
 */
export interface SchedulePreset {
    id: string;
    label: string;
    description: string;
    cron: string;
    displayText: string;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
    {
        id: "every-morning",
        label: "Every morning",
        description: "Daily at 9am",
        cron: "0 9 * * *",
        displayText: "Every day at 9am",
    },
    {
        id: "weekday-mornings",
        label: "Weekday mornings",
        description: "Mon-Fri at 9am",
        cron: "0 9 * * 1-5",
        displayText: "Every weekday at 9am",
    },
    {
        id: "weekly-monday",
        label: "Weekly on Monday",
        description: "Every Monday at 9am",
        cron: "0 9 * * 1",
        displayText: "Every Monday at 9am",
    },
    {
        id: "monthly-first",
        label: "Monthly on the 1st",
        description: "First of each month at 9am",
        cron: "0 9 1 * *",
        displayText: "First of each month at 9am",
    },
    {
        id: "hourly",
        label: "Hourly",
        description: "Every hour on the hour",
        cron: "0 * * * *",
        displayText: "Every hour",
    },
    {
        id: "every-2-hours",
        label: "Every 2 hours",
        description: "Every 2 hours during the day",
        cron: "0 */2 * * *",
        displayText: "Every 2 hours",
    },
];

/**
 * Find a matching preset for a cron expression
 */
export function findMatchingPreset(cron: string): SchedulePreset | undefined {
    return SCHEDULE_PRESETS.find((preset) => preset.cron === cron);
}

/**
 * Generate a fallback display text from cron if we don't have one stored
 */
export function generateDisplayTextFromCron(cron: string, timezone: string): string {
    const preset = findMatchingPreset(cron);
    if (preset) {
        const tz = getTimezoneAbbreviation(timezone);
        // Add timezone if not UTC
        return timezone === "UTC" ? preset.displayText : `${preset.displayText} ${tz}`;
    }

    // For non-preset crons, try to describe them simply
    const parts = cron.split(" ");
    if (parts.length !== 5) return cron;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const tz = getTimezoneAbbreviation(timezone);

    // Handle common patterns
    if (dayOfMonth === "*" && month === "*") {
        if (dayOfWeek === "*") {
            // Daily
            if (hour !== "*" && minute !== "*") {
                const h = parseInt(hour);
                const suffix = h >= 12 ? "pm" : "am";
                const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `Every day at ${displayHour}${suffix} ${tz}`;
            }
        } else if (dayOfWeek === "1-5") {
            // Weekdays
            if (hour !== "*" && minute !== "*") {
                const h = parseInt(hour);
                const suffix = h >= 12 ? "pm" : "am";
                const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `Weekdays at ${displayHour}${suffix} ${tz}`;
            }
        }
    }

    // Fallback to showing the cron with timezone
    return `${cron} (${tz})`;
}
