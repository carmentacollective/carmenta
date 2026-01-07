import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

const config: NextConfig = {
    // Create a standalone build with minimal dependencies
    // This reduces deployment size by ~90% (from ~1GB to ~100MB)
    output: "standalone",

    reactStrictMode: true,

    // Hide Next.js dev indicators (build indicator, etc)
    devIndicators: false,

    // Force transpilation of ESM packages that have issues with pnpm + Turbopack
    // See: property-information's boolean import gets dropped during bundling
    transpilePackages: [
        "property-information",
        "hast-util-to-jsx-runtime",
        "react-markdown",
    ],

    // Type checking happens during build for safety
    // CI also runs type-check separately for faster feedback

    // Exclude unnecessary files from build trace collection
    outputFileTracingExcludes: {
        "*": [
            "node_modules/@swc/core-linux-x64-gnu",
            "node_modules/@swc/core-linux-x64-musl",
            "node_modules/@swc/core-darwin-x64",
            "node_modules/@swc/core-darwin-arm64",
            "node_modules/@esbuild",
            "node_modules/@next/swc-linux-x64-gnu",
            "node_modules/@next/swc-linux-x64-musl",
            "node_modules/@next/swc-darwin-x64",
            "node_modules/webpack/lib",
            "node_modules/terser",
        ],
    },

    // Image optimization config
    // Next.js 16 defaults: minimumCacheTTL 4h (was 60s), qualities [75] only
    // Remote patterns for next/image optimization:
    // - carmenta.ai: Marketing assets
    // - *.supabase.co: User-uploaded files (KB attachments)
    // Note: Clerk profile images use native <img> elements (various OAuth providers)
    // Note: GIFs use next/image with unoptimized={true} for animation support
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "carmenta.ai",
            },
            {
                protocol: "https",
                hostname: "*.supabase.co",
            },
        ],
    },

    async headers() {
        return [
            {
                // Apply security headers to all routes
                source: "/:path*",
                headers: [
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        // Disabled per OWASP recommendation - modern browsers don't need it
                        // and it can introduce security vulnerabilities in older browsers.
                        // We rely on CSP for XSS protection instead (added in M1+).
                        // See: https://owasp.org/www-project-secure-headers/
                        key: "X-XSS-Protection",
                        value: "0",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=()",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains; preload",
                    },
                ],
            },
        ];
    },

    // Prevent bundling of native Node packages (works with both Turbopack and Webpack)
    // braintrust: pulls in nunjucks → chokidar → fsevents (native module Turbopack can't bundle)
    serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "braintrust"],
};

// Sentry configuration options
const sentryConfig = {
    // Suppress source map upload logs during build
    silent: !process.env.CI,

    // Upload source maps for better stack traces
    // Requires SENTRY_AUTH_TOKEN to be set
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },

    // Automatically tree-shake Sentry SDK in production
    webpack: {
        treeshake: {
            removeDebugLogging: true,
        },
    },

    // Tunnel Sentry requests through our own domain to avoid ad blockers
    tunnelRoute: "/monitoring",
};

export default withBundleAnalyzer(withSentryConfig(config, sentryConfig));
