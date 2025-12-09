---
description: Test a service integration through natural language chat
---

# Test Integration Command

Test a Carmenta service integration by interacting with it through natural language.

## Arguments

`/test-integration <service-name>`

Example: `/test-integration giphy` or `/test-integration notion`

## Goal

Verify a service integration works correctly by testing it through Carmenta's chat
interface. The integration tools are automatically available when a service is
connected.

## Prerequisites

Before testing, ensure:

1. The service is connected at `/integrations`
2. You have valid credentials (API key or OAuth)
3. The service status is not "error" or "expired"

## Testing Process

### 1. Connectivity Check

Start by asking Carmenta to describe the service's capabilities:

> "What can you do with [service]?"

This triggers `action='describe'` and verifies:

- Tool is registered for the user
- Credentials are accessible
- Adapter loads correctly

### 2. Basic Read Operation

Test a simple read operation that calls the actual API:

**Giphy:** "Search for cat GIFs on Giphy" **Notion:** "List my Notion pages"
**ClickUp:** "Show my ClickUp workspaces" **Fireflies:** "Get my recent meetings from
Fireflies" **Limitless:** "Show recent Limitless lifelogs"

If this fails with authentication errors, stop and fix credentials first.

### 3. Core Operations

Test the main use cases for each service:

**For search/list services:**

- Search with different queries
- Test pagination if available
- Verify result structure

**For CRUD services:**

- Create a test item
- Read/list to verify creation
- Update the item
- Delete and verify cleanup

**For read-only services:**

- Test various query parameters
- Verify data completeness
- Check error handling

### 4. Edge Cases

Test how the integration handles:

- Empty results: "Search for XYZNONEXISTENT123 on [service]"
- Invalid parameters: Request with missing required fields
- Rate limits: Multiple rapid requests (if safe to do)

### 5. raw_api Fallback

If the service has raw_api, test the escape hatch:

> "Use [service]'s raw API to call [endpoint]"

Verify it correctly proxies requests to the underlying API.

## Expected Behavior

**Successful operations should:**

- Return relevant data in readable format
- Include appropriate metadata
- Handle pagination when needed

**Errors should:**

- Show clear, user-friendly messages
- Not expose internal details
- Suggest next steps when possible

## Bug Documentation

When you find issues, document:

```
Bug: [Brief description]
Service: [service-name]
Operation: [operation-name]
Expected: [What should happen]
Actual: [What actually happened]
Error message: [If any]
```

## Common Issues

**"No connection found"**

- Verify service is connected at /integrations
- Check credentials haven't expired

**Empty responses**

- Some services return empty for fresh accounts
- Try with known data if possible

**API errors**

- Check rate limits
- Verify API key permissions
- For OAuth, check token freshness

## Testing Checklist

- [ ] Describe action works (tool is loaded)
- [ ] Basic read operation succeeds
- [ ] Multiple operations work correctly
- [ ] Error handling is graceful
- [ ] raw_api fallback works (if available)
- [ ] Edge cases handled appropriately

## Report Template

```
✅ [Service] Integration Test Complete

**Operations Tested:**
- describe: ✅ Works
- [operation]: ✅/❌ [notes]
- [operation]: ✅/❌ [notes]
- raw_api: ✅/❌ [notes]

**Issues Found:**
- [Issue 1]
- [Issue 2]

**Overall Status:** Ready for production / Needs fixes

**Recommendations:**
- [Any improvements or observations]
```
