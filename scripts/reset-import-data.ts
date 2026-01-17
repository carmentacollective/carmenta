/**
 * Reset Import Data
 *
 * Comprehensive cleanup that removes:
 * - Imported connections (source != "carmenta")
 * - Pending extractions
 * - Extraction jobs and processed connection tracking
 * - KB documents EXCEPT seed documents (Google-derived profile)
 *
 * Keeps:
 * - profile.character (Carmenta defaults)
 * - profile.identity (user's name from Google)
 * - profile.preferences (collaboration prefs)
 * - Native Carmenta conversations
 */

import { db } from "@/lib/db";
import {
    connections,
    documents,
    extractionJobs,
    extractionProcessedConnections,
    messages,
    pendingExtractions,
    users,
} from "@/lib/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

const userEmail = process.argv[2];
if (!userEmail) {
    console.error("Usage: pnpm tsx scripts/reset-import-data.ts <email>");
    process.exit(1);
}

async function resetImportData() {
    // Find the user
    const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, userEmail));

    if (!user) {
        console.error(`User not found: ${userEmail}`);
        process.exit(1);
    }
    console.log(`Found user: ${userEmail} (${user.id})`);

    // Survey what exists
    const imported = await db
        .select({
            id: connections.id,
            title: connections.title,
            source: connections.source,
        })
        .from(connections)
        .where(
            and(eq(connections.userId, user.id), ne(connections.source, "carmenta"))
        );

    const kbDocs = await db
        .select({
            id: documents.id,
            path: documents.path,
            sourceType: documents.sourceType,
        })
        .from(documents)
        .where(eq(documents.userId, user.id));

    const seedDocs = kbDocs.filter((d) => d.sourceType === "seed");
    const nonSeedDocs = kbDocs.filter((d) => d.sourceType !== "seed");

    const pending = await db
        .select({ id: pendingExtractions.id })
        .from(pendingExtractions)
        .where(eq(pendingExtractions.userId, user.id));

    const jobs = await db
        .select({ id: extractionJobs.id })
        .from(extractionJobs)
        .where(eq(extractionJobs.userId, user.id));

    console.log("\n📊 Current state:");
    console.log(`  Imported connections: ${imported.length}`);
    console.log(`  KB documents (to delete): ${nonSeedDocs.length}`);
    console.log(`  KB documents (keeping seed): ${seedDocs.length}`);
    seedDocs.forEach((d) => console.log(`    ✓ ${d.path}`));
    console.log(`  Pending extractions: ${pending.length}`);
    console.log(`  Extraction jobs: ${jobs.length}`);

    if (
        imported.length === 0 &&
        nonSeedDocs.length === 0 &&
        pending.length === 0 &&
        jobs.length === 0
    ) {
        console.log("\n✓ Nothing to delete. Already clean.");
        return;
    }

    // Confirmation
    console.log("\n⚠️  This will PERMANENTLY DELETE:");
    console.log(`  - ${imported.length} imported conversations and their messages`);
    console.log(
        `  - ${nonSeedDocs.length} KB documents (keeping ${seedDocs.length} seed docs)`
    );
    console.log(`  - ${pending.length} pending extractions`);
    console.log(`  - ${jobs.length} extraction jobs`);
    console.log("\nThis action cannot be undone.\n");

    const readline = await import("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
        rl.question('Type "DELETE" to confirm: ', (answer) => {
            rl.close();
            resolve(answer.trim() === "DELETE");
        });
    });

    if (!confirmed) {
        console.log("\n❌ Canceled. No data was deleted.");
        return;
    }

    console.log("\n🗑️  Proceeding with deletion...\n");

    // Delete extraction processed connections
    const deletedProcessed = await db
        .delete(extractionProcessedConnections)
        .where(eq(extractionProcessedConnections.userId, user.id))
        .returning({ id: extractionProcessedConnections.id });
    console.log(`Deleted ${deletedProcessed.length} processed connection records`);

    // Delete pending extractions
    if (pending.length > 0) {
        const deletedPending = await db
            .delete(pendingExtractions)
            .where(eq(pendingExtractions.userId, user.id))
            .returning({ id: pendingExtractions.id });
        console.log(`Deleted ${deletedPending.length} pending extractions`);
    }

    // Delete extraction jobs
    if (jobs.length > 0) {
        const deletedJobs = await db
            .delete(extractionJobs)
            .where(eq(extractionJobs.userId, user.id))
            .returning({ id: extractionJobs.id });
        console.log(`Deleted ${deletedJobs.length} extraction jobs`);
    }

    // Delete non-seed KB documents
    if (nonSeedDocs.length > 0) {
        const nonSeedIds = nonSeedDocs.map((d) => d.id);
        const deletedDocs = await db
            .delete(documents)
            .where(inArray(documents.id, nonSeedIds))
            .returning({ id: documents.id });
        console.log(`Deleted ${deletedDocs.length} KB documents`);
    }

    // Delete imported connections (messages cascade)
    if (imported.length > 0) {
        const connectionIds = imported.map((c) => c.id);

        // Delete messages first
        const deletedMessages = await db
            .delete(messages)
            .where(inArray(messages.connectionId, connectionIds))
            .returning({ id: messages.id });
        console.log(`Deleted ${deletedMessages.length} messages`);

        // Delete connections
        const deletedConnections = await db
            .delete(connections)
            .where(inArray(connections.id, connectionIds))
            .returning({ id: connections.id });
        console.log(`Deleted ${deletedConnections.length} imported connections`);
    }

    console.log("\n✓ Reset complete. Ready for fresh import.");
}

resetImportData()
    .catch(console.error)
    .finally(() => process.exit(0));
