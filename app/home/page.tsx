import type { Metadata } from "next";

/**
 * /home - The landing page, accessible to everyone.
 *
 * While "/" redirects authenticated users to /connection,
 * /home always shows the landing page regardless of auth state.
 * This lets logged-in users revisit the vision and features.
 */

export const metadata: Metadata = {
    title: "Carmenta · Create at the speed of thought",
    description:
        "AI that remembers you. Multi-model access. Your team. One interface for everything you build.",
};

// Re-export the HomePage component from the root page
export { default } from "../page";
