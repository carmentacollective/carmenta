import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Fresh Start · Carmenta",
    description: "Start fresh. We're ready when you are.",
};

/**
 * New Connection Route - Reset Trampoline
 *
 * This route serves as a "fresh load" mechanism. It immediately redirects
 * to /connection, which forces a clean page load and resets any client state.
 *
 * Use case: When a user is on /connection and has started typing but wants
 * to completely start over, clicking "New" navigates here, which redirects
 * back to /connection with a fresh server-side render.
 */
export default async function NewConnectionPage() {
    redirect("/connection");
}
