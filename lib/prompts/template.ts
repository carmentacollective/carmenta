import Handlebars from "handlebars";

/**
 * Type-safe prompt template system using Handlebars.
 *
 * Provides declarative templates with:
 * - Variable interpolation: {{variable}}
 * - Conditional sections: {{#if condition}}...{{/if}}
 * - Nested paths: {{user.profile.name}}
 * - Custom helpers for common patterns
 *
 * Why Handlebars over custom Mustache-style:
 * - Battle-tested with 8M+ weekly downloads
 * - Rich conditional blocks ({{#if}}, {{#unless}}, {{#each}})
 * - Extensible with custom helpers
 * - Well-documented and maintained
 *
 * @example
 * ```typescript
 * const template = createTemplate<{ userName?: string; dateInfo: string }>(`
 * Today is {{dateInfo}}.
 *
 * {{#if userName}}
 * We're working with {{userName}}.
 * {{/if}}
 * `);
 *
 * const result = template({ dateInfo: "Monday, December 11", userName: "Nick" });
 * ```
 */

// Precompiled template cache for performance
const templateCache = new Map<string, Handlebars.TemplateDelegate>();

/**
 * Register custom Handlebars helpers for prompt templating.
 *
 * These helpers provide semantic clarity for common LLM prompt patterns.
 */
function registerHelpers() {
    // Only register once
    if (Handlebars.helpers["trim"]) return;

    /**
     * Trim whitespace from block content.
     * Useful for templates with lots of conditional whitespace.
     *
     * @example
     * {{#trim}}
     *   Some content with extra whitespace
     * {{/trim}}
     */
    Handlebars.registerHelper("trim", function (this: unknown, options) {
        const content = options.fn(this);
        return content.trim();
    });

    /**
     * Join array items with a separator.
     *
     * @example
     * {{#join items ", "}}{{this}}{{/join}}
     */
    Handlebars.registerHelper(
        "join",
        function (
            this: unknown,
            items: unknown[],
            separator: string,
            options: Handlebars.HelperOptions
        ) {
            if (!Array.isArray(items)) return "";
            return items.map((item) => options.fn(item)).join(separator);
        }
    );

    /**
     * Include content only if value is truthy and non-empty string.
     * More strict than {{#if}} which treats empty string as falsy anyway.
     *
     * @example
     * {{#present userName}}Welcome, {{userName}}!{{/present}}
     */
    Handlebars.registerHelper(
        "present",
        function (this: unknown, value: unknown, options: Handlebars.HelperOptions) {
            if (
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !(Array.isArray(value) && value.length === 0)
            ) {
                return options.fn(this);
            }
            return options.inverse ? options.inverse(this) : "";
        }
    );

    /**
     * Equality comparison helper.
     *
     * @example
     * {{#eq role "admin"}}Admin controls here{{/eq}}
     */
    Handlebars.registerHelper(
        "eq",
        function (
            this: unknown,
            a: unknown,
            b: unknown,
            options: Handlebars.HelperOptions
        ) {
            return a === b ? options.fn(this) : options.inverse(this);
        }
    );

    /**
     * Not-equal comparison helper.
     *
     * @example
     * {{#neq status "pending"}}Status resolved{{/neq}}
     */
    Handlebars.registerHelper(
        "neq",
        function (
            this: unknown,
            a: unknown,
            b: unknown,
            options: Handlebars.HelperOptions
        ) {
            return a !== b ? options.fn(this) : options.inverse(this);
        }
    );
}

// Register helpers on module load
registerHelpers();

/**
 * Compile and cache a Handlebars template.
 *
 * Templates are cached by their source string to avoid recompilation.
 * The cache persists for the lifetime of the process.
 *
 * @param source - The template string
 * @returns Compiled template delegate
 */
function compileTemplate(source: string): Handlebars.TemplateDelegate {
    let compiled = templateCache.get(source);
    if (!compiled) {
        compiled = Handlebars.compile(source, {
            // Strict mode: throw on missing properties instead of returning empty string
            // Disabled for now - LLM prompts often have optional sections
            strict: false,
            // Assume all inputs are already escaped (we're generating prompts, not HTML)
            noEscape: true,
        });
        templateCache.set(source, compiled);
    }
    return compiled;
}

/**
 * Create a type-safe template function.
 *
 * Returns a function that accepts a context object and returns the rendered string.
 * The context type is enforced at compile time.
 *
 * @param source - The Handlebars template string
 * @returns A function that renders the template with the given context
 *
 * @example
 * ```typescript
 * interface SessionContext {
 *   dateInfo: string;
 *   userName?: string;
 *   timezone?: string;
 * }
 *
 * const sessionTemplate = createTemplate<SessionContext>(`
 * ## Session Context
 *
 * Today is {{dateInfo}}.
 *
 * {{#if userName}}
 * We're working with {{userName}}.
 * {{/if}}
 * `);
 *
 * // TypeScript ensures correct context shape
 * const result = sessionTemplate({ dateInfo: "Monday, December 11" });
 * ```
 */
export function createTemplate<TContext extends object>(
    source: string
): (context: TContext) => string {
    const compiled = compileTemplate(source);
    return (context: TContext) => compiled(context);
}

/**
 * Render a template string with the given context.
 *
 * For one-off rendering without type safety. Prefer createTemplate()
 * for templates that will be reused.
 *
 * @param source - The Handlebars template string
 * @param context - The context object for interpolation
 * @returns The rendered string
 *
 * @example
 * ```typescript
 * const result = render("Hello, {{name}}!", { name: "World" });
 * // "Hello, World!"
 * ```
 */
export function render(source: string, context: Record<string, unknown>): string {
    const compiled = compileTemplate(source);
    return compiled(context);
}

/**
 * Clear the template cache.
 *
 * Useful for testing or when templates are dynamically generated.
 */
export function clearTemplateCache(): void {
    templateCache.clear();
}

/**
 * Get the current size of the template cache.
 *
 * Useful for debugging and monitoring.
 */
export function getTemplateCacheSize(): number {
    return templateCache.size;
}

/**
 * Pre-compile and cache multiple templates.
 *
 * Call this at startup for templates that will be used frequently
 * to avoid compilation overhead on first use.
 *
 * @param templates - Object mapping names to template strings
 */
export function precompileTemplates(templates: Record<string, string>): void {
    for (const source of Object.values(templates)) {
        compileTemplate(source);
    }
}
