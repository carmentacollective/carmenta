# Agent Testing

AI agents that use Carmenta as we would. Generates usage signals that Product
Intelligence processes. Enables finding product-market fit in hours instead of months.
AI agents test, AI PM synthesizes, AI builds, repeat.

## Why This Exists

Traditional product testing requires humans. Real humans are slow, expensive, and scarce.
You can't run a thousand humans through onboarding to find the friction points. You can't
have humans continuously exercise every feature combination.

Agent Testing creates synthetic users - AI agents that interact with Carmenta the way
we would. They generate usage signals at scale. They find edge cases humans would
miss. They exercise the product continuously.

Combined with Product Intelligence, this creates the self-improvement loop: agents test,
AI PM synthesizes feedback, developers (human or AI) improve, agents test again. The
cycle that compresses months into hours.

## Core Functions

### Synthetic User Simulation

AI agents that behave like target personas:
- Simulate user onboarding and first-run experience
- Exercise common workflows and use cases
- Test edge cases and unusual request patterns
- Generate realistic conversation sequences
- Vary behavior across persona types

### Signal Generation

Produce signals that Product Intelligence can process:
- Task completion success/failure
- Friction points and confusion indicators
- Performance and latency observations
- Feature usage patterns
- Comparative quality assessments

### Continuous Testing

Ongoing product exercise, not just one-time:
- Regular test runs across core workflows
- Regression detection when changes introduce problems
- Coverage of new features as they ship
- Exploration of feature combinations

### Quality Benchmarking

Measure and track product quality:
- Response quality assessment
- Task completion rates
- Comparison against baselines
- Progress tracking over time

## Integration Points

- **Product Intelligence**: Primary consumer of testing signals
- **Concierge**: Test agents interact through the same pipeline as real users
- **Memory**: May use or simulate user memory states
- **Interface**: Interacts through the same interface layer
- **All components**: Agent testing exercises the full system

## Success Criteria

- Synthetic users generate signals that match real behavior patterns
- Testing catches issues before we encounter them
- Continuous testing detects regressions quickly
- Test coverage reaches meaningful breadth of use cases
- Quality benchmarks improve measurably over time

---

## Open Questions

### Architecture

- **Agent design**: How do we create agents that behave realistically? Scripted flows?
  LLM-driven behavior? Hybrid?
- **Isolation**: How do we prevent test agents from polluting real user data? Separate
  environment? Flagged accounts?
- **Scale**: How many test agents, how often? What's the right balance of coverage vs.
  cost?
- **Signal format**: What do test signals look like? How do they feed into Product
  Intelligence?

### Product Decisions

- **Persona coverage**: Which personas do we simulate? How do we ensure representative
  coverage?
- **Test scenarios**: What use cases do agents exercise? Scripted critical paths?
  Exploratory behavior? Both?
- **Quality criteria**: How do agents determine if a response is good or bad? Human
  baseline? Rubric evaluation?
- **Feedback integration**: How automated is the feedback loop? Human review gates?
  Fully automated?

### Technical Specifications Needed

- Test agent definition schema
- Signal format and emission protocol
- Environment isolation requirements
- Test coverage framework
- Quality evaluation rubrics

### Research Needed

- Study LLM-based evaluation approaches (LLM-as-judge, rubric evaluation)
- Research synthetic data and user simulation techniques
- Analyze continuous testing patterns from software engineering
- Review academic work on AI safety evaluation and red-teaming
- Evaluate existing AI testing frameworks and tools
