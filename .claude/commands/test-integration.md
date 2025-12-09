---
description: Test a service integration through the chat interface
---

# Test Integration Command

`/test-integration <service-name>`

<objective>
Verify a service integration works correctly by testing operations through Carmenta's chat interface. Identify bugs, fix issues in adapter code, and document findings.
</objective>

<prerequisites>
- Service must be connected at `/integrations`
- OAuth services: Complete OAuth flow first
- API key services: Enter valid API key first
</prerequisites>

<testing-approach>
Use the chat interface to trigger tool calls. The integration appears as an AI tool.

**Start with connectivity check:**

Ask the LLM to test a basic read operation:

- Giphy: "Search for cat GIFs"
- Notion: "Search my workspace for meeting notes"
- ClickUp: "List my workspaces"
- Fireflies: "List my recent transcripts"
- Limitless: "Search recordings for 'project'"

If basic connectivity fails, debug the connection before testing other operations.

**Test core operations:**

- List/search operations
- Get specific items by ID
- Create operations (clean up test data)
- Update operations
- Delete operations

**Verify:**

- Responses have expected data structures
- Empty results handled gracefully
- Error messages are helpful </testing-approach>

<bug-documentation>
When bugs are found, document:
- Which operation failed
- Error messages observed
- Apparent root cause
- Affected operations
</bug-documentation>

<common-issues>
**Wrong Nango proxy URLs:** Returns HTML instead of JSON. Verify URL path matches real API.

**Array parameters not encoded:** Causes 400 errors. Check parameter handling.

**Response type mismatches:** Missing fields. Update adapter to match actual API
response.

**Poor error handling:** Unhelpful messages. Add context to error handling.
</common-issues>

<success-criteria>
- Basic connectivity verified with real API call
- Core operations tested through chat interface
- Bugs found and fixed
- Findings documented
- Test resources cleaned up
</success-criteria>
