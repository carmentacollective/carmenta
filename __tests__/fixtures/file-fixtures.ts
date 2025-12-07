/**
 * File Upload Test Fixtures
 *
 * Provides test file data and mock Supabase responses.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { UploadedFile } from "@/lib/storage/types";

/**
 * Read test image as File object
 */
export function createTestImageFile(filename = "test-image.png"): File {
    const buffer = readFileSync(join(__dirname, filename));
    const blob = new Blob([buffer], { type: "image/png" });
    return new File([blob], filename, { type: "image/png" });
}

/**
 * Create a mock PDF file
 */
export function createTestPDFFile(filename = "test.pdf"): File {
    const content = "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n%%EOF";
    const blob = new Blob([content], { type: "application/pdf" });
    return new File([blob], filename, { type: "application/pdf" });
}

/**
 * Create a mock text file
 */
export function createTestTextFile(
    content = "Test content",
    filename = "test.txt"
): File {
    const blob = new Blob([content], { type: "text/plain" });
    return new File([blob], filename, { type: "text/plain" });
}

/**
 * Create a mock audio file
 */
export function createTestAudioFile(filename = "test.mp3"): File {
    const blob = new Blob([new ArrayBuffer(1024)], { type: "audio/mp3" });
    return new File([blob], filename, { type: "audio/mp3" });
}

/**
 * Mock Supabase upload response
 */
export function createMockSupabaseUploadResponse(
    fileName: string,
    userId: string,
    connectionId: string | null
): {
    data: { path: string };
    error: null;
} {
    const timestamp = Date.now();
    const id = "test1234567";
    const ext = fileName.split(".").pop() || "bin";
    const connectionPath = connectionId || "unclaimed";
    const path = `${userId}/${connectionPath}/${timestamp}-${id}.${ext}`;

    return {
        data: { path },
        error: null,
    };
}

/**
 * Create a mock uploaded file result
 */
export function createMockUploadedFile(
    fileName: string,
    mediaType: string,
    userId: string,
    connectionId: string | null
): UploadedFile {
    const mockResponse = createMockSupabaseUploadResponse(
        fileName,
        userId,
        connectionId
    );
    const publicUrl = `https://test.supabase.co/storage/v1/object/public/carmenta-files/${mockResponse.data.path}`;

    return {
        url: publicUrl,
        mediaType,
        name: fileName,
        size: 1024,
        path: mockResponse.data.path,
    };
}

/**
 * Create multiple mock uploaded files
 */
export function createMockUploadedFiles(
    count: number,
    userId: string,
    connectionId: string | null
): UploadedFile[] {
    return Array.from({ length: count }, (_, i) =>
        createMockUploadedFile(
            `test-file-${i + 1}.png`,
            "image/png",
            userId,
            connectionId
        )
    );
}
