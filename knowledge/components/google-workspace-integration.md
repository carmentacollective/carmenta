# Google Workspace Integration

Connecting Google Sheets, Docs, Slides, Drive, and related services to Carmenta.

## Why This Exists

Users want to work with live Google data, not just uploaded files. "Look at this Google
Sheet and create a new one like it" requires OAuth integration with Google's APIs.

**This is separate from spreadsheet parsing** - file uploads are covered in
[spreadsheet-handling.md](./spreadsheet-handling.md). This covers Google OAuth, API
integration, and live document workflows.

## The Core Insight

Google OAuth scopes have three tiers with dramatically different verification
requirements:

| Tier              | Examples                          | Verification Required               |
| ----------------- | --------------------------------- | ----------------------------------- |
| **Non-sensitive** | `drive.file`, `drive.appdata`     | Basic only (domain, privacy policy) |
| **Sensitive**     | `spreadsheets`, `calendar.events` | 3-5 day review, video demo          |
| **Restricted**    | `drive`, `gmail.readonly`         | CASA audit ($15-75k/year)           |

**The breakthrough**: `drive.file` scope is **non-sensitive** and covers our primary use
case - creating new files and accessing user-picked files.

---

## Architecture Decisions

### Read-Only Integration (Decided 2025-01-18)

**Decision**: Remove document creation capabilities (`create_doc`, `create_sheet`).
Integration is now read-only: `read_sheet` and `open_picker` only.

**Why**:

1. **Scope mismatch**: Users expected Carmenta to create formatted documents (specific
   fonts, logos, layouts). The Docs API inserts plain text—no formatting control.
2. **Malformed JSON loops**: Creation attempts generated malformed tool calls
   (`{"action", "create_doc"}` with comma instead of colon), causing infinite "Working"
   loops with no user feedback.
3. **Not our purpose**: Carmenta is an AI assistant, not a document formatting service.
   Users should create documents in Google Workspace and have Carmenta read/analyze
   them.
4. **Better UX**: "Read your spreadsheet and analyze it" is a clear value prop. "Create
   a formatted doc" sets expectations we can't meet.

**What remains**:

- `read_sheet` - Read data from user-selected Google Sheets
- `open_picker` - Let users select files to grant Carmenta access

### Integration Naming: Google Sheets/Docs/Slides (Decided 2025-01-10)

**Decision**: Name it "Google Sheets/Docs/Slides" - NOT "Google Drive"

**Why**: "Google Drive" implies full browsing access to all files. Our `drive.file`
scope only grants access to:

- Files the user explicitly picks via Google Picker

Calling it "Google Drive" would mislead users into expecting they can browse their
entire Drive. The more honest name sets correct expectations.

**On the /integrations page**:

```
+----------------------------------------+
| Google Sheets/Docs/Slides              |
|                                        |
| Read and interact with your Sheets,    |
| Docs, and Slides via file selection    |
|                                        |
| [Connect]                              |
+----------------------------------------+
```

### OAuth Provider Strategy: Use drive.file (Decided 2025-01-10)

**Decision**: Use `drive.file` scope for all users via Google Picker +
Sheets/Docs/Slides APIs. No CASA audit required.

**What `drive.file` enables**:

- Access files user explicitly picks via Google Picker
- Read spreadsheet data, document content

**What it doesn't enable**:

- Browse user's full Drive
- List all files
- Access files without explicit user selection

**Use case**: "Read my spreadsheet and analyze the data" or "Look at this doc and
summarize it"

### Google Cloud Project Architecture (Decided 2025-01-10)

**Decision**: Three GCP projects with different scope levels.

```
PROJECT 1: carmenta-auth (Login Only)
Status: Verified (basic)
Scopes: openid, email, profile
Classification: Non-sensitive
Verification: Basic (domain, privacy policy)
Users: All
Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

PROJECT 2: carmenta-workspace (Sensitive Integrations)
Status: Verified (sensitive) - already done for calendar/contacts
Scopes:
  - calendar.*, contacts.* (Sensitive - already verified)
  - drive.file (Non-sensitive - THE KEY)
  - spreadsheets, documents (Sensitive - needs verification)
Classification: Sensitive (no CASA audit)
Verification: 3-5 days, video demo
Users: All
Env vars: GOOGLE_SENSITIVE_CLIENT_ID, GOOGLE_SENSITIVE_CLIENT_SECRET

PROJECT 3: carmenta-internal (Restricted - Testing Only)
Status: Internal / Unverified
Scopes: Everything (see full list below)
Classification: Restricted
Verification: NONE (internal only, "unverified app" warning)
Users: Test accounts only
Env vars: GOOGLE_INTERNAL_CLIENT_ID, GOOGLE_INTERNAL_CLIENT_SECRET
```

---

## Scope Reference

### Project 2 Scopes (Public Users)

**Already Verified**:

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/contacts.readonly
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

**To Add (Non-sensitive - no new verification)**:

```
https://www.googleapis.com/auth/drive.file
```

**To Add (Sensitive - requires re-verification)**:

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/spreadsheets.readonly
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/documents.readonly
```

### Project 3 Scopes (Internal Testing)

Full list for comprehensive internal testing:

**RESTRICTED** (would require CASA for public):

```
# Drive - Full Access
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/drive.metadata
https://www.googleapis.com/auth/drive.metadata.readonly
https://www.googleapis.com/auth/drive.activity
https://www.googleapis.com/auth/drive.activity.readonly

# Gmail - Full Access
https://mail.google.com/
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.metadata
https://www.googleapis.com/auth/gmail.settings.basic
https://www.googleapis.com/auth/gmail.settings.sharing
```

**SENSITIVE**:

```
# Sheets
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/spreadsheets.readonly

# Docs
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/documents.readonly

# Gmail - Limited
https://www.googleapis.com/auth/gmail.send

# Calendar - All
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.events.readonly
https://www.googleapis.com/auth/calendar.events.owned
https://www.googleapis.com/auth/calendar.events.owned.readonly
https://www.googleapis.com/auth/calendar.freebusy
https://www.googleapis.com/auth/calendar.calendars
https://www.googleapis.com/auth/calendar.calendars.readonly
https://www.googleapis.com/auth/calendar.calendarlist
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.acls
https://www.googleapis.com/auth/calendar.acls.readonly
https://www.googleapis.com/auth/calendar.settings.readonly

# Contacts/People
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/contacts.readonly
https://www.googleapis.com/auth/contacts.other.readonly
https://www.googleapis.com/auth/directory.readonly
https://www.googleapis.com/auth/user.birthday.read
https://www.googleapis.com/auth/user.emails.read
https://www.googleapis.com/auth/user.gender.read
https://www.googleapis.com/auth/user.organization.read
https://www.googleapis.com/auth/user.phonenumbers.read
https://www.googleapis.com/auth/user.addresses.read

# Photos (limited - most deprecated April 2025)
https://www.googleapis.com/auth/photoslibrary.appendonly
https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata
https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata
https://www.googleapis.com/auth/photospicker.mediaitems.readonly
```

**NON-SENSITIVE**:

```
openid
email
profile
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/gmail.labels
```

---

## Technical Implementation

### OAuth Provider Configuration

**File**: `lib/integrations/oauth/providers/google-workspace-files.ts`

```typescript
import { env } from "@/lib/env";
import type { OAuthProviderConfig } from "../types";

export const googleWorkspaceFilesProvider: OAuthProviderConfig = {
  id: "google-workspace-files",
  name: "Google Sheets/Docs/Slides",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    // Non-sensitive - no additional verification needed
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  // Same GCP project as calendar/contacts
  get clientId(): string {
    return env.GOOGLE_SENSITIVE_CLIENT_ID;
  },
  get clientSecret(): string {
    return env.GOOGLE_SENSITIVE_CLIENT_SECRET;
  },
  // Additional OAuth params for Google
  additionalAuthParams: {
    access_type: "offline",
    prompt: "consent",
  },
};
```

**File**: `lib/integrations/oauth/providers/google-internal.ts`

```typescript
// For internal testing only - unverified app with full access
export const googleInternalProvider: OAuthProviderConfig = {
  id: "google-internal",
  name: "Google (Full Access - Internal)",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    // All the restricted scopes for internal testing
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/contacts",
    // ... all others
  ],
  get clientId(): string {
    return env.GOOGLE_INTERNAL_CLIENT_ID;
  },
  get clientSecret(): string {
    return env.GOOGLE_INTERNAL_CLIENT_SECRET;
  },
};
```

### Service Definition

**File**: `lib/integrations/services.ts`

```typescript
{
  id: "google-workspace-files",
  name: "Google Sheets/Docs/Slides",
  description: "Read and analyze your Sheets, Docs, and Slides by selecting them via file picker",
  logo: "/logos/google-workspace-files.svg",
  authMethod: "oauth",
  status: "available",
  oauthProviderId: "google-workspace-files",
  capabilities: ["read_sheet", "open_picker"],
}
```

### Adapter Implementation

The adapter is in `lib/integrations/adapters/google-workspace-files.ts`. Key operations:

- `read_sheet` - Read data from a user-selected Google Sheet
- `open_picker` - Signal frontend to open Google Picker for file selection

### Google Picker Integration

The Google Picker component is in `components/integrations/google-picker.tsx` with a
hook in `lib/hooks/use-google-picker.ts`. Key features:

- Auto-opens picker when mounted with valid credentials
- Handles file selection callback with file ID, name, MIME type, URL
- Handles cancellation gracefully
- Filters by MIME type (spreadsheet, document, presentation)

---

## User Experience Flows

### Flow 1: Read Existing Sheet

```
User: "Look at my budget spreadsheet"
1. Check if google-workspace-files connected
   - If not: "Connect Google Sheets/Docs/Slides to access your files: [Connect]"
2. Call open_picker tool → Frontend shows Google Picker
3. User selects "2024 Budget.gsheet"
4. Read sheet data via read_sheet
5. Return: "Here's what I found in your budget spreadsheet: [summary]"
```

### Flow 2: Analyze Data

```
User: "Analyze my sales data and find trends"
1. Check if connected
2. Call open_picker tool with file_types: ["spreadsheet"]
3. User selects sales spreadsheet
4. Read and analyze the data
5. Return insights about trends, patterns, anomalies
```

---

## Implementation Status

### ✅ Milestone 1: OAuth Provider Setup (Complete)

- `google-workspace-files` OAuth provider configured
- Service definition in registry
- OAuth flow working

### ✅ Milestone 2: Google Picker Integration (Complete)

- Google Picker component with hook
- File selection flow with callbacks
- MIME type filtering

### ✅ Milestone 3: Sheet Reading (Complete)

- `read_sheet` operation implemented
- A1 notation range support

### ❌ Document Creation (Removed 2025-01-18)

Document creation (`create_doc`, `create_sheet`) was removed. See "Read-Only
Integration" decision at top of file for rationale.

---

## Google Photos Note

Google significantly restricted the Photos API in April 2025. The old scopes
(`photoslibrary.readonly`, `photoslibrary`, `photoslibrary.sharing`) are deprecated.

**What's still available**:

- `photoslibrary.appendonly` - Upload photos only
- `photoslibrary.readonly.appcreateddata` - Read photos YOUR APP created
- `photospicker.mediaitems.readonly` - User picks specific photos via Picker

**What's gone**: Full library access. You cannot list or access all user photos anymore.

If we want Photos integration, it must use the Picker API for user selection.

---

## Verification Checklist

When adding scopes to Project 2:

| Requirement        | What to Provide                                                    |
| ------------------ | ------------------------------------------------------------------ |
| **Justification**  | "Users read and analyze their Google Sheets data via AI assistant" |
| **Video demo**     | Show: OAuth flow → Picker selection → Sheet reading → AI analysis  |
| **Privacy policy** | Update to mention Google Drive/Sheets data handling                |
| **Homepage**       | Must match authorized domain                                       |

Timeline: 3-5 business days for sensitive scope review.

---

## Sources

- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Sheets API Scopes](https://developers.google.com/workspace/sheets/api/scopes)
- [Docs API Scopes](https://developers.google.com/workspace/docs/api/auth)
- [Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Photos API Authorization](https://developers.google.com/photos/overview/authorization)
