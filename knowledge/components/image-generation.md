# Image Generation

Create images from conversation. Text prompts become visual output—logos, illustrations,
diagrams, concept art, social graphics. Carmenta routes to the right image model,
handles iteration, and persists results as artifacts.

## Architecture Decisions

✅ **Use Vercel AI Gateway `imageModel()`** (decided 2025-01)

The AI Gateway (`@ai-sdk/gateway`) supports image generation via `gateway.imageModel()`.
This uses our existing `AI_GATEWAY_API_KEY`—no additional API keys needed. Benefits:

- Single API key for LLMs AND image generation
- Unified billing through Vercel
- Built-in retry/failover support
- Consistent with our existing `lib/ai/gateway.ts` pattern

Available image models via Gateway:

- `google/imagen-4.0-generate` - Fast, good quality
- `google/imagen-4.0-ultra-generate` - Higher quality
- `bfl/flux-pro-1.1` - Artistic, high-quality
- `bfl/flux-kontext-pro` - Character consistency
- `google/gemini-3-pro-image` - Nano Banana Pro (multimodal)

✅ **Primary Model: Imagen 4.0** (decided 2025-01)

Google's Imagen 4.0 via Gateway is our default for speed and reliability. For tasks
requiring text rendering or character consistency, we route to Gemini 3 Pro Image (Nano
Banana Pro) or FLUX Kontext.

**Nano Banana Pro (Gemini 3 Pro Image)** is available for advanced use cases:

- State-of-the-art text rendering in images (industry-leading)
- Character consistency across multiple images (up to 5 characters)
- Multi-step editing with reasoning ("thinking" mode)
- 4K output resolution support
- Competitive pricing (~$0.134/image standard, ~$0.24/4K)

✅ **Tool-based Architecture** (decided 2025-01)

Image generation is a built-in tool in `lib/tools/built-in.ts`, not a service adapter.
This matches our pattern for capabilities that are conversation-native (like calculate,
webSearch, giphy). The tool returns generated image data that renders inline.

✅ **Async Generation with Progress** (decided 2025-01)

Image generation takes 5-30 seconds. We use streaming progress indicators similar to
deepResearch. The tool UI shows generation status, and results appear when ready.

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
model that launches tomorrow. We ask what they want to create. The Concierge routes to
the model best suited for the task: photorealism, illustration, speed, style
consistency.

Users can override model selection when they have preferences. But the default is: tell
us what you want, we figure out how.

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

Default: automatic routing based on request analysis.

**Primary Model (2025)**:

- **Gemini 3 Pro Image (Nano Banana Pro)**: Our default. Best-in-class text rendering,
  character consistency, 4K output, reasoning-enabled editing. Available via Vercel AI
  SDK's Google provider.

**Alternative Models** (via Vercel AI SDK providers):

- **GPT Image 1 (OpenAI)**: Strong prompt adherence, good for specific compositions.
  Available via `@ai-sdk/openai`.
- **FLUX.2 (Black Forest Labs)**: High-quality diffusion model, excellent for artistic
  output. Available via `@ai-sdk/replicate` or `@ai-sdk/fal`.
- **Imagen 4 (Google)**: Fast generation, good baseline. Available via `@ai-sdk/google`.

**Model Routing Factors**:

- Task type (photorealism → Nano Banana Pro, artistic → FLUX, fast preview → Imagen)
- Text rendering needs (Nano Banana Pro excels here)
- Speed requirements (Imagen fastest, Nano Banana Pro slower but higher quality)
- Cost optimization (route appropriately based on user tier)

Users can specify model directly: "use FLUX for this" overrides routing.

### API Integration

We use Vercel AI Gateway with `generateImage`:

```typescript
import { generateImage } from "ai";
import { getGatewayClient } from "@/lib/ai/gateway";

const gateway = getGatewayClient();

// Default: Imagen 4.0 (fast, reliable)
const { image } = await generateImage({
  model: gateway.imageModel("google/imagen-4.0-generate"),
  prompt: userPrompt,
  aspectRatio: "16:9",
});

// For text-heavy images: Nano Banana Pro
const { image: textImage } = await generateImage({
  model: gateway.imageModel("google/gemini-3-pro-image"),
  prompt: "Logo with text: 'Morning Ritual Coffee'",
  aspectRatio: "1:1",
});

// For artistic work: FLUX
const { image: artImage } = await generateImage({
  model: gateway.imageModel("bfl/flux-pro-1.1"),
  prompt: "Watercolor sunset over mountains",
  aspectRatio: "16:9",
});
```

The response includes `image.uint8Array` (raw bytes) or `image.base64` for
storage/display. No additional API keys needed—uses existing `AI_GATEWAY_API_KEY`.

### Prompt Engineering

The generation quality depends heavily on prompt quality. We help:

**Expansion**: Brief prompts become detailed specifications. "sunset" becomes "golden
hour sunset over ocean, warm orange and pink sky, silhouette of palm trees,
photorealistic, 4K quality."

**Style vocabulary**: Translate natural descriptions to model-specific tokens. "make it
look professional" becomes appropriate style parameters.

**Reference integration**: When style references exist in memory, inject them
automatically. "Use my brand colors" works when brand context exists.

**Negative prompts**: Generate appropriate exclusions to avoid common artifacts.

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

### Opportunity

No unified interface does it all well. ChatGPT has generation but limited iteration.
Midjourney has quality but is a separate app. Google has the best model but basic UX.
Open-source projects have tools but no polished iteration experience.

Carmenta integrates generation into the broader AI interface—with memory, voice,
artifacts, AG-UI, and a true iteration loop. The image becomes part of the conversation,
refineable through natural dialogue.

## Implementation Milestones

### Phase 1: Basic Generation (MVP)

- [ ] Add `generateImage` tool to `lib/tools/built-in.ts`
- [ ] Add tool config to `lib/tools/tool-config.ts` with delight messages
- [ ] Use existing Gateway (`gateway.imageModel()`) - no new API keys needed
- [ ] Return base64 image data for inline display
- [ ] Add image rendering component for tool results

### Phase 2: Enhanced UX

- [ ] Progress indicator during generation (5-30s)
- [ ] Aspect ratio selection from prompt analysis
- [ ] Resolution options (1K/2K/4K based on user tier)
- [ ] Error handling with user-friendly messages

### Phase 3: Iteration Loop

- [ ] "Try again" regeneration with different seed
- [ ] Targeted refinement ("make it warmer", "remove the person")
- [ ] Reference previous generations in conversation
- [ ] Version history tracking

### Phase 4: Multi-Model Routing

- [ ] Add FLUX via Replicate/fal provider
- [ ] Add GPT Image 1 via OpenAI provider
- [ ] Implement routing logic based on task type
- [ ] User model override via prompt

## Sources

- [Nano Banana Pro API Setup Guide](https://www.aifreeapi.com/en/posts/nano-banana-pro-api-setup)
- [Vercel AI SDK generateImage](https://github.com/vercel/ai/blob/main/content/docs/07-reference/01-ai-sdk-core/10-generate-image.mdx)
- [Google Gemini Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [OpenRouter Image Generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [Black Forest Labs FLUX](https://docs.bfl.ml/quick_start/introduction)
