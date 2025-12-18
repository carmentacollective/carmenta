import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Integrations · Carmenta",
    description: "Connect external services to unlock new capabilities.",
};

export default function IntegrationsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
