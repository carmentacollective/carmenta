# Image Artist Agent

Transforms user image requests into high-quality generated images through prompt
engineering and intelligent model routing.

@.cursor/rules/prompt-engineering.mdc

**Before editing `prompt.ts`, invoke the `writing-for-llms` skill.**

## Architecture

The Image Artist uses a ToolLoopAgent pattern:

1. **detectTaskType** - Analyzes prompt to determine category (diagram, logo, photo,
   etc.)
2. **expandPrompt** - Enhances brief prompts with style, lighting, composition details
3. **generateImage** - Calls the appropriate model based on task type
4. **completeGeneration** - Returns results to the calling context

## Model Routing

Based on 195-image eval (13 models x 15 prompts):

| Task          | Model              | Score |
| ------------- | ------------------ | ----- |
| Diagrams      | Gemini 3 Pro Image | 98%   |
| Text          | Gemini 3 Pro Image | 86%   |
| Illustrations | Gemini 3 Pro Image | 75%   |
| Logos         | FLUX 2 Flex        | 70%   |
| Photos        | Imagen 4.0 Ultra   | 70%   |

## Usage

The agent is exposed via `createImageArtistTool()` for DCOS integration:

```typescript
import { createImageArtistTool } from "@/lib/ai-team/agents/image-artist-tool";

const tool = createImageArtistTool({ userId, abortSignal });

// Describe operations
await tool.execute({ action: "describe" });

// Generate image
await tool.execute({
  action: "generate",
  prompt: "A minimalist logo for a coffee shop",
  style: "professional",
  aspectRatio: "1:1",
});
```
