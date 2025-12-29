/**
 * New Code Session Page
 *
 * Clean URL: /code/[repo]/new
 * Example: /code/carmenta-code/new
 *
 * Creates a new code session for the specified project.
 * The session will be created on first message and auto-titled after the first exchange.
 */

import { notFound } from "next/navigation";

import { Chat, ConnectLayout } from "@/components/connection";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { getRecentConnections } from "@/lib/actions/connections";
import { findProjectBySlug } from "@/lib/code/projects";

interface PageProps {
    params: Promise<{
        repo: string;
    }>;
}

export default async function NewCodeSessionPage({ params }: PageProps) {
    const { repo } = await params;

    // Look up the project by repo slug
    const project = await findProjectBySlug(repo);
    if (!project) {
        notFound();
    }

    // Load recent connections for the sidebar
    const recentConnections = await getRecentConnections(10);

    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground hideWatermark />
            <div className="relative z-content h-full">
                <ConnectLayout
                    initialConnections={recentConnections}
                    activeConnection={null}
                    initialMessages={[]}
                    initialConcierge={null}
                    projectPath={project.path}
                >
                    <Chat />
                </ConnectLayout>
            </div>
        </div>
    );
}
