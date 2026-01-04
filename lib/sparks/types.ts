import type { Icon } from "@phosphor-icons/react";

/**
 * Spark - A contextual suggestion shown on the welcome screen
 *
 * Sparks ignite conversation by offering personalized starting points
 * based on the user's integrations, recent activity, and context.
 */

export type SparkCategory =
    | "continue" // Recent/starred conversations
    | "productivity" // Calendar, email, tasks
    | "research" // Web search, analysis
    | "creative" // Brainstorm, write
    | "setup"; // Onboarding CTAs

export type SparkSource =
    | "starred" // User's starred threads
    | "recent" // Last conversation
    | "integration" // Connected service action
    | "onboarding" // Setup nudge
    | "contextual" // Time-aware suggestion
    | "discovery"; // Capability showcase

export type SparkActionType = "prefill" | "deeplink" | "navigate";

export interface SparkAction {
    type: SparkActionType;
    /** For prefill: the prompt text. For deeplink: conversation slug. For navigate: href */
    value: string;
    /** For prefill actions: whether to auto-submit after filling */
    autoSubmit?: boolean;
}

export interface Spark {
    id: string;
    label: string;
    icon: Icon;
    category: SparkCategory;
    action: SparkAction;
    source: SparkSource;
}

/**
 * Integration-specific spark templates
 */
export interface IntegrationSparkTemplate {
    serviceId: string;
    morning?: { label: string; prompt: string };
    afternoon?: { label: string; prompt: string };
    evening?: { label: string; prompt: string };
    default: { label: string; prompt: string };
}
