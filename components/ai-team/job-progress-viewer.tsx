"use client";

/**
 * Job Progress Viewer
 *
 * Displays live progress when "tapping in" to a running job.
 * Connects to the job stream endpoint via SSE and shows:
 * - Transient status messages (tool calls in progress)
 * - Streaming text output from the AI employee
 * - Completion/error states
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, AlertCircle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import type { TransientMessage } from "@/lib/streaming/types";
import { isTransientDataPart } from "@/lib/streaming/types";

interface JobProgressViewerProps {
    jobId: string;
    runId: string;
    jobName: string;
    onClose: () => void;
}

type StreamStatus = "connecting" | "streaming" | "completed" | "error" | "no-stream";

/**
 * Parse SSE data into structured events
 * SSE format: "data: {json}\n\n"
 */
function parseSSEEvent(data: string): unknown | null {
    if (!data.startsWith("data: ")) return null;
    const jsonStr = data.slice(6).trim();
    if (!jsonStr || jsonStr === "[DONE]") return null;
    try {
        return JSON.parse(jsonStr);
    } catch (error) {
        logger.debug({ jsonStr, error }, "Failed to parse SSE event");
        return null;
    }
}

export function JobProgressViewer({
    jobId,
    runId,
    jobName,
    onClose,
}: JobProgressViewerProps) {
    const [status, setStatus] = useState<StreamStatus>("connecting");
    const [transientMessages, setTransientMessages] = useState<
        Map<string, TransientMessage>
    >(new Map());
    const [textContent, setTextContent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const hasConnectedRef = useRef(false);

    // Auto-scroll to bottom when content updates
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [textContent, transientMessages]);

    // Handle incoming data parts
    const handleDataPart = useCallback((part: unknown) => {
        // Handle transient status messages
        if (isTransientDataPart(part)) {
            const message = part.data;
            if (!message.text) {
                // Empty text means clear the message
                setTransientMessages((prev) => {
                    const next = new Map(prev);
                    next.delete(part.id);
                    return next;
                });
            } else {
                setTransientMessages((prev) => {
                    const next = new Map(prev);
                    next.set(part.id, message);
                    return next;
                });
            }
            return;
        }

        // Handle text parts
        if (
            typeof part === "object" &&
            part !== null &&
            "type" in part &&
            (part as { type: string }).type === "text-delta"
        ) {
            const delta = (part as { textDelta?: string }).textDelta ?? "";
            setTextContent((prev) => prev + delta);
        }
    }, []);

    // Connect to stream (only once - jobId and runId don't change)
    useEffect(() => {
        const url = `/api/jobs/${jobId}/runs/${runId}/stream`;

        logger.info({ jobId, runId }, "Connecting to job stream");

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            logger.info({ jobId, runId }, "Stream connected");
            hasConnectedRef.current = true;
            setStatus("streaming");
        };

        eventSource.onmessage = (event) => {
            const parsed = parseSSEEvent(`data: ${event.data}`);
            if (parsed) {
                handleDataPart(parsed);
            }
        };

        eventSource.onerror = (event) => {
            // Check if this is a normal close (204 No Content)
            if (eventSource.readyState === EventSource.CLOSED) {
                // If we never connected, there was no stream
                if (!hasConnectedRef.current) {
                    setStatus("no-stream");
                } else {
                    setStatus("completed");
                }
            } else {
                logger.error({ jobId, runId, event }, "Stream error");
                setError("Connection lost");
                setStatus("error");
            }
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [jobId, runId, handleDataPart]);

    const activeTransients = Array.from(transientMessages.values());

    return (
        <div className="bg-background border-foreground/10 z-modal fixed inset-4 flex flex-col overflow-hidden rounded-2xl border shadow-xl md:inset-auto md:top-1/2 md:left-1/2 md:h-[80vh] md:max-h-[600px] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2">
            {/* Header */}
            <div className="border-foreground/10 flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-lg p-2">
                        {status === "streaming" ? (
                            <Sparkles className="text-primary h-4 w-4 animate-pulse" />
                        ) : status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : status === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                            <Sparkles className="text-foreground/50 h-4 w-4" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-foreground font-medium">{jobName}</h2>
                        <p className="text-foreground/60 text-xs">
                            {status === "connecting" && "Connecting..."}
                            {status === "streaming" && "Live view"}
                            {status === "completed" && "Completed"}
                            {status === "error" && "Connection lost"}
                            {status === "no-stream" && "Not running"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-foreground/60 hover:text-foreground rounded-lg p-2 transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Content */}
            <div ref={contentRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* No stream state */}
                {status === "no-stream" && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="text-foreground/30 mb-4 h-10 w-10" />
                        <p className="text-foreground/70">
                            This job isn't currently running.
                        </p>
                        <p className="text-foreground/50 mt-1 text-sm">
                            Check back when it's scheduled to run.
                        </p>
                    </div>
                )}

                {/* Streaming/completed content */}
                {(status === "streaming" || status === "completed") && (
                    <>
                        {/* Transient status messages */}
                        {activeTransients.length > 0 && (
                            <div className="space-y-2">
                                {activeTransients.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "bg-primary/10 text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                                            "animate-in fade-in slide-in-from-top-1 duration-200"
                                        )}
                                    >
                                        {msg.icon && <span>{msg.icon}</span>}
                                        <span>{msg.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Text output */}
                        {textContent && (
                            <div className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                                {textContent}
                            </div>
                        )}

                        {/* Empty state while streaming */}
                        {status === "streaming" &&
                            !textContent &&
                            activeTransients.length === 0 && (
                                <div className="flex items-center gap-2 py-8">
                                    <Sparkles className="text-primary h-4 w-4 animate-pulse" />
                                    <span className="text-foreground/60 text-sm">
                                        Waiting for output...
                                    </span>
                                </div>
                            )}
                    </>
                )}

                {/* Error state */}
                {status === "error" && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                        <p className="text-foreground/70">{error}</p>
                        <p className="text-foreground/50 mt-1 text-sm">
                            The connection to the job stream was lost.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
