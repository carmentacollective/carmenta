import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";

const results = await db
    .select()
    .from(integrations)
    .where(or(eq(integrations.service, "clickup"), eq(integrations.service, "notion")))
    .orderBy(desc(integrations.connectedAt));

console.log("Found", results.length, "integration(s):");
console.log(JSON.stringify(results, null, 2));
process.exit(0);
