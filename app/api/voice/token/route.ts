/**
 * Voice Token API Route
 *
 * Generates a WebSocket URL with authentication for Deepgram streaming STT.
 * Requires authenticated user to prevent abuse.
 *
 * Security considerations:
 * - Endpoint requires Clerk authentication
 * - Deepgram API key is passed to client (required for WebSocket auth)
 * - Use a Deepgram key with minimal scopes (only "usage:write" for STT)
 * - Consider Deepgram's project key API for short-lived tokens in production
 */

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
    language: z.string().optional().default("en"),
});

/** Deepgram WebSocket parameters for optimal real-time transcription */
const DEEPGRAM_CONFIG = {
    /** Use Nova-3 for best accuracy and speed */
    model: "nova-3",
    /** Enable interim results for responsive UX */
    interim_results: "true",
    /** Auto-detect and format punctuation */
    punctuate: "true",
    /** Smart formatting for numbers, dates, etc. */
    smart_format: "true",
    /** Voice activity detection for speech boundaries */
    vad_events: "true",
    /** Detect end of utterance */
    utterance_end_ms: "1000",
    /** Audio encoding - matches MediaRecorder output */
    encoding: "opus",
    /** Sample rate */
    sample_rate: "48000",
} as const;

export async function POST(request: Request) {
    try {
        // Require authenticated user to prevent API key abuse
        const user = await currentUser();
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required for voice input" },
                { status: 401 }
            );
        }

        assertEnv(env.DEEPGRAM_API_KEY, "DEEPGRAM_API_KEY");

        // Parse JSON with error handling
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const result = requestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid request", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { language } = result.data;

        // Build WebSocket URL with parameters
        const params = new URLSearchParams({
            ...DEEPGRAM_CONFIG,
            language,
        });

        // Deepgram's streaming endpoint
        const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

        logger.info({ language, userId: user.id }, "Generated Deepgram voice token");

        // Note: Deepgram WebSocket requires the API key for authentication.
        // The key is transmitted to the client but requires an authenticated session.
        // For production, consider using Deepgram's project key API to create
        // short-lived, scoped keys for each session.
        const authenticatedUrl = `${wsUrl}&token=${env.DEEPGRAM_API_KEY}`;

        return NextResponse.json({
            url: authenticatedUrl,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error({ error }, "Failed to generate voice token");

        if (message.includes("Missing required environment variable")) {
            return NextResponse.json(
                { error: "Voice input not configured" },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: "Failed to initialize voice input" },
            { status: 500 }
        );
    }
}
