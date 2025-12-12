"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Undo2 } from "lucide-react";
import type { ServiceDefinition } from "@/lib/integrations/services";

export interface UndoToastProps {
    /** Service that was disconnected */
    service: ServiceDefinition | null;
    /** Account ID that was disconnected */
    accountId?: string;
    /** Callback when undo is clicked */
    onUndo: () => void;
    /** Whether the toast is visible */
    visible: boolean;
}

/**
 * Undo toast for disconnect actions.
 * Shows briefly after disconnect with option to undo.
 * Auto-dismisses after 5 seconds if not undone.
 */
export function UndoToast({ service, onUndo, visible }: UndoToastProps) {
    return (
        <AnimatePresence>
            {visible && service && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
                >
                    <div className="flex items-center gap-4 rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-2xl dark:bg-zinc-800">
                        <p className="text-sm">{service.name} disconnected</p>
                        <button
                            onClick={onUndo}
                            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
