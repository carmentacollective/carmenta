# Carmenta Assistant

DCOS interface for workbench pages. A focused, context-aware chat panel that lets users
interact with Carmenta on pages like AI Team, Knowledge Base, and MCP Config.

## Architecture

```
carmenta-assistant/
├── carmenta-sidecar.tsx  Context-aware sidecar (recommended)
├── carmenta-layout.tsx   Push-content layout (legacy)
├── carmenta-sheet.tsx    Mobile sheet component
├── sidecar-thread.tsx    Thread UI for sidecar
├── empty-state.tsx       Contextual welcome screens
├── utils.ts              Shared utilities (getMessageText)
├── types.ts              TypeScript interfaces
└── index.ts              Exports
```

**Shared dependencies** from `components/connection/`:

- `Composer` - Full-featured composer with model selection, file attachments, drafts
- Message rendering primitives from `components/chat/`

## Components

### CarmentaSidecar (Recommended)

Context-aware sidecar with custom welcome screens for different pages. Automatically
pushes body content when open on desktop.

```tsx
import { CarmentaSidecar, CarmentaToggle } from "@/components/carmenta-assistant";

const WELCOME_CONFIG = {
  heading: "MCP Configuration",
  subtitle: "Let's connect your tools together",
  suggestions: [
    {
      id: "add-server",
      label: "Add a server",
      prompt: "I want to connect a new MCP server...",
      icon: PlusIcon,
      autoSubmit: false,
    },
  ],
};

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CarmentaToggle onClick={() => setOpen(true)} />
      <CarmentaSidecar
        open={open}
        onOpenChange={setOpen}
        pageContext="mcp-config"
        onChangesComplete={() => refetch()}
        welcomeConfig={WELCOME_CONFIG}
      />
    </>
  );
}
```

### CarmentaLayout (Legacy)

Simpler layout wrapper without context-aware welcome screens:

```tsx
<CarmentaLayout pageContext="ai-team" onChangesComplete={() => refreshData()}>
  <PageContent />
</CarmentaLayout>
```

## Responsive Behavior

| Screen        | Interface      | Behavior                                                        |
| ------------- | -------------- | --------------------------------------------------------------- |
| Desktop (lg+) | Sidecar/Layout | Push-content sidebar - panel appears left, content shifts right |
| Mobile        | Sheet/Modal    | Full-screen sheet with overlay for focused interaction          |

This follows the pattern: desktop has space for side-by-side work, mobile needs focused
full-attention interactions.

## useCarmenta Hook (Legacy)

Manages chat state connected to DCOS endpoint:

```tsx
const {
  messages, // Current conversation
  input, // Controlled input value
  setInput, // Update input
  sendMessage, // Send current input
  stop, // Stop streaming response
  isLoading, // Currently streaming or submitted
  clear, // Clear conversation
  error, // API error if any
  clearError, // Dismiss error
} = useCarmenta({
  pageContext: "ai-team",
  onChangesComplete: () => refetch(),
});
```

The hook:

- Creates stable transport to `/api/dcos` endpoint
- Includes `pageContext` and `channel: "web"` in requests
- Triggers `onChangesComplete` when agent makes tool calls
- Reports errors to Sentry with context

## Difference from /connection Chat

| Aspect   | /connection                      | Carmenta Assistant                               |
| -------- | -------------------------------- | ------------------------------------------------ |
| Purpose  | Long-form creative work          | Quick DCOS interactions                          |
| Composer | Full `Composer` (same component) | Same `Composer` (stacked layout via @container)  |
| Endpoint | `/api/connection`                | `/api/dcos`                                      |
| Context  | Connection-based with history    | Page-based, ephemeral                            |
| Layout   | Full-page                        | Sidebar/modal (420px triggers mobile breakpoint) |

Both use the same `Composer` component from `components/connection/`. The sidecar's
420px width triggers container queries (`@xl: 576px`) that automatically use the stacked
mobile layout.

## Relevant Rules

@.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc
