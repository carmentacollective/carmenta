import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Route protection proxy using Clerk
 *
 * Public-by-default security model: All routes are public except those explicitly protected.
 * This is more secure because new routes default to public, requiring explicit opt-in for protection.
 *
 * Protected routes (require authentication):
 * - /connection/* (all conversation routes)
 * - /integrations (service connections dashboard)
 * - /connect/* (OAuth connection flows)
 * - /api/* (all API routes except webhooks)
 *
 * Public exceptions:
 * - /api/webhooks/* (external services with signature verification)
 *
 * Unauthenticated users attempting to access protected routes are
 * automatically redirected to the sign-in page.
 *
 * Authenticated users on landing page (/) are redirected to /connection.
 *
 * Note: Next.js 16 renamed middleware.ts to proxy.ts
 * The clerkMiddleware helper name remains unchanged
 */
const isProtectedRoute = createRouteMatcher([
    "/connection(.*)",
    "/integrations(.*)",
    "/connect(.*)",
    "/api(.*)",
]);

const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();

    // Authenticated users on landing page → redirect to connection
    if (userId && req.nextUrl.pathname === "/") {
        return Response.redirect(new URL("/connection", req.url));
    }

    // Webhooks are public (use signature verification instead)
    if (isWebhookRoute(req)) {
        return;
    }

    // Protect explicitly protected routes
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
