import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, featureTipViews } from "@/lib/db/schema";
import { findUserByClerkId } from "@/lib/db";
import { getConnectPageFeatures, type Feature } from "@/lib/features/feature-catalog";
import { logger } from "@/lib/logger";
import {
    serverErrorResponse,
    unauthorizedResponse,
    notFoundResponse,
    validationErrorResponse,
} from "@/lib/api/responses";

/**
 * Feature Tips API
 *
 * GET /api/tips - Get next tip for current user (weighted selection with session gating)
 * POST /api/tips - Record tip interaction (shown, dismissed, engaged)
 */

// Session gating configuration
const SESSION_GATE_START = 4; // First session tips can appear
const SESSION_FREQUENCIES: Record<string, number> = {
    // Sessions 4-6: 60% chance of showing a tip
    "4-6": 0.6,
    // Sessions 7-10: 40% chance
    "7-10": 0.4,
    // Sessions 11+: 25% chance
    "11+": 0.25,
};

// Dismiss timeout in days
const DISMISS_TIMEOUT_DAYS = 30;

// Weight multipliers for selection
const WEIGHT_UNSEEN = 3.0;
const WEIGHT_SHOWN_ONCE = 1.0;
const WEIGHT_SHOWN_TWICE = 0.5;
const WEIGHT_SHOWN_MORE = 0.1;

/**
 * Get probability of showing a tip based on session count
 */
function getTipProbability(sessionCount: number): number {
    if (sessionCount < SESSION_GATE_START) return 0;
    if (sessionCount <= 6) return SESSION_FREQUENCIES["4-6"];
    if (sessionCount <= 10) return SESSION_FREQUENCIES["7-10"];
    return SESSION_FREQUENCIES["11+"];
}

/**
 * Calculate weight for a tip based on view history
 */
function getTipWeight(shownCount: number): number {
    if (shownCount === 0) return WEIGHT_UNSEEN;
    if (shownCount === 1) return WEIGHT_SHOWN_ONCE;
    if (shownCount === 2) return WEIGHT_SHOWN_TWICE;
    return WEIGHT_SHOWN_MORE;
}

/**
 * Weighted random selection from array of items with weights
 */
function weightedRandomSelect<T>(items: Array<{ item: T; weight: number }>): T | null {
    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    if (totalWeight === 0) return null;

    let random = Math.random() * totalWeight;
    for (const { item, weight } of items) {
        random -= weight;
        if (random <= 0) return item;
    }

    return items[items.length - 1].item;
}

/**
 * GET /api/tips - Get next tip for display
 *
 * Response: { tip: Feature | null, shouldShow: boolean }
 */
export async function GET() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return unauthorizedResponse();
        }

        const user = await findUserByClerkId(clerkId);
        if (!user) {
            return notFoundResponse("User");
        }

        // Check session gate - increment session count if new day
        const today = new Date().toISOString().slice(0, 10);
        let sessionCount = user.sessionCount ?? 0;

        if (user.lastSessionDate !== today) {
            // New session day - increment count
            sessionCount += 1;
            await db
                .update(users)
                .set({
                    sessionCount,
                    lastSessionDate: today,
                })
                .where(eq(users.id, user.id));
        }

        // Check if we should show a tip based on session count
        const probability = getTipProbability(sessionCount);
        if (probability === 0 || Math.random() > probability) {
            return NextResponse.json({ tip: null, shouldShow: false });
        }

        // Get all tips available for connect page
        const allTips = getConnectPageFeatures().filter((f) => f.available);

        // Get user's tip view history
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DISMISS_TIMEOUT_DAYS);

        const tipViews = await db
            .select()
            .from(featureTipViews)
            .where(eq(featureTipViews.userId, user.id));

        // Build view lookup
        const viewsByTipId = new Map(tipViews.map((v) => [v.tipId, v]));

        // Filter and weight tips
        const eligibleTips: Array<{ item: Feature; weight: number }> = [];

        for (const tip of allTips) {
            const view = viewsByTipId.get(tip.id);

            if (!view) {
                // Never seen - highest weight
                eligibleTips.push({ item: tip, weight: WEIGHT_UNSEEN * tip.priority });
                continue;
            }

            // Engaged tips are permanently excluded
            if (view.state === "engaged") {
                continue;
            }

            // Dismissed tips excluded for 30 days
            if (view.state === "dismissed") {
                if (view.stateChangedAt && view.stateChangedAt > thirtyDaysAgo) {
                    continue;
                }
                // Dismiss timeout passed - re-eligible with base weight
                eligibleTips.push({
                    item: tip,
                    weight: WEIGHT_SHOWN_ONCE * tip.priority,
                });
                continue;
            }

            // Shown but not interacted - weight based on count
            const weight = getTipWeight(view.shownCount) * tip.priority;
            eligibleTips.push({ item: tip, weight });
        }

        // Select a tip using weighted random selection
        const selectedTip = weightedRandomSelect(eligibleTips);

        if (!selectedTip) {
            return NextResponse.json({ tip: null, shouldShow: false });
        }

        return NextResponse.json({ tip: selectedTip, shouldShow: true });
    } catch (error) {
        return serverErrorResponse(error, { route: "tips/GET" });
    }
}

/**
 * POST /api/tips - Record tip interaction
 *
 * Body: { tipId: string, state: "shown" | "dismissed" | "engaged" }
 */
export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return unauthorizedResponse();
        }

        const user = await findUserByClerkId(clerkId);
        if (!user) {
            return notFoundResponse("User");
        }

        const body = await request.json();
        const { tipId, state } = body;

        if (!tipId || typeof tipId !== "string") {
            return validationErrorResponse({ tipId: "required" }, "tipId is required");
        }

        // Validate tipId exists in feature catalog
        const allTips = getConnectPageFeatures();
        const validTipIds = new Set(allTips.map((f) => f.id));
        if (!validTipIds.has(tipId)) {
            return validationErrorResponse({ tipId: "unknown" }, "Unknown tip ID");
        }

        if (!state || !["shown", "dismissed", "engaged"].includes(state)) {
            return validationErrorResponse(
                { state: "invalid" },
                "state must be 'shown', 'dismissed', or 'engaged'"
            );
        }

        // Check if view record exists
        const existingView = await db
            .select()
            .from(featureTipViews)
            .where(
                and(
                    eq(featureTipViews.userId, user.id),
                    eq(featureTipViews.tipId, tipId)
                )
            )
            .limit(1);

        const now = new Date();

        if (existingView.length === 0) {
            // Create new view record
            await db.insert(featureTipViews).values({
                userId: user.id,
                tipId,
                state,
                shownCount: 1,
                firstShownAt: now,
                lastShownAt: now,
                stateChangedAt: state !== "shown" ? now : null,
            });
        } else {
            // Update existing record
            const view = existingView[0];

            if (state === "shown") {
                // Increment show count and reset state if previously dismissed
                // (allows dismissed tips to re-enter weighted selection after timeout)
                await db
                    .update(featureTipViews)
                    .set({
                        state: "shown",
                        shownCount: view.shownCount + 1,
                        lastShownAt: now,
                        // Reset stateChangedAt if transitioning from dismissed back to shown
                        stateChangedAt:
                            view.state === "dismissed" ? now : view.stateChangedAt,
                    })
                    .where(eq(featureTipViews.id, view.id));
            } else {
                // State change (dismissed or engaged)
                await db
                    .update(featureTipViews)
                    .set({
                        state,
                        stateChangedAt: now,
                        lastShownAt: now,
                    })
                    .where(eq(featureTipViews.id, view.id));
            }
        }

        logger.info({ tipId, state, userId: user.id }, "Tip interaction recorded");

        return NextResponse.json({ success: true });
    } catch (error) {
        return serverErrorResponse(error, { route: "tips/POST" });
    }
}
