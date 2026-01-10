# Image Model Rubric (Detailed)

Comprehensive reference for image model routing based on empirical eval results.

## Key Insight

**Route by task type, not speed.** Users expect to wait for images. The question isn't
"how fast?" but "which model produces the best result for THIS type of image?"

## Eval Summary (January 2025)

**Test Matrix**: 13 models × 15 prompts (3 per category) = 195 image generations **Eval
Method**: Round-robin batch ranking (batches of 3, comparative scoring) **Success
Rate**: 100% - all models generated images successfully **Eval Link**:
[Braintrust Dashboard](https://www.braintrust.dev/app/Carmenta%20Collective/p/Image%20Generation/experiments)

## Overall Model Rankings

| Rank | Model               | Score  | Provider   | API             | Best Category  |
| ---- | ------------------- | ------ | ---------- | --------------- | -------------- |
| 1    | **Nano Banana Pro** | 78.73% | Gateway    | `generateText`  | Diagrams (98%) |
| 2    | FLUX 2 Flex         | 68.53% | Gateway    | `generateImage` | Logos (70%)    |
| 3    | FLUX 2 Pro          | 59.73% | Gateway    | `generateImage` | Logos (69%)    |
| 4    | Seedream 4.5        | 58.07% | OpenRouter | `generateText`  | Diagrams (80%) |
| 5    | Imagen 4.0 Ultra    | 57.13% | Gateway    | `generateImage` | Photos (70%)   |
| 6    | FLUX 2 Pro (OR)     | 55.67% | OpenRouter | `generateText`  | Diagrams (75%) |
| 7    | Imagen 4.0          | 51.07% | Gateway    | `generateImage` | Text (71%)     |
| 8    | FLUX 1.1 Pro        | 46.73% | Gateway    | `generateImage` | -              |
| 9    | Riverflow v2 Fast   | 40.73% | OpenRouter | `generateText`  | -              |
| 10   | GPT-5 Image         | 37.07% | OpenRouter | `generateText`  | -              |
| 11   | FLUX 1.1 Pro Ultra  | 33.87% | Gateway    | `generateImage` | -              |
| 12   | Imagen 4.0 Fast     | 33.47% | Gateway    | `generateImage` | -              |
| 13   | FLUX Kontext Pro    | 31.33% | Gateway    | `generateImage` | -              |

## Task-Based Performance

### Diagrams (Highest Variance - 91 point spread!)

| Model              | Score | Notes                        |
| ------------------ | ----- | ---------------------------- |
| **Nano Banana**    | 98%   | Clear winner - LLM reasoning |
| Seedream 4.5       | 80%   | Strong OpenRouter option     |
| FLUX 2 Pro (OR)    | 75%   | Good                         |
| FLUX 2 Pro         | 67%   | Decent                       |
| FLUX 2 Flex        | 56%   | Below average                |
| Imagen 4.0 Ultra   | 54%   | Surprisingly poor            |
| GPT-5 Image        | 53%   | Middle of pack               |
| Imagen 4.0         | 49%   | Below average                |
| Riverflow v2       | 48%   | Below average                |
| FLUX 1.1 Pro       | 36%   | Poor                         |
| FLUX 1.1 Pro Ultra | 17%   | Very poor                    |
| Imagen 4.0 Fast    | 9%    | Avoid                        |
| FLUX Kontext Pro   | 7%    | Avoid                        |

**Recommendation**: Always use Nano Banana Pro for diagrams, flowcharts, architecture.

### Text-Heavy (58 point spread)

| Model              | Score | Notes                |
| ------------------ | ----- | -------------------- |
| **Nano Banana**    | 86%   | Best text rendering  |
| FLUX 2 Flex        | 79%   | Strong second choice |
| Imagen 4.0         | 71%   | Good                 |
| FLUX 2 Pro         | 70%   | Good                 |
| Imagen 4.0 Ultra   | 61%   | Acceptable           |
| Riverflow v2       | 38%   | Poor                 |
| Seedream 4.5       | 40%   | Poor                 |
| GPT-5 Image        | 31%   | Poor                 |
| FLUX Kontext Pro   | 29%   | Poor                 |
| FLUX 1.1 Pro Ultra | 27%   | Poor                 |
| Imagen 4.0 Fast    | 28%   | Poor                 |
| FLUX 2 Pro (OR)    | 48%   | Below average        |
| FLUX 1.1 Pro       | 47%   | Below average        |

**Recommendation**: Use Nano Banana Pro for posters, signage, text in scenes.

### Illustrations (47 point spread)

| Model              | Score | Notes                  |
| ------------------ | ----- | ---------------------- |
| **Nano Banana**    | 75%   | Best for detailed work |
| FLUX 2 Flex        | 69%   | Strong for stylized    |
| FLUX 2 Pro         | 64%   | Good                   |
| Seedream 4.5       | 63%   | Good                   |
| Riverflow v2       | 52%   | Average                |
| FLUX 2 Pro (OR)    | 51%   | Average                |
| Imagen 4.0         | 50%   | Average                |
| Imagen 4.0 Ultra   | 48%   | Below average          |
| FLUX 1.1 Pro       | 47%   | Below average          |
| FLUX 1.1 Pro Ultra | 46%   | Below average          |
| GPT-5 Image        | 32%   | Poor                   |
| FLUX Kontext Pro   | 29%   | Poor                   |
| Imagen 4.0 Fast    | 29%   | Poor                   |

**Recommendation**: Use Nano Banana Pro for detailed illustrations.

### Logos (70 point spread)

| Model              | Score | Notes          |
| ------------------ | ----- | -------------- |
| **FLUX 2 Flex**    | 70%   | Best for logos |
| FLUX 2 Pro         | 69%   | Near-tied      |
| Nano Banana        | 66%   | Good           |
| Imagen 4.0 Ultra   | 58%   | Average        |
| FLUX Kontext Pro   | 53%   | Average        |
| Imagen 4.0 Fast    | 53%   | Average        |
| Riverflow v2       | 51%   | Average        |
| FLUX 1.1 Pro       | 47%   | Below average  |
| Seedream 4.5       | 41%   | Below average  |
| Imagen 4.0         | 44%   | Below average  |
| FLUX 1.1 Pro Ultra | 38%   | Poor           |
| FLUX 2 Pro (OR)    | 36%   | Poor           |
| GPT-5 Image        | 26%   | Poor           |

**Recommendation**: Use FLUX 2 Flex or FLUX 2 Pro for logos.

### Photorealistic (55 point spread)

| Model                | Score | Notes           |
| -------------------- | ----- | --------------- |
| **Imagen 4.0 Ultra** | 70%   | Best for photos |
| FLUX 2 Flex          | 69%   | Near-tied       |
| FLUX 2 Pro           | 69%   | Near-tied       |
| Nano Banana          | 69%   | Near-tied       |
| Seedream 4.5         | 66%   | Good            |
| FLUX 1.1 Pro         | 56%   | Average         |
| FLUX 2 Pro (OR)      | 29%   | Poor            |
| Imagen 4.0 Fast      | 43%   | Below average   |
| Imagen 4.0           | 41%   | Below average   |
| GPT-5 Image          | 42%   | Below average   |
| FLUX 1.1 Pro Ultra   | 42%   | Below average   |
| FLUX Kontext Pro     | 39%   | Below average   |
| Riverflow v2         | 15%   | Avoid           |

**Recommendation**: Use Imagen 4.0 Ultra for photorealistic images.

## Routing Recommendations

### Default

**Model**: `google/imagen-4.0-generate-001` **Price**: $0.04/img **Use for**: General
requests when category is unclear

### Diagrams & Flowcharts

**Model**: `google/gemini-3-pro-image` (Nano Banana Pro) **Price**: ~$0.02/img
(token-based) **Use for**: Diagrams, flowcharts, architecture, technical documentation
**Why**: 98% vs 49% for Imagen - double the quality

### Text in Images

**Model**: `google/gemini-3-pro-image` (Nano Banana Pro) **Price**: ~$0.02/img **Use
for**: Posters, signage, labels, environmental text **Why**: 86% vs average 45% -
significantly better text rendering

### Logos

**Model**: `bfl/flux-2-flex` **Price**: $0.06/MP **Use for**: Brand logos, wordmarks,
icons **Why**: 70% - best for clean graphic design

### Photorealistic

**Model**: `google/imagen-4.0-ultra-generate-001` **Price**: ~$0.08/img **Use for**:
Product photography, portraits, landscapes **Why**: 70% - best for realistic images

### Illustrations

**Model**: `google/gemini-3-pro-image` (Nano Banana Pro) **Price**: ~$0.02/img **Use
for**: Character art, detailed scenes, fantasy **Why**: 75% - best for complex
illustrated content

## OpenRouter Models

Available as alternatives when Gateway is unavailable:

| Model                                 | Overall | Best Use            | Price      |
| ------------------------------------- | ------- | ------------------- | ---------- |
| `bytedance-seed/seedream-4.5`         | 58%     | Diagrams (80%)      | $0.009/img |
| `black-forest-labs/flux.2-pro`        | 56%     | Diagrams (75%)      | $0.05/img  |
| `sourceful/riverflow-v2-fast-preview` | 41%     | Budget general      | $0.003/img |
| `openai/gpt-5-image`                  | 37%     | **Not recommended** | $5/1M tok  |

**Note**: GPT-5 Image significantly underperforms expectations.

## API Implementation

### Gateway: Dedicated Image Models

```typescript
import { generateImage } from "ai";
const { image } = await generateImage({
  model: gateway.imageModel("google/imagen-4.0-generate-001"),
  prompt: "...",
  aspectRatio: "1:1",
});
// image.base64
```

### Gateway: Multimodal LLM (Nano Banana Pro)

```typescript
import { generateText } from "ai";
const result = await generateText({
  model: gateway("google/gemini-3-pro-image"),
  prompt: "...",
});
// result.files[0].base64
```

### OpenRouter: All Models

```typescript
import { generateText } from "ai";
const result = await generateText({
  model: openrouter("bytedance-seed/seedream-4.5"),
  prompt: "...",
});
// result.files[0].base64
```

## Avoid List

These models consistently underperform:

- **GPT-5 Image** (37%): Expensive and poor quality
- **FLUX 1.1 Pro Ultra** (34%): Worse than older FLUX versions
- **Imagen 4.0 Fast** (33%): "Fast" comes at major quality cost
- **FLUX Kontext Pro** (31%): Poor across all categories

## Test Prompts Used

### Logos (3)

1. Minimalist coffee shop logo
2. Bold esports team logo
3. Vintage nautical company logo

### Illustrations (3)

1. Flat design startup team
2. Cartoon robot mascot
3. Detailed fantasy wizard's study

### Photorealistic (3)

1. Professional business portrait
2. Golden hour ocean sunset
3. Product photography (smartwatch)

### Diagrams (3)

1. Software architecture flowchart
2. AWS-style cloud diagram
3. Sleep infographic with steps

### Text Layouts (3)

1. Tech conference poster
2. Comic book speech bubble
3. Bookshop storefront sign

## Update Log

| Version | Date       | Changes                                            |
| ------- | ---------- | -------------------------------------------------- |
| 3.0.0   | 2025-01-09 | Added OpenRouter models, round-robin ranking       |
| 2.0.0   | 2025-01-09 | Rewritten around task-based routing vs speed tiers |
| 1.0.0   | 2025-01-09 | Initial rubric based on 45-case eval               |
