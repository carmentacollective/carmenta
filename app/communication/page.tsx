import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Chat } from "@phosphor-icons/react/dist/ssr";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { KnowledgeViewer } from "@/components/knowledge-viewer";
import {
    getKBFolders,
    initializeKBWithClerkData,
    hasKBProfile,
    type KBFolder,
} from "@/lib/kb/actions";

export const metadata: Metadata = {
    title: "Communication · Carmenta",
    description: "Shape how we connect and collaborate.",
};

/**
 * Communication Page
 *
 * Displays voice/style and collaboration preferences - how Carmenta communicates.
 * Split from Knowledge Base to separate "what we know" from "how we talk".
 */
export default async function CommunicationPage() {
    // Get current user from Clerk
    let user;
    try {
        user = await currentUser();
    } catch {
        redirect("/sign-in?redirect_url=/communication");
    }

    if (!user) {
        redirect("/sign-in?redirect_url=/communication");
    }

    // Check if user has a profile, initialize if not
    const hasProfile = await hasKBProfile();
    if (!hasProfile) {
        await initializeKBWithClerkData({
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.primaryEmailAddress?.emailAddress ?? null,
        });
    }

    // Fetch KB data
    const userFolders = await getKBFolders();

    // Build folder structure for communication preferences
    const allFolders: KBFolder[] = [];
    const profileFolder = userFolders.find((f) => f.path === "profile");

    // Communication documents: voice/style and collaboration preferences
    // Virtual folder - documents have "profile.*" paths but we present them
    // under "style" folder for navigation purposes on this page
    if (profileFolder) {
        const communicationDocs = profileFolder.documents.filter(
            (d) => d.path === "profile.character" || d.path === "profile.preferences"
        );
        if (communicationDocs.length > 0) {
            allFolders.push({
                id: "style",
                name: "style",
                path: "style",
                documents: communicationDocs,
            });
        }
    }

    return (
        <StandardPageLayout
            maxWidth="standard"
            contentClassName="flex h-full flex-col gap-8 py-8"
        >
            {/* Header */}
            <section className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 rounded-xl p-3">
                        <Chat className="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-foreground text-3xl font-light tracking-tight">
                            Communication
                        </h1>
                        <p className="text-foreground/70">How we connect</p>
                    </div>
                </div>
            </section>

            {/* Communication Viewer */}
            <section className="min-h-[400px] flex-1">
                {allFolders.length === 0 || allFolders[0]?.documents.length === 0 ? (
                    <div className="border-foreground/5 bg-foreground/[0.02] flex h-full flex-col items-center justify-center rounded-2xl border py-16 text-center">
                        <Chat className="text-foreground/30 mb-4 h-12 w-12" />
                        <h3 className="text-foreground/80 text-lg font-medium">
                            Communication preferences
                        </h3>
                        <p className="text-foreground/60 mt-2 text-sm">
                            Start a conversation to shape how we connect.
                        </p>
                    </div>
                ) : (
                    <KnowledgeViewer
                        initialFolders={allFolders}
                        title="Communication"
                    />
                )}
            </section>
        </StandardPageLayout>
    );
}
