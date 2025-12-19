/**
 * Model Routing Tests
 *
 * Tests for file-to-model routing logic with focus on:
 * - Audio files forcing audio-capable model (only model with native audio)
 * - PDFs and images allowing concierge choice (prefers Claude)
 * - Multiple file handling
 * - Required model detection
 */

import { describe, expect, it } from "vitest";

import { AUDIO_CAPABLE_MODEL } from "@/lib/model-config";
import {
    getAttachmentMeta,
    getAttachmentMetaForFiles,
    getRequiredModel,
} from "@/lib/storage/model-routing";

// ============================================================================
// AUDIO FILE ROUTING
// ============================================================================

describe("Model Routing - Audio Files", () => {
    it("forces audio-capable model for MP3 audio files", () => {
        const meta = getAttachmentMeta("audio/mp3");

        expect(meta.mediaType).toBe("audio/mp3");
        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for MPEG audio files", () => {
        const meta = getAttachmentMeta("audio/mpeg");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for WAV audio files", () => {
        const meta = getAttachmentMeta("audio/wav");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for FLAC audio files", () => {
        const meta = getAttachmentMeta("audio/flac");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for M4A audio files (audio/mp4)", () => {
        const meta = getAttachmentMeta("audio/mp4");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for M4A audio files (audio/x-m4a)", () => {
        const meta = getAttachmentMeta("audio/x-m4a");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for AAC audio files", () => {
        const meta = getAttachmentMeta("audio/aac");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for OGG audio files", () => {
        const meta = getAttachmentMeta("audio/ogg");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for WebM audio files", () => {
        const meta = getAttachmentMeta("audio/webm");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("forces audio-capable model for AIFF audio files", () => {
        const meta = getAttachmentMeta("audio/aiff");

        expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });
});

// ============================================================================
// IMAGE FILE ROUTING
// ============================================================================

describe("Model Routing - Image Files", () => {
    it("allows concierge choice for JPEG images", () => {
        const meta = getAttachmentMeta("image/jpeg");

        expect(meta.mediaType).toBe("image/jpeg");
        expect(meta.requiredModel).toBeUndefined(); // No forced model
    });

    it("allows concierge choice for PNG images", () => {
        const meta = getAttachmentMeta("image/png");

        expect(meta.requiredModel).toBeUndefined();
    });

    it("allows concierge choice for GIF images", () => {
        const meta = getAttachmentMeta("image/gif");

        expect(meta.requiredModel).toBeUndefined();
    });

    it("allows concierge choice for WebP images", () => {
        const meta = getAttachmentMeta("image/webp");

        expect(meta.requiredModel).toBeUndefined();
    });
});

// ============================================================================
// DOCUMENT FILE ROUTING
// ============================================================================

describe("Model Routing - Document Files", () => {
    it("allows concierge choice for PDF documents", () => {
        const meta = getAttachmentMeta("application/pdf");

        expect(meta.mediaType).toBe("application/pdf");
        expect(meta.requiredModel).toBeUndefined(); // Concierge will prefer Claude
    });
});

// ============================================================================
// TEXT FILE ROUTING
// ============================================================================

describe("Model Routing - Text Files", () => {
    it("allows concierge choice for plain text files", () => {
        const meta = getAttachmentMeta("text/plain");

        expect(meta.requiredModel).toBeUndefined();
    });

    it("allows concierge choice for markdown files", () => {
        const meta = getAttachmentMeta("text/markdown");

        expect(meta.requiredModel).toBeUndefined();
    });

    it("allows concierge choice for CSV files", () => {
        const meta = getAttachmentMeta("text/csv");

        expect(meta.requiredModel).toBeUndefined();
    });

    it("allows concierge choice for JSON files", () => {
        const meta = getAttachmentMeta("application/json");

        expect(meta.requiredModel).toBeUndefined();
    });
});

// ============================================================================
// MULTIPLE FILES
// ============================================================================

describe("Model Routing - Multiple Files", () => {
    it("returns metadata for multiple files", () => {
        const files = [
            { mediaType: "image/jpeg" },
            { mediaType: "application/pdf" },
            { mediaType: "audio/mp3" },
        ];

        const meta = getAttachmentMetaForFiles(files);

        expect(meta).toHaveLength(3);
        expect(meta[0].mediaType).toBe("image/jpeg");
        expect(meta[1].mediaType).toBe("application/pdf");
        expect(meta[2].mediaType).toBe("audio/mp3");
    });

    it("handles empty array", () => {
        const meta = getAttachmentMetaForFiles([]);

        expect(meta).toEqual([]);
    });

    it("preserves required model for audio in multi-file array", () => {
        const files = [{ mediaType: "image/jpeg" }, { mediaType: "audio/wav" }];

        const meta = getAttachmentMetaForFiles(files);

        expect(meta[0].requiredModel).toBeUndefined();
        expect(meta[1].requiredModel).toBe(AUDIO_CAPABLE_MODEL);
    });
});

// ============================================================================
// REQUIRED MODEL DETECTION
// ============================================================================

describe("Model Routing - Required Model Detection", () => {
    it("returns null when no attachments require specific model", () => {
        const attachments = [
            { mediaType: "image/jpeg" },
            { mediaType: "application/pdf" },
            { mediaType: "text/plain" },
        ];

        const required = getRequiredModel(attachments);

        expect(required).toBeNull();
    });

    it("returns audio-capable model when audio file present", () => {
        const attachments = [
            { mediaType: "image/jpeg" },
            { mediaType: "audio/mp3", requiredModel: AUDIO_CAPABLE_MODEL },
        ];

        const required = getRequiredModel(attachments);

        expect(required).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("returns first required model when multiple exist", () => {
        const attachments = [
            { mediaType: "audio/wav", requiredModel: AUDIO_CAPABLE_MODEL },
            { mediaType: "audio/mp3", requiredModel: AUDIO_CAPABLE_MODEL },
        ];

        const required = getRequiredModel(attachments);

        expect(required).toBe(AUDIO_CAPABLE_MODEL);
    });

    it("returns null for empty array", () => {
        const required = getRequiredModel([]);

        expect(required).toBeNull();
    });

    it("finds required model among many optional attachments", () => {
        const attachments = [
            { mediaType: "image/jpeg" },
            { mediaType: "image/png" },
            { mediaType: "application/pdf" },
            { mediaType: "audio/flac", requiredModel: AUDIO_CAPABLE_MODEL },
            { mediaType: "text/plain" },
        ];

        const required = getRequiredModel(attachments);

        expect(required).toBe(AUDIO_CAPABLE_MODEL);
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Model Routing - Edge Cases", () => {
    it("handles unsupported MIME type gracefully", () => {
        const meta = getAttachmentMeta("video/mp4");

        expect(meta.mediaType).toBe("video/mp4");
        expect(meta.requiredModel).toBeUndefined();
    });

    it("handles empty MIME type", () => {
        const meta = getAttachmentMeta("");

        expect(meta.mediaType).toBe("");
        expect(meta.requiredModel).toBeUndefined();
    });

    it("handles malformed MIME type", () => {
        const meta = getAttachmentMeta("not-a-mime-type");

        expect(meta.mediaType).toBe("not-a-mime-type");
        expect(meta.requiredModel).toBeUndefined();
    });

    it("is case-sensitive for MIME types", () => {
        // MIME types are lowercase by spec
        const meta = getAttachmentMeta("AUDIO/MP3");

        // Should not match due to case sensitivity
        expect(meta.requiredModel).toBeUndefined();
    });
});

// ============================================================================
// ROUTING LOGIC VERIFICATION
// ============================================================================

describe("Model Routing - Routing Logic", () => {
    it("audio files are the only type requiring specific model", () => {
        const allMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "text/markdown",
            "text/csv",
            "application/json",
        ];

        const nonAudioMeta = allMimeTypes.map(getAttachmentMeta);

        // None of these should have required model
        expect(nonAudioMeta.every((meta) => !meta.requiredModel)).toBe(true);
    });

    it("all audio MIME types require Gemini", () => {
        const audioTypes = [
            "audio/wav",
            "audio/mp3",
            "audio/mpeg",
            "audio/aiff",
            "audio/aac",
            "audio/ogg",
            "audio/flac",
            "audio/webm",
            "audio/mp4",
            "audio/x-m4a",
        ];

        const audioMeta = audioTypes.map(getAttachmentMeta);

        // All should require audio-capable model
        expect(
            audioMeta.every((meta) => meta.requiredModel === AUDIO_CAPABLE_MODEL)
        ).toBe(true);
    });

    it("concierge can choose for non-audio files", () => {
        const flexibleTypes = [
            "image/jpeg",
            "image/png",
            "application/pdf",
            "text/plain",
        ];

        const meta = flexibleTypes.map(getAttachmentMeta);

        // All should allow concierge choice (no required model)
        expect(meta.every((m) => !m.requiredModel)).toBe(true);
    });
});

// ============================================================================
// INTEGRATION WITH FILE CONFIG
// ============================================================================

describe("Model Routing - File Config Integration", () => {
    it("routes all supported image types correctly", () => {
        const supportedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];

        for (const mimeType of supportedImages) {
            const meta = getAttachmentMeta(mimeType);
            expect(meta.requiredModel).toBeUndefined(); // Should allow concierge
        }
    });

    it("routes all supported audio types to Gemini", () => {
        const supportedAudio = [
            "audio/wav",
            "audio/mp3",
            "audio/mpeg",
            "audio/aiff",
            "audio/aac",
            "audio/ogg",
            "audio/flac",
            "audio/webm",
            "audio/mp4",
            "audio/x-m4a",
        ];

        for (const mimeType of supportedAudio) {
            const meta = getAttachmentMeta(mimeType);
            expect(meta.requiredModel).toBe(AUDIO_CAPABLE_MODEL);
        }
    });

    it("routes all supported document types correctly", () => {
        const supportedDocs = ["application/pdf"];

        for (const mimeType of supportedDocs) {
            const meta = getAttachmentMeta(mimeType);
            expect(meta.requiredModel).toBeUndefined(); // Should allow concierge
        }
    });

    it("routes all supported text types correctly", () => {
        const supportedText = [
            "text/plain",
            "text/markdown",
            "text/csv",
            "application/json",
        ];

        for (const mimeType of supportedText) {
            const meta = getAttachmentMeta(mimeType);
            expect(meta.requiredModel).toBeUndefined(); // Should allow concierge
        }
    });
});
