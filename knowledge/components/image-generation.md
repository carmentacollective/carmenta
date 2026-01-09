# Image Generation

Create images from conversation. Text prompts become visual output—logos, illustrations,
diagrams, concept art, social graphics. Carmenta routes to the right image model,
handles iteration, and persists results as artifacts.

## Architecture Decisions

✅ **Use Vercel AI Gateway with Unified Abstraction** (updated 2025-01)

The AI Gateway (`@ai-sdk/gateway`) supports image generation, but **two different APIs
exist** based on model architecture:

| Model Type                            | API               | Response Format  |
| ------------------------------------- | ----------------- | ---------------- |
| Dedicated image models (Imagen, FLUX) | `generateImage()` | `image.base64`   |
| Multimodal LLMs (Gemini 3 Pro Image)  | `generateText()`  | `files[].base64` |

**This is intentional, not a bug.** Google built two different model types:

- **Imagen** = purpose-built image generator (prompt → image)
- **Gemini 3 Pro Image** = LLM with image output capability (prompt → text + images)

Our tool abstracts this difference—users don't need to know which API is used.

### Available Models (January 2025)

| Model                | ID                                    | Price      | API             | Best For                      |
| -------------------- | ------------------------------------- | ---------- | --------------- | ----------------------------- |
| **Nano Banana Pro**  | `google/gemini-3-pro-image`           | $0.014/img | `generateText`  | Text rendering, reasoning, 4K |
| **FLUX 2 Pro**       | `bfl/flux-2-pro`                      | $0.03/MP   | `generateImage` | 4MP, editing, multi-reference |
| **Imagen 4.0**       | `google/imagen-4.0-generate-001`      | $0.04/img  | `generateImage` | Reliable baseline             |
| **FLUX 1.1 Pro**     | `bfl/flux-pro-1.1`                    | $0.04/img  | `generateImage` | Artistic quality              |
| **Imagen 4.0 Fast**  | `google/imagen-4.0-fast-generate-001` | $0.02/img  | `generateImage` | Speed, drafts                 |
| **FLUX Kontext Pro** | `bfl/flux-kontext-pro`                | varies     | `generateImage` | Character consistency         |

Sources: [Vercel AI Gateway Models](https://vercel.com/ai-gateway/models),
[AI SDK Image Generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation)

✅ **Primary Model: Nano Banana Pro** (updated 2025-01)

Gemini 3 Pro Image (Nano Banana Pro) is our default for quality-tier requests:

- State-of-the-art text rendering in images (industry-leading)
- Reasoning-enabled editing ("thinking" mode)
- 4K output resolution support
- Cheapest per-image at $0.014

For fast drafts, we route to Imagen 4.0 Fast ($0.02/image).

✅ **Tool-based Architecture** (decided 2025-01)

Image generation is a built-in tool in `lib/tools/built-in.ts`, not a service adapter.
This matches our pattern for capabilities that are conversation-native (like calculate,
webSearch, giphy). The tool returns generated image data that renders inline.

✅ **Async Generation with Progress** (decided 2025-01)

Image generation takes 5-30 seconds. The Vercel AI Gateway's `generateImage` API is
fire-and-wait (no streaming progress events), so we use simulated progress indicators
following the deepResearch pattern:

- Rotating tips that provide value during the wait
- Elapsed time counter (appears after 5s)
- Animated indeterminate progress bar
- Prompt context displayed during generation

**Research finding**: Competitor analysis (LibreChat, LobeChat, Open WebUI) confirmed
this is industry standard. LibreChat uses sophisticated canvas-based "PixelCard"
animations to make waits feel shorter, but all progress is simulated - the API provides
no real-time progress data.

## Why This Exists

AI image generation has become essential creative infrastructure. People generate
marketing assets, visualize ideas, create social content, prototype designs. But the
experience is fragmented: DALL-E in one tab, Midjourney in Discord, Stable Diffusion
requiring technical setup.

Carmenta is the unified front door to AI. That includes visual AI. When we generate a
logo concept, create an illustration for a blog post, or visualize an architecture
diagram, it should happen in the same interface where we do everything else—with the
same memory, context, and conversation history.

Image generation also unlocks the full potential of AG-UI. Purpose-built interfaces can
include generated visuals alongside data and interactions. A travel planning response
might include AI-generated mood boards. A product spec might include generated UI
mockups. Images become another modality Carmenta uses to communicate.

## Core Philosophy

**Model-Agnostic, Outcome-Focused**

We don't ask users to choose between DALL-E, Midjourney, Stable Diffusion, or the next
model that launches tomorrow. We ask what they want to create. The Image Artist
sub-agent routes to the model best suited for the task: photorealism, illustration,
logos, diagrams.

Users can override model selection when they have preferences. But the default is: tell
us what you want, we figure out how.

**Sub-Agent Architecture**

Image generation uses a dedicated sub-agent rather than inline tool logic:

1. **Main conversation** detects image intent, optionally asks clarifying questions
2. **Image Artist sub-agent** has full model rubric and prompt engineering knowledge
3. **Prompt expansion** transforms brief requests into detailed specifications
4. **Task-based routing** selects optimal model (not speed-based)
5. **Transparency** - shows users the expanded prompt used

This keeps the main concierge lean (no rubric context) while giving the image generation
path full context for quality decisions.

**Iteration Is the Work**

First-attempt image generation rarely produces the final result. The real workflow is:
generate → critique → refine → regenerate. We support this loop natively:

- Reference previous generations in conversation
- Edit specific aspects without regenerating everything
- Maintain style consistency across iterations
- Track the creative evolution through version history

**Images as First-Class Artifacts**

Generated images persist beyond the conversation that created them. They live in
artifacts with full version history, references, and sharing capabilities. An image
generated today is findable, refineable, and shareable forever.

**Voice-Native**

"Create an illustration of a sunset over mountains, warm tones, minimalist style." Image
generation works through voice as naturally as text. Results announce when ready. Voice
descriptions become prompts. This isn't an afterthought—it's how generation integrates
with Carmenta's voice-first identity.

## Relationship to Other Components

**Artifacts**: Generated images become artifacts automatically. Version history tracks
iterations. References link images to conversations. Sharing exposes images without
exposing the prompts that created them. The Artifacts component handles persistence; we
handle generation.

**Conversations**: Generation happens through conversation. Prompts are messages.
Results appear inline with artifact links. Iteration continues the conversation. Memory
informs style preferences across sessions.

**Memory**: We remember what works. Style preferences extracted from successful
generations. Brand guidelines stored for consistency. "Use my usual illustration style"
works because Memory provides context.

**Concierge**: The Concierge routes image requests to appropriate models. Simple prompts
might use fast models. Complex artistic requests might use higher-fidelity options. The
user describes intent; Concierge translates to capability.

**Interface**: Generated images display inline with conversation, expandable to full
view. Editing tools (inpainting, outpainting, style transfer) surface when relevant.
AG-UI responses can include generated images as embedded components.

**File Attachments**: Image-to-image workflows combine uploads with generation. "Make
this photo look like a watercolor" takes an attachment and generates a transformation.
Style references from uploaded images inform generation.

## Core Functions

### Generation

Accept natural language prompts describing desired images:

- "Create a logo for a coffee shop called Morning Ritual, minimalist, earth tones"
- "Illustration of a team brainstorming session, tech startup vibe, diverse group"
- "Product mockup showing our app on an iPhone, clean white background"
- "Architecture diagram showing microservices communication patterns"

Process prompts through:

1. **Prompt enhancement**: Expand vague requests into detailed specifications. Add
   technical parameters (aspect ratio, style tokens) based on intent.
2. **Model routing**: Select appropriate generation model based on task type, quality
   requirements, and user preferences.
3. **Generation**: Execute generation with selected model.
4. **Post-processing**: Apply any requested transformations, format for display.
5. **Artifact creation**: Persist result with metadata, prompt history, model used.

### Iteration

Support refinement workflows:

**Regenerate**: Same prompt, different seed. "Try again" produces variations.

**Refine**: Modify specific aspects. "Make the background darker" or "remove the person
on the left" applies targeted changes.

**Extend**: Outpainting to expand image beyond original boundaries. "Add more sky above"
or "extend the scene to the right."

**Style transfer**: Apply style from one image to another. "Make this photo look like
that illustration style."

**Upscale**: Increase resolution for print or high-resolution displays.

Track iteration history. Any previous version is recoverable. Show the creative journey
from first attempt to final result.

### Model Selection

**Route by task type, not speed.** Users expect to wait for images.

**Routing Reference**: See `knowledge/image-rubric.md` for slim routing rules and
`knowledge/image-rubric-detailed.md` for full eval data and model profiles.

**Task-Based Routing** (implemented in Image Artist sub-agent):

| Task           | Best Model                  | Score | Why                 |
| -------------- | --------------------------- | ----- | ------------------- |
| Diagrams       | `google/gemini-3-pro-image` | 98%   | LLM reasoning       |
| Text-heavy     | `google/gemini-3-pro-image` | 86%   | Best text rendering |
| Illustrations  | `google/gemini-3-pro-image` | 75%   | Detail work         |
| Logos          | `bfl/flux-2-flex`           | 70%   | Clean graphics      |
| Photorealistic | `google/imagen-4.0-ultra`   | 70%   | Realistic images    |

Scores from 195-case Braintrust eval (13 models × 15 prompts, January 2025).

**Routing Logic** (in sub-agent):

- Prompt contains diagram/flowchart/architecture/infographic → Nano Banana Pro
- Prompt needs text in image (poster, sign, label, title, banner) → Nano Banana Pro
- Prompt is logo/wordmark/brand/icon/emblem → FLUX 2 Flex
- Prompt is photo/realistic/portrait/landscape/product → Imagen 4.0 Ultra
- Prompt is illustration/cartoon/character/scene/fantasy → Nano Banana Pro
- Default → Imagen 4.0

**Models to Avoid** (based on eval):

- GPT-5 Image (37%) - expensive and underperforms
- Imagen 4.0 Fast (33%) - quality too low
- FLUX Kontext Pro (31%) - poor across all categories

Users can specify model directly: "use FLUX for this" overrides routing.

### API Integration

We use Vercel AI Gateway with **two different APIs** based on model type:

```typescript
import { generateImage, generateText } from "ai";
import { getGatewayClient } from "@/lib/ai/gateway";

const gateway = getGatewayClient();

// =============================================================
// DEDICATED IMAGE MODELS → use generateImage()
// =============================================================

// Imagen 4.0 (fast, reliable baseline)
const { image } = await generateImage({
  model: gateway.imageModel("google/imagen-4.0-generate-001"),
  prompt: userPrompt,
  aspectRatio: "16:9",
});
// Response: image.base64, image.uint8Array, image.mediaType

// FLUX for artistic work
const { image: artImage } = await generateImage({
  model: gateway.imageModel("bfl/flux-pro-1.1"),
  prompt: "Watercolor sunset over mountains",
  aspectRatio: "16:9",
});

// =============================================================
// MULTIMODAL LLMs → use generateText()
// =============================================================

// Nano Banana Pro (best for text rendering, reasoning)
const result = await generateText({
  model: gateway("google/gemini-3-pro-image"),
  prompt: "Logo with text: 'Morning Ritual Coffee'",
});

// Extract image from files array
const imageFile = result.files?.find((f) => f.mediaType?.startsWith("image/"));
// Response: imageFile.base64, imageFile.uint8Array, imageFile.mediaType
```

**Why two APIs?** Different model architectures:

- Imagen/FLUX are dedicated image generators (prompt → image only)
- Gemini 3 Pro Image is an LLM that outputs images (prompt → text + images)

Our `createImageTool` in `lib/tools/built-in.ts` abstracts this—users don't need to know
which API is used. No additional API keys needed—uses existing `AI_GATEWAY_API_KEY`.

### Prompt Engineering

The generation quality depends heavily on prompt quality. The Image Artist sub-agent
handles this automatically.

**Expansion Formula**: Subject + Style/Medium + Details + Environment + Lighting + Mood

Example:

- User: "coffee shop logo"
- Expanded: "Minimalist logo for a coffee shop, clean vector style, warm earth tones
  (brown, cream, terracotta), single coffee cup icon with steam forming abstract shape,
  simple sans-serif wordmark, professional and inviting, white background"

**Key Transformations**:

1. **Specificity**: "dog" → "golden retriever puppy, 3 months old, sitting"
2. **Style anchor**: Add art medium or photography style
3. **Lighting**: golden hour, soft diffused, dramatic side lighting
4. **Mood**: warm, professional, playful, mysterious
5. **Composition**: close-up, wide shot, rule of thirds, centered
6. **Quality markers**: highly detailed, 4K, professional quality

**What to Avoid in Prompts**:

- Conversational language ("please create", "I want")
- Abstract concepts without grounding ("freedom" → "eagle soaring over canyon at
  sunrise")
- Conflicting styles ("photorealistic oil painting")

**Reference integration**: When style references exist in memory, inject them
automatically. "Use my brand colors" works when brand context exists.

### Clarification Strategy

Based on competitor research, we generate immediately (80% of requests) but consider
brief clarification for high-stakes creative work (20%).

**Generate immediately when**:

- Clear, specific prompts
- Technical diagrams
- Simple scenes
- User says "quick" or shows urgency

**Consider ONE clarifying question for**:

- Logo/brand work (style matters enormously)
- Ambiguous mood ("make it nice" → "professional or playful?")
- Complex multi-subject scenes

The main conversation handles clarification naturally - not the sub-agent. This keeps
interaction flowing without awkward tool state.

**Always offer easy opt-out**: "Or I can just generate with my best judgment."

### Reference Images

Reference images dramatically improve results for style consistency, brand alignment,
and character consistency across images.

**When to offer reference image upload**:

- Logo and brand work
- Illustration series
- When user mentions "like X" or "similar to"

**What to extract from references**:

- Color palette
- Composition style
- Lighting quality
- Texture/grain

Don't copy the subject - transfer the aesthetic.

### Output Formats

Support multiple output configurations:

- Aspect ratios: Square, portrait, landscape, widescreen, custom
- Resolutions: Preview (fast), standard, high-resolution, print-ready
- Formats: PNG, JPEG, WebP, SVG (for diagrams)
- Batch generation: Multiple variations in single request

## Integration Points

- **Concierge**: Receives image generation requests, routes to this component
- **Artifacts**: Stores generated images, handles versioning and persistence
- **Memory**: Provides style preferences, brand guidelines, past successful patterns
- **Interface**: Displays results, provides editing UI, handles downloads
- **File Attachments**: Provides input images for image-to-image workflows
- **Usage Metering**: Tracks generation costs for billing and limits
- **Subscriptions**: Gates access to premium models and higher resolution outputs

## Voice Integration

Image generation through voice follows the same patterns as text:

"Hey Carmenta, create a logo for my new podcast about technology and philosophy.
Something minimal, maybe incorporating an infinity symbol."

Results announce: "I've created four logo concepts. The first uses a clean infinity
symbol in deep blue..."

Voice descriptions of desired changes: "I like the second one but make it warmer, more
golden tones."

Voice works because image generation is fundamentally a language interface. The prompt
IS natural language. Voice is just another input method.

## AG-UI Integration

Generated images become building blocks for AG-UI responses:

**Travel planning**: Response includes generated mood boards alongside maps and booking
options.

**Product development**: Interface shows generated UI mockups alongside feature
specifications.

**Marketing**: Campaign planning response includes generated social graphics alongside
copy suggestions.

**Personal**: Gift ideas include generated product mockups alongside purchase links.

Images aren't separate from rich responses—they're components within them.

## Success Criteria

**Functional**:

- Generate images from natural language prompts across all major use cases
- Iteration workflows feel natural, not tedious
- Model routing produces appropriate quality without user intervention
- Voice generation works as naturally as text
- Generated images persist and remain accessible indefinitely

**Quality**:

- Prompt enhancement improves output quality noticeably
- Style consistency across iterations when requested
- Generation speed appropriate to quality level (previews fast, finals slower)
- Results competitive with native platform experiences (ChatGPT, Midjourney)

**Experience**:

- First generation attempt often useful, not just "try again" fodder
- Refinement feels like collaboration, not wrestling with the tool
- Finding previous generations is trivial
- Sharing images is one action, not export/upload/share

## Open Questions

### Model Strategy

**Provider relationships**: Direct API access or through aggregators? Cost implications?
Reliability concerns?

**Model evaluation**: How do we benchmark models for routing decisions? Automated
evaluation or human judgment?

**New model integration**: Process for adding models as they launch? Flux, Imagen,
future capabilities?

**Fine-tuning**: Support user-specific or brand-specific fine-tuned models? Significant
complexity but potential differentiation.

### Product Decisions

**Pricing**: How does image generation affect subscription tiers? Per-generation costs?
Quality-based pricing? Resolution limits by tier?

**Rate limiting**: Generation limits per time period? Queue system for high-demand
periods?

**Content policy**: How do we handle generation requests that models refuse? Do we have
our own content policy layer?

**Ownership**: What rights do users have to generated images? Commercial use? What do we
retain?

### Technical Decisions

**Generation infrastructure**: Serverless functions or dedicated GPU instances? Latency
vs cost tradeoffs?

**Queue management**: Priority system for paid vs free tiers? Estimated wait times?

**Caching**: Cache common generation patterns? Privacy implications?

**Prompt storage**: Store full prompts with artifacts? Privacy considerations?

### Future Capabilities

**Video generation**: Runway, Pika, Sora—video is coming. How does this extend image
generation architecture?

**3D generation**: NeRF, Gaussian splatting—3D asset generation emerging. Relevant for
certain use cases.

**Real-time generation**: Streaming generation for interactive applications? Significant
technical complexity.

**Collaborative generation**: Multiple users iterating on same image? Version control
implications?

## Competitor Landscape (Updated 2025-01)

### ChatGPT with GPT Image 1

Tight integration within conversation. GPT Image 1 (April 2025) brought major
improvements in instruction following and text rendering. Still limited iteration UX.
Images live in conversation context with some persistence. Sets baseline expectation.

### Gemini with Nano Banana Pro

Google's December 2025 release of Gemini 3 Pro Image set a new bar: 4K output, character
consistency, reasoning-enabled editing. Available in Gemini app, Google AI Studio, and
via API. Strong for text-in-image tasks. Our primary model.

### Midjourney

Best aesthetic quality for artistic output. Now has web UI (moved beyond Discord).
Strong community creates style vocabulary. V7 (2025) improved prompt adherence.
Subscription model proven.

### FLUX.2 (Black Forest Labs)

Open-weight diffusion model with excellent quality. Available via multiple providers
(Replicate, fal.ai, Cloudflare Workers AI). Good for artistic/creative work. Supports
multi-reference image inputs for consistency.

### Adobe Firefly

Enterprise-focused. Training data provenance matters for commercial use. Integration
with Creative Cloud valuable. Firefly 3 (2025) competitive on quality.

### LibreChat / LobeChat / Open WebUI

Open-source competitors support image generation via tools. LibreChat uses DALL-E and
FLUX. LobeChat supports DALL-E 3 and Pollinations. Open WebUI supports DALL-E,
AUTOMATIC1111, ComfyUI. None have the iteration loop UX we're building.

**Progress/Loading UX Research (2025-01)**:

**LibreChat** (most sophisticated):

- Canvas-based "PixelCard" animation - radial pixel reveal from center outward
- Quality-based timing estimates: Low (10s), Medium (20s), High (50s) with ±30% jitter
- Multi-layer progress: PixelCard + shimmer text + progress circle
- Files: `PixelCard.tsx`, `OpenAIImageGen.tsx`, `ProgressText.tsx`

**LobeChat**:

- State-based rendering (LoadingState/SuccessState/ErrorState components)
- Elapsed time counter during generation
- Skeleton grid for initial page load
- Direct swap from loading to image (no progressive reveal)

**Open WebUI**:

- Simple multi-circle spinner during generation
- No skeleton/placeholder - direct image render
- Fire-and-wait API pattern

**Key insight**: All competitors simulate progress because image generation APIs provide
no real-time streaming events. LibreChat's sophisticated animations make waits _feel_
shorter but don't show actual generation progress.

### Opportunity

No unified interface does it all well. ChatGPT has generation but limited iteration.
Midjourney has quality but is a separate app. Google has the best model but basic UX.
Open-source projects have tools but no polished iteration experience.

Carmenta integrates generation into the broader AI interface—with memory, voice,
artifacts, AG-UI, and a true iteration loop. The image becomes part of the conversation,
refineable through natural dialogue.

## Implementation Milestones

### Phase 1: Basic Generation (MVP) ✅

- [x] Add `createImage` tool to `lib/tools/built-in.ts`
- [x] Add tool config to `lib/tools/tool-config.ts` with delight messages
- [x] Use existing Gateway (`gateway.imageModel()`) - no new API keys needed
- [x] Return base64 image data for inline display
- [x] Add image rendering component (`components/tools/integrations/create-image.tsx`)
- [x] Premium loading experience with rotating tips, elapsed timer, progress animation

PR #671 implements Phase 1 with polished UX.

### Phase 2: Sub-Agent Architecture

- [ ] Create Image Artist sub-agent (`lib/ai-team/image-artist/`)
- [ ] Implement prompt expansion logic with engineering patterns
- [ ] Add task-based model routing (diagrams → Nano Banana, logos → FLUX, etc.)
- [ ] Create tool wrapper (`lib/ai-team/agents/image-artist-tool.ts`)
- [ ] Return expanded prompt in tool output for transparency
- [ ] Update UI to display expanded prompt used

### Phase 3: Enhanced UX

- [ ] Aspect ratio selection from prompt analysis
- [ ] Reference image support for style consistency
- [ ] "Try again" regeneration with different seed
- [ ] Targeted refinement ("make it warmer", "remove the person")
- [ ] Version history tracking

### Phase 4: Multi-Model Routing (Complete)

- [x] Task-based routing via Image Artist sub-agent
- [x] Model rubric based on 195-image eval (13 models × 15 prompts)
- [x] User model override via prompt ("use FLUX for this")
- [x] Gateway models only (OpenRouter not needed - Gateway wins every category)

## Sources

- [Nano Banana Pro API Setup Guide](https://www.aifreeapi.com/en/posts/nano-banana-pro-api-setup)
- [Vercel AI SDK generateImage](https://github.com/vercel/ai/blob/main/content/docs/07-reference/01-ai-sdk-core/10-generate-image.mdx)
- [Google Gemini Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [OpenRouter Image Generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [Black Forest Labs FLUX](https://docs.bfl.ml/quick_start/introduction)
