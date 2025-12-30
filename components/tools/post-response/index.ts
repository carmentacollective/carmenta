/**
 * Post-Response Tool Renderers
 *
 * Tools that enhance the conversation after a response:
 * - suggestQuestions: Clickable follow-up suggestions
 * - showReferences: Expandable source citations
 * - askUserInput: Interactive input collection
 * - acknowledge: Heart-centered appreciation cards
 */

export { SuggestQuestionsResult } from "./suggest-questions";
export { ShowReferencesResult } from "./show-references";
export { AskUserInputResult } from "./ask-user-input";
export { AcknowledgeResult } from "./acknowledge";

// Re-export types for convenience
export type {
    SuggestQuestionsOutput,
    ShowReferencesOutput,
    AskUserInputOutput,
    AcknowledgeOutput,
} from "@/lib/tools/post-response";
