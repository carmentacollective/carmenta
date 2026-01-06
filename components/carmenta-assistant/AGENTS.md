# Carmenta Assistant

DCOS interface for workbench pages. A focused, context-aware chat panel that lets users
interact with Carmenta on pages like AI Team, Knowledge Base, and MCP Config.

## Architecture

```
carmenta-assistant/
├── carmenta-layout.tsx   Push-content layout (desktop sidebar)
├── carmenta-panel.tsx    Fixed-position drawer (legacy, prefer layout)
├── use-carmenta.ts       Chat state hook with DCOS transport
├── empty-state.tsx       Contextual hints when no messages
├── utils.ts              Shared utilities (getMessageText)
├── types.ts              TypeScript interfaces
└── index.ts              Exports
```

**Shared dependencies** from `components/chat/`:

- `SimpleComposer` - Text input and send/stop button
- `UserBubble`, `AssistantBubble`, `ThinkingBubble` - Message rendering

## Responsive Behavior

| Screen        | Interface        | Behavior                                                        |
| ------------- | ---------------- | --------------------------------------------------------------- |
| Desktop (md+) | `CarmentaLayout` | Push-content sidebar - panel appears left, content shifts right |
| Mobile        | `CarmentaModal`  | Global modal via `useCarmentaModal()` - focused overlay         |

This follows the pattern: desktop has space for side-by-side work, mobile needs focused
full-attention interactions.

## Usage

Wrap workbench pages with `CarmentaLayout`:

```tsx
import { CarmentaLayout, useCarmentaLayout } from "@/components/carmenta-assistant";

function WorkbenchPage() {
  return (
    <CarmentaLayout
      pageContext="ai-team"
      onChangesComplete={() => refreshData()}
      placeholder="What should we work on?"
    >
      <PageContent />
    </CarmentaLayout>
  );
}

// Inside PageContent:
function ToggleButton() {
  const { toggle, isOpen } = useCarmentaLayout();
  return <Button onClick={toggle}>{isOpen ? "Close" : "Ask Carmenta"}</Button>;
}
```

## useCarmenta Hook

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

| Aspect   | /connection                          | Carmenta Assistant      |
| -------- | ------------------------------------ | ----------------------- |
| Purpose  | Long-form creative work              | Quick DCOS interactions |
| Composer | Rich (model selection, files, voice) | Simple (text only)      |
| Endpoint | `/api/connection`                    | `/api/dcos`             |
| Context  | Connection-based with history        | Page-based, ephemeral   |
| Layout   | Full-page                            | Sidebar/modal           |

Both share primitives from `components/chat/` for DRY message rendering.

## Relevant Rules

@.cursor/rules/frontend/react-components.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc
