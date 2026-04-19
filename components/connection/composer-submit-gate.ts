/**
 * Composer submit gate
 *
 * Decides what to do when a user attempts to submit a message.
 *
 * Previously the composer collapsed all gating conditions into a single silent
 * `return;` — which dropped user input whenever uploads were in-flight or the
 * assistant was still streaming. Anna reported both symptoms in April 2026:
 * image uploads blocked Enter, and messages typed during a response were lost.
 *
 * This helper separates "why we can't submit right now" from "what to do with
 * the user's intent" so each case routes to the correct handler:
 *
 *   - streaming → interrupt: stop the current response and send the new
 *     message immediately. Users overwhelmingly type during streaming to
 *     redirect ("stop, you're doing it wrong"), not to pre-stage a follow-up.
 *     Send should always mean Send.
 *   - uploads in-flight → defer: auto-submit when uploads complete
 *   - empty / composing → block (with caller-provided UI feedback)
 *
 * Keeping this pure makes the behavior trivially testable without having to
 * instantiate the composer component and all of its context providers.
 */

export type SubmitAction =
    | "allow"
    | "interrupt-and-send"
    | "defer-until-uploads-complete"
    | "block-empty"
    | "block-composing";

export interface SubmitGateInput {
    /** True when the user has text or non-text files ready to send */
    hasContent: boolean;
    /** True while the assistant is streaming a response (useChat isLoading) */
    isLoading: boolean;
    /** True while an IME composition is in progress */
    isComposing: boolean;
    /** True while any file is validating, optimizing, uploading, or extracting */
    isUploading: boolean;
}

export function decideSubmitAction(input: SubmitGateInput): SubmitAction {
    // IME composition: user is mid-character (Japanese/Chinese/Korean typing).
    // Block unconditionally so we don't fire on the composition-commit Enter.
    if (input.isComposing) return "block-composing";

    // Nothing to send.
    if (!input.hasContent) return "block-empty";

    // Streaming in progress — interrupt and send immediately.
    // When someone types during a response, they want to redirect, not wait.
    // handleInterrupt stops the stream and sends the new message in one step.
    if (input.isLoading) return "interrupt-and-send";

    // Uploads still in-flight — hold the user's intent and fire it
    // once uploads complete, so the attachments land with the message.
    if (input.isUploading) return "defer-until-uploads-complete";

    return "allow";
}
