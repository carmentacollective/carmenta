# Web Intelligence

Web intelligence is the capability for Carmenta to access, search, and synthesize
information from the web. This enables real-time lookups, page content extraction,
semantic research, and deep multi-step analysis.

## Why This Exists

Builders work at the speed of thought. That speed requires access to current
information - documentation that changed last week, competitor announcements, research
papers, API references, news. Without web intelligence, conversations are limited to the
AI's training cutoff and whatever context the user manually provides.

Web intelligence transforms Carmenta from a knowledgeable assistant into a research
partner that can actively gather information, verify facts, and synthesize insights from
across the web.

## Use Cases

### 1. Quick Real-Time Lookup

_"What's the current price of Anthropic API calls?" / "Is GitHub having an outage?"_

Fast answers to factual questions requiring current data. Latency matters - under 5
seconds ideal. Results should be concise, direct answers or snippets. The AI uses this
proactively when it needs fresh facts to answer questions accurately.

### 2. Web Page Content Fetch

_"Read this article and summarize it" / "Get the content from this documentation page"_

User provides a specific URL and wants its content extracted as clean, readable text.
This is the most common operation - happens whenever someone shares a link. Speed is
critical (target under 10 seconds). Output should be clean markdown without ads,
navigation, or boilerplate.

### 3. Semantic Research Search

_"Find papers about transformer architectures" / "What are the best practices for React
state management in 2025?"_

Finding high-quality, relevant results based on meaning rather than just keywords.
Multiple sources with context. Citations are critical. Latency tolerance is medium (5-10
seconds acceptable). The AI synthesizes across results rather than just returning links.

### 4. Deep Multi-Step Research

_"Research the competitive landscape for AI coding tools" / "What's the state of the art
in voice interfaces?"_

Comprehensive analysis requiring the AI to search multiple times, read multiple pages,
and synthesize findings. This is agentic - the AI decides what to search next based on
what it learns. Latency tolerance is high (30-60 seconds acceptable). Output is a
synthesized report with detailed citations.

### 5. Background Context Enrichment

_AI autonomously searches to enhance responses_

The AI proactively fetches information without explicit user request when it would
improve response quality. Must not slow down primary response noticeably. Results are
injected into AI context, not shown directly to user. Example: checking latest API docs
when helping with code.

### 6. Continuous Monitoring (Future)

_"Track mentions of my product" / "Alert me when there's news about X"_

Periodic searches with change detection. Not in initial scope but architecture should
support it.

### 7. Data Extraction & Enrichment (Future)

_"Find contact info for companies matching X criteria"_

Structured data extraction from web sources. Not in initial scope but architecture
should support it.

## Architecture

### Design Principles

**Vendor Abstraction**: The implementation abstracts vendor-specific details behind a
common interface. We can swap Parallel for Exa, Tavily, Firecrawl, or others without
changing calling code.

**Use-Case Optimized Tools**: Rather than exposing raw vendor APIs to the LLM, we expose
purpose-built tools that map to use cases. The LLM doesn't need to know about
vendor-specific parameters.

**Graceful Degradation**: If the provider fails or is slow, the system handles errors
gracefully with clear feedback.

### Implementation Pattern

Follow the existing Vercel AI SDK tool pattern used by `getWeather`:

1. **Tools defined in route.ts**: Use the `tool()` function from `ai` package with zod
   schemas for input validation
2. **Execute functions call provider**: Each tool's execute function calls the Parallel
   provider
3. **Generative UI components**: Create `makeAssistantToolUI` components for rich
   rendering of results

### Provider Interface

The provider interface defines three core operations:

**search**: Quick search that returns concise results fast. Takes a query string and
optional parameters for max results, freshness filter, and domain inclusion/exclusion.
Returns ranked results with title, URL, snippet, and optional published date.

**extract**: Extract content from a specific URL. Takes a URL and optional parameters
for format (markdown/text/html) and max length. Returns the extracted content with title
and metadata.

**research**: Deep research for agentic multi-step analysis. Takes an objective string
and optional parameters for depth tier (quick/standard/deep), max sources, and focus
areas. Returns a summary, structured findings with confidence levels, and detailed
source citations.

All operations return latency metrics and provider attribution for observability.

### Primary Provider: Parallel

Parallel Web Systems provides all three capabilities through their API suite:

- **Search API**: Quick search, semantic queries, background enrichment ($5/1k
  requests + $1/1k pages for excerpts)
- **Extract API**: Page content extraction ($1/1k pages)
- **Task API**: Deep multi-step research with tiered pricing (Lite $5/1k, Base $10/1k,
  Core $25/1k, Ultra tiers for highest quality)

The research depth options map to Parallel's tiers: quick uses Lite or Base, standard
uses Base or Core, deep uses Core or Ultra.

### Future Provider Options

The architecture supports adding alternative providers:

- **Firecrawl**: Better JS rendering for SPAs, structured extraction capabilities
- **Exa**: Superior semantic search if Parallel Search quality is insufficient
- **Perplexity**: Fastest for simple lookups if speed becomes critical
- **Tavily**: Free tier useful for development/testing

## LLM Tool Design

The LLM interacts with web intelligence through three purpose-built tools. These are
designed for clarity, appropriate defaults, and good UX.

### Tool 1: `webSearch`

For quick lookups and semantic searches.

**Description**: Search the web for current information. Use when you need fresh data,
recent news, or to verify facts. Returns concise results with snippets and URLs.

**Parameters**:

- `query` (required): The search query. Be specific and include key terms.
- `freshness` (optional): How recent results should be. Options: day, week, month, any.
  Use "day" for breaking news, "week" for recent updates, "any" for evergreen content.
  Default: any.
- `maxResults` (optional): Maximum number of results to return. Default: 5, maximum: 20.

**Returns**: Array of results, each with title, url, snippet, and optional date.

**When the LLM should use this**:

- Answering questions about current events
- Finding recent documentation or API changes
- Verifying facts that may have changed
- Background enrichment during complex tasks

### Tool 2: `fetchPage`

For extracting content from a specific URL.

**Description**: Fetch and extract the main content from a web page. Returns clean,
readable text without ads or navigation. Use when you have a specific URL to read.

**Parameters**:

- `url` (required): The URL to fetch content from.
- `maxLength` (optional): Maximum characters to return. Use for long pages where you
  only need the beginning. Default: 50000.

**Returns**: Object with title, content (clean markdown), and url.

**When the LLM should use this**:

- User shares a link to read
- Following up on search results that need deeper reading
- Reading documentation pages
- Analyzing articles or blog posts

### Tool 3: `deepResearch`

For comprehensive multi-step research.

**Description**: Conduct comprehensive research on a topic. Searches multiple sources,
reads relevant pages, and synthesizes findings. Use for complex questions requiring
thorough analysis. Takes 30-60 seconds.

**Parameters**:

- `objective` (required): What you want to research. Be specific about the question or
  topic.
- `depth` (optional): How thorough the research should be. Options: quick, standard,
  deep. "quick" for basic overview, "standard" for solid analysis, "deep" for
  comprehensive investigation. Default: standard.
- `focusAreas` (optional): Array of specific aspects to focus on.

**Returns**: Object with summary, findings (array of insights with sources and
confidence), and sources (array with url, title, relevance).

**When the LLM should use this**:

- User explicitly asks for research
- Complex questions requiring multiple perspectives
- Competitive analysis
- Understanding state-of-the-art in a domain

## Implementation Notes

### Error Handling

Following external-apis.mdc patterns:

- Return null/empty results on API errors (don't throw to callers)
- Log errors with context for debugging
- User-friendly error messages when provider fails

### Logging

Following typescript-coding-standards.mdc: Use structured logging with pino, including
operation type, provider name, and relevant context in the log object.

### Sentry Integration

Capture exceptions with tags for component (web-intelligence) and operation type, plus
extra context like query/url and options.

## Configuration

Environment variables:

- `PARALLEL_API_KEY`: Required for Parallel Web Systems API access

## Success Criteria

1. **Latency**: Search < 5s, Extract < 10s, Research < 60s
2. **Reliability**: 99%+ success rate with proper error handling
3. **Quality**: Results are relevant and actionable
4. **Developer Experience**: Clean abstraction, easy to add providers

## Decisions

### Why Parallel as Primary?

1. **Best-in-class deep research**: 48% accuracy on BrowseComp vs 6-14% competitors
2. **Single vendor**: Search + Extract + Research from one provider
3. **SOC 2 certified**: Enterprise-ready security
4. **Fresh index**: 1B+ pages added/refreshed daily
5. **AI-optimized**: Built specifically for AI agent use cases

### Why Three Tools?

The three tools map to distinct use cases and user mental models:

- **webSearch**: "Find me information about X"
- **fetchPage**: "Read this specific page"
- **deepResearch**: "Research X thoroughly"

More granular tools (separate semantic vs keyword search, different extract modes) add
complexity without proportional value. Fewer tools mean the LLM makes better choices.
