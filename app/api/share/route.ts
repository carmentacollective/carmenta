/**
 * PWA Share Target API
 *
 * Handles content shared from other apps via the Web Share Target API.
 * Receives text, URLs, and files, then redirects to a new conversation
 * with the shared content pre-populated.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target
 * @see https://web.dev/articles/web-share-target
 */

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { getSupabaseClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/storage/types";
import { validateFile } from "@/lib/storage/file-validator";
import { getOrCreateUser } from "@/lib/db/users";

/**
 * Shared file metadata to pass via URL params
 */
interface SharedFileMetadata {
    url: string;
    name: string;
    mediaType: string;
    size: number;
}

/**
 * Generate storage path for shared files
 * Format: {userId}/shared/{timestamp}-{nanoid}.{ext}
 */
function generateSharedFilePath(userId: string, filename: string): string {
    const timestamp = Date.now();
    const id = nanoid(10);
    // Extract extension, handling files without dots (e.g., "README" → "bin")
    const parts = filename.split(".");
    const ext = parts.length > 1 ? parts.pop()! : "bin";
    return `${userId}/shared/${timestamp}-${id}.${ext}`;
}

/**
 * Upload a shared file to Supabase Storage
 */
async function uploadSharedFile(
    file: File,
    userId: string
): Promise<SharedFileMetadata> {
    const path = generateSharedFilePath(userId, file.name);
    const supabase = getSupabaseClient();

    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, buffer, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
        });

    if (error) {
        logger.error({ error, filename: file.name }, "Failed to upload shared file");
        throw new Error(`Upload failed: ${error.message}`);
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

    return {
        url: publicUrl,
        name: file.name,
        mediaType: file.type,
        size: file.size,
    };
}

/**
 * POST /api/share
 *
 * Receives shared content from the PWA share target.
 * Uploads any files and redirects to a new conversation.
 */
export async function POST(request: Request) {
    try {
        // Authenticate - share target requires signed-in user
        const user = await currentUser();
        if (!user) {
            logger.info("Unauthenticated share attempt, redirecting to sign-in");
            // Redirect to sign-in, then back to connection page
            // The shared content will be lost, but this is the expected PWA behavior
            redirect("/sign-in?redirect_url=/connection");
        }

        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (!userEmail) {
            logger.error({ userId: user.id }, "User has no email address");
            redirect("/connection?error=no-email");
        }

        // Get or create the database user
        const dbUser = await getOrCreateUser(user.id, userEmail, {
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            displayName: user.fullName ?? null,
            imageUrl: user.imageUrl ?? null,
        });

        // Parse the multipart form data
        const formData = await request.formData();
        const title = formData.get("title") as string | null;
        const text = formData.get("text") as string | null;
        const url = formData.get("url") as string | null;
        const files = formData.getAll("files") as File[];

        logger.info(
            {
                userEmail,
                hasTitle: !!title,
                hasText: !!text,
                hasUrl: !!url,
                fileCount: files.length,
            },
            "Processing share target request"
        );

        // Build the shared content
        const sharedFiles: SharedFileMetadata[] = [];

        // Upload any valid files
        for (const file of files) {
            // Skip empty file entries (browsers may send empty File objects)
            if (!file || file.size === 0) continue;

            // Validate file before upload
            const validation = validateFile(file);
            if (!validation.valid) {
                logger.warn(
                    { filename: file.name, error: validation.error },
                    "Skipping invalid shared file"
                );
                continue;
            }

            try {
                const metadata = await uploadSharedFile(file, dbUser.id);
                sharedFiles.push(metadata);
                logger.info(
                    { filename: file.name, url: metadata.url },
                    "Uploaded shared file"
                );
            } catch (error) {
                logger.error(
                    { error, filename: file.name },
                    "Failed to upload shared file, skipping"
                );
                Sentry.captureException(error, {
                    tags: { component: "share-target", action: "upload" },
                    extra: { filename: file.name, fileSize: file.size },
                });
            }
        }

        // Build redirect URL with share data
        const params = new URLSearchParams();
        params.set("new", "true");

        // Combine title, text, and URL into a single shared text
        const textParts: string[] = [];
        if (title) textParts.push(title);
        if (text) textParts.push(text);
        if (url) textParts.push(url);

        if (textParts.length > 0) {
            params.set("sharedText", textParts.join("\n\n"));
        }

        if (sharedFiles.length > 0) {
            // Encode file metadata as base64 JSON for URL safety
            const filesJson = JSON.stringify(sharedFiles);
            params.set("sharedFiles", Buffer.from(filesJson).toString("base64"));
        }

        const redirectUrl = `/connection?${params.toString()}`;

        logger.info(
            {
                userEmail,
                hasSharedText: textParts.length > 0,
                sharedFileCount: sharedFiles.length,
            },
            "Share processed, redirecting to connection"
        );

        redirect(redirectUrl);
    } catch (error) {
        // redirect() throws a special error that should propagate
        // Check error digest to detect Next.js redirect errors
        if (error && typeof error === "object" && "digest" in error) {
            const digest = (error as { digest?: string }).digest;
            if (digest?.startsWith("NEXT_REDIRECT")) {
                throw error;
            }
        }

        logger.error({ error }, "Share target request failed");
        Sentry.captureException(error, {
            tags: { component: "share-target", action: "process" },
        });

        // Redirect to connection page with error state
        redirect("/connection?error=share-failed");
    }
}

/**
 * GET /api/share
 *
 * Handles direct navigation to the share endpoint (shouldn't happen normally).
 * Redirects to the connection page.
 */
export async function GET() {
    redirect("/connection?new");
}
