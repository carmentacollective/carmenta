# Image Model Rubric

Route by task type. Users expect to wait for images.

## Routing Table

| Task           | Model                       | Why                    |
| -------------- | --------------------------- | ---------------------- |
| Diagrams       | `google/gemini-3-pro-image` | 98% - LLM reasoning    |
| Text in images | `google/gemini-3-pro-image` | 86% - best text render |
| Illustrations  | `google/gemini-3-pro-image` | 75% - detail work      |
| Logos          | `bfl/flux-2-flex`           | 70% - clean graphics   |
| Photorealistic | `google/imagen-4.0-ultra`   | 70% - realistic images |

## Default

`google/imagen-4.0-generate-001` - reliable baseline for unclear requests.

## API Pattern

| Model Type    | API               | Response         |
| ------------- | ----------------- | ---------------- |
| Imagen/FLUX   | `generateImage()` | `image.base64`   |
| Gemini (Nano) | `generateText()`  | `files[].base64` |

## Models to Avoid

- GPT-5 Image (37%) - expensive, underperforms
- Imagen 4.0 Fast (33%) - quality too low
- FLUX Kontext Pro (31%) - poor across categories

See `image-rubric-detailed.md` for full eval data.
