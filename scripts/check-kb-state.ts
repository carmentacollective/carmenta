/**
 * Check KB State - View current knowledge base documents and extraction jobs
 *
 * Usage: npx tsx scripts/check-kb-state.ts [email]
 */

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
    const email = process.argv[2] || "care@carmenta.ai";

    // Find user
    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
    });

    if (!user) {
        console.log(`User not found: ${email}`);
        process.exit(1);
    }

    console.log(`User: ${email} (${user.id})\n`);

    // Get KB documents
    const docs = await db.query.documents.findMany({
        where: eq(schema.documents.userId, user.id),
        columns: { path: true, name: true, content: true, createdAt: true },
        orderBy: schema.documents.path,
    });

    console.log(`=== KB DOCUMENTS (${docs.length}) ===`);
    for (const doc of docs) {
        const preview = doc.content.slice(0, 100).replace(/\n/g, " ");
        console.log(`${doc.path}`);
        console.log(`  ${preview}${doc.content.length > 100 ? "..." : ""}\n`);
    }

    // Get extraction jobs
    const jobs = await db.query.extractionJobs.findMany({
        where: eq(schema.extractionJobs.userId, user.id),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: 5,
    });

    console.log(`\n=== RECENT EXTRACTION JOBS ===`);
    for (const job of jobs) {
        console.log(
            `${job.id.slice(0, 8)}... | ${job.status.padEnd(10)} | ${job.processedConversations}/${job.totalConversations} | ${job.createdAt.toISOString()}`
        );
        if (job.errorMessage) {
            console.log(`  Error: ${job.errorMessage}`);
        }
    }

    process.exit(0);
}

main();
