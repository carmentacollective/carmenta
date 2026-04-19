import { describe, it, expect } from "vitest";
import {
    decideSubmitAction,
    type SubmitGateInput,
} from "@/components/connection/composer-submit-gate";

/**
 * These tests encode the desired behavior of the composer's submit gate.
 *
 * Two user-reported bugs motivated extracting this helper:
 *   Bug 1: image uploads blocked Enter-to-submit (silently dropped)
 *   Bug 3: messages typed during streaming were silently dropped / queued
 *          when the user wanted to redirect ("stop, you're doing it wrong")
 *
 * The old inline guard collapsed every "can't submit right now" case to a
 * single `return;`. These tests pin the fix so we don't regress.
 *
 * Design principle: Send always means Send. During streaming, the user's
 * new message interrupts the current response — it doesn't queue silently.
 */
describe("decideSubmitAction", () => {
    const base: SubmitGateInput = {
        hasContent: true,
        isLoading: false,
        isComposing: false,
        isUploading: false,
    };

    it("allows submit when nothing is blocking", () => {
        expect(decideSubmitAction(base)).toBe("allow");
    });

    it("blocks when there is no content to send", () => {
        expect(decideSubmitAction({ ...base, hasContent: false })).toBe("block-empty");
    });

    it("blocks during IME composition so users can finish typing", () => {
        expect(decideSubmitAction({ ...base, isComposing: true })).toBe(
            "block-composing"
        );
    });

    // Bug 3 (Anna, Apr 2026): messages typed while the assistant was streaming
    // were silently dropped or queued for later. Anna wanted the AI to STOP and
    // consider her message ("stop doing it wrong"). The fix: interrupt the
    // current stream and send the new message immediately.
    it("interrupts — does not drop or queue — when the assistant is streaming", () => {
        expect(decideSubmitAction({ ...base, isLoading: true })).toBe(
            "interrupt-and-send"
        );
    });

    // Bug 1 (Anna, Apr 2026): tapping Send or pressing Enter while an image was
    // uploading produced no visible action. The fix defers the submit intent
    // and auto-fires it when the upload finishes, so the attachment lands
    // with the message.
    it("defers — does not drop — while uploads are still in-flight", () => {
        expect(decideSubmitAction({ ...base, isUploading: true })).toBe(
            "defer-until-uploads-complete"
        );
    });

    it("prefers interrupt over defer when both streaming and uploading", () => {
        // User is actively trying to redirect — interrupt takes priority.
        // handleInterrupt will send with whatever files are completed.
        expect(
            decideSubmitAction({
                ...base,
                isLoading: true,
                isUploading: true,
            })
        ).toBe("interrupt-and-send");
    });

    it("composition beats every other blocking state", () => {
        expect(
            decideSubmitAction({
                ...base,
                isComposing: true,
                isLoading: true,
                isUploading: true,
            })
        ).toBe("block-composing");
    });

    it("empty input beats upload/streaming — nothing to interrupt with", () => {
        expect(
            decideSubmitAction({
                ...base,
                hasContent: false,
                isLoading: true,
                isUploading: true,
            })
        ).toBe("block-empty");
    });

    // Files-only interrupt: attaching a file while streaming (no typed text) should
    // interrupt, not silently drop. The caller signals hasContent=true when files
    // are ready to send even if input.trim() is empty.
    it("interrupts with files only — no text required to stop streaming", () => {
        expect(
            decideSubmitAction({
                ...base,
                hasContent: true, // files present, no text
                isLoading: true,
            })
        ).toBe("interrupt-and-send");
    });
});
