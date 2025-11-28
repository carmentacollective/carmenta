# Auth

Authentication and user accounts - who we are, how we log in, and how we manage our
identity across sessions and devices.

## Why This Exists

We need accounts. Memory needs to know whose memory it is. Service connections need to
belong to someone. Conversations need to persist across devices. AI team configurations
need to be personal.

Auth is the foundation that makes personalization possible. Without identity, Carmenta
is just another stateless chatbot. With identity, it becomes our AI partner that knows
us and grows with us.

## Implementation Status

**Platform**: Clerk (https://clerk.com)

**Current Configuration**:

- Email/password authentication
- Google OAuth social login
- Session management via Clerk's JWTs
- Middleware-based route protection

**Protected Routes**:

- `/connect` - requires authentication
- `/api/*` - all API routes require authentication

**Public Routes**:

- `/` - landing page
- `/sign-in` - Clerk sign-in component
- `/sign-up` - Clerk sign-up component
- `/ai-first-development` - informational page

**UI Approach**: Using Clerk's React components (`<SignIn/>`, `<SignUp/>`,
`<UserButton/>`) with Tailwind CSS customization via the `appearance` prop. Can be
migrated to fully custom UI using Clerk hooks (`useSignIn`, `useSignUp`) when design
requirements solidify.

## Core Functions

### Authentication

How we prove who we are:

- Email/password (enabled)
- Social login: Google (enabled)
- Magic links (available via Clerk, not yet enabled)
- SSO for enterprise (available via Clerk, future consideration)

### Session Management

Handled by Clerk:

- JWT-based sessions with automatic refresh
- Multi-device support built-in
- Session invalidation via UserButton or programmatic logout
- Persistent sessions by default

### User Management

Lifecycle of user accounts:

- Signup via `/sign-up` page
- Profile management via Clerk's UserButton component
- Password reset via Clerk's built-in flow
- Account deletion (available in Clerk dashboard, self-service not yet exposed)

### Authorization

What we can access:

- Resource ownership via `userId` from Clerk's `auth()` function
- Role-based access (available via Clerk Organizations, not yet implemented)
- Sharing permissions (future consideration)

## Relationship to Service Connectivity

Auth and Service Connectivity remain distinct:

- **Auth** handles Carmenta user identity via Clerk
- **Service Connectivity** will handle third-party OAuth for external services

Clerk can potentially handle OAuth for third-party services, which would simplify the
architecture. This decision is deferred until Service Connectivity implementation.

## Integration Points

- **Memory**: User identity via `userId` determines whose memory to access
- **Conversations**: Conversations will be associated with `userId`
- **Service Connectivity**: OAuth connections will be tied to `userId`
- **Onboarding**: Account creation via Clerk during first protected route access
- **Interface**: Sign-in/sign-up pages, UserButton in header
- **AI Team**: Team configuration will be per `userId`

## Success Criteria

- We can sign up and log in without friction
- Sessions persist appropriately across devices
- Security best practices followed (Clerk handles this)
- Account deletion fully cleans up user data (requires webhook implementation)
- Auth doesn't add noticeable latency to requests

---

## Open Questions

### Architecture (Resolved)

- ~~**Platform choice**~~: **Clerk** chosen for fast implementation, good DX, and
  built-in security. Can migrate if needed.
- **Unified vs. separate**: Deferred. Will evaluate when implementing Service
  Connectivity.
- ~~**Session storage**~~: **JWTs** managed by Clerk.
- **Multi-tenancy**: Deferred. Clerk Organizations available when needed.

### Product Decisions (Partially Resolved)

- ~~**Auth methods**~~: Email + Google at launch.
- ~~**Required vs. optional**~~: Auth required for `/connect` and API. Landing page
  public.
- **Data portability**: To be implemented (GDPR consideration)
- **Account linking**: Handled by Clerk (users can add multiple auth methods)

### Technical Specifications (Partially Resolved)

- ~~**User schema**~~: Clerk manages user data. Extend via Clerk metadata if needed.
- ~~**Session management**~~: Clerk JWTs
- **Integration with Service Connectivity OAuth**: Deferred
- **Account deletion and data cleanup**: Requires Clerk webhook implementation
- ~~**Security requirements**~~: Clerk defaults (strong passwords, secure sessions)

### Research Needed

- ~~Evaluate auth platforms~~: Clerk selected
- Study auth UX patterns for AI products (ongoing)
- Research data portability requirements (GDPR right to export)
- Clerk webhook setup for account deletion cleanup
