"use client";

/**
 * Activity Feed
 *
 * Shows recent knowledge base changes from the Knowledge Librarian.
 * Displays notifications about created, updated, and moved documents.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell,
    FileText,
    PenSquare,
    ArrowRight,
    Sparkles,
    X,
    Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
    id: string;
    type: "knowledge_created" | "knowledge_updated" | "knowledge_moved" | "insight";
    message: string;
    documentPath: string | null;
    read: boolean;
    createdAt: Date;
}

interface ActivityFeedProps {
    initialItems: ActivityItem[];
    onItemClick?: (documentPath: string) => void;
}

const typeIcons = {
    knowledge_created: FileText,
    knowledge_updated: PenSquare,
    knowledge_moved: ArrowRight,
    insight: Sparkles,
};

const typeColors = {
    knowledge_created: "text-emerald-500",
    knowledge_updated: "text-blue-500",
    knowledge_moved: "text-purple-500",
    insight: "text-amber-500",
};

export function ActivityFeed({ initialItems, onItemClick }: ActivityFeedProps) {
    const [items, setItems] = useState<ActivityItem[]>(initialItems);
    const [isExpanded, setIsExpanded] = useState(false);

    const unreadCount = items.filter((item) => !item.read).length;

    // Mark item as read when clicked
    const handleItemClick = useCallback(
        async (item: ActivityItem) => {
            if (!item.read) {
                // Optimistic update
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? { ...i, read: true } : i))
                );

                // Call server action to mark as read
                try {
                    await fetch("/api/notifications/mark-read", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notificationId: item.id }),
                    });
                } catch {
                    // Revert on error
                    setItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, read: false } : i))
                    );
                }
            }

            if (item.documentPath && onItemClick) {
                onItemClick(item.documentPath);
            }
        },
        [onItemClick]
    );

    // Mark all as read
    const handleMarkAllRead = useCallback(async () => {
        const unreadIds = items.filter((i) => !i.read).map((i) => i.id);
        if (unreadIds.length === 0) return;

        // Optimistic update
        setItems((prev) => prev.map((i) => ({ ...i, read: true })));

        try {
            await fetch("/api/notifications/mark-all-read", { method: "POST" });
        } catch {
            // Revert on error - refetch would be better but this is simpler
            setItems(initialItems);
        }
    }, [items, initialItems]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div className="relative">
            {/* Collapsed state - notification bell */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full",
                    "bg-foreground/5 text-foreground/60 transition-colors",
                    "hover:bg-foreground/10 hover:text-foreground"
                )}
                aria-label={`${unreadCount} unread notifications`}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Expanded state - activity list */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className={cn(
                            "absolute right-0 top-12 z-modal w-80",
                            "rounded-xl border border-foreground/10 bg-background",
                            "shadow-lg shadow-black/10"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-foreground/5 px-4 py-3">
                            <h3 className="text-sm font-medium text-foreground">
                                Recent Activity
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
                                    >
                                        <Check className="h-3 w-3" />
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="rounded-md p-1 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Items list */}
                        <div className="max-h-80 overflow-y-auto">
                            {items.map((item) => {
                                const Icon = typeIcons[item.type];
                                const iconColor = typeColors[item.type];

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={cn(
                                            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                                            "border-b border-foreground/5 last:border-b-0",
                                            "hover:bg-foreground/5",
                                            !item.read && "bg-primary/5"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                                                "bg-foreground/5"
                                            )}
                                        >
                                            <Icon
                                                className={cn("h-3.5 w-3.5", iconColor)}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={cn(
                                                    "text-sm",
                                                    item.read
                                                        ? "text-foreground/70"
                                                        : "text-foreground"
                                                )}
                                            >
                                                {item.message}
                                            </p>
                                            <p className="mt-0.5 text-xs text-foreground/40">
                                                {formatDistanceToNow(
                                                    new Date(item.createdAt),
                                                    {
                                                        addSuffix: true,
                                                    }
                                                )}
                                            </p>
                                        </div>
                                        {!item.read && (
                                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
