/**
 * Sync Documentation Script
 *
 * Syncs markdown files from /docs folder to the knowledge base as system documentation.
 * Only syncs if docs/ has been modified more recently than the database records.
 *
 * Documents are created with:
 * - userId: null (global, not user-specific)
 * - path: docs.{folder}.{filename} (dot notation)
 * - sourceType: system_docs
 * - searchable: true (included in search results)
 * - editable: false (read-only in UI)
 *
 * Usage: pnpm docs:sync
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

const DOCS_DIR = path.join(process.cwd(), "docs");

/**
 * Get the unix timestamp of the last git commit that touched docs/
 */
function getDocsLastModifiedTimestamp(): number | null {
    try {
        const timestamp = execSync("git log -1 --format=%ct -- docs/", {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
        logger.warn("Could not get git timestamp for docs/, will sync anyway");
        return null;
    }
}

/**
 * Get the most recent updated_at timestamp from system_docs in the database
 */
async function getDbLastSyncTimestamp(): Promise<number | null> {
    const result = await db
        .select({ updatedAt: documents.updatedAt })
        .from(documents)
        .where(eq(documents.sourceType, "system_docs"))
        .orderBy(desc(documents.updatedAt))
        .limit(1);

    if (result.length === 0) {
        return null;
    }

    return Math.floor(result[0].updatedAt.getTime() / 1000);
}

/**
 * Check if docs need to be synced based on timestamps
 */
async function needsSync(): Promise<boolean> {
    const gitTimestamp = getDocsLastModifiedTimestamp();
    const dbTimestamp = await getDbLastSyncTimestamp();

    logger.info({ gitTimestamp, dbTimestamp }, "Comparing docs timestamps");

    // If no git timestamp, sync to be safe
    if (gitTimestamp === null) {
        return true;
    }

    // If no db records, definitely need to sync
    if (dbTimestamp === null) {
        logger.info("No existing system_docs in database, sync needed");
        return true;
    }

    // If git is newer than db, sync needed
    if (gitTimestamp > dbTimestamp) {
        logger.info("Docs folder has been updated since last sync");
        return true;
    }

    logger.info("Docs are up to date, skipping sync");
    return false;
}

interface DocFile {
    filePath: string;
    relativePath: string;
    kbPath: string;
    name: string;
    content: string;
}

// Files to exclude from syncing (AI coding config files that shouldn't be in KB)
const EXCLUDED_FILES = ["CLAUDE.md", "AGENTS.md", "CURSOR.md"];

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string = dir): DocFile[] {
    const files: DocFile[] = [];

    if (!fs.existsSync(dir)) {
        logger.warn({ dir }, "Docs directory does not exist, skipping sync");
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...findMarkdownFiles(fullPath, baseDir));
        } else if (
            entry.isFile() &&
            entry.name.endsWith(".md") &&
            !EXCLUDED_FILES.includes(entry.name)
        ) {
            const relativePath = path.relative(baseDir, fullPath);
            // Convert path/to/file.md → docs.path.to.file
            const kbPath =
                "docs." +
                relativePath.replace(/\.md$/, "").replace(/\//g, ".").toLowerCase();

            // Extract name from filename (capitalize words)
            const baseName = path.basename(entry.name, ".md");
            const name = baseName
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");

            files.push({
                filePath: fullPath,
                relativePath,
                kbPath,
                name,
                content: fs.readFileSync(fullPath, "utf-8"),
            });
        }
    }

    return files;
}

async function syncDocs(): Promise<void> {
    logger.info("Starting docs sync check...");

    // Step 1: Check if sync is needed
    if (!(await needsSync())) {
        return;
    }

    // Step 2: Find all markdown files
    const docFiles = findMarkdownFiles(DOCS_DIR);
    logger.info({ count: docFiles.length }, "Found markdown files");

    if (docFiles.length === 0) {
        logger.info("No docs to sync, skipping");
        return;
    }

    // Step 3: Delete all existing system_docs
    const deleteResult = await db
        .delete(documents)
        .where(eq(documents.sourceType, "system_docs"));

    logger.info(
        { deleted: (deleteResult as { rowCount?: number }).rowCount ?? "unknown" },
        "Deleted existing system docs"
    );

    // Step 4: Insert new docs
    const docsToInsert = docFiles.map((doc) => ({
        userId: null, // Global docs
        path: doc.kbPath,
        name: doc.name,
        content: doc.content,
        description: `System documentation synced from ${doc.relativePath}`,
        sourceType: "system_docs" as const,
        sourceId: doc.relativePath, // Track source file
        searchable: true, // Include in search
        editable: false, // Read-only
        alwaysInclude: false, // Only include when searched
        tags: ["documentation", "system"],
    }));

    await db.insert(documents).values(docsToInsert);

    logger.info(
        { inserted: docsToInsert.length, paths: docsToInsert.map((d) => d.path) },
        "Synced system docs to knowledge base"
    );
}

// Run the sync
syncDocs()
    .then(() => {
        logger.info("Docs sync completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        logger.error({ error }, "Docs sync failed");
        process.exit(1);
    });
