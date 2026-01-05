import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "MCP Servers · Carmenta",
    description: "Connect remote MCP servers to extend capabilities.",
};

export default function McpLayout({ children }: { children: React.ReactNode }) {
    return children;
}
