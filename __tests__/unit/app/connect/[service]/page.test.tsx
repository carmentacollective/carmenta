import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectServicePage from "@/app/connect/[service]/page";

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock("next/navigation", () => ({
    useParams: () => mockUseParams(),
}));

// Mock Nango SDK
vi.mock("@nangohq/frontend", () => ({
    default: vi.fn().mockImplementation(() => ({
        openConnectUI: vi.fn().mockReturnValue({}),
    })),
}));

// Mock client logger
vi.mock("@/lib/client-logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock services registry
vi.mock("@/lib/integrations/services", () => ({
    getServiceById: vi.fn((id: string) => ({
        id,
        name: id === "notion" ? "Notion" : "Test Service",
        description: "Test description",
        logo: "/logos/test.svg",
        authMethod: "oauth",
        status: "available",
    })),
}));

describe("ConnectServicePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseParams.mockReturnValue({ service: "notion" });
    });

    it("renders loading state initially", () => {
        render(<ConnectServicePage />);

        expect(screen.getByText(/Connecting Notion/i)).toBeTruthy();
        expect(
            screen.getByText(/We're redirecting you to authorize access/i)
        ).toBeTruthy();
    });
});
