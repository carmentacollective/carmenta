import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { BookOpen } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { DocsViewer } from "@/components/docs-viewer";
import { getGlobalDocs, type KBDocument } from "@/lib/kb/actions";

export const metadata: Metadata = {
    title: "Carmenta Documentation",
    description: "Learn how to work with Carmenta effectively.",
};

/**
 * Carmenta Documentation Page
 *
 * Displays system documentation with TOC-style navigation.
 * Read-only documentation synced from /docs folder.
 */
export default async function CarmentaDocsPage() {
    // Get current user from Clerk
    const user = await currentUser();

    if (!user) {
        // Redirect to sign-in if not authenticated
        redirect("/sign-in?redirect_url=/carmenta-docs");
    }

    // Fetch global documentation
    const docs = await getGlobalDocs();

    // Organize docs into sections based on path prefix
    const sections = organizeDocs(docs);

    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-10 flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8">
                        {/* Header */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/20 p-3">
                                    <BookOpen className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                                        Carmenta Documentation
                                    </h1>
                                    <p className="text-foreground/70">
                                        Learn how we work together
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Documentation Viewer */}
                        <section className="min-h-[500px] flex-1">
                            <DocsViewer sections={sections} />
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}

/**
 * Section structure for documentation
 */
export interface DocSection {
    id: string;
    name: string;
    path: string;
    documents: KBDocument[];
}

/**
 * Organize flat docs list into sections based on path prefix
 */
function organizeDocs(docs: KBDocument[]): DocSection[] {
    const sectionMap = new Map<string, KBDocument[]>();

    for (const doc of docs) {
        // Get section from path: "docs.features.memory" -> "features"
        const pathParts = doc.path.split(".");
        const sectionName = pathParts.length > 1 ? pathParts[1] : "general";

        const sectionDocs = sectionMap.get(sectionName) ?? [];
        sectionDocs.push(doc);
        sectionMap.set(sectionName, sectionDocs);
    }

    // Convert to array with nice display names
    const sectionDisplayNames: Record<string, string> = {
        general: "Overview",
        about: "About Carmenta",
        features: "Features",
        integrations: "Integrations",
        philosophy: "Philosophy",
    };

    const sections: DocSection[] = [];
    const sectionOrder = ["general", "about", "features", "philosophy", "integrations"];

    for (const sectionId of sectionOrder) {
        const sectionDocs = sectionMap.get(sectionId);
        if (sectionDocs && sectionDocs.length > 0) {
            sections.push({
                id: sectionId,
                name: sectionDisplayNames[sectionId] ?? sectionId,
                path: sectionId,
                documents: sectionDocs.sort((a, b) => a.name.localeCompare(b.name)),
            });
        }
    }

    // Add any remaining sections not in our order
    for (const [sectionId, sectionDocs] of sectionMap) {
        if (!sectionOrder.includes(sectionId)) {
            sections.push({
                id: sectionId,
                name: sectionDisplayNames[sectionId] ?? sectionId,
                path: sectionId,
                documents: sectionDocs.sort((a, b) => a.name.localeCompare(b.name)),
            });
        }
    }

    return sections;
}
