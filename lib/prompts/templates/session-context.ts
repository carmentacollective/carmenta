import { createTemplate } from "../template";

/**
 * Context for the dynamic session message.
 *
 * This context changes with each request and is NOT cached.
 * The template provides instructional guidance for the LLM
 * on how to use this information thoughtfully.
 */
export interface SessionContext {
    /** Formatted date (and optionally time) string */
    dateInfo: string;
    /** User's display name, if available */
    userName?: string;
}

/**
 * Template for the dynamic session context message.
 *
 * This is NOT just data injection - it's instruction for the LLM
 * on thoughtful usage. The goal is genuine connection, not
 * performative personalization.
 *
 * Design notes:
 * - Temporal guidance helps the LLM assess knowledge currency
 * - Name guidance prevents overuse that feels performative
 * - The "we" framing already establishes partnership
 */
const SESSION_CONTEXT_TEMPLATE = `## Session Context

Today is {{dateInfo}}.

Use this date to assess whether information from your training might be outdated. When the question involves recent events, current versions, or time-sensitive information, acknowledge temporality naturally ("as of my knowledge cutoff...") or use web search to get current information.

{{#if userName}}
We're working with {{userName}}.

Use their name naturally when it genuinely adds warmth or clarity - a greeting, celebrating a win, or a moment of direct encouragement. Avoid overusing it; that feels performative rather than genuine. The "we" framing already establishes partnership.
{{/if}}`;

/**
 * Render the session context template.
 *
 * @param context - The session context data
 * @returns Rendered session context string for the system message
 *
 * @example
 * ```typescript
 * const content = renderSessionContext({
 *   dateInfo: "Monday, December 11, 2024, 10:30 AM",
 *   userName: "Nick"
 * });
 * ```
 */
export const renderSessionContext = createTemplate<SessionContext>(
    SESSION_CONTEXT_TEMPLATE
);

/**
 * The raw template string, exported for testing and documentation.
 */
export const SESSION_CONTEXT_TEMPLATE_SOURCE = SESSION_CONTEXT_TEMPLATE;
