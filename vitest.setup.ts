import "@testing-library/jest-dom/vitest";

// Environment is automatically set to "test" by vitest
// env.ts skips validation when NODE_ENV === "test"

// Mock window.matchMedia for components that check for prefers-reduced-motion
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
    }),
});
