/**
 * Image Processing
 *
 * Client-side image optimization BEFORE upload to reduce:
 * - Upload bandwidth (10MB → ~200KB)
 * - Token costs (16,000 tokens → ~1,600 tokens = 90% savings)
 *
 * Uses browser-image-compression to resize images to Claude's sweet spot (1092px).
 */

import imageCompression from "browser-image-compression";
import { logger } from "@/lib/client-logger";
import { ALLOWED_MIME_TYPES } from "./file-config";

/**
 * Target dimensions for image optimization.
 * Based on Claude's token cost formula: tokens = (width × height) / 750
 *
 * 1092×1092 = ~1,590 tokens (Claude's max before server-side resize)
 */
const MAX_DIMENSION = 1092;

/**
 * JPEG quality for compression (0-1 scale).
 * 85% provides excellent quality while reducing file size significantly.
 */
const JPEG_QUALITY = 0.85;

/**
 * Options for browser-image-compression.
 */
interface CompressionOptions {
    /** Max width in pixels */
    maxWidthOrHeight: number;
    /** JPEG quality (0-1) */
    quality: number;
    /** Use Web Worker for non-blocking processing */
    useWebWorker: boolean;
}

/**
 * Optimize an image file before upload.
 *
 * This function:
 * - Resizes to 1092px max dimension (preserves aspect ratio)
 * - Compresses to 85% JPEG quality
 * - Handles EXIF rotation automatically
 * - Runs in Web Worker (non-blocking)
 *
 * Result: 10MB photo → ~200KB, 16K tokens → ~1.6K tokens (90% cost savings)
 *
 * @param file - Image file to optimize
 * @returns Optimized image file with same name
 */
export async function optimizeImage(file: File): Promise<File> {
    const startSize = file.size;

    logger.info(
        { filename: file.name, originalSize: startSize },
        "Starting image optimization"
    );

    const options: CompressionOptions = {
        maxWidthOrHeight: MAX_DIMENSION,
        quality: JPEG_QUALITY,
        useWebWorker: true,
    };

    try {
        const optimizedFile = await imageCompression(file, options);

        const endSize = optimizedFile.size;
        const savings = ((1 - endSize / startSize) * 100).toFixed(1);

        // Return original if optimization increased size (can happen with small/well-compressed images)
        if (endSize >= startSize) {
            logger.info(
                {
                    filename: file.name,
                    originalSize: startSize,
                    optimizedSize: endSize,
                },
                "Optimization increased size, using original"
            );
            return file;
        }

        logger.info(
            {
                filename: file.name,
                originalSize: startSize,
                optimizedSize: endSize,
                savingsPercent: savings,
            },
            "Image optimization complete"
        );

        return optimizedFile;
    } catch (error) {
        logger.error(
            { error, filename: file.name },
            "Image optimization failed, using original"
        );
        // Fall back to original file if optimization fails
        return file;
    }
}

/**
 * Check if a file should be optimized.
 * Only optimize image types (not PDFs, audio, etc.)
 */
export function shouldOptimizeImage(mimeType: string): boolean {
    return (ALLOWED_MIME_TYPES.image as readonly string[]).includes(mimeType);
}
