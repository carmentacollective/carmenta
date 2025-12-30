"use client";

/**
 * CodeModeActivity - Real-time tool activity display for code mode
 *
 * Displays transient messages as inline activity items during streaming.
 * This replaces the pill-based TransientStatus for code mode, showing
 * what tools are executing in real-time.
 *
 * Uses the transient message system which streams tool status updates
 * from the server as they happen.
 */

import { useMemo, createElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Terminal,
    FileText,
    FilePen,
    FileEdit,
    FolderSearch,
    FileSearch,
    Bot,
    ListTodo,
    Code,
    Globe,
    Search,
    Loader2,
    type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useTransientChat } from "@/lib/streaming";
import type { TransientMessage } from "@/lib/streaming";

/**
 * Get icon for a tool based on the transient message icon or text
 */
function getToolIcon(message: TransientMessage) {
    // First check for icon emoji and map to Lucide
    const iconMap: Record<string, typeof Terminal> = {
        "💻": Terminal,
        "📖": FileText,
        "✏️": FilePen,
        "📝": FileEdit,
        "📁": FolderSearch,
        "🔍": FileSearch,
        "🤖": Bot,
        "📋": ListTodo,
        "🧠": Code,
        "🌐": Globe,
        "🔎": Search,
    };

    if (message.icon && iconMap[message.icon]) {
        return iconMap[message.icon];
    }

    // Try to extract tool name from message text
    const text = message.text.toLowerCase();
    if (text.includes("bash") || text.includes("command") || text.includes("running")) {
        return Terminal;
    }
    if (text.includes("read")) {
        return FileText;
    }
    if (text.includes("write") || text.includes("writing")) {
        return FilePen;
    }
    if (text.includes("edit")) {
        return FileEdit;
    }
    if (text.includes("glob") || text.includes("find")) {
        return FolderSearch;
    }
    if (text.includes("grep") || text.includes("search")) {
        return FileSearch;
    }
    if (text.includes("agent") || text.includes("task") || text.includes("spawn")) {
        return Bot;
    }
    if (text.includes("todo")) {
        return ListTodo;
    }
    if (text.includes("fetch") || text.includes("web")) {
        return Globe;
    }

    // Default
    return Loader2;
}

/**
 * Extract tool name from transient message
 */
function getToolName(message: TransientMessage): string {
    const text = message.text;

    // Common patterns: "Running Bash...", "Reading file.ts...", etc.
    const patterns = [
        /^(Reading|Writing|Editing|Running|Finding|Searching|Spawning|Fetching)\s+(\S+)/i,
        /^(\w+)\s*:/,
        /^(Bash|Read|Write|Edit|Glob|Grep|Task|WebFetch)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }

    // Fallback: first word
    return text.split(/\s+/)[0] || "Working";
}

/**
 * Tool icon component - uses createElement to avoid static-components lint rule
 */
function ToolIconDisplay({ message }: { message: TransientMessage }) {
    const icon = getToolIcon(message);
    return createElement(icon, {
        className: cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/70", "animate-pulse"),
    });
}

/**
 * Single activity item
 */
function ActivityItem({ message }: { message: TransientMessage }) {
    const toolName = getToolName(message);

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className={cn("flex items-center gap-2 px-2 py-1.5", "text-sm")}
        >
            {/* Status indicator - pulsing amber */}
            <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>

            {/* Tool icon */}
            <ToolIconDisplay message={message} />

            {/* Tool name */}
            <span className="shrink-0 font-medium text-foreground/80">{toolName}</span>

            {/* Full message text - truncated */}
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground/60">
                {message.text}
            </span>

            {/* Progress bar if available */}
            {message.progress !== undefined && (
                <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-700">
                    <motion.div
                        className="h-full bg-amber-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${message.progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            )}
        </motion.div>
    );
}

interface CodeModeActivityProps {
    className?: string;
}

/**
 * Code mode activity display
 * Shows transient messages as inline activity items during streaming
 */
export function CodeModeActivity({ className }: CodeModeActivityProps) {
    const transientMessages = useTransientChat();

    // Filter out empty messages
    const activeMessages = useMemo(
        () => transientMessages.filter((msg) => msg.text.trim().length > 0),
        [transientMessages]
    );

    if (activeMessages.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "rounded-lg border border-foreground/10 bg-black/30 backdrop-blur-sm",
                "overflow-hidden",
                className
            )}
        >
            <AnimatePresence mode="popLayout">
                {activeMessages.map((message) => (
                    <ActivityItem key={message.id} message={message} />
                ))}
            </AnimatePresence>
        </div>
    );
}
