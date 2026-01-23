# AI Team User Flow Specification

## Overview

Tests for the AI Team functionality - creating and managing AI team members (personas)
that can be invoked in conversations.

## Critical User Flows

### 1. View AI Team Page

**Priority:** P0 (Critical)

**Steps:**

1. Navigate to `/ai-team`
2. Verify page loads without errors
3. Verify existing team members are displayed
4. Verify "Create" or "Hire" button is visible

**Acceptance Criteria:**

- Page loads successfully for authenticated users
- Team member cards render correctly
- Empty state handled gracefully

### 2. Create Team Member (Hire)

**Priority:** P1 (High)

**Steps:**

1. Navigate to `/ai-team`
2. Click "Hire" button
3. Fill in team member details (name, role, instructions)
4. Submit the form
5. Verify new team member appears in list

**Acceptance Criteria:**

- Form validation works correctly
- Team member is created successfully
- New member appears without page refresh

### 3. Edit Team Member

**Priority:** P1 (High)

**Steps:**

1. Navigate to `/ai-team`
2. Click on existing team member
3. Modify settings (name, instructions, etc.)
4. Save changes
5. Verify changes persist

**Acceptance Criteria:**

- Edit form pre-populated with current values
- Changes save successfully
- UI updates to reflect changes

### 4. Remove Team Member

**Priority:** P2 (Medium)

**Steps:**

1. Navigate to `/ai-team`
2. Click on existing team member
3. Click delete/remove button
4. Confirm removal
5. Verify team member is removed from list

**Acceptance Criteria:**

- Delete requires confirmation
- Team member is removed from list
- Associated conversations unaffected

### 5. Invoke Team Member in Chat

**Priority:** P1 (High)

**Steps:**

1. Create a team member with specific instructions
2. Navigate to chat
3. Invoke the team member (e.g., @mention or tool call)
4. Verify team member responds according to their instructions

**Acceptance Criteria:**

- Team member can be invoked in chat
- Response follows team member's persona
- Tool call format is correct

## Test Data Requirements

- Authenticated user
- Clean state or ability to create/delete test team members
- Mock API for team member invocation in chat

## Selectors

```typescript
const SELECTORS = {
  teamList: '[data-testid="ai-team-list"]',
  hireButton: '[data-testid="ai-team-hire-button"]',
  memberCard: '[data-testid="ai-team-member"]',
  memberName: '[data-testid="ai-team-member-name"]',
  memberForm: '[data-testid="ai-team-form"]',
  deleteButton: '[data-testid="ai-team-delete"]',
  saveButton: '[data-testid="ai-team-save"]',
};
```

## Notes

- Team member creation may involve AI-generated suggestions (mock in tests)
- Consider test isolation for team member CRUD operations
- Verify team member invocation doesn't break chat flow
