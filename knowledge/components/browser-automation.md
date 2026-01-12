# Browser Automation

Browse the web as the user, with their sessions and logins. Deep research requiring
authentication, task execution across web applications. Differentiates from tools that
only access public web.

## Why This Exists

Most AI web access is limited to public pages. But real work happens behind logins -
your company's internal tools, your personal accounts, subscription content. An AI that
can only access what's public misses most of what matters.

Browser automation lets Carmenta act as you on the web. Research that requires your
LinkedIn login. Tasks in web apps that don't have APIs. Reading paywalled content you
subscribe to. This transforms what's possible.

## Core Functions

### Authenticated Browsing

Browse with our sessions:

- Use existing login sessions for authorized access
- Navigate web applications as we would
- Access content behind authentication walls
- Respect our existing permissions and subscriptions

### Research Tasks

Deep web research capabilities:

- Multi-page research across authenticated sources
- Extract and synthesize information from web apps
- Screenshot and capture dynamic content
- Navigate complex web interfaces

### Task Execution

Perform actions on web applications:

- Fill forms and submit data
- Click through workflows
- Complete multi-step processes
- Handle web apps without APIs

### Session Management

Handle the complexity of browser state:

- Cookie and session management
- Multiple account contexts
- Session isolation and security
- Credential handling

## Integration Points

- **AI Team**: Agents use browser automation for web-based tasks
- **Service Connectivity**: Browser automation fills gaps where APIs don't exist
- **Concierge**: Routes web automation requests appropriately
- **Memory**: Web research results feed into knowledge base

## Success Criteria

- Access authenticated content we have legitimate access to
- Complete web tasks reliably across common web applications
- Secure handling of sessions - no credential leakage
- Clear visibility into what Carmenta is doing in our browser
- Graceful handling when sites block automation

---

## Open Questions

### Architecture

- **Browser engine**: Puppeteer? Playwright? Browser extension? Remote browser service?
  What's the right approach for security and capability?
- **Session architecture**: How do we safely use our sessions? Browser extension that
  shares context? Separate browser with imported sessions?
- **Execution environment**: Where does the browser run? Our machine? Cloud? Security
  and privacy implications?
- **Anti-bot handling**: Many sites actively block automation. How do we handle this?
  Stealth approaches? Stick to cooperative sites?

### Product Decisions

- **Scope of automation**: What can Carmenta do in the browser? Read only? Fill forms?
  Click buttons? Where do we draw the line?
- **User visibility**: Do we see what Carmenta is doing? Live view? Summary after?
  Approval before actions?
- **Site allowlist**: Do we limit which sites can be automated? User-controlled?
  Carmenta-determined?
- **Failure behavior**: When automation fails (site changes, CAPTCHA, etc.), what's our
  experience?

### Technical Specifications Needed

- Browser automation framework selection
- Session capture and replay mechanism
- Security model for credential handling
- Site compatibility matrix
- Error detection and recovery patterns

### Research Needed

- Evaluate browser automation approaches (Playwright, Puppeteer, browser extensions,
  services like Browserbase/Browserless)
- Study computer-use style AI agents (Claude computer use, OpenAI Operator rumors)
- Research session security best practices
- Analyze anti-bot detection landscape and ethical considerations
- Review legal considerations for automated browsing

### Competitive Reference: ChatLLM Operator

Abacus AI's ChatLLM Operator offers computer task automation with:

- Browser automation for scheduled workflows
- Job application processing at scale
- Social media posting and outreach campaigns
- Multi-system integration (Salesforce, Jira, Gmail, GitHub)

This is bundled into their $10/user/month offering. See
[ChatLLM competitor analysis](../competitors/chatllm-abacus-ai.md) for details.
