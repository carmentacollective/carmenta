import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const config: NextConfig = {
    // Create a standalone build with minimal dependencies
    // This reduces deployment size by ~90% (from ~1GB to ~100MB)
    output: "standalone",

    reactStrictMode: true,

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

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "carmenta.ai",
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
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains; preload",
                    },
                ],
            },
        ];
    },

    // Turbopack configuration (Next.js 16 uses Turbopack by default)
    turbopack: {},

    // Keep webpack config for backward compatibility
    webpack: (config, { isServer }) => {
        config.cache = {
            type: "filesystem",
            buildDependencies: {
                config: [__filename],
            },
        };

        config.infrastructureLogging = {
            ...config.infrastructureLogging,
            level: "error",
        };

        if (isServer) {
            // Mark Pino and related packages as external to prevent bundling
            config.externals = config.externals || [];
            config.externals.push("pino", "pino-pretty", "thread-stream");
        }

        return config;
    },

    serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
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
    disableLogger: true,

    // Tunnel Sentry requests through our own domain to avoid ad blockers
    tunnelRoute: "/monitoring",

    // Disable Sentry during development unless explicitly enabled
    hideSourceMaps: process.env.NODE_ENV === "development",

    // Turbopack is supported as of SDK 10.13.0
    // No special configuration needed
};

export default withSentryConfig(config, sentryConfig);
