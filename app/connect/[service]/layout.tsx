import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Connecting · Carmenta",
    description: "Connecting your service securely.",
};

export default function ConnectServiceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
