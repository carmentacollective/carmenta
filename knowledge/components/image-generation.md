# Image Generation

Create images from conversation. Text prompts become visual output—logos, illustrations,
diagrams, concept art, social graphics. Carmenta routes to the right image model,
handles iteration, and persists results as artifacts.

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

Available models (initial set, expands over time):

- **DALL-E 3**: Strong prompt adherence, good for specific compositions
- **Midjourney**: Distinctive aesthetic, strong for artistic output
- **Stable Diffusion XL**: Open model, customizable, good baseline
- **Flux**: Emerging capability, evaluate and integrate as appropriate

Model selection factors:

- Task type (photorealism, illustration, diagram, logo)
- Speed requirements (fast preview vs high quality)
- Style consistency (matching previous generations)
- Cost optimization (route appropriately based on user tier)

Users can specify model directly: "use Midjourney for this" overrides routing.

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

## Competitor Landscape

### ChatGPT with DALL-E

Tight integration within conversation. Generates well, iterates poorly. No persistent
storage—images live in conversation context only. Limited customization. Sets baseline
expectation for "AI that can make images."

### Midjourney

Best aesthetic quality. Discord-based interface is limiting. Strong community creates
style vocabulary. Subscription model works. Shows what's possible for artistic output.

### Adobe Firefly

Enterprise-focused. Training data provenance matters for commercial use. Integration
with Creative Cloud valuable. Shows commercial viability concerns.

### Canva AI

Design context, not chat context. Images generated within specific layouts. Different
use case but demonstrates image generation as feature within broader creative tool.

### Opportunity

No unified interface does it all. ChatGPT has generation but poor persistence and
iteration. Midjourney has quality but terrible UX. Firefly has commercial clarity but
limited capability. Canva has context but is design-specific.

Carmenta integrates generation into the broader AI interface—with memory, voice,
artifacts, and AG-UI. The image becomes part of the conversation, not a side tool.
