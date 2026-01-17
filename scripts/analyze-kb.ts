import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

async function analyze() {
    // Get all KB documents
    const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));

    console.log(`\n=== KB ANALYSIS (${docs.length} documents) ===\n`);

    // Group by namespace
    const byNamespace: Record<string, typeof docs> = {};
    for (const doc of docs) {
        const ns = doc.path.split(".")[0];
        byNamespace[ns] = byNamespace[ns] || [];
        byNamespace[ns].push(doc);
    }

    console.log("Documents by namespace:");
    for (const [ns, nsDocs] of Object.entries(byNamespace)) {
        console.log(`  ${ns}: ${nsDocs.length}`);
    }

    // Size distribution
    const sizes = docs.map((d) => ({
        path: d.path,
        name: d.name,
        chars: d.content?.length || 0,
        tokens: Math.ceil((d.content?.length || 0) / 4),
    }));

    const small = sizes.filter((s) => s.tokens < 200).length;
    const medium = sizes.filter((s) => s.tokens >= 200 && s.tokens < 500).length;
    const large = sizes.filter((s) => s.tokens >= 500 && s.tokens < 1000).length;
    const xlarge = sizes.filter((s) => s.tokens >= 1000).length;

    console.log("\nSize distribution:");
    console.log(`  Small (<200 tokens): ${small}`);
    console.log(`  Medium (200-500): ${medium}`);
    console.log(`  Large (500-1000): ${large}`);
    console.log(`  X-Large (>1000): ${xlarge}`);

    // Largest docs
    console.log("\nLargest documents:");
    sizes
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 5)
        .forEach((d) => {
            console.log(`  ${d.tokens} tokens: ${d.path} - ${d.name}`);
        });

    // Path analysis
    const withHyphens = docs.filter((d) => d.path.includes("-")).map((d) => d.path);
    const withSpaces = docs.filter((d) => d.name.includes(" ")).length;

    console.log("\nPath naming:");
    console.log(`  With spaces in name: ${withSpaces}`);
    console.log(`  With hyphens in path: ${withHyphens.length}`);
    if (withHyphens.length > 0) {
        withHyphens.slice(0, 10).forEach((p) => console.log(`    - ${p}`));
        if (withHyphens.length > 10)
            console.log(`    ... and ${withHyphens.length - 10} more`);
    }

    // Sample content check (5 random docs)
    console.log("\n=== SAMPLE DOCUMENTS ===\n");
    const samples = docs.sort(() => Math.random() - 0.5).slice(0, 5);
    for (const doc of samples) {
        console.log(`--- ${doc.path} ---`);
        console.log(`Name: ${doc.name}`);
        console.log(`Content (first 400 chars):`);
        console.log(doc.content?.substring(0, 400));
        console.log("");
    }

    process.exit(0);
}

analyze().catch((e) => {
    console.error(e);
    process.exit(1);
});
