import { describe, it, expect, beforeEach } from "vitest";
import {
    createTemplate,
    render,
    clearTemplateCache,
    getTemplateCacheSize,
    precompileTemplates,
} from "@/lib/prompts/template";

describe("template utility", () => {
    beforeEach(() => {
        clearTemplateCache();
    });

    describe("createTemplate", () => {
        it("creates a reusable template function", () => {
            const template = createTemplate<{ name: string }>("Hello, {{name}}!");
            const result = template({ name: "World" });
            expect(result).toBe("Hello, World!");
        });

        it("supports multiple variables", () => {
            const template = createTemplate<{ greeting: string; name: string }>(
                "{{greeting}}, {{name}}!"
            );
            const result = template({ greeting: "Hi", name: "Nick" });
            expect(result).toBe("Hi, Nick!");
        });

        it("handles missing variables gracefully", () => {
            const template = createTemplate<{ name?: string }>("Hello, {{name}}!");
            const result = template({});
            expect(result).toBe("Hello, !");
        });

        it("caches compiled templates", () => {
            const source = "Hello, {{name}}!";
            createTemplate<{ name: string }>(source);
            createTemplate<{ name: string }>(source);
            expect(getTemplateCacheSize()).toBe(1);
        });

        it("caches different templates separately", () => {
            createTemplate<{ a: string }>("Template {{a}}");
            createTemplate<{ b: string }>("Template {{b}}");
            expect(getTemplateCacheSize()).toBe(2);
        });
    });

    describe("render", () => {
        it("renders a template string with context", () => {
            const result = render("Hello, {{name}}!", { name: "World" });
            expect(result).toBe("Hello, World!");
        });

        it("handles nested paths", () => {
            const result = render("Hello, {{user.profile.name}}!", {
                user: { profile: { name: "Nick" } },
            });
            expect(result).toBe("Hello, Nick!");
        });

        it("returns empty string for missing nested paths", () => {
            const result = render("Hello, {{user.profile.name}}!", { user: {} });
            expect(result).toBe("Hello, !");
        });
    });

    describe("conditional blocks", () => {
        it("renders content when condition is truthy", () => {
            const template = createTemplate<{ show: boolean; message: string }>(
                "{{#if show}}{{message}}{{/if}}"
            );
            const result = template({ show: true, message: "Visible!" });
            expect(result).toBe("Visible!");
        });

        it("omits content when condition is falsy", () => {
            const template = createTemplate<{ show: boolean; message: string }>(
                "{{#if show}}{{message}}{{/if}}"
            );
            const result = template({ show: false, message: "Hidden!" });
            expect(result).toBe("");
        });

        it("handles else blocks", () => {
            const template = createTemplate<{ loggedIn: boolean }>(
                "{{#if loggedIn}}Welcome back!{{else}}Please log in.{{/if}}"
            );
            expect(template({ loggedIn: true })).toBe("Welcome back!");
            expect(template({ loggedIn: false })).toBe("Please log in.");
        });

        it("treats non-empty strings as truthy", () => {
            const template = createTemplate<{ name?: string }>(
                "{{#if name}}Hello, {{name}}!{{/if}}"
            );
            expect(template({ name: "Nick" })).toBe("Hello, Nick!");
        });

        it("treats empty strings as falsy", () => {
            const template = createTemplate<{ name?: string }>(
                "{{#if name}}Hello, {{name}}!{{/if}}"
            );
            expect(template({ name: "" })).toBe("");
        });

        it("treats undefined as falsy", () => {
            const template = createTemplate<{ name?: string }>(
                "{{#if name}}Hello, {{name}}!{{/if}}"
            );
            expect(template({})).toBe("");
        });

        it("supports unless (inverse of if)", () => {
            const template = createTemplate<{ error?: string }>(
                "{{#unless error}}All good!{{/unless}}"
            );
            expect(template({})).toBe("All good!");
            expect(template({ error: "Something went wrong" })).toBe("");
        });
    });

    describe("iteration", () => {
        it("iterates over arrays with each", () => {
            const template = createTemplate<{ items: string[] }>(
                "{{#each items}}{{this}} {{/each}}"
            );
            const result = template({ items: ["a", "b", "c"] });
            expect(result).toBe("a b c ");
        });

        it("handles empty arrays", () => {
            const template = createTemplate<{ items: string[] }>(
                "{{#each items}}{{this}}{{/each}}"
            );
            const result = template({ items: [] });
            expect(result).toBe("");
        });

        it("provides @index in each loops", () => {
            const template = createTemplate<{ items: string[] }>(
                "{{#each items}}{{@index}}: {{this}} {{/each}}"
            );
            const result = template({ items: ["a", "b"] });
            expect(result).toBe("0: a 1: b ");
        });

        it("iterates over objects", () => {
            const template = createTemplate<{ obj: Record<string, string> }>(
                "{{#each obj}}{{@key}}={{this}} {{/each}}"
            );
            const result = template({ obj: { a: "1", b: "2" } });
            expect(result).toBe("a=1 b=2 ");
        });
    });

    describe("custom helpers", () => {
        describe("present helper", () => {
            it("renders when value is present", () => {
                const template = createTemplate<{ name?: string }>(
                    "{{#present name}}Hello, {{name}}!{{/present}}"
                );
                expect(template({ name: "Nick" })).toBe("Hello, Nick!");
            });

            it("does not render for undefined", () => {
                const template = createTemplate<{ name?: string }>(
                    "{{#present name}}Hello, {{name}}!{{/present}}"
                );
                expect(template({})).toBe("");
            });

            it("does not render for null", () => {
                const template = createTemplate<{ name?: string | null }>(
                    "{{#present name}}Hello, {{name}}!{{/present}}"
                );
                expect(template({ name: null })).toBe("");
            });

            it("does not render for empty string", () => {
                const template = createTemplate<{ name?: string }>(
                    "{{#present name}}Hello, {{name}}!{{/present}}"
                );
                expect(template({ name: "" })).toBe("");
            });

            it("does not render for empty array", () => {
                const template = createTemplate<{ items?: string[] }>(
                    "{{#present items}}Has items{{/present}}"
                );
                expect(template({ items: [] })).toBe("");
            });

            it("renders for non-empty array", () => {
                const template = createTemplate<{ items?: string[] }>(
                    "{{#present items}}Has items{{/present}}"
                );
                expect(template({ items: ["a"] })).toBe("Has items");
            });
        });

        describe("eq helper", () => {
            it("renders when values are equal", () => {
                const template = createTemplate<{ role: string }>(
                    '{{#eq role "admin"}}Admin panel{{/eq}}'
                );
                expect(template({ role: "admin" })).toBe("Admin panel");
            });

            it("does not render when values differ", () => {
                const template = createTemplate<{ role: string }>(
                    '{{#eq role "admin"}}Admin panel{{/eq}}'
                );
                expect(template({ role: "user" })).toBe("");
            });

            it("supports else block", () => {
                const template = createTemplate<{ role: string }>(
                    '{{#eq role "admin"}}Admin{{else}}User{{/eq}}'
                );
                expect(template({ role: "admin" })).toBe("Admin");
                expect(template({ role: "user" })).toBe("User");
            });
        });

        describe("neq helper", () => {
            it("renders when values are not equal", () => {
                const template = createTemplate<{ status: string }>(
                    '{{#neq status "pending"}}Resolved{{/neq}}'
                );
                expect(template({ status: "completed" })).toBe("Resolved");
            });

            it("does not render when values are equal", () => {
                const template = createTemplate<{ status: string }>(
                    '{{#neq status "pending"}}Resolved{{/neq}}'
                );
                expect(template({ status: "pending" })).toBe("");
            });
        });

        describe("trim helper", () => {
            it("trims whitespace from content", () => {
                const template = createTemplate<Record<string, never>>(
                    "{{#trim}}  content with spaces  {{/trim}}"
                );
                expect(template({})).toBe("content with spaces");
            });
        });

        describe("join helper", () => {
            it("joins array items with separator", () => {
                const template = createTemplate<{ tags: string[] }>(
                    '{{#join tags ", "}}{{this}}{{/join}}'
                );
                expect(template({ tags: ["a", "b", "c"] })).toBe("a, b, c");
            });

            it("handles empty arrays", () => {
                const template = createTemplate<{ tags: string[] }>(
                    '{{#join tags ", "}}{{this}}{{/join}}'
                );
                expect(template({ tags: [] })).toBe("");
            });
        });
    });

    describe("cache management", () => {
        it("clearTemplateCache removes all cached templates", () => {
            createTemplate<{ a: string }>("{{a}}");
            createTemplate<{ b: string }>("{{b}}");
            expect(getTemplateCacheSize()).toBe(2);

            clearTemplateCache();
            expect(getTemplateCacheSize()).toBe(0);
        });

        it("precompileTemplates caches multiple templates", () => {
            precompileTemplates({
                greeting: "Hello, {{name}}!",
                farewell: "Goodbye, {{name}}!",
                status: "Status: {{status}}",
            });
            expect(getTemplateCacheSize()).toBe(3);
        });
    });

    describe("complex templates", () => {
        it("handles multi-line templates with conditionals", () => {
            const template = createTemplate<{
                dateInfo: string;
                userName?: string;
            }>(`## Session Context

Today is {{dateInfo}}.

{{#if userName}}
We're working with {{userName}}.
{{/if}}`);

            const withName = template({
                dateInfo: "Monday, December 11",
                userName: "Nick",
            });
            expect(withName).toContain("Today is Monday, December 11.");
            expect(withName).toContain("We're working with Nick.");

            const withoutName = template({ dateInfo: "Monday, December 11" });
            expect(withoutName).toContain("Today is Monday, December 11.");
            expect(withoutName).not.toContain("We're working with");
        });

        it("preserves whitespace correctly", () => {
            const template = createTemplate<{ name: string }>(
                "Line 1\n\nLine 2\n\n{{name}}"
            );
            const result = template({ name: "test" });
            expect(result).toBe("Line 1\n\nLine 2\n\ntest");
        });
    });

    describe("edge cases", () => {
        it("handles special characters in values", () => {
            const template = createTemplate<{ code: string }>("Code: {{code}}");
            const result = template({ code: "const x = { a: 1 };" });
            expect(result).toBe("Code: const x = { a: 1 };");
        });

        it("handles HTML-like content without escaping", () => {
            const template = createTemplate<{ html: string }>("{{html}}");
            const result = template({ html: "<div>content</div>" });
            expect(result).toBe("<div>content</div>");
        });

        it("handles template syntax in values", () => {
            const template = createTemplate<{ example: string }>(
                "Example: {{example}}"
            );
            // Handlebars values don't get re-processed
            const result = template({ example: "{{not a variable}}" });
            expect(result).toBe("Example: {{not a variable}}");
        });

        it("handles numeric values", () => {
            const template = createTemplate<{ count: number }>("Count: {{count}}");
            const result = template({ count: 42 });
            expect(result).toBe("Count: 42");
        });

        it("handles boolean values", () => {
            const template = createTemplate<{ active: boolean }>("Active: {{active}}");
            expect(template({ active: true })).toBe("Active: true");
            expect(template({ active: false })).toBe("Active: false");
        });
    });
});
