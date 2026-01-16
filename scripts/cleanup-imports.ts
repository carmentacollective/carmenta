import { db } from "@/lib/db";
import { connections, messages, pendingExtractions, users } from "@/lib/db/schema";
import { ne, inArray, eq, and } from "drizzle-orm";

const userEmail = process.argv[2];
if (!userEmail) {
    console.error("Usage: pnpm tsx scripts/cleanup-imports.ts <email>");
    process.exit(1);
}

async function deleteImportedData() {
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

    // Find all imported connections for this user (source != 'carmenta')
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

    console.log(`Found ${imported.length} imported connections:`);
    imported.forEach((c) => console.log(`  - [${c.source}] ${c.title} (id: ${c.id})`));

    if (imported.length === 0) {
        console.log("Nothing to delete.");
        return;
    }

    // Confirmation prompt before deletion
    console.log(
        "\n⚠️  This will PERMANENTLY DELETE all imported conversations and their messages."
    );
    console.log("This action cannot be undone.\n");

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

    const connectionIds = imported.map((c) => c.id);

    // Delete pending extractions for these connections (if table exists)
    try {
        const deletedExtractions = await db
            .delete(pendingExtractions)
            .where(inArray(pendingExtractions.connectionId, connectionIds))
            .returning({ id: pendingExtractions.id });
        console.log(`Deleted ${deletedExtractions.length} pending extractions`);
    } catch {
        console.log("Skipping pending_extractions (table doesn't exist)");
    }

    // Delete messages for these connections
    const deletedMessages = await db
        .delete(messages)
        .where(inArray(messages.connectionId, connectionIds))
        .returning({ id: messages.id });
    console.log(`Deleted ${deletedMessages.length} messages`);

    // Delete the connections themselves
    const deletedConnections = await db
        .delete(connections)
        .where(inArray(connections.id, connectionIds))
        .returning({ id: connections.id });
    console.log(`Deleted ${deletedConnections.length} connections`);

    console.log("\n✓ Cleanup complete");
}

deleteImportedData()
    .catch(console.error)
    .finally(() => process.exit(0));
