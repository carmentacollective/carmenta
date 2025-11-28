import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Route protection proxy using Clerk
 *
 * Public routes: Landing page, sign-in/sign-up, and static assets
 * Protected routes: /connect, /api/* (requires authentication)
 *
 * Note: Next.js 16 renamed middleware.ts to proxy.ts
 * The clerkMiddleware helper name remains unchanged
 */
const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/ai-first-development(.*)",
    // Static assets and Next.js internals
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
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
