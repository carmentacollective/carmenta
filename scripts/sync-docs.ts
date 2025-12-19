/**
 * Sync Documentation Script
 *
 * Syncs markdown files from /docs folder to the knowledge base as system documentation.
 * This is a full-replace sync - deletes all existing system_docs and re-inserts from files.
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
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const DOCS_DIR = path.join(process.cwd(), "docs");

interface DocFile {
    filePath: string;
    relativePath: string;
    kbPath: string;
    name: string;
    content: string;
}

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
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
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
    logger.info("Starting docs sync...");

    // Step 1: Find all markdown files
    const docFiles = findMarkdownFiles(DOCS_DIR);
    logger.info({ count: docFiles.length }, "Found markdown files");

    if (docFiles.length === 0) {
        logger.info("No docs to sync, skipping");
        return;
    }

    // Step 2: Delete all existing system_docs
    const deleteResult = await db
        .delete(documents)
        .where(eq(documents.sourceType, "system_docs"));

    logger.info(
        { deleted: (deleteResult as { rowCount?: number }).rowCount ?? "unknown" },
        "Deleted existing system docs"
    );

    // Step 3: Insert new docs
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
