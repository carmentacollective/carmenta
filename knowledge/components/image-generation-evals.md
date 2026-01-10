# Image Generation: Tool State Machine & Evals

## Tool State Machine (Critical)

Image generation uses the Vercel AI SDK's tool streaming architecture. Understanding the
state machine is critical for correct rendering.

### Tool States

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ input-streaming │ ──► │ input-available │ ──► │ output-available│
│ (params arriving)│     │ (executing)     │     │ (success)       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌─────────────────┐        │
                              │  output-error   │ ◄──────┘
                              │  (failed)       │
                              └─────────────────┘
```

**State definitions:**

| State              | Input        | Output   | What's Happening              |
| ------------------ | ------------ | -------- | ----------------------------- |
| `input-streaming`  | partial/none | none     | Parameters streaming from LLM |
| `input-available`  | complete     | none     | Tool execution starting       |
| `output-available` | complete     | complete | Tool succeeded                |
| `output-error`     | complete     | error    | Tool failed                   |

### Rendering Rule: State-Driven, Not Data-Driven

**Wrong pattern (causes bugs):**

```typescript
// BAD: Checking data presence
if (!part.input) return null;
if (!part.output) return <Loading />;
```

**Correct pattern (Vercel's approach):**

```typescript
// GOOD: Rendering based on state
switch (part.state) {
    case "input-streaming":
        return null; // Or minimal placeholder
    case "input-available":
        return <ToolExecuting input={part.input} />;
    case "output-available":
        return <ToolResult input={part.input} output={part.output} />;
    case "output-error":
        return <ToolError input={part.input} error={part.errorText} />;
}
```

**Why this matters:**

The `input: unknown` type on `ToolPart` is non-optional, but at runtime `input` can be
`undefined` during `input-streaming`. The state enum is the source of truth - it tells
you what data is guaranteed to exist.

**Bug pattern we hit (2025-01):**

```typescript
// ToolPartRenderer guarded on !part.input
if (!part.input) return null;

// But createImage.tsx accessed input.prompt before checking status
const prompt = (input.prompt as string) || ""; // CRASH when input is undefined
```

The fix is state-driven rendering in `ToolPartRenderer` that only renders components
when `input-available` or later states are reached.

### Image Generation State Flow

```
User: "Create a logo for my coffee shop"
    ↓
LLM starts tool call
    ↓
State: input-streaming
  - part.input: undefined or partial { prompt: "Create a l..." }
  - Render: null (nothing to show yet)
    ↓
State: input-available
  - part.input: { prompt: "Create a logo...", aspectRatio: "1:1" }
  - Render: ImageGenerationLoader (pendulum animation)
  - Tool execution begins
    ↓
generateImage() calls Vercel AI Gateway → Google Imagen
  - 5-15 seconds of generation time
    ↓
State: output-available
  - part.output: { success: true, image: { base64: "...", mimeType: "image/png" } }
  - Render: ImageContent with the generated image
```

## Evals Architecture

### Purpose

Systematic testing of image generation quality across:

- Different image models (Imagen 4.0, Gemini 3 Pro, FLUX)
- Different prompt types (logos, illustrations, photorealistic, text-heavy)
- LLM-as-judge scoring for quality assessment

### Eval Structure

```
evals/
├── image-generation.eval.ts    # Main eval file
├── scorers/
│   └── image-quality-scorer.ts # LLM-as-judge scorer
└── fixtures/
    └── image-prompts.json      # Test prompts by category
```

### Test Categories

| Category       | What It Tests                                      | Example Prompt                               |
| -------------- | -------------------------------------------------- | -------------------------------------------- |
| logos          | Clean graphics, text rendering, brand identity     | "Logo for 'Morning Ritual' coffee shop"      |
| illustrations  | Artistic style, composition, visual storytelling   | "Illustration of a team brainstorming"       |
| photorealistic | Realism, lighting, natural scenes                  | "Golden hour sunset over mountains"          |
| text-heavy     | Text rendering accuracy (Nano Banana Pro strength) | "Poster with headline 'SUMMER SALE 50% OFF'" |
| diagrams       | Technical accuracy, clarity, information design    | "Architecture diagram of microservices"      |

### Test Prompts (5 Images)

```typescript
const testPrompts = [
  {
    id: "logo-coffee",
    category: "logos",
    prompt:
      "Minimalist logo for 'Morning Ritual' coffee shop. Earth tones, clean lines, professional.",
    expectedStrengths: ["clean design", "readable text", "professional"],
  },
  {
    id: "illustration-team",
    category: "illustrations",
    prompt:
      "Warm illustration of a diverse tech startup team in a creative workspace. Modern, friendly, vibrant colors.",
    expectedStrengths: [
      "diverse representation",
      "warm atmosphere",
      "modern aesthetic",
    ],
  },
  {
    id: "photo-sunset",
    category: "photorealistic",
    prompt:
      "Golden hour sunset over ocean with silhouette of palm trees. Warm orange and pink sky, photorealistic.",
    expectedStrengths: ["realistic lighting", "atmospheric depth", "natural colors"],
  },
  {
    id: "text-poster",
    category: "text-heavy",
    prompt:
      "Event poster with bold text 'TECH SUMMIT 2025' and subtext 'January 15-17, San Francisco'. Modern tech aesthetic.",
    expectedStrengths: ["readable text", "correct spelling", "professional layout"],
  },
  {
    id: "diagram-arch",
    category: "diagrams",
    prompt:
      "Clean architecture diagram showing: User → API Gateway → Auth Service → Database. Technical but visually clear.",
    expectedStrengths: ["clear flow", "readable labels", "logical layout"],
  },
];
```

### Models to Test

```typescript
const imageModels = [
  {
    id: "google/imagen-4.0-fast-generate-001",
    name: "Imagen 4.0 Fast",
    tier: "fast",
    expectedCost: 0.02,
  },
  {
    id: "google/imagen-4.0-generate-001",
    name: "Imagen 4.0 Standard",
    tier: "standard",
    expectedCost: 0.04,
  },
  {
    id: "google/gemini-3-pro-image",
    name: "Gemini 3 Pro (Nano Banana Pro)",
    tier: "quality",
    expectedCost: 0.134,
  },
];
```

### LLM-as-Judge Scorer

Use Claude or GPT-4 to evaluate generated images on multiple dimensions:

```typescript
interface ImageQualityScore {
  overall: number; // 0-100 composite score
  promptAdherence: number; // Did it match the description?
  technicalQuality: number; // Resolution, artifacts, clarity
  aesthetics: number; // Visual appeal, composition
  textAccuracy: number; // If text present, is it readable/correct?
  usability: number; // Could this be used professionally?
}

const scorePrompt = `
You are evaluating an AI-generated image. Score on these dimensions (0-100):

**Prompt:** {prompt}

**Expected Strengths:** {expectedStrengths}

**Scoring Dimensions:**

1. **Prompt Adherence (0-100)**: Does the image match what was requested?
   - 90-100: Perfect match, all elements present
   - 70-89: Good match, minor omissions
   - 50-69: Partial match, some elements missing
   - Below 50: Significant deviation from prompt

2. **Technical Quality (0-100)**: Image clarity, artifacts, resolution
   - 90-100: Crisp, professional quality, no artifacts
   - 70-89: Good quality, minor imperfections
   - 50-69: Noticeable artifacts or blur
   - Below 50: Significant quality issues

3. **Aesthetics (0-100)**: Visual appeal, composition, color harmony
   - 90-100: Visually stunning, excellent composition
   - 70-89: Attractive, well-composed
   - 50-69: Acceptable but unremarkable
   - Below 50: Poor aesthetics

4. **Text Accuracy (0-100)**: If text is present, score readability and correctness
   - 90-100: Perfect text, fully readable
   - 70-89: Readable with minor issues
   - 50-69: Partially readable
   - Below 50: Illegible or incorrect
   - N/A if no text in prompt

5. **Usability (0-100)**: Could this be used professionally?
   - 90-100: Production-ready
   - 70-89: Usable with minor edits
   - 50-69: Needs significant work
   - Below 50: Not usable

Return JSON:
{
    "overall": <weighted average>,
    "promptAdherence": <score>,
    "technicalQuality": <score>,
    "aesthetics": <score>,
    "textAccuracy": <score or null>,
    "usability": <score>,
    "reasoning": "<brief explanation>"
}
`;
```

### Eval Implementation

```typescript
// evals/image-generation.eval.ts
import { Eval } from "braintrust";
import { generateImage } from "ai";
import { gateway } from "@/lib/ai/gateway";
import { scoreImageQuality } from "./scorers/image-quality-scorer";

Eval("image-generation", {
  data: () => {
    // Generate test matrix: prompts × models
    const testCases = [];
    for (const prompt of testPrompts) {
      for (const model of imageModels) {
        testCases.push({
          input: { prompt, model },
          tags: [prompt.category, model.tier],
        });
      }
    }
    return testCases;
  },

  task: async ({ prompt, model }) => {
    const startTime = Date.now();

    const { image } = await generateImage({
      model: gateway.imageModel(model.id),
      prompt: prompt.prompt,
      aspectRatio: "1:1",
    });

    return {
      image: {
        base64: image.base64,
        mimeType: image.mediaType ?? "image/png",
      },
      model: model.id,
      tier: model.tier,
      durationMs: Date.now() - startTime,
      prompt: prompt.prompt,
      expectedStrengths: prompt.expectedStrengths,
    };
  },

  scores: [
    async (output) => {
      const scores = await scoreImageQuality({
        imageBase64: output.image.base64,
        prompt: output.prompt,
        expectedStrengths: output.expectedStrengths,
      });

      return [
        { name: "overall", score: scores.overall / 100 },
        { name: "promptAdherence", score: scores.promptAdherence / 100 },
        { name: "technicalQuality", score: scores.technicalQuality / 100 },
        { name: "aesthetics", score: scores.aesthetics / 100 },
        {
          name: "textAccuracy",
          score: scores.textAccuracy ? scores.textAccuracy / 100 : null,
        },
        { name: "usability", score: scores.usability / 100 },
        {
          name: "speed",
          score: output.durationMs < 10000 ? 1 : output.durationMs < 20000 ? 0.5 : 0,
        },
      ];
    },
  ],
});
```

### Running Evals

```bash
# Run image generation evals
pnpm dlx braintrust eval evals/image-generation.eval.ts

# Filter by category
pnpm dlx braintrust eval evals/image-generation.eval.ts --filter "tags:logos"

# Filter by model tier
pnpm dlx braintrust eval evals/image-generation.eval.ts --filter "tags:quality"

# Local mode (no upload to Braintrust)
BRAINTRUST_NO_SEND_LOGS=1 pnpm dlx braintrust eval evals/image-generation.eval.ts
```

### Expected Results Matrix

| Prompt Category | Imagen Fast | Imagen Std | Gemini Pro | Notes                          |
| --------------- | ----------- | ---------- | ---------- | ------------------------------ |
| logos           | 65-75       | 75-85      | 85-95      | Gemini excels at clean design  |
| illustrations   | 70-80       | 80-85      | 85-90      | All models good, Gemini best   |
| photorealistic  | 75-85       | 85-90      | 85-90      | Imagen competitive here        |
| text-heavy      | 40-60       | 50-70      | 80-95      | Gemini's text rendering wins   |
| diagrams        | 50-65       | 60-75      | 75-85      | All struggle, Gemini least bad |

### Using Results

1. **Model Selection Tuning**: Results inform automatic routing decisions
2. **Quality Baselines**: Set minimum acceptable scores per category
3. **Regression Detection**: Alert when new model versions score lower
4. **Cost Optimization**: Identify where fast model is "good enough"
5. **Marketing Claims**: Quantified evidence for competitive positioning

## Implementation Checklist

### Phase 1: Fix Tool State Machine

- [ ] Update `ToolPartRenderer` to use state-driven rendering
- [ ] Only render `CreateImageToolResult` when `input-available` or later
- [ ] Test with streaming tool calls

### Phase 2: Basic Evals

- [ ] Create `evals/image-generation.eval.ts`
- [ ] Implement 5 test prompts
- [ ] Add basic scoring (generation success, speed)

### Phase 3: LLM-as-Judge

- [ ] Implement `image-quality-scorer.ts`
- [ ] Use Claude/GPT-4 vision for evaluation
- [ ] Score all 5 dimensions

### Phase 4: Multi-Model Comparison

- [ ] Test across Imagen Fast, Standard, and Gemini Pro
- [ ] Generate comparison matrix
- [ ] Identify routing optimizations

## References

- [Vercel AI SDK Tool Streaming](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#tool-streaming)
- [Braintrust Evals Documentation](https://www.braintrust.dev/docs/guides/evals)
- [Vercel ai-chatbot Tool Architecture](../reference/ai-chatbot/components/ai-elements/tool.tsx)
