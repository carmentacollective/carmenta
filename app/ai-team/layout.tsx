import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "AI Team · Carmenta",
    description:
        "Your AI team members working alongside you - automations, scheduled tasks, and intelligent agents.",
};

export default function AITeamLayout({ children }: { children: React.ReactNode }) {
    return children;
}
