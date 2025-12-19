"use client";

/**
 * Google Calendar & Contacts Tool UI
 *
 * Rich visual display for calendar events and contacts.
 * Shows compact status for simple operations and visual cards for list results.
 */

import { useState } from "react";
import {
    AlertCircle,
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    ExternalLink,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    Trash2,
    User,
    Users,
} from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { cn } from "@/lib/utils";
import { ToolIcon } from "./tool-icon";

// ============================================================================
// Types
// ============================================================================

interface GoogleCalendarContactsToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

interface CalendarEvent {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
    attendees?: Array<{ email: string; responseStatus?: string }>;
}

interface Contact {
    resourceName?: string;
    names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
    phoneNumbers?: Array<{ value?: string }>;
    organizations?: Array<{ name?: string; title?: string }>;
    photos?: Array<{ url?: string }>;
}

interface FreeBusyBlock {
    start: string;
    end: string;
}

// ============================================================================
// Date/Time Formatting
// ============================================================================

function formatEventTime(event: CalendarEvent): string {
    const startDateTime = event.start?.dateTime;
    const startDate = event.start?.date;

    if (startDateTime) {
        const start = new Date(startDateTime);
        const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;

        const dateStr = start.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });

        const startTime = start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });

        if (end) {
            const endTime = end.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
            });
            // Same day
            if (start.toDateString() === end.toDateString()) {
                return `${dateStr} · ${startTime} – ${endTime}`;
            }
            // Multi-day
            const endDateStr = end.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
            });
            return `${dateStr} ${startTime} – ${endDateStr} ${endTime}`;
        }

        return `${dateStr} · ${startTime}`;
    }

    // All-day event
    if (startDate) {
        const date = new Date(startDate + "T00:00:00");
        return (
            date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
            }) + " (all day)"
        );
    }

    return "Date TBD";
}

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Compact event card for list display
 */
function EventCard({ event }: { event: CalendarEvent }) {
    const timeStr = formatEventTime(event);
    const hasLink = Boolean(event.htmlLink);

    return (
        <div className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate font-medium text-foreground">
                        {event.summary || "Untitled Event"}
                    </h4>
                    {hasLink && (
                        <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                            aria-label={`Open "${event.summary || "event"}" in Google Calendar`}
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {timeStr}
                    </span>
                    {event.location && (
                        <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{event.location}</span>
                        </span>
                    )}
                </div>
                {event.attendees && event.attendees.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>
                            {event.attendees.length} attendee
                            {event.attendees.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Compact contact card for list display
 */
function ContactCard({ contact }: { contact: Contact }) {
    const name =
        contact.names?.[0]?.displayName ||
        [contact.names?.[0]?.givenName, contact.names?.[0]?.familyName]
            .filter(Boolean)
            .join(" ") ||
        "Unknown";
    const email = contact.emailAddresses?.[0]?.value;
    const phone = contact.phoneNumbers?.[0]?.value;
    const org = contact.organizations?.[0];
    const photoUrl = contact.photos?.[0]?.url;

    // Generate initials for avatar
    const initials = name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();

    return (
        <div className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
            {/* Avatar */}
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30">
                {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-violet-300">
                        {initials || <User className="h-5 w-5" />}
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-foreground">{name}</h4>
                {org && (
                    <p className="truncate text-sm text-muted-foreground">
                        {org.title && org.name
                            ? `${org.title} at ${org.name}`
                            : org.title || org.name}
                    </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {email && (
                        <a
                            href={`mailto:${email}`}
                            aria-label={`Email ${name} at ${email}`}
                            className="flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                        >
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{email}</span>
                        </a>
                    )}
                    {phone && (
                        <a
                            href={`tel:${phone}`}
                            aria-label={`Call ${name} at ${phone}`}
                            className="flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                        >
                            <Phone className="h-3.5 w-3.5" />
                            <span>{phone}</span>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Free/busy availability summary
 */
function FreeBusySummary({
    calendars,
    timeMin,
    timeMax,
}: {
    calendars: Record<string, { busy: FreeBusyBlock[] }>;
    timeMin?: string;
    timeMax?: string;
}) {
    const calendarIds = Object.keys(calendars);

    // Count total busy blocks across all calendars
    const totalBusyBlocks = calendarIds.reduce((sum, id) => {
        return sum + (calendars[id]?.busy?.length || 0);
    }, 0);

    const dateRange =
        timeMin && timeMax
            ? `${formatRelativeDate(timeMin)} to ${formatRelativeDate(timeMax)}`
            : "the requested period";

    return (
        <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">
                    Checked availability for {calendarIds.length} calendar
                    {calendarIds.length !== 1 ? "s" : ""}
                </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
                {totalBusyBlocks === 0
                    ? `Completely free during ${dateRange}`
                    : `Found ${totalBusyBlocks} busy block${totalBusyBlocks !== 1 ? "s" : ""} during ${dateRange}`}
            </p>
        </div>
    );
}

/**
 * Event creation/update confirmation
 */
function EventConfirmation({
    event,
    action,
}: {
    event: CalendarEvent;
    action: "created" | "updated" | "deleted";
}) {
    const actionText =
        action === "created"
            ? "Event created"
            : action === "updated"
              ? "Event updated"
              : "Event deleted";

    const actionIcon =
        action === "created" ? Plus : action === "deleted" ? Trash2 : Calendar;

    const ActionIcon = actionIcon;

    if (action === "deleted") {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ActionIcon className="h-4 w-4" />
                <span>{actionText}</span>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
                <ActionIcon className="h-4 w-4 text-green-400" />
                <span className="font-medium">{actionText}</span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
                <div className="font-medium text-foreground">
                    {event.summary || "Untitled Event"}
                </div>
                <div className="text-muted-foreground">{formatEventTime(event)}</div>
                {event.location && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                    </div>
                )}
                {event.htmlLink && (
                    <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open in Google Calendar
                    </a>
                )}
            </div>
        </div>
    );
}

/**
 * Contact creation/update confirmation
 */
function ContactConfirmation({
    contact,
    action,
}: {
    contact: Contact;
    action: "created" | "updated";
}) {
    const name =
        contact.names?.[0]?.displayName ||
        [contact.names?.[0]?.givenName, contact.names?.[0]?.familyName]
            .filter(Boolean)
            .join(" ") ||
        "Contact";

    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 text-green-400" />
            <span>
                {action === "created" ? "Created" : "Updated"} contact: {name}
            </span>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Google Calendar & Contacts tool result display.
 *
 * Shows compact status for simple operations, rich visual cards for lists.
 */
export function GoogleCalendarContactsToolResult({
    status,
    action,
    input,
    output,
    error,
}: GoogleCalendarContactsToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <ToolIcon
                    toolName="google-calendar-contacts"
                    className="h-3.5 w-3.5 animate-pulse"
                />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Google operation failed`}</span>
            </div>
        );
    }

    // Success - render based on action type
    const content = renderOutput(action, input, output);
    const summary = getStatusMessage(action, input, "completed", output);
    const hasRichContent = content !== null;

    // For rich content, show it directly
    if (hasRichContent) {
        return (
            <div className="py-2">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <ToolIcon
                        toolName="google-calendar-contacts"
                        className="h-3.5 w-3.5"
                    />
                    <span>{summary}</span>
                </div>
                {content}
            </div>
        );
    }

    // For simple operations, show compact with optional expansion
    return (
        <div className="py-1">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ToolIcon toolName="google-calendar-contacts" className="h-3.5 w-3.5" />
                <span className="flex-1">{summary}</span>
                {output &&
                    (expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    ))}
            </button>

            {expanded && output && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
        </div>
    );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Render rich output for specific action types
 */
function renderOutput(
    action: string,
    input: Record<string, unknown>,
    output?: Record<string, unknown>
): React.ReactNode | null {
    if (!output) return null;

    switch (action) {
        // Event list operations
        case "list_events":
        case "search_events": {
            const events = (output.events ?? output.items ?? []) as CalendarEvent[];
            if (events.length === 0) return null;

            return (
                <div className="space-y-2">
                    {events.slice(0, 5).map((event, idx) => (
                        <EventCard key={event.id || idx} event={event} />
                    ))}
                    {events.length > 5 && (
                        <p className="text-center text-xs text-muted-foreground">
                            + {events.length - 5} more events
                        </p>
                    )}
                </div>
            );
        }

        // Event CRUD operations
        case "create_event":
            return (
                <EventConfirmation event={output as CalendarEvent} action="created" />
            );

        case "update_event":
            return (
                <EventConfirmation event={output as CalendarEvent} action="updated" />
            );

        case "delete_event":
            return <EventConfirmation event={{} as CalendarEvent} action="deleted" />;

        // Free/busy
        case "get_freebusy": {
            const calendars = output.calendars as
                | Record<string, { busy: FreeBusyBlock[] }>
                | undefined;
            if (!calendars) return null;
            return (
                <FreeBusySummary
                    calendars={calendars}
                    timeMin={input.timeMin as string}
                    timeMax={input.timeMax as string}
                />
            );
        }

        // Contact list operations
        case "list_contacts":
        case "search_contacts": {
            const contacts = (output.contacts ??
                output.connections ??
                output.results ??
                []) as Contact[];
            if (contacts.length === 0) return null;

            return (
                <div className="space-y-2">
                    {contacts.slice(0, 5).map((contact, idx) => (
                        <ContactCard
                            key={contact.resourceName || idx}
                            contact={contact}
                        />
                    ))}
                    {contacts.length > 5 && (
                        <p className="text-center text-xs text-muted-foreground">
                            + {contacts.length - 5} more contacts
                        </p>
                    )}
                </div>
            );
        }

        // Single contact
        case "get_contact": {
            const contact = output as Contact;
            if (!contact.names && !contact.emailAddresses) return null;
            return <ContactCard contact={contact} />;
        }

        // Contact CRUD
        case "create_contact":
            return <ContactConfirmation contact={output as Contact} action="created" />;

        case "update_contact":
            return <ContactConfirmation contact={output as Contact} action="updated" />;

        default:
            return null;
    }
}

/**
 * Generate human-readable status message based on action and result
 */
function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        // Calendar operations
        case "list_accounts":
            return isRunning ? "Loading accounts..." : "Accounts loaded";

        case "list_calendars":
            return isRunning ? "Loading calendars..." : "Calendars loaded";

        case "list_events": {
            if (isRunning) return "Fetching events...";
            const count = ((output?.events ?? output?.items) as unknown[])?.length ?? 0;
            return `Found ${count} event${count !== 1 ? "s" : ""}`;
        }

        case "search_events": {
            const query = input.query as string;
            if (isRunning) return `Searching "${query}"...`;
            const count = ((output?.events ?? output?.items) as unknown[])?.length ?? 0;
            return `Found ${count} event${count !== 1 ? "s" : ""} for "${query}"`;
        }

        case "create_event": {
            if (isRunning) return "Creating event...";
            const summary = (output?.summary as string) || "event";
            return `Created "${truncate(summary, 30)}"`;
        }

        case "update_event":
            return isRunning ? "Updating event..." : "Event updated";

        case "delete_event":
            return isRunning ? "Deleting event..." : "Event deleted";

        case "get_freebusy":
            return isRunning ? "Checking availability..." : "Availability checked";

        // Contact operations
        case "list_contacts": {
            if (isRunning) return "Loading contacts...";
            const count =
                ((output?.contacts ?? output?.connections) as unknown[])?.length ?? 0;
            return `Found ${count} contact${count !== 1 ? "s" : ""}`;
        }

        case "search_contacts": {
            const query = input.query as string;
            if (isRunning) return `Searching "${query}"...`;
            const count =
                (
                    (output?.contacts ??
                        output?.connections ??
                        output?.results) as unknown[]
                )?.length ?? 0;
            return `Found ${count} contact${count !== 1 ? "s" : ""} for "${query}"`;
        }

        case "get_contact":
            return isRunning ? "Loading contact..." : "Contact loaded";

        case "create_contact": {
            if (isRunning) return "Creating contact...";
            const givenName = input.givenName as string;
            const familyName = input.familyName as string;
            const name = [givenName, familyName].filter(Boolean).join(" ") || "contact";
            return `Created ${name}`;
        }

        case "update_contact":
            return isRunning ? "Updating contact..." : "Contact updated";

        case "raw_api":
            return isRunning ? "Executing API request..." : "API request completed";

        case "describe":
            return isRunning
                ? "Loading capabilities..."
                : "Google Calendar & Contacts ready";

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
