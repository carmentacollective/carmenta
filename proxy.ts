import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Route protection proxy using Clerk
 *
 * Public-by-default security model: All routes are public except those explicitly protected.
 * This is more secure because new routes default to public, requiring explicit opt-in for protection.
 *
 * Protected routes (require authentication):
 * - /connection/* (all conversation routes)
 * - /knowledge-base/* (user knowledge base)
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
 *
 * IMPORTANT: Next.js 16 requires the proxy function to be a NAMED export called "proxy".
 * Using `export default` instead of `export const proxy =` will cause:
 * "Error: Cannot append headers after they are sent to the client"
 */
const isProtectedRoute = createRouteMatcher([
    "/connection(.*)",
    "/knowledge-base(.*)",
    "/integrations(.*)",
    "/connect(.*)",
    "/api(.*)",
]);

const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);
const isHealthRoute = createRouteMatcher(["/healthz"]);
const isOAuthCallbackRoute = createRouteMatcher(["/integrations/oauth/callback(.*)"]);
const isInngestRoute = createRouteMatcher(["/api/inngest(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();

    // Authenticated users on landing page → redirect to connection
    if (userId && req.nextUrl.pathname === "/") {
        return NextResponse.redirect(new URL("/connection", req.url));
    }

    // Health check is public (used by Render for zero-downtime deployments)
    // Uses /healthz (Kubernetes convention) to avoid /api route protection
    if (isHealthRoute(req)) {
        return;
    }

    // OAuth callback is public (authenticated via state token)
    // State token provides CSRF protection + user identity + one-time use
    if (isOAuthCallbackRoute(req)) {
        return;
    }

    // Webhooks are public (use signature verification instead)
    if (isWebhookRoute(req)) {
        return;
    }

    // Inngest is public (uses signing key verification)
    if (isInngestRoute(req)) {
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
