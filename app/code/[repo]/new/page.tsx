/**
 * New Code Session Page
 *
 * Clean URL: /code/[repo]/new
 * Example: /code/carmenta-code/new
 *
 * Creates a new ephemeral code session. The session will be created
 * on first message and auto-titled after the first exchange.
 */

import ConnectionPage from "@/app/connection/[slug]/[id]/page";

interface PageProps {
    params: Promise<{
        repo: string;
    }>;
}

export default async function NewCodeSessionPage({ params }: PageProps) {
    const { repo } = await params;

    // Render the chat interface in "new session" mode
    // The session will be created when the user sends their first message
    return (
        <ConnectionPage
            params={Promise.resolve({ slug: "_", id: "new" })}
            // @ts-expect-error - Adding code mode context
            codeMode={{ repo, isNew: true }}
        />
    );
}
