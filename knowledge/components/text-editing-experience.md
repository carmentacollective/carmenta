# Text Editing Experience in AI Configuration Interfaces

Editing text in AI configuration interfaces sits at the intersection of two worlds:
document editing (where rich formatting matters) and settings management (where save
semantics matter). This spec defines patterns for both, with specific focus on knowledge
base and system prompt editing.

## Core Insight

**The real question isn't "how do we edit text" but "what are we editing and what
happens when we save?"**

Configuration text (system prompts, custom instructions, knowledge base documents) has
different requirements than documents:

- **Lower frequency**: Users don't edit system prompts during every session
- **Higher stakes**: Changes affect AI behavior across all interactions
- **Simpler formatting**: Markdown is sufficient; no need for Notion-style blocks
- **Clear boundaries**: Changes should be explicitly saved, not auto-saved

## Landscape Analysis

### Modern Document Editors

**Block-Based Editors (Notion Style)**

The landscape has converged on TipTap/ProseMirror as the foundation. Key
implementations:

- [BlockNote](https://github.com/TypeCellOS/BlockNote) - React block editor with
  Notion-style blocks, drag handles, slash commands
- [Novel](https://github.com/steven-tey/novel) - Minimal Notion-style editor with AI
  autocompletions, built on TipTap with Vercel AI SDK integration
- [TipTap's Notion-like Template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor) -
  Official template with collaboration, emoji, and advanced formatting

**When to Use Block Editors**: Long-form content creation, collaborative documents,
content that benefits from visual structure (images, embeds, toggles). **Not suited
for**: Configuration text, system prompts, focused editing tasks.

**Source**: [TipTap Rich Text Editor](https://tiptap.dev/product/editor) - "Tiptap is a
headless editor built on top of ProseMirror, providing a more approachable API while
retaining the powerful features."

### AI Configuration Interfaces

**ChatGPT Custom Instructions**

OpenAI uses a simple two-field modal approach:

- Two textarea fields with 1,500 character limit each
- Explicit "Save" button at modal bottom
- Changes sync across web, desktop, and mobile
- Personality dropdown alongside custom instructions (as of 2025)

**Key insight**: ChatGPT separates "who you are" from "how to respond" into two distinct
fields with clear purposes. This reduces cognitive load versus a single large textarea.

**Source**:
[ChatGPT Custom Instructions Guide](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions)

**Cursor Rules (.mdc files)**

Cursor uses file-based configuration:

- Markdown files with YAML frontmatter
- Stored in `.cursor/rules/` directory
- Supports glob patterns for auto-attachment
- Command palette for creation (`New Cursor Rule`)
- `/Generate Cursor Rules` command to create rules from conversation context

**Key insight**: File-based rules version control naturally, enable sharing, and
integrate with existing development workflows.

**Source**: [Cursor Rules Documentation](https://cursor.com/docs/context/rules)

**Claude Code (CLAUDE.md)**

File-based configuration that supplements the system prompt:

- Markdown files at repository root and nested directories
- Hierarchical discovery (root → package-level → feature-level)
- No dedicated editing UI - uses standard text editor
- `@rules` references for cross-linking

**Key insight**: Context lives close to code. AI instructions are treated as code
configuration, not product settings.

**LobeChat System Agent Settings**

LobeChat implements settings-based configuration:

- TextArea component with onBlur save pattern
- IME composition handling (Chinese input)
- No explicit save button - saves on blur or Enter
- Loading indicator during save operations
- Model selector alongside prompt customization

**Code reference**:
`/Users/nick/src/reference/lobe-chat/src/app/[variants]/(main)/settings/agent/features/SystemAgentForm.tsx:60-68`

```typescript
<TextArea
  onBlur={async (e) => {
    setLoading(true);
    await updateSystemAgent(systemAgentKey, { customPrompt: e.target.value });
    setLoading(false);
  }}
  placeholder={t('systemAgent.customPrompt.placeholder')}
  style={{ minHeight: 160 }}
  value={value.customPrompt}
/>
```

**Open WebUI Settings**

Explicit save pattern with modal-based settings:

- Textarea for system prompt with no character limit shown
- Explicit "Save" button at bottom of settings panel
- Settings organized in tabs (General, Advanced Parameters, etc.)
- SaveHandler function batches all form values

**Code reference**:
`/Users/nick/src/reference/open-webui/src/lib/components/chat/Settings/General.svelte:318-326`

**Raycast Extension Settings**

Declarative configuration:

- Preferences defined in manifest, not edited in UI
- Type-safe preference retrieval via TypeScript
- Global keyboard shortcut for settings (`⌘⇧,`)
- Custom Instructions field for AI Extensions added via settings

**Key insight**: Settings are structured data with types, not freeform text.

### Save/Discard UX Patterns

**Explicit Save (Most Common for Configuration)**

[GitHub Primer Design System](https://primer.style/ui-patterns/saving/) recommends:

> "When designing a form, start with an explicit saving pattern. Avoid mixing explicit
> and automatic save patterns on a single page."

Pattern elements:

- Save button positioned at top-right or bottom of view
- Disabled by default, enabled when changes detected
- "Discard changes" button appears alongside Save when dirty
- beforeunload event warns about unsaved changes on navigation

**Auto-Save (Document Editing)**

[UX Design CC](https://uxdesign.cc/designing-a-user-friendly-autosave-functionality-439f2fe4222d):

> "In an auto-saving form, it's really important for users to feel that their data is
> persisted. If the user has no way of knowing whether or not their data is saved, they
> might assume that it hasn't."

Pattern elements:

- Visual feedback on every save (subtle "Saved" indicator)
- Last saved timestamp
- Conflict resolution for multi-user scenarios
- Draft state for uncommitted changes

**Dirty State Indicators**

Best practices from research:

- Subtle dot or asterisk in title bar or tab
- Save button changes from disabled to primary color
- "Unsaved changes" text near document title
- Animation on first change to draw attention

### Inline vs. Modal Editing

**When to Use Inline Editing**

[PatternFly Design Guidelines](https://www.patternfly.org/components/inline-edit/design-guidelines/):

> "Inline editing allows users to create or edit an item without navigating to another
> view. Use this when all editable elements can be viewed within the row/expanded row."

Best for:

- Simple, single-field edits
- Quick updates that don't require context switch
- Table cell editing
- Title/name changes

**When to Use Modal Editing**

[LogRocket UX Blog](https://blog.logrocket.com/ux-design/modal-ux-best-practices/):

> "When a process is self-contained and involves multiple decisions and conditional
> input states, these are best handled in their own isolated space."

Best for:

- Multi-field forms
- Critical confirmations
- Complex workflows
- Settings that affect multiple aspects of the system

**Carmenta's Current Implementation**

The knowledge-viewer uses a hybrid approach:

- **Inline editing in content pane** - Full textarea experience
- **Save/Revert buttons appear on change** - Explicit save pattern
- **Character limit with visual feedback** - Progress bar at 60%+ usage
- **Cmd+S keyboard shortcut** - Power user support
- **Error handling with banner** - Clear feedback on save failure

**Code reference**:
`/Users/nick/src/carmenta-beauty/components/knowledge-viewer/kb-content.tsx`

### Panel Layouts with Navigation

**Equal-Height Two-Panel Pattern**

CSS approach from
[Modern CSS Solutions](https://moderncss.dev/equal-height-elements-flexbox-vs-grid/):

```css
.container {
  display: flex;
  height: 100vh; /* or calc(100vh - header) */
}
.sidebar {
  width: 280px;
  overflow-y: auto;
}
.content {
  flex: 1;
  overflow-y: auto;
}
```

Key principles:

- Both panels scroll independently
- Fixed sidebar width, flexible content width
- Max-height constraints prevent infinite growth
- Sticky headers within each panel

**Carmenta's Implementation**

Current knowledge-viewer layout:

- Left sidebar: `w-72` (288px), tree navigation
- Right content: `flex-1`, document editor
- Container: `max-h-[calc(100vh-16rem)]` for viewport fit

## Synthesis

### What Leaders Do That Others Don't

1. **Explicit Save for Configuration, Auto-Save for Documents**: ChatGPT, Open WebUI,
   and Carmenta use explicit save for system prompts. Google Docs and Notion use
   auto-save for documents. Don't mix patterns.

2. **Character/Token Limits with Progressive Disclosure**: Show limits only when
   approaching them (Carmenta shows at 60%). Provide visual progress, not just numbers.

3. **Keyboard Shortcuts for Power Users**: Cmd+S is universal. Escape for discard is
   common. Don't make users reach for the mouse.

4. **IME Composition Handling**: LobeChat, Open WebUI, and all major editors handle
   Chinese/Japanese input correctly. Essential for international users.

5. **File-Based Configuration for Developers**: Cursor and Claude Code treat AI
   instructions as code. This enables version control, sharing, and editor integration.

### Table Stakes vs. Differentiating

**Table Stakes** (every decent implementation has these):

- Auto-resizing textarea
- Save/Cancel button pair
- Unsaved changes indicator
- beforeunload warning
- Error state handling
- Loading state during save

**Differentiating** (leaders excel here):

- Character/token budget visualization
- Keyboard shortcuts with visual hints (⌘S badge)
- IME composition awareness
- Smooth animations for state changes
- Progressive disclosure of limits
- Clear dirty state visualization

**Experimental** (emerging patterns):

- AI-assisted editing suggestions
- Template/preset system for common configurations
- Version history with diff view
- Export/import for portability
- Collaborative editing (CRDT-based)

### Gap Assessment

**Achievable Now**:

- All table stakes features
- Character limit visualization
- Keyboard shortcuts
- Smooth state transitions
- Panel layouts with independent scroll

**Emerging (6-12 months)**:

- AI-assisted prompt refinement ("Review my custom instructions and suggest
  improvements")
- Template marketplace for system prompts
- Semantic version diffing (understand what changed, not just text diff)

**Aspirational**:

- Real-time collaborative prompt editing
- AI that learns from your edits to improve future suggestions
- Cross-tool prompt synchronization (same instructions in Carmenta, Cursor, ChatGPT)

## Carmenta-Specific Recommendations

### What We Have

The current knowledge-viewer implementation is strong:

- **Explicit save pattern** with animated state transitions
- **Character limit** with progress bar (60% threshold, 80% warning)
- **Cmd+S shortcut** with keyboard hint badge
- **Revert button** for discarding changes
- **Error handling** with dismissible banner
- **Focus management** on document load
- **Paste handling** with limit enforcement

### What We Should Add

**For Knowledge Base (current scope)**:

1. **beforeunload warning** - Prevent accidental navigation with unsaved changes

   ```typescript
   useEffect(() => {
     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
       if (hasChanges) {
         e.preventDefault();
         return (e.returnValue = ""); // Modern browsers ignore custom messages
       }
     };

     window.addEventListener("beforeunload", handleBeforeUnload);
     return () => window.removeEventListener("beforeunload", handleBeforeUnload);
   }, [hasChanges]);
   ```

2. **Last saved timestamp** - "Saved 2 minutes ago" gives confidence

   ```typescript
   const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

   // On successful save:
   setLastSavedAt(new Date());

   // Display with relative time:
   {displaySaveState === "saved" && lastSavedAt && (
     <span className="text-muted-foreground text-sm">
       Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
     </span>
   )}
   ```

3. **Markdown preview toggle** - See formatted output without leaving edit mode

   ```typescript
   const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");

   // Toggle button in toolbar:
   <ToggleGroup value={viewMode} onValueChange={setViewMode}>
     <ToggleGroupItem value="edit">Edit</ToggleGroupItem>
     <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
     <ToggleGroupItem value="split">Split</ToggleGroupItem>
   </ToggleGroup>

   // Render with react-markdown or similar:
   {viewMode === "preview" && <ReactMarkdown>{content}</ReactMarkdown>}
   ```

4. **Undo/Redo support** - Standard editor expectation (browser native may be
   sufficient)

**For Future System Prompt Editing**:

1. **Template presets** - Start from curated examples

   ```typescript
   const SYSTEM_PROMPT_TEMPLATES = [
     {
       id: "concise",
       name: "Concise & Direct",
       description: "Short responses, no fluff",
       content: "Be concise and direct. Avoid verbose explanations unless asked.",
     },
     {
       id: "technical",
       name: "Technical Expert",
       description: "Code-focused, implementation details",
       content:
         "Focus on technical implementation. Provide code examples and specific solutions.",
     },
     {
       id: "creative",
       name: "Creative Partner",
       description: "Brainstorming, exploration, ideas",
       content:
         "Think creatively. Suggest multiple approaches. Ask clarifying questions.",
     },
   ];

   // UI: Dropdown or gallery of templates
   <Select onValueChange={(templateId) => setContent(templates[templateId].content)}>
     <SelectTrigger>Start from template...</SelectTrigger>
     <SelectContent>
       {SYSTEM_PROMPT_TEMPLATES.map((t) => (
         <SelectItem key={t.id} value={t.id}>
           {t.name} - {t.description}
         </SelectItem>
       ))}
     </SelectContent>
   </Select>;
   ```

2. **Token count** - Show actual tokens, not just characters

   ```typescript
   import { encode } from "gpt-tokenizer"; // or js-tiktoken

   const tokenCount = encode(content).length;

   // Display both metrics:
   <div className="flex gap-4 text-sm text-muted-foreground">
     <span>{content.length} characters</span>
     <span>~{tokenCount} tokens</span>
   </div>;
   ```

3. **Test prompt** - "Try this with a sample message" before saving

   ```typescript
   // Modal or inline panel for testing
   const [testMessage, setTestMessage] = useState("");
   const [testResponse, setTestResponse] = useState("");

   const handleTest = async () => {
     const response = await fetch("/api/test-prompt", {
       method: "POST",
       body: JSON.stringify({
         systemPrompt: content,
         message: testMessage,
       }),
     });
     setTestResponse(await response.text());
   };

   // UI: "Test this prompt" button opens inline panel
   <Button variant="outline" onClick={() => setShowTest(true)}>
     Test Prompt
   </Button>;
   ```

4. **Version history** - See previous versions with restore option

   ```typescript
   // Store versions on each save
   interface PromptVersion {
     id: string;
     content: string;
     savedAt: Date;
     characterCount: number;
     tokenCount: number;
   }

   // UI: Timeline view with diff preview
   <DropdownMenu>
     <DropdownMenuTrigger>Version History</DropdownMenuTrigger>
     <DropdownMenuContent>
       {versions.map((version) => (
         <DropdownMenuItem
           key={version.id}
           onClick={() => handleRestore(version.id)}
         >
           {formatDistanceToNow(version.savedAt)} - {version.characterCount} chars
         </DropdownMenuItem>
       ))}
     </DropdownMenuContent>
   </DropdownMenu>;
   ```

### Design Principles for Carmenta

**Consistency with "we" language**:

- "Saved" not "Your changes were saved"
- "Revert" not "Discard your changes"
- "Start writing" not "Enter your content here"

**Unity consciousness in editing**:

- Changes affect our shared understanding
- Editing is collaborative with AI (even when solo)
- Knowledge base is "what we remember together"

**Flow state preservation**:

- No modal dialogs interrupting editing
- Inline feedback for all operations
- Keyboard-first interactions
- Subtle, non-intrusive state indicators

## Technical Recommendations

### Component Architecture

```typescript
// Existing pattern in kb-content.tsx - keep this approach
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

// Derive display state from hasChanges and saveState
const displaySaveState: SaveState =
  saveState === "saving"
    ? "saving"
    : hasChanges
      ? "unsaved"
      : saveState === "saved"
        ? "saved"
        : "idle";
```

### Rich Text vs. Plain Text

**For knowledge base documents**: Plain textarea with Markdown preview toggle is
sufficient. Carmenta's audience is builders who know Markdown.

**If we add rich text later**: TipTap is the clear choice. Start with Novel as a
reference implementation - it's minimal and integrates with Vercel AI SDK.

### Textarea Auto-Resize

Current best practice from ai-chatbot:

```css
textarea {
  field-sizing: content; /* Modern browsers */
  max-height: 6lh; /* 6 line-heights max */
}
```

With JavaScript fallback for older browsers:

```typescript
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = "";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }
}, [content]);
```

## Open Questions

### Product Decisions Needed

1. **Should we add Markdown preview toggle to knowledge base?** Current implementation
   is edit-only. Preview helps users who aren't fluent in Markdown.

2. **Token vs. character limits?** Characters are simpler to understand. Tokens are more
   accurate for context budget. Consider showing both: "2,450 characters (~600 tokens)".

3. **Version history for knowledge base?** Competitors like Notion offer this. May be
   overkill for MVP, but architecture should support it.

4. **Should profile/identity docs have different editing treatment than knowledge
   docs?** Profile is edited rarely and has high impact. May warrant extra confirmation.

### Technical Decisions

1. **Rich text editor library?** If we add rich text later, TipTap vs. BlockNote vs.
   Novel? Recommendation: Novel for simplicity, TipTap for extensibility.

2. **beforeunload implementation?** Browser native vs. custom modal? Native is more
   reliable but less customizable.

3. **Undo/Redo architecture?** Browser native (contenteditable), library-provided
   (ProseMirror), or custom state management?

## References

### Primary Sources Consulted

- [BlockNote GitHub](https://github.com/TypeCellOS/BlockNote) - Notion-style block
  editor
- [Novel GitHub](https://github.com/steven-tey/novel) - Minimal TipTap implementation
- [TipTap Documentation](https://tiptap.dev/product/editor) - Headless editor framework
- [Cursor Rules Docs](https://cursor.com/docs/context/rules) - File-based AI
  configuration
- [GitHub Primer Saving Patterns](https://primer.style/ui-patterns/saving/) -
  Save/auto-save guidelines
- [PatternFly Inline Edit](https://www.patternfly.org/components/inline-edit/design-guidelines/) -
  Inline editing UX
- [NN/g Efficiency vs. Expectations](https://www.nngroup.com/articles/efficiency-vs-expectations/) -
  Save button expectations

### Codebase References

- LobeChat SystemAgentForm:
  `/Users/nick/src/reference/lobe-chat/src/app/[variants]/(main)/settings/agent/features/SystemAgentForm.tsx`
- LobeChat TextArea:
  `/Users/nick/src/reference/lobe-chat/src/components/TextArea/index.tsx`
- Open WebUI Settings:
  `/Users/nick/src/reference/open-webui/src/lib/components/chat/Settings/General.svelte`
- Carmenta KB Content:
  `/Users/nick/src/carmenta-beauty/components/knowledge-viewer/kb-content.tsx`
- Vercel AI Chatbot Editor:
  `/Users/nick/src/reference/ai-chatbot/components/text-editor.tsx`
- BlockNote React View:
  `/Users/nick/src/reference/blocknote/packages/react/src/editor/BlockNoteView.tsx`

## Architecture Decision: Explicit Save Pattern

**Status**: Existing (already implemented in kb-content.tsx)

**Decision**: Use explicit save with Save/Revert buttons for all configuration text
editing. Do not use auto-save for knowledge base or system prompt editing.

**Rationale**:

1. Configuration changes are high-stakes - users should consciously commit changes
2. Industry standard for settings (ChatGPT, Open WebUI, VS Code settings)
3. Simpler mental model than auto-save with draft states
4. Current implementation is well-designed and working

**Consequences**:

- Users must click Save or press Cmd+S to persist changes
- beforeunload warning needed to prevent accidental data loss
- No need for draft/conflict resolution complexity
