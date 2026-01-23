# Knowledge Base User Flow Specification

## Overview

Tests for the knowledge base functionality - document management and search. The
knowledge base stores user documents and context that Carmenta uses to personalize
responses.

## Critical User Flows

### 1. View Knowledge Base Page

**Priority:** P0 (Critical)

**Steps:**

1. Navigate to `/knowledge-base`
2. Verify page loads without errors
3. Verify document list is displayed (may be empty for new users)
4. Verify search input is visible

**Acceptance Criteria:**

- Page loads successfully for authenticated users
- UI handles both empty and populated states
- No console errors

### 2. Upload Document

**Priority:** P1 (High)

**Steps:**

1. Navigate to `/knowledge-base`
2. Click upload button
3. Select a document (PDF, TXT, or MD)
4. Verify upload progress indicator
5. Verify document appears in list after upload
6. Verify document content is indexed

**Acceptance Criteria:**

- Supported file types are accepted
- Upload progress is shown
- Document is searchable after upload

### 3. Search Knowledge Base

**Priority:** P1 (High)

**Steps:**

1. Navigate to `/knowledge-base`
2. Type search query in search input
3. Verify search results update
4. Verify matching documents are highlighted

**Acceptance Criteria:**

- Search is responsive (debounced input)
- Results are relevant to query
- Empty state for no matches

### 4. Delete Document

**Priority:** P2 (Medium)

**Steps:**

1. Navigate to `/knowledge-base`
2. Select a document
3. Click delete button
4. Confirm deletion
5. Verify document is removed from list

**Acceptance Criteria:**

- Delete requires confirmation
- Document is permanently removed
- UI updates immediately

### 5. Knowledge Base in Chat Context

**Priority:** P1 (High)

**Steps:**

1. Upload a document with specific content
2. Navigate to chat
3. Ask a question related to the document
4. Verify response includes knowledge base context

**Acceptance Criteria:**

- Relevant KB content is retrieved
- Response is informed by KB data
- Source attribution is clear

## Test Data Requirements

- Sample documents for upload testing
- Authenticated user with KB access
- Clean state for isolated tests (may need per-test cleanup)

## Selectors

```typescript
const SELECTORS = {
  kbList: '[data-testid="knowledge-base-list"]',
  uploadButton: '[data-testid="kb-upload-button"]',
  searchInput: '[data-testid="kb-search-input"]',
  documentCard: '[data-testid="kb-document"]',
  deleteButton: '[data-testid="kb-delete-button"]',
  uploadProgress: '[data-testid="kb-upload-progress"]',
};
```

## Notes

- Document upload may need larger timeout (processing time)
- Search tests should use unique content to avoid false matches
- Consider test isolation - uploaded docs persist between tests
