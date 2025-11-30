import type { Organization, WebSite, WithContext } from "schema-dts";

/**
 * Structured data (JSON-LD) for Carmenta.
 * Implements Schema.org markup for better search engine understanding.
 */

const organizationSchema: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Carmenta Collective",
    url: "https://carmenta.ai",
    logo: "https://carmenta.ai/logos/icon-transparent-512.png",
    description:
        "Carmenta is a heart-centered AI interface with complete memory, multi-model access, AI team, and purpose-built responses for builders working at the speed of thought.",
    foundingDate: "2024",
    sameAs: [
        "https://github.com/carmentacollective/carmenta",
        "https://heartcentered.ai",
    ],
    contactPoint: {
        "@type": "ContactPoint",
        contactType: "Support",
        url: "https://carmenta.ai/connect",
    },
};

const websiteSchema: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Carmenta",
    url: "https://carmenta.ai",
    description:
        "One interface. All AI models. Complete memory. Carmenta is a unified AI interface with multi-model access, AI team, and purpose-built responses for builders.",
    publisher: {
        "@type": "Organization",
        name: "Carmenta Collective",
        logo: {
            "@type": "ImageObject",
            url: "https://carmenta.ai/logos/icon-transparent-512.png",
        },
    },
};

export function StructuredData() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(organizationSchema),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(websiteSchema),
                }}
            />
        </>
    );
}
