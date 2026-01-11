import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logger } from "@/lib/client-logger";
import { STORAGE_BUCKET, type UploadedFile } from "./types";
import { validateFile } from "./file-validator";
import { optimizeImage, shouldOptimizeImage } from "./image-processor";
import { isSpreadsheet } from "./file-config";
import { parseSpreadsheet, spreadsheetToMarkdown } from "./spreadsheet-parser";

/**
 * MIME types that should be extracted via Docling API
 * These need server-side processing, unlike spreadsheets which parse client-side
 */
const DOCLING_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
] as const;

function shouldExtractWithDocling(mimeType: string): boolean {
    return DOCLING_TYPES.includes(mimeType as (typeof DOCLING_TYPES)[number]);
}

/**
 * Extract document content via Docling API
 * Returns undefined if extraction is not available or fails
 */
async function extractDocumentContent(file: File): Promise<string | undefined> {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/documents/extract", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            // 503 means Docling is not enabled - this is expected in some environments
            if (response.status === 503) {
                logger.info(
                    { filename: file.name },
                    "Docling not enabled, skipping extraction"
                );
                return undefined;
            }
            const error = await response.json();
            throw new Error(error.error || "Extraction failed");
        }

        const result = await response.json();
        logger.info(
            {
                filename: file.name,
                processingTimeMs: result.processingTimeMs,
                contentLength: result.markdown.length,
            },
            "Document extracted via Docling"
        );
        return result.markdown;
    } catch (error) {
        logger.error(
            { error, filename: file.name },
            "Document extraction failed - file will be uploaded without parsed content"
        );
        return undefined;
    }
}

/**
 * File Upload Service
 *
 * Handles client-side file uploads to Supabase Storage with:
 * - Format validation (via file-validator)
 * - Size limits enforcement
 * - Client-side image optimization (90% token cost savings)
 * - Public URL generation
 * - Thumbnail URL generation for images
 */

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
 * Upload file to Supabase Storage with optional image optimization.
 *
 * Flow:
 * 1. Validate file format and size
 * 2. Optimize images (resize to 1092px, 85% quality) - 90% token savings
 * 3. Upload to Supabase Storage
 * 4. Parse spreadsheets to Markdown for LLM consumption
 * 5. Return public URL and metadata
 *
 * @param file - File to upload
 * @param userId - User email for path organization
 * @param connectionId - Connection ID for path organization (null for new connections)
 * @param onStatusChange - Callback for status updates ("validating", "optimizing", "uploading", "extracting", "complete")
 * @returns Uploaded file metadata with public URL
 */
export async function uploadFile(
    file: File,
    userId: string,
    connectionId: string | null,
    onStatusChange?: (
        status: "validating" | "optimizing" | "uploading" | "extracting" | "complete"
    ) => void
): Promise<UploadedFile> {
    // Step 1: Validate file
    onStatusChange?.("validating");
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Step 2: Optimize images before upload (90% token cost reduction)
    let fileToUpload = file;
    if (shouldOptimizeImage(file.type)) {
        onStatusChange?.("optimizing");
        fileToUpload = await optimizeImage(file);
    }

    // Step 3: Upload to Supabase
    onStatusChange?.("uploading");
    const path = generateStoragePath(userId, connectionId, file.name);
    const supabase = getSupabaseClient();

    logger.info(
        {
            filename: file.name,
            path,
            originalSize: file.size,
            uploadSize: fileToUpload.size,
        },
        "Uploading file to Supabase"
    );

    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, fileToUpload, {
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

        // Step 4: Extract content for LLM consumption
        // Spreadsheets: Parse client-side (fast, no external dependency)
        // PDFs/DOCX: Extract via Docling API (server-side, optional)
        let parsedContent: string | undefined;
        if (isSpreadsheet(file.type)) {
            onStatusChange?.("extracting");
            try {
                const buffer = await file.arrayBuffer();
                const parsed = parseSpreadsheet(buffer, file.name);
                parsedContent = spreadsheetToMarkdown(parsed);
                logger.info(
                    {
                        filename: file.name,
                        sheets: parsed.sheets.length,
                        totalRows: parsed.totalRows,
                    },
                    "Spreadsheet parsed successfully"
                );
            } catch (parseError) {
                logger.error(
                    { error: parseError, filename: file.name },
                    "Failed to parse spreadsheet - file will be uploaded without parsed content"
                );
            }
        } else if (shouldExtractWithDocling(file.type)) {
            onStatusChange?.("extracting");
            parsedContent = await extractDocumentContent(file);
        }

        // Step 5: Complete
        onStatusChange?.("complete");

        const result: UploadedFile = {
            url: publicUrl,
            mediaType: file.type,
            name: file.name,
            size: fileToUpload.size, // Use optimized size, not original
            path: data.path,
            ...(parsedContent && { parsedContent }),
        };

        logger.info(
            {
                filename: file.name,
                url: publicUrl,
                hasParsedContent: !!parsedContent,
            },
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
 * Generate thumbnail URL for images using Supabase transforms.
 * Returns original URL for non-images.
 */
export function getThumbnailUrl(publicUrl: string, mediaType: string): string {
    if (!shouldOptimizeImage(mediaType)) return publicUrl;

    // Supabase Storage image transformation
    // 200x200 cover crop with smart gravity
    return `${publicUrl}?width=200&height=200&resize=cover&quality=85`;
}

/**
 * Generate optimized URL for image display.
 */
export function getOptimizedUrl(
    publicUrl: string,
    mediaType: string,
    width = 800
): string {
    if (!shouldOptimizeImage(mediaType)) return publicUrl;

    // Optimize for display: resize and convert to WebP
    return `${publicUrl}?width=${width}&quality=85&format=webp`;
}
