import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: [
            "__tests__/unit/**/*.{test,spec}.{ts,tsx}",
            "__tests__/integration/**/*.{test,spec}.{ts,tsx}",
        ],
        pool: "threads",
        poolOptions: {
            threads: {
                singleThread: false,
                isolate: true,
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "__tests__/",
                "**/*.config.*",
                "**/*.d.ts",
                ".next/",
                "out/",
            ],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
});
