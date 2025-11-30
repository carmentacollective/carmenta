import type { BreadcrumbList, WithContext } from "schema-dts";

/**
 * Breadcrumb schema for improved SERP display.
 */

interface BreadcrumbSchemaProps {
    items: Array<{
        name: string;
        url: string;
    }>;
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
    const breadcrumbSchema: WithContext<BreadcrumbList> = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
            }}
        />
    );
}
