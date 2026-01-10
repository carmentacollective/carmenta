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

### Integration Naming: Google Sheets/Docs/Slides (Decided 2025-01-10)

**Decision**: Name it "Google Sheets/Docs/Slides" - NOT "Google Drive"

**Why**: "Google Drive" implies full browsing access to all files. Our `drive.file`
scope only grants access to:

- Files the user explicitly picks via Google Picker
- Files our app creates

Calling it "Google Drive" would mislead users into expecting they can browse their
entire Drive. The more honest name sets correct expectations.

**On the /integrations page**:

```
+----------------------------------------+
| Google Sheets/Docs/Slides              |
|                                        |
| Create and work with Sheets, Docs,     |
| and Slides in your Carmenta workspace  |
|                                        |
| [Connect]                              |
+----------------------------------------+
```

### OAuth Provider Strategy: Use drive.file (Decided 2025-01-10)

**Decision**: Use `drive.file` scope for all users via Google Picker +
Sheets/Docs/Slides APIs. No CASA audit required.

**What `drive.file` enables**:

- Create new Google Sheets from data
- Create new Google Docs from content
- Create new Google Slides from content
- Access files user explicitly picks via Google Picker
- Read/write to app-created files

**What it doesn't enable**:

- Browse user's full Drive
- List all files
- Access files without explicit user selection

This covers Julianna's use case perfectly: "Look at this sheet and create a new one like
it"

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

**File**: `lib/integrations/services.ts` (add to existing)

```typescript
{
  id: "google-workspace-files",
  name: "Google Sheets/Docs/Slides",
  description: "Create and work with Sheets, Docs, and Slides in your Carmenta workspace",
  logo: "/integrations/google-workspace.svg",
  authMethod: "oauth",
  status: "active",
  oauthProviderId: "google-workspace-files",
  capabilities: [
    "create_sheet",
    "create_doc",
    "create_slides",
    "read_picked_file",
    "update_picked_file",
  ],
}
```

### Adapter Implementation

**File**: `lib/integrations/adapters/google-workspace-files.ts`

```typescript
import { google } from "googleapis";
import type { IntegrationAdapter } from "../types";

export const googleWorkspaceFilesAdapter: IntegrationAdapter = {
  id: "google-workspace-files",

  async createSheet(
    accessToken: string,
    title: string,
    data: string[][]
  ): Promise<{ spreadsheetId: string; url: string }> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          {
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: data.map((row) => ({
                  values: row.map((cell) => ({
                    userEnteredValue: { stringValue: String(cell) },
                  })),
                })),
              },
            ],
          },
        ],
      },
    });

    return {
      spreadsheetId: response.data.spreadsheetId!,
      url: response.data.spreadsheetUrl!,
    };
  },

  async createDoc(
    accessToken: string,
    title: string,
    content: string
  ): Promise<{ documentId: string; url: string }> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const docs = google.docs({ version: "v1", auth });

    // Create empty doc
    const createResponse = await docs.documents.create({
      requestBody: { title },
    });

    const documentId = createResponse.data.documentId!;

    // Insert content
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      },
    });

    return {
      documentId,
      url: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  },

  async readSheetData(
    accessToken: string,
    spreadsheetId: string,
    range?: string
  ): Promise<string[][]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range || "A:ZZ", // All columns
    });

    return response.data.values || [];
  },
};
```

### Google Picker Integration

**File**: `components/integrations/google-picker.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

interface GooglePickerProps {
  accessToken: string;
  onSelect: (file: { id: string; name: string; mimeType: string }) => void;
  onCancel: () => void;
  mimeTypes?: string[];
}

export function GooglePicker({
  accessToken,
  onSelect,
  onCancel,
  mimeTypes = [
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.presentation",
  ],
}: GooglePickerProps) {
  const [pickerLoaded, setPickerLoaded] = useState(false);

  useEffect(() => {
    if (pickerLoaded && accessToken) {
      openPicker();
    }
  }, [pickerLoaded, accessToken]);

  function openPicker() {
    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
      .addView(
        new google.picker.DocsView()
          .setIncludeFolders(true)
          .setMimeTypes(mimeTypes.join(","))
      )
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          onSelect({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
          });
        } else if (data.action === google.picker.Action.CANCEL) {
          onCancel();
        }
      })
      .build();

    picker.setVisible(true);
  }

  return (
    <Script
      src="https://apis.google.com/js/api.js"
      onLoad={() => {
        gapi.load("picker", () => setPickerLoaded(true));
      }}
    />
  );
}
```

### Tool Definitions

**File**: `lib/integrations/tools/google-workspace-files.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";

export function getGoogleWorkspaceTools(accessToken: string) {
  return {
    createGoogleSheet: tool({
      description:
        "Create a new Google Sheet with the given title and data. Returns the URL to the new sheet.",
      parameters: z.object({
        title: z.string().describe("Title for the new spreadsheet"),
        data: z
          .array(z.array(z.string()))
          .describe("2D array of cell values, first row is headers"),
      }),
      execute: async ({ title, data }) => {
        const result = await googleWorkspaceFilesAdapter.createSheet(
          accessToken,
          title,
          data
        );
        return {
          success: true,
          spreadsheetId: result.spreadsheetId,
          url: result.url,
          message: `Created Google Sheet "${title}"`,
        };
      },
    }),

    createGoogleDoc: tool({
      description:
        "Create a new Google Doc with the given title and content. Returns the URL to the new document.",
      parameters: z.object({
        title: z.string().describe("Title for the new document"),
        content: z.string().describe("Text content for the document"),
      }),
      execute: async ({ title, content }) => {
        const result = await googleWorkspaceFilesAdapter.createDoc(
          accessToken,
          title,
          content
        );
        return {
          success: true,
          documentId: result.documentId,
          url: result.url,
          message: `Created Google Doc "${title}"`,
        };
      },
    }),

    openGooglePicker: tool({
      description:
        "Open Google Picker to let user select a file from their Drive. Use this when user wants to work with an existing file.",
      parameters: z.object({
        fileTypes: z
          .array(z.enum(["spreadsheet", "document", "presentation"]))
          .optional()
          .describe("Types of files to show in picker"),
      }),
      execute: async ({ fileTypes }) => {
        // This triggers UI - returns instruction for frontend
        return {
          action: "open_google_picker",
          fileTypes: fileTypes || ["spreadsheet", "document", "presentation"],
        };
      },
    }),
  };
}
```

---

## User Experience Flows

### Flow 1: Create New Sheet from Data

```
User: "Create a Google Sheet from this data"
1. Check if google-workspace-files connected
   - If not: "To create Google Sheets, connect your account: [Connect Google Sheets/Docs/Slides]"
2. If connected: Use createGoogleSheet tool
3. Return: "Created 'Untitled Spreadsheet' - [Open in Google Sheets](url)"
```

### Flow 2: Work with Existing Sheet

```
User: "Look at my budget spreadsheet and create a new one for next month"
1. Check if connected
2. Call openGooglePicker tool → Frontend shows Google Picker
3. User selects "2024 Budget.gsheet"
4. Read sheet data via readSheetData
5. Understand structure, create new sheet with updated template
6. Return: "Created '2025 Budget' based on your 2024 template - [Open](url)"
```

### Flow 3: User Uploads XLSX, Recommend Integration

```
User: [uploads budget.xlsx]
1. Parse XLSX via spreadsheet-handling
2. If google-workspace-files NOT connected:
   "I can see your spreadsheet. If you'd like to create a live Google Sheet
    from this data, connect Google Sheets/Docs/Slides: [Connect]"
3. If connected:
   "I can see your spreadsheet. Would you like me to create a Google Sheet
    from this data so you can collaborate on it?"
```

---

## Implementation Milestones

### Milestone 1: OAuth Provider Setup

- Create `google-workspace-files` OAuth provider
- Add to provider registry
- Add service definition
- Test OAuth flow
- **Validates**: Users can connect and we get access token

### Milestone 2: Basic Sheet Creation

- Implement `createSheet` in adapter
- Add `createGoogleSheet` tool
- Wire into chat tools
- **Validates**: "Create a Google Sheet" works

### Milestone 3: Google Picker Integration

- Add Google Picker component
- Implement file selection flow
- Read selected file data
- **Validates**: "Open my budget spreadsheet" works

### Milestone 4: Doc & Slides Support

- Implement `createDoc` in adapter
- Implement `createSlides` in adapter
- Add corresponding tools
- **Validates**: Full Workspace file creation

### Milestone 5: Update Existing Files

- Implement sheet update methods
- Handle versioning/conflicts
- **Validates**: "Update this spreadsheet" works

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

| Requirement        | What to Provide                                                           |
| ------------------ | ------------------------------------------------------------------------- |
| **Justification**  | "Users create Google Sheets/Docs from AI-generated content and templates" |
| **Video demo**     | Show: OAuth flow → Picker selection → Sheet creation → actual usage       |
| **Privacy policy** | Update to mention Google Drive/Sheets data handling                       |
| **Homepage**       | Must match authorized domain                                              |

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
