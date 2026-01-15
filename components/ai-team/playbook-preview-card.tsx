"use client";

/**
 * PlaybookPreviewCard
 *
 * Displays the extracted automation playbook from the hire wizard.
 * Shows name, schedule, and description with a "Hire This Team Member" button.
 * Used inside the CarmentaSidecar auxiliary content slot.
 */

import { motion } from "framer-motion";
import { ClockIcon, CheckCircleIcon, SparkleIcon } from "@phosphor-icons/react";

import type { Playbook } from "@/components/connection";

interface PlaybookPreviewCardProps {
    playbook: Playbook;
    onHire: () => void;
    isHiring: boolean;
}

export function PlaybookPreviewCard({
    playbook,
    onHire,
    isHiring,
}: PlaybookPreviewCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-foreground/10 bg-foreground/[0.02] rounded-xl border p-4"
        >
            <div className="mb-4 flex items-center gap-2">
                <CheckCircleIcon className="text-primary h-5 w-5" weight="duotone" />
                <h3 className="text-foreground font-medium">Ready to Hire</h3>
            </div>

            <div className="space-y-3">
                <div>
                    <p className="text-foreground/60 text-xs tracking-wide uppercase">
                        Name
                    </p>
                    <p className="text-foreground font-medium">{playbook.name}</p>
                </div>

                <div>
                    <p className="text-foreground/60 text-xs tracking-wide uppercase">
                        Schedule
                    </p>
                    <div className="text-foreground flex items-center gap-2 text-sm">
                        <ClockIcon className="h-4 w-4" />
                        <span>{playbook.schedule.displayText}</span>
                    </div>
                </div>

                {playbook.description && (
                    <div>
                        <p className="text-foreground/60 text-xs tracking-wide uppercase">
                            What it does
                        </p>
                        <p className="text-foreground/80 text-sm">
                            {playbook.description}
                        </p>
                    </div>
                )}
            </div>

            <button
                onClick={onHire}
                disabled={isHiring}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-medium transition-colors disabled:opacity-50"
            >
                {isHiring ? (
                    <>
                        <SparkleIcon className="h-4 w-4 animate-pulse" />
                        Setting up...
                    </>
                ) : (
                    <>
                        <CheckCircleIcon className="h-4 w-4" />
                        Hire This Team Member
                    </>
                )}
            </button>
        </motion.div>
    );
}
