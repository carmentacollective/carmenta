# Message Input

The message input is how builders communicate with AI at the speed of thought. It must
feel instant, intelligent, and invisible until needed.

## Core Principle

**Friction kills flow.** Every extra click, every moment of confusion, every context
switch pulls the builder out of their mental model. The input should be intuitive -
anticipate needs and get out of the way.

## Must-Have Features

### Voice Input (First-Class)

**What:** Press button, speak, edit transcription, send.

**Why:** Builders think faster than they type. Voice captures ideas at thought speed.
Editing before send gives control - not every thought should go straight to the LLM.

**Decision made:** Voice is not an afterthought accessibility feature. It's a primary
input method with equal prominence to text.

**See:** [@knowledge/components/voice.md](voice.md) for complete voice architecture.

### Paste-to-Attach Images

**What:** Paste image from clipboard → auto-uploads without confirmation → shows in
message.

**Why:** Screenshots are how builders communicate context. "Here's the bug" with a
screenshot is clearer than 100 words. Requiring manual upload breaks flow.

**Behavior:** Works with screenshots, copied images, anything in clipboard. Detects
image vs text and routes appropriately.

**Reference:** Vercel AI Chatbot implementation - paste just works.

### @Mention System for Context/Tools

**What:** Type `@` → suggestion popup → select tool/model/context → continue typing.

**Why:** Builders shouldn't hunt through menus. `@web` to enable search, `@opus` to
target a model, `@calculator` to enable math - these are faster than any UI.

**Key insight from Better Chatbot:** @mentions don't just suggest tools - they RESTRICT
the LLM to only those tools. This saves tokens and improves accuracy. Typing
`@calculator` means "use ONLY the calculator, nothing else."

**Use cases:**

- `@web` - Enable web search context
- `@deep-research` - Activate deep reasoning mode
- `@opus` / `@sonnet` - Target specific model
- `@calculator` - Enable specific tool
- `@docs/api-reference` - Reference specific document

**Phase:** Not MVP (Phase 3). Explore TipTap (headless editor built on ProseMirror) for
rich text rendering with custom React components inside mentions.

### Long Paste → File Conversion

**What:** Paste >4000 characters of text → auto-converts to file attachment with glow
animation.

**Why:** Long pastes waste tokens and make conversation unreadable. Converting to file
preserves content while keeping the conversation clean.

**Behavior:** Happens automatically. User sees glow animation confirming the conversion.
Can still access full content as attachment.

**Reference:** HuggingFace Chat UI pattern.

## Core Behaviors

### Auto-Resize

**What:** Textarea grows as you type, up to max height, then scrolls.

**Why:** Fixed-height feels cramped. Auto-resize lets you see your full message without
scrolling until it's genuinely long.

**Technical approach:** CSS `field-sizing-content` with `max-h-[6lh]` (6 line-heights
max) - cleanest approach (ai-chatbot). Fallback to JavaScript measuring scrollHeight for
older browsers.

**Max height:** 4-6 lines mobile, 8-10 desktop.

**Decision made:** No manual expand button. All competitors use auto-resize only. Keep
it simple.

### Send Button States

The send button is a state machine that communicates what's possible:

**Disabled (grayed out ArrowUp):** Can't send

- Input is empty
- Files are uploading

**Ready (accent color ArrowUp):** Can send

- Input has content
- No uploads pending
- Click or Enter to send

**Sending (pulsing ArrowUp):** Brief transition

- Message submitted
- Waiting for stream to start
- Just long enough to show something's happening

**Streaming (warning color Square):** Can stop

- LLM is generating response
- Click or Escape to stop
- Subtle pulse animation

**Stopping (Square with spinner):** Brief transition

- Stop requested
- Waiting for stream abort
- Feels instant to the user
- **On stop complete:** Put the stopped message back into input field

**Why this matters:** Builders need to know what's happening. The button communicates
system state without text.

**Stop behavior insight:** When you stop generation, your last message returns to the
input field. This is for the common case: you spot a typo mid-stream, stop, fix it,
resend. Without this, you're copy-pasting or retyping. With this, it's instant
correction.

### Keyboard Behavior

**Platform-specific patterns (matching ChatGPT, Claude, and major AI apps):**

**Desktop:**

- Enter = send
- Shift+Enter = newline
- Escape = stop generation (when streaming)

**Mobile:**

- Enter/Return = newline (for composing multi-line messages)
- Send button = send (explicit tap required)
- Cmd/Ctrl+Enter = send (power user shortcut)

**Why different on mobile:** Mobile users compose multi-line messages naturally using
the Return key. Auto-sending on Return creates a frustrating experience where users
accidentally send incomplete thoughts. The ChatGPT app, Claude app, and virtually all
modern mobile chat interfaces use Return for newlines with an explicit send button.

**Technical implementation:**

- Use `enterKeyHint="enter"` on mobile to show "return" key label
- Use `enterKeyHint="send"` on desktop to indicate Enter sends
- Detect mobile via viewport width or touch capability

### Draft Persistence

**What:** Save input to localStorage on every keystroke. Restore on page load. Clear
only on successful send.

**Why:** Builders switch contexts constantly. Accidental tab close, browser crash,
switching to terminal - draft persistence prevents lost work.

**Storage key:** `carmenta_draft_${threadId}`

**Decision made:** This is crucial for builders. Data loss is unacceptable.

### Command History (Later)

**What:** Terminal-style history. ArrowUp/Down cycles through recently sent messages
when input is empty.

**Why:** Builders are used to CLI workflows. "Repeat that last command" should work in
chat too.

**Phase:** Phase 3/4 - not MVP but deeply appreciated by target audience.

## Platform Awareness

### Mobile vs Desktop

**Desktop:**

- Auto-focus on load (with preventScroll)
- Taller max height (8-10 lines)
- Hover states matter
- Enter = send, Shift+Enter = newline

**Mobile:**

- No auto-focus (don't pop keyboard unexpectedly)
- Shorter max height (4-6 lines)
- Larger touch targets
- Enter = newline, send button = send
- Virtual keyboard detection via visualViewport API
- Scroll position stability during keyboard transitions
- Immediate draft save on blur (prevents data loss)

**Why:** Desktop and mobile are different contexts. Respect platform conventions.

**Key mobile UX principles:**

1. Never auto-pop the keyboard - let users initiate
2. Return key creates newlines (matches user expectation from native apps)
3. Explicit send button required (prevents accidental sends)
4. Scroll position must not jump when keyboard opens/closes
5. Save draft immediately on blur (users scroll to read, shouldn't lose content)

### File Attachments

Full file handling architecture in
[@knowledge/components/file-attachments.md](file-attachments.md).

Message input integrates with:

- Drag-drop onto input
- Paste detection (images)
- File picker button
- Upload queue with progress

**Key decision:** Never block conversation during upload. Background processing, show
progress, allow sending other messages.

## Competitive Insights

After deep analysis of ai-chatbot, assistant-ui, LobeChat, chat-ui, Better Chatbot, Open
WebUI:

**Universal behaviors (every competitor does this identically):**

- Enter to send, Shift+Enter for newline
- IME composition detection
- Auto-resize textarea
- Disable send when empty or uploading
- ArrowUp icon → Square icon when streaming

**Standout features to adopt:**

- **Better Chatbot:** @mention tool filtering (restricts LLM to only mentioned tools)
- **Vercel AI Chatbot:** Paste-to-attach images (frictionless)
- **HuggingFace Chat UI:** Long paste → file conversion, smart mobile/touch detection
- **Open WebUI:** Multi-provider voice with graceful fallback

**Rejected patterns:**

- Manual expand/fullscreen buttons (nobody does this, auto-resize is sufficient)
- Rich text WYSIWYG for input (only Better Chatbot uses TipTap, and only for @mentions)
- Slash commands for formatting (adds complexity, markdown in responses is enough)

## Open Questions

1. **@Mention syntax:** `@gpt-4` or `@model:gpt-4`? How handle conflicts between tool
   names and model names?

2. **Voice button placement:** Always visible in input? Or action bar only? Or keyboard
   shortcut primary?

3. **File preview location:** Above input, inside input area, or separate panel?

4. **Multi-model @mentions:** Can user mention multiple models? If yes, how does
   orchestration work?

## Phase Sequencing

**Phase 1: Core Input (MVP)**

1. Auto-resizing textarea with IME handling
2. Paste-to-attach images
3. File upload with progress
4. Platform-aware focus
5. Draft persistence
6. Send button states (all 5 states)

**Phase 2: Voice** 7. Multi-provider voice input 8. Audio visualization 9. Browser STT
with server fallback

**Phase 3: @Mentions & Power Features** 10. TipTap integration 11. @mention suggestion
system 12. Tool filtering logic 13. Command history (ArrowUp/Down)

**Phase 4: Smart Paste** 14. Long text → file conversion 15. Visual feedback animations

## Reference Implementations

Code to study when building (in `../reference/`):

- **ai-chatbot** - `multimodal-input.tsx` for paste detection
- **better-chatbot** - `mention-input.tsx` for TipTap @mentions
- **open-webui** - `audio.py` for multi-provider voice
- **chat-ui** - `ChatInput.svelte` for mobile/touch device detection

## The Insight

**Better Chatbot's mention-based tool filtering is the killer feature.**

Every other chat interface treats @mentions as suggestions - helpful shortcuts but
purely cosmetic. Better Chatbot makes them functional: typing `@calculator` doesn't just
suggest the calculator tool, it RESTRICTS the LLM to ONLY that tool.

This is perfect for Carmenta's agent-orchestration positioning. Builders want precise
control. "Use only the calculator" is clearer than "here are 50 tools, good luck." Saves
tokens, improves accuracy, gives builders the control they expect.

This is the differentiator worth investing in.
