/**
 * Title Module
 *
 * Unified title generation and evolution for Carmenta connections.
 *
 * - `generateTitle()` - Create initial titles for new conversations/code sessions
 * - `evaluateTitleEvolution()` - Evaluate and update titles as conversations develop
 * - Guidelines and utilities are available for custom use cases
 */

// Core generation
export { generateTitle } from "./generator";
export type { TitleGenerationContext, TitleGenerationResult } from "./generator";

// Evolution (updates for ongoing conversations)
export { evaluateTitleEvolution, summarizeRecentMessages } from "./evolution";
export type { TitleEvolutionResult } from "./evolution";

// Guidelines and utilities (for concierge and other consumers)
export {
    TITLE_MAX_LENGTH,
    TITLE_CORE_GUIDELINES,
    CONVERSATION_TITLE_EXAMPLES,
    CODE_TITLE_EXAMPLES,
    EVOLUTION_TITLE_EXAMPLES,
    buildTitleFormatPrompt,
    cleanTitle,
} from "./guidelines";
