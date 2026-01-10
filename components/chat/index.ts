/**
 * Reusable chat components
 *
 * Context-agnostic building blocks for chat interfaces.
 */

export { UserBubble, AssistantBubble, ThinkingBubble } from "./message-bubbles";
export { SimpleComposer, type SimpleComposerProps } from "./simple-composer";
export { ComposerUI, type ComposerUIProps } from "./composer-ui";
export {
    ComposerButton,
    type ComposerButtonProps,
    type PipelineState,
} from "./composer-button";
export {
    ScrollToBottomButton,
    type ScrollToBottomButtonProps,
} from "./scroll-to-bottom-button";

// Message part utilities - shared between HoloThread and SidecarThread
export {
    getMessageContent,
    getReasoningContent,
    getToolParts,
    getFileParts,
    getDataParts,
    getToolStatus,
    getToolError,
    isToolPart,
    isFilePart,
    isDataPart,
    type ToolPart,
    type FilePart,
    type DataPart,
} from "./message-parts";

// Message rendering components
export { MessageActions, type MessageActionsProps } from "./message-actions";
export { ToolPartRenderer } from "./tool-part-renderer";
