/**
 * Tests for concierge context
 *
 * Tests the ConciergeProvider, useConcierge hook, and parseConciergeHeaders.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

import {
    ConciergeProvider,
    useConcierge,
    parseConciergeHeaders,
} from "@/lib/concierge/context";

describe("ConciergeProvider and useConcierge", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ConciergeProvider>{children}</ConciergeProvider>
    );

    it("provides null concierge by default", () => {
        const { result } = renderHook(() => useConcierge(), { wrapper });

        expect(result.current.concierge).toBeNull();
    });

    it("allows setting concierge data", () => {
        const { result } = renderHook(() => useConcierge(), { wrapper });

        act(() => {
            result.current.setConcierge({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.7,
                explanation: "Creative task requires higher temperature",
                reasoning: { enabled: true, effort: "medium" },
            });
        });

        expect(result.current.concierge).toEqual({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.7,
            explanation: "Creative task requires higher temperature",
            reasoning: { enabled: true, effort: "medium" },
        });
    });

    it("allows clearing concierge data", () => {
        const { result } = renderHook(() => useConcierge(), { wrapper });

        // Set data first
        act(() => {
            result.current.setConcierge({
                modelId: "anthropic/claude-opus-4.5",
                temperature: 0.5,
                explanation: "Default selection",
                reasoning: { enabled: false },
            });
        });

        // Clear it
        act(() => {
            result.current.setConcierge(null);
        });

        expect(result.current.concierge).toBeNull();
    });

    it("throws error when used outside provider", () => {
        expect(() => {
            renderHook(() => useConcierge());
        }).toThrow("useConcierge must be used within ConciergeProvider");
    });
});

describe("parseConciergeHeaders", () => {
    it("parses valid headers successfully", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.7",
            "X-Concierge-Explanation": "Good%20for%20coding",
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: true, effort: "medium" })
            ),
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result).toEqual({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.7,
            explanation: "Good for coding",
            reasoning: { enabled: true, effort: "medium" },
        });
    });

    it("returns null when model ID header is missing", () => {
        const headers = new Headers({
            "X-Concierge-Temperature": "0.7",
            "X-Concierge-Explanation": "Some explanation",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result).toBeNull();
    });

    it("returns null when temperature header is missing", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Explanation": "Some explanation",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result).toBeNull();
    });

    it("returns null when explanation header is missing", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.7",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result).toBeNull();
    });

    it("defaults to 0.5 temperature for NaN values", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "not-a-number",
            "X-Concierge-Explanation": "Some explanation",
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: false })
            ),
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result).toEqual({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.5,
            explanation: "Some explanation",
            reasoning: { enabled: false },
        });
    });

    it("decodes URL-encoded explanation", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-opus-4.5",
            "X-Concierge-Temperature": "0.3",
            "X-Concierge-Explanation":
                "Complex%20task%20requiring%20deep%20reasoning%20%26%20analysis",
            "X-Concierge-Reasoning": encodeURIComponent(
                JSON.stringify({ enabled: true, effort: "high", maxTokens: 16000 })
            ),
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result?.explanation).toBe(
            "Complex task requiring deep reasoning & analysis"
        );
        expect(result?.reasoning).toEqual({
            enabled: true,
            effort: "high",
            maxTokens: 16000,
        });
    });

    it("handles empty headers gracefully", () => {
        const response = new Response(null);

        const result = parseConciergeHeaders(response);

        expect(result).toBeNull();
    });

    it("parses integer temperature correctly", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "google/gemini-pro",
            "X-Concierge-Temperature": "1",
            "X-Concierge-Explanation": "Creative mode",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result?.temperature).toBe(1);
    });

    it("parses zero temperature correctly", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0",
            "X-Concierge-Explanation": "Deterministic mode",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result?.temperature).toBe(0);
    });

    it("defaults reasoning to disabled when header missing", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.5",
            "X-Concierge-Explanation": "Quick task",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result?.reasoning).toEqual({ enabled: false });
    });

    it("defaults reasoning to disabled when header is invalid JSON", () => {
        const headers = new Headers({
            "X-Concierge-Model-Id": "anthropic/claude-sonnet-4.5",
            "X-Concierge-Temperature": "0.5",
            "X-Concierge-Explanation": "Quick task",
            "X-Concierge-Reasoning": "not-valid-json",
        });
        const response = new Response(null, { headers });

        const result = parseConciergeHeaders(response);

        expect(result?.reasoning).toEqual({ enabled: false });
    });
});
