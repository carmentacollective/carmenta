import "@testing-library/jest-dom/vitest";

// Environment is automatically set to "test" by vitest

// Skip env validation during tests - env vars are mocked where needed
process.env.SKIP_ENV_VALIDATION = "true";
