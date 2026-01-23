# Chat User Flow Specification

## Overview

Tests for the core chat functionality - the primary user interaction in Carmenta. These
tests validate that users can send messages, receive responses, and interact with the
chat interface reliably.

## Critical User Flows

### 1. Send a Message and Receive Response

**Priority:** P0 (Critical)

**Steps:**

1. Navigate to `/connection/new/new`
2. Type a message in the composer input (`data-testid="composer-input"`)
3. Click send button (`data-testid="send-button"`) or press Enter
4. Verify message appears in chat
5. Verify assistant response streams in
6. Verify stop button (`data-testid="stop-button"`) disappears when streaming completes

**Acceptance Criteria:**

- Message sent without JavaScript errors
- Response appears within reasonable time
- UI remains responsive during streaming

### 2. Retry Failed Message

**Priority:** P0 (Critical) **Regression for:** PR #844 (retry button bug)

**Steps:**

1. Trigger a failed message (use mock API with error response)
2. Verify error state is displayed
3. Click retry button
4. Verify message is resent
5. Verify successful response on retry

**Acceptance Criteria:**

- Retry button appears on failure
- Clicking retry actually resends the message (not a no-op)
- Success state displays correctly after retry

### 3. Stop Generation Mid-Stream

**Priority:** P1 (High)

**Steps:**

1. Send a message that triggers a long response
2. Click stop button (`data-testid="stop-button"`) while streaming
3. Verify streaming stops
4. Verify partial response is preserved
5. Verify user can send new messages

**Acceptance Criteria:**

- Stop button is visible during streaming
- Streaming stops promptly on click
- Partial response is not corrupted

### 4. Edit and Resend Message

**Priority:** P1 (High)

**Steps:**

1. Send a message and receive response
2. Hover over sent message
3. Click edit button
4. Modify the message text
5. Submit edited message
6. Verify new response based on edited message

**Acceptance Criteria:**

- Edit UI appears on hover
- Original message can be modified
- New response reflects the edited content

### 5. Queue Messages

**Priority:** P2 (Medium)

**Steps:**

1. Send a message (streaming begins)
2. While streaming, type another message
3. Click queue button (`data-testid="queue-button"`)
4. Verify queued message indicator
5. Verify queued message sends after first completes

**Acceptance Criteria:**

- Queue button visible during streaming
- Queued messages process in order

## Test Data Requirements

- Mock chat API responses for deterministic testing
- Test user must be authenticated (use cached auth state)

## Selectors

```typescript
const SELECTORS = {
  composerInput: '[data-testid="composer-input"]',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  queueButton: '[data-testid="queue-button"]',
  messageList: '[role="log"]', // Chat message list
  userMessage: '[data-role="user"]',
  assistantMessage: '[data-role="assistant"]',
  retryButton: '[data-testid="retry-button"]', // May need to add this
};
```

## Notes

- Use `mockChatApi` fixture for deterministic responses
- Tests should not depend on real LLM calls (expensive, slow, non-deterministic)
- Consider testing both new connection (`/connection/new/new`) and existing connection
  flows
