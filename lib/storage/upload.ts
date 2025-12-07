import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logger } from "@/lib/client-logger";
import {
    SUPPORTED_FORMATS,
    MAX_FILE_SIZE,
    MAX_IMAGE_SIZE,
    STORAGE_BUCKET,
    type UploadedFile,
} from "./types";

/**
 * File Upload Service
 *
 * Handles client-side file uploads to Supabase Storage with:
 * - Format validation
 * - Size limits
 * - Public URL generation
 * - Thumbnail URL generation for images
 */

/**
 * Validate a file against format and size constraints
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
    // Check if format is supported
    const allFormats = Object.values(SUPPORTED_FORMATS).flat();
    if (!allFormats.includes(file.type as (typeof allFormats)[number])) {
        return {
            valid: false,
            error: `Unsupported file type: ${file.type}. Supported formats: images, PDFs, text, audio, video, code.`,
        };
    }

    // Check size limits
    const isImage = SUPPORTED_FORMATS.image.includes(
        file.type as (typeof SUPPORTED_FORMATS.image)[number]
    );
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        return {
            valid: false,
            error: `File too large. Maximum size: ${maxSizeMB}MB`,
        };
    }

    return { valid: true };
}

/**
 * Generate storage path for file
 * Format: {userId}/{connectionId}/{timestamp}-{nanoid}.{ext}
 */
export function generateStoragePath(
    userId: string,
    connectionId: string | null,
    filename: string
): string {
    const timestamp = Date.now();
    const id = nanoid(10);
    const ext = filename.split(".").pop() || "bin";
    const connectionPath = connectionId || "unclaimed";

    return `${userId}/${connectionPath}/${timestamp}-${id}.${ext}`;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
    file: File,
    userId: string,
    connectionId: string | null,
    onProgress?: (progress: number) => void
): Promise<UploadedFile> {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const path = generateStoragePath(userId, connectionId, file.name);
    const supabase = getSupabaseClient();

    logger.info(
        { filename: file.name, path, size: file.size },
        "Uploading file to Supabase"
    );

    try {
        // Upload file
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (error) {
            logger.error({ error, filename: file.name }, "Failed to upload file");
            throw new Error(`Upload failed: ${error.message}`);
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

        // Report complete
        onProgress?.(100);

        const result: UploadedFile = {
            url: publicUrl,
            mediaType: file.type,
            filename: file.name,
            size: file.size,
            path: data.path,
        };

        logger.info(
            { filename: file.name, url: publicUrl },
            "File uploaded successfully"
        );

        return result;
    } catch (error) {
        logger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                filename: file.name,
            },
            "Upload error"
        );
        throw error;
    }
}

/**
 * Generate thumbnail URL for images using Supabase transforms
 * Returns original URL for non-images
 */
export function getThumbnailUrl(publicUrl: string, mediaType: string): string {
    const isImage = SUPPORTED_FORMATS.image.includes(
        mediaType as (typeof SUPPORTED_FORMATS.image)[number]
    );

    if (!isImage) return publicUrl;

    // Supabase Storage image transformation
    // 200x200 cover crop with smart gravity
    return `${publicUrl}?width=200&height=200&resize=cover&quality=85`;
}

/**
 * Generate optimized URL for image display
 */
export function getOptimizedUrl(
    publicUrl: string,
    mediaType: string,
    width = 800
): string {
    const isImage = SUPPORTED_FORMATS.image.includes(
        mediaType as (typeof SUPPORTED_FORMATS.image)[number]
    );

    if (!isImage) return publicUrl;

    // Optimize for display: resize and convert to WebP
    return `${publicUrl}?width=${width}&quality=85&format=webp`;
}
