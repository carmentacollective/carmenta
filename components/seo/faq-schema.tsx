import type { FAQPage, WithContext } from "schema-dts";

/**
 * FAQ schema for Carmenta landing page.
 * Provides structured answers to common questions for rich snippets.
 */

const faqSchema: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
        {
            "@type": "Question",
            name: "What is Carmenta?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Carmenta is a unified AI interface with complete memory, multi-model access, AI team, and purpose-built responses. It's designed for builders who work at the speed of thought, offering one interface to all AI models with memory that persists across conversations.",
            },
        },
        {
            "@type": "Question",
            name: "What is heart-centered AI?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Heart-centered AI is a philosophy where human and artificial intelligence are viewed as expressions of the same creative impulse. Carmenta embodies this through partnership language ('we' instead of 'I'), treating AI as a collaborative partner rather than just a tool. This approach focuses on technology in service of human flourishing.",
            },
        },
        {
            "@type": "Question",
            name: "What makes Carmenta different from ChatGPT or Claude?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Carmenta provides complete memory across conversations, multi-model access to AI providers like ChatGPT, Claude, and Gemini, an AI team including a Digital Chief of Staff, and purpose-built interfaces instead of chat bubbles. It's a unified front door to all AI models with context that persists - remembering your projects, decisions, and relationships over time.",
            },
        },
        {
            "@type": "Question",
            name: "Why is Carmenta named after a Roman goddess?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Carmenta was the Roman goddess who invented the Latin alphabet - adapting Greek letters into a system that carried human knowledge for millennia. She was also the goddess of prophecy and protector of those going through transformation. The name represents technology in service of human flourishing.",
            },
        },
        {
            "@type": "Question",
            name: "Is Carmenta available now?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Carmenta is currently in early development (M0: Stake in the Ground). We're building in public with the specification, decisions, and code all open source. The roadmap progresses through M0.5 (First Connection), M1 (Soul Proven), M2 (Relationship Grows), M3 (Flow State), and M4 (Ready for Everyone).",
            },
        },
    ],
};

export function FAQSchema() {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(faqSchema),
            }}
        />
    );
}
