# Concierge

The Concierge sits between our input and AI processing - the intelligent layer that
transforms casual requests into optimized queries, selects the right models, and
determines how to respond. We experience a simple interface while the Concierge handles
complexity invisibly.

## Why This Exists

Every AI interaction involves choices: which model, what context to include, how to
structure the query, what response strategy fits best. Most interfaces push these choices
to us when we don't want to think about them, or make rigid default choices that work
poorly for many cases.

The Concierge makes these choices intelligently for each request. A quick question gets a
fast model. A research task gets a thorough one. A creative request gets appropriate
temperature. We get what we need without understanding the machinery.

The Concierge is foundational to everything else. It determines what the Interface needs
to display, what Memory to retrieve, which agents to invoke. Building it first means
other components can be designed around known output types rather than retrofitting.

## Core Functions

### Request Analysis

When a message arrives, the Concierge classifies what kind of request it is and
determines how to handle it. Classification should happen fast enough that we don't
perceive delay.

### Query Enhancement

Our requests rarely arrive optimized for AI processing. The Concierge transforms them
by adding context from Memory, structuring prompts for optimal model performance, and
aligning response tone with our preferences.

### Model Selection

Different requests need different models. Quick questions get fast, cheap models. Deep
analysis gets powerful, expensive ones. The Concierge optimizes for speed, capability,
and cost based on request type.

### Response Strategy

Beyond model selection, the Concierge determines how to respond: direct chat completion,
purpose-built AG-UI interface, tool routing, multi-agent dispatch, or asking for
clarification when the request is too ambiguous.

## Controls

While the Concierge handles complexity automatically, we get simple overrides when we
want them - likely a speed/quality tradeoff and possibly response mode preferences.

## Integration Points

- **Memory**: Primary consumer. Every request triggers context retrieval.
- **Interface**: Signals how to render responses (chat, rich media, structured reports).
- **AI Team**: Routes complex requests to specialized agents.
- **Service Connectivity**: Orchestrates access to external services when needed.

## Success Criteria

- We don't think about the Concierge - we just get good responses
- Quick questions feel quick, deep analysis feels thorough
- Cost efficiency without our involvement
- Respects our explicit preferences when provided

---

## Open Questions

### Architecture

- **Classification approach**: Dedicated fast model for routing vs. letting the main
  model self-route? Fast model adds latency but saves cost on simple requests.
- **Latency budget**: What's acceptable end-to-end? How does that break down across
  classification, context retrieval, and model inference?
- **Error handling**: What happens when classification fails or the selected model is
  unavailable?

### Product Decisions

- **Request type taxonomy**: What categories of requests do we recognize? Initial
  thinking: quick lookup, conversation, deep analysis, creative generation, task
  execution, emotional support. Is this complete? Too granular?
- **Controls**: What knobs do we get? Speed/quality slider? Response mode selection?
  Persona preferences? Or keep it fully automatic?
- **AG-UI triggering**: When does a response become a purpose-built interface vs. chat?
  Our choice, Concierge choice, or both?

### Technical Specifications Needed

- Classification result schema and request type enum
- API contract: input/output types for the Concierge
- Prompt templates for classification and enhancement
- Model selection decision tree with specific model mappings
- Protocol for signaling response type to Interface

### Research Needed

- Benchmark different classification approaches (dedicated model vs. self-routing)
- Analyze latency/cost tradeoffs across model tiers
- Study how other products handle automatic model selection (if any do it well)
