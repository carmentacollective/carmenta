import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Hire · AI Team · Carmenta",
    description:
        "Create a new AI team member to automate tasks and work alongside you.",
};

export default function HireLayout({ children }: { children: React.ReactNode }) {
    return children;
}
