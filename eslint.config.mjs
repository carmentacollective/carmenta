import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
    // Global ignores must come FIRST
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "coverage/**",
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
        "**/*.config.mjs",
        "**/*.config.js",
    ]),
    ...nextVitals,
    ...nextTs,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "react/no-unescaped-entities": "off",
        },
    },
    // Relax rules for test files
    {
        files: [
            "**/__tests__/**",
            "**/*.test.ts",
            "**/*.test.tsx",
            "**/*.spec.ts",
            "**/*.spec.tsx",
        ],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@next/next/no-img-element": "off",
        },
    },
]);

export default eslintConfig;
