import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Import Data · Carmenta",
    description:
        "Bring your AI history to Carmenta. Import conversations from ChatGPT and other platforms.",
};

export default function ImportLayout({ children }: { children: React.ReactNode }) {
    return children;
}
