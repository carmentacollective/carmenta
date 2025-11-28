"use client";

import { CopilotKit } from "@copilotkit/react-core";

interface CopilotKitProviderProps {
    children: React.ReactNode;
}

export function CopilotKitProvider({ children }: CopilotKitProviderProps) {
    return <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>;
}
