import type { NextConfig } from "next";

const config: NextConfig = {
    // Create a standalone build with minimal dependencies
    // This reduces deployment size by ~90% (from ~1GB to ~100MB)
    output: "standalone",

    reactStrictMode: true,

    typescript: {
        // Skip type checking during builds since we do it in CI
        ignoreBuildErrors: true,
    },

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

export default config;
