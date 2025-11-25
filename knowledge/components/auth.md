# Auth

Authentication and user accounts - who users are, how they log in, and how we manage
their identity across sessions and devices.

## Why This Exists

Users need accounts. Memory needs to know whose memory it is. Service connections need
to belong to someone. Conversations need to persist across devices. AI team
configurations need to be personal.

Auth is the foundation that makes personalization possible. Without identity, Carmenta
is just another stateless chatbot. With identity, it becomes your AI partner that
knows you and grows with you.

## Core Functions

### Authentication

How users prove who they are:
- Email/password (classic, reliable)
- Social login (Google, GitHub, etc.)
- Magic links (passwordless)
- SSO for enterprise (SAML, OIDC)

### Session Management

Keep users logged in appropriately:
- Secure session handling
- Multi-device support
- Session invalidation and logout
- Remember me / persistent sessions

### User Management

Lifecycle of user accounts:
- Signup and account creation
- Profile management
- Password reset and recovery
- Account deletion (with data cleanup)

### Authorization

What users can access:
- Role-based access (if needed)
- Resource ownership (my conversations, my memory)
- Sharing permissions (if we support collaboration)

## Relationship to Service Connectivity

Auth and Service Connectivity are closely related but distinct:

- **Auth** handles Carmenta user identity - who you are to Carmenta
- **Service Connectivity** handles third-party OAuth - connecting your external accounts

They interact at key points:
- Service connections belong to authenticated users
- OAuth tokens for services are stored per-user
- User deletion must clean up service connections
- Session security affects access to connected services

Consider whether to use the same auth provider for both or keep them separate. A
unified approach (e.g., Clerk handles both user auth and OAuth to services) could
simplify the architecture.

## Integration Points

- **Memory**: User identity determines whose memory to access
- **Conversations**: Conversations belong to users
- **Service Connectivity**: OAuth connections tied to user accounts
- **Onboarding**: Account creation during first run
- **Interface**: Login/logout UI, profile settings
- **AI Team**: Team configuration per user

## Success Criteria

- Users can sign up and log in without friction
- Sessions persist appropriately across devices
- Security best practices followed (no password breaches, secure tokens)
- Account deletion fully cleans up user data
- Auth doesn't add noticeable latency to requests

---

## Open Questions

### Architecture

- **Platform choice**: Clerk, Auth.js (NextAuth), Supabase Auth, or custom? What's the
  right balance of features, cost, and control?
- **Unified vs. separate**: Use auth provider for both user auth and service OAuth, or
  keep them separate? Tradeoffs in simplicity vs. flexibility.
- **Session storage**: JWTs, database sessions, or hybrid? Where does session state live?
- **Multi-tenancy**: Do we need organization/team accounts? What's the data model?

### Product Decisions

- **Auth methods**: Which login methods do we support at launch? What's the priority
  order?
- **Required vs. optional**: Can users try Carmenta before creating an account? Anonymous
  mode?
- **Data portability**: How do users export their data? What format?
- **Account linking**: Can users link multiple auth methods to one account?

### Technical Specifications Needed

- User schema and profile fields
- Session management approach
- Integration with Service Connectivity OAuth
- Account deletion and data cleanup process
- Security requirements (password policy, 2FA, etc.)

### Research Needed

- Evaluate auth platforms (Clerk, Auth.js, Supabase Auth, Stytch)
- Study auth UX patterns for AI products
- Research data portability requirements (GDPR right to export)
- Review security best practices for auth
