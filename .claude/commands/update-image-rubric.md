---
# prettier-ignore
description: Research the current image generation landscape and update Carmenta's image model routing rubrics with latest models, capabilities, and pricing
version: 1.0.0
model: inherit
---

# Update Image Rubric

Research the current image generation landscape and update Carmenta's image model
routing rubrics. This command runs comprehensive evals against available models and
produces data-driven routing recommendations.

## The Image Model Challenge

Image generation models evolve rapidly. New models release, quality improves, pricing
changes. This command addresses static configuration maintenance through empirical
testing.

## Avoiding Hallucination

Read @.cursor/rules/trust-and-decision-making.mdc first.

Model names, versions, and capabilities are exactly the kind of specifics where LLMs
hallucinate. Your parametric knowledge is almost certainly out of date.

- Never trust your training data for model names, versions, or capabilities
- Verify every model name against Vercel AI Gateway documentation
- Get exact model IDs from the gateway's model list
- Run actual evals - don't guess quality based on marketing
- Cite sources for pricing claims

## Two API Patterns

Image models use different APIs based on architecture:

| Model Type                            | API               | Response Format  |
| ------------------------------------- | ----------------- | ---------------- |
| Dedicated image models (Imagen, FLUX) | `generateImage()` | `image.base64`   |
| Multimodal LLMs (Gemini 3 Pro Image)  | `generateText()`  | `files[].base64` |

This is BY DESIGN - Google built two different architectures. Support both.

## Your Mission

Update THREE files:

1. **`knowledge/image-rubric.md`** — Slim routing version (~400-600 tokens) for the
   Concierge. Minimal, efficient, decision-focused.

2. **`knowledge/image-rubric-detailed.md`** — Full reference with eval results, model
   profiles, and research citations.

3. **`knowledge/components/image-generation.md`** — Update the model table with latest
   findings.

### Slim Rubric: Token Efficiency Rules

The slim rubric must be ruthlessly efficient:

**Content to include:**

- Task routing table (logo, photo, illustration, text-heavy, diagram)
- Speed vs quality trade-off guidance
- Primary models (one line each: name, price, best for)
- Fallback default

**What NOT to include (goes in detailed version):**

- Eval methodology and scores
- Detailed model profiles
- Research citations
- Update history

## Eval-Driven Process

### Step 1: Run Comprehensive Eval

```bash
pnpm braintrust eval evals/image-generation/eval.ts
```

The eval tests each model against 5 prompt categories:

1. **Logos** — Clean design, text rendering, professional
2. **Illustrations** — Style consistency, warmth, detail
3. **Photorealistic** — Lighting, atmosphere, realism
4. **Text-heavy** — Accurate text, spelling, layout
5. **Diagrams** — Clear flow, readable labels, logical structure

### Step 2: Analyze Results

From Braintrust dashboard, extract:

- Overall quality scores per model
- Category-specific performance (which models excel at what)
- Speed (generation time)
- Cost efficiency (quality per dollar)

### Step 3: Derive Routing Rules

Based on eval data:

- **Fast/drafts**: Which model is fastest while acceptable quality?
- **Standard**: Best quality/cost balance?
- **Quality**: Best absolute quality regardless of cost?
- **Text-heavy**: Which model renders text accurately?
- **Photorealistic**: Which excels at photo-style images?

## Available Models (January 2025)

### generateImage() API

| Model              | ID                                     | Price      | Notes                     |
| ------------------ | -------------------------------------- | ---------- | ------------------------- |
| Imagen 4.0 Fast    | `google/imagen-4.0-fast-generate-001`  | $0.02/img  | Speed tier                |
| Imagen 4.0         | `google/imagen-4.0-generate-001`       | $0.04/img  | Reliable baseline         |
| Imagen 4.0 Ultra   | `google/imagen-4.0-ultra-generate-001` | ~$0.08/img | Highest quality           |
| FLUX 2 Pro         | `bfl/flux-2-pro`                       | $0.03/MP   | 4MP, editing, multi-ref   |
| FLUX 1.1 Pro       | `bfl/flux-pro-1.1`                     | $0.04/img  | Artistic quality          |
| FLUX 1.1 Pro Ultra | `bfl/flux-pro-1.1-ultra`               | Higher     | Maximum resolution        |
| FLUX Kontext Pro   | `bfl/flux-kontext-pro`                 | Variable   | Character consistency     |
| FLUX Kontext Max   | `bfl/flux-kontext-max`                 | Variable   | Character consistency max |
| FLUX Fill Pro      | `bfl/flux-pro-1.0-fill`                | Variable   | Inpainting/editing        |

### generateText() API

| Model           | ID                          | Price         | Notes                     |
| --------------- | --------------------------- | ------------- | ------------------------- |
| Nano Banana Pro | `google/gemini-3-pro-image` | $2/$120/M tok | Text rendering, reasoning |

## Output Format

After running evals and analyzing results, present:

### Summary

- Which models performed best overall
- Which models excel at specific tasks
- Speed/quality/cost trade-offs
- Recommended routing rules

### Proposed Slim Rubric

Token-efficient routing version (~400-600 tokens).

### Proposed Detailed Rubric

Full reference with eval scores and methodology.

Wait for user approval before writing files.

## Example Invocation

```
/update-image-rubric
```

Runs evals, analyzes results, proposes updated rubrics.

## Relationship to Text Model Rubric

This mirrors `/update-model-rubric` but for image generation. The image rubric is
separate because:

- Different evaluation criteria (visual quality vs text coherence)
- Different routing signals (photo vs logo vs diagram)
- Simpler decision space (fewer models, clearer trade-offs)

Keep the image rubric slim - image routing is simpler than text routing.
