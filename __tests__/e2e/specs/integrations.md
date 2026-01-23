# Integrations User Flow Specification

## Overview

Tests for service integrations - OAuth connections and virtual service tools. These
tests validate that users can connect services and that connected services provide tools
to the chat.

## Critical User Flows

### 1. View Integrations Page

**Priority:** P0 (Critical)

**Steps:**

1. Navigate to `/integrations`
2. Verify page loads without errors
3. Verify service categories are displayed
4. Verify connected/disconnected states are accurate

**Acceptance Criteria:**

- Page loads successfully for authenticated users
- Service list renders correctly
- Connection status reflects actual state

### 2. OAuth Connection Flow

**Priority:** P1 (High)

**Steps:**

1. Navigate to `/integrations`
2. Click "Connect" on an OAuth service (e.g., Notion)
3. Verify redirect to OAuth authorize page
4. Complete OAuth flow (may require real credentials in CI)
5. Verify redirect back to Carmenta
6. Verify service now shows as connected

**Acceptance Criteria:**

- OAuth redirect preserves return URL
- No internal hostname leaks (regression for existing test)
- Connection persists after page refresh

### 3. Virtual Service Tools Load

**Priority:** P0 (Critical) **Regression for:** PR #850 (virtual service tools bug)

**Steps:**

1. Have a virtual service configured (e.g., Gmail via Quo)
2. Navigate to chat
3. Send a message that triggers the service tool
4. Verify tool call appears in chat
5. Verify tool result is displayed

**Acceptance Criteria:**

- Virtual service tools are available in tool list
- Tool execution works correctly
- Tool results render properly

### 4. Disconnect Service

**Priority:** P2 (Medium)

**Steps:**

1. Navigate to `/integrations`
2. Click "Disconnect" on a connected service
3. Confirm disconnection
4. Verify service now shows as disconnected
5. Verify service tools no longer available in chat

**Acceptance Criteria:**

- Disconnect requires confirmation
- Service status updates immediately
- Tools are properly removed

### 5. Handle Missing OAuth Scopes

**Priority:** P1 (High) **Regression for:** PR #847 (missing scopes rejection)

**Steps:**

1. Attempt OAuth with incomplete scope grant
2. Verify appropriate error message
3. Verify user can retry with correct scopes

**Acceptance Criteria:**

- Clear error message for missing scopes
- No partial/broken connection created
- Recovery path is clear to user

## Test Data Requirements

- Test OAuth credentials in CI secrets
- Mock OAuth flow for unit testing
- Virtual service configuration for tool tests

## Selectors

```typescript
const SELECTORS = {
  integrationsList: '[data-testid="integrations-list"]',
  connectButton: '[data-testid="connect-service"]',
  disconnectButton: '[data-testid="disconnect-service"]',
  connectionStatus: '[data-testid="connection-status"]',
  oauthError: '[data-testid="oauth-error"]',
};
```

## Notes

- OAuth tests may need to skip in fork PRs (no secrets)
- Use existing `oauth-flows.test.ts` patterns where applicable
- Virtual service tests should mock the underlying API
