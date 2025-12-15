# Integration Tests for Service Adapters

This directory contains integration tests that make **real API calls** to external
services. These tests verify that our service adapters work correctly with actual APIs,
catching issues that mocked tests would miss.

## Running Integration Tests

Integration tests require API keys and are automatically skipped unless the required
environment variables are set.

### Giphy Integration Tests

Tests the Giphy service adapter with real API calls.

**Run tests:**

```bash
GIPHY_API_KEY=your_key_here pnpm test giphy.integration
```

**Get an API key:** https://developers.giphy.com/

**Test coverage (15 tests):**

- Connection validation
- GIF search with filters (query, limit, rating)
- Random GIF retrieval
- Trending GIFs
- Raw API access
- Error handling and parameter validation

### CoinMarketCap Integration Tests

Tests the CoinMarketCap service adapter with real API calls.

**Run tests:**

```bash
COINMARKETCAP_API_KEY=your_key_here pnpm test coinmarketcap.integration
```

**Get an API key:** https://coinmarketcap.com/api/

**Test coverage (27 tests):**

- Connection validation
- Cryptocurrency listings with sorting and pagination
- Quote retrieval by symbol/ID/slug
- Global market metrics
- Cryptocurrency metadata and info
- Category listings
- Price conversion
- Exchange data
- Raw API access
- Comprehensive error handling

## Why Integration Tests?

While unit tests verify logic with mocks, integration tests catch:

- **API structure changes** - Real responses might differ from documentation
- **Rate limiting behavior** - How services actually handle limits
- **Authentication edge cases** - Invalid keys, expired tokens, permission errors
- **Response format variations** - V1 vs V2 endpoints, array vs object responses
- **Real-world error messages** - What users actually see

## CI/CD Behavior

**Without API keys:** All integration tests skip automatically. This allows CI/CD
pipelines to run the full test suite without requiring external API credentials.

**With API keys:** Tests make real API calls and verify actual integration behavior.

## Adding New Integration Tests

Follow the existing pattern:

1. **Create test file:** `[service].integration.test.ts`
2. **Use describeIf pattern:**
   ```typescript
   const API_KEY = process.env.SERVICE_API_KEY;
   const describeIf = API_KEY ? describe : describe.skip;
   ```
3. **Set up test database:** `setupTestDb()`
4. **Create test fixtures:** Use `createTestUser()` and `createTestApiKeyIntegration()`
5. **Write comprehensive tests:** Cover all operations, error cases, and edge cases
6. **Update documentation:** Add section to `__tests__/AGENTS.md` and this README

## Best Practices

- **Test with real data:** Use actual API calls, don't mock responses
- **Verify response structure:** Check that properties exist and have correct types
- **Test error cases:** Invalid keys, missing parameters, rate limits
- **Use non-null assertions carefully:** Only when you've verified data exists
- **Add helpful test names:** Describe what behavior is being verified
- **Focus on user value:** Test what makes the tool useful for LLMs helping users
