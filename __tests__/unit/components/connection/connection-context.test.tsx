/**
 * Tests for connection context hooks
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useConnectionSafe } from "@/components/connection/connection-context";

describe("useConnectionSafe", () => {
    it("returns null when used outside ConnectionProvider", () => {
        const { result } = renderHook(() => useConnectionSafe());
        expect(result.current).toBeNull();
    });
});
