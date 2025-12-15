# Production OAuth Setup - CRITICAL

## Issue

The OAuth migration from Nango to in-house OAuth (PR #193) introduced a **required**
environment variable that was:

- ❌ Not added to `.env.example`
- ❌ Not set in Vercel production environment
- ❌ Not documented

This caused all OAuth connections to fail in production with:

> "We need to finish setting up OAuth. We're on it."

## Root Cause

The new OAuth flow requires `NEXT_PUBLIC_APP_URL` in **two places**:

1. **Authorize route** (`/integrations/oauth/authorize/[provider]`)
   - Builds callback URL to send to OAuth provider
   - Line 73: `const redirectUri = ${appUrl}/integrations/oauth/callback`

2. **Callback route** (`/integrations/oauth/callback`)
   - Builds callback URL for token exchange (must match authorize)
   - Line 173: `const redirectUri = ${appUrl}/integrations/oauth/callback`

## Complete OAuth Flow

```
User clicks "Connect Notion"
  ↓
/connect/notion → redirects to /integrations/oauth/authorize/notion
  ↓
Authorize route:
  - Authenticates user (Clerk)
  - Checks NEXT_PUBLIC_APP_URL ← FAILS HERE if not set
  - Builds callback: https://carmenta.ai/integrations/oauth/callback
  - Generates state token
  - Redirects to Notion's OAuth page
  ↓
User authorizes on Notion
  ↓
Notion redirects to /integrations/oauth/callback?code=XXX&state=YYY
  ↓
Callback route:
  - Validates state
  - Checks NEXT_PUBLIC_APP_URL ← ALSO checks here
  - Exchanges code for tokens
  - Stores encrypted tokens
  - Redirects to success page
```

## Fix Required

### 1. Set in Vercel Environment Variables

Go to Vercel Dashboard → Settings → Environment Variables

Add:

```
Name: NEXT_PUBLIC_APP_URL
Value: https://carmenta.ai
Environment: Production, Preview, Development (all)
```

**CRITICAL**: This must match the callback URL registered in each OAuth provider:

- Notion OAuth app
- Slack OAuth app
- ClickUp OAuth app
- Dropbox OAuth app
- Google OAuth apps (Calendar/Contacts, Gmail)
- Twitter OAuth app

All should have redirect URI: `https://carmenta.ai/integrations/oauth/callback`

### 2. Verify OAuth Provider Callback URLs

Check each OAuth provider's developer console to ensure the redirect URI matches:

**Notion**: https://www.notion.so/my-integrations

- Redirect URI should be: `https://carmenta.ai/integrations/oauth/callback`

**Slack**: https://api.slack.com/apps

- Redirect URL should be: `https://carmenta.ai/integrations/oauth/callback`

**ClickUp**: https://app.clickup.com/settings/apps

- Redirect URL should be: `https://carmenta.ai/integrations/oauth/callback`

**Dropbox**: https://www.dropbox.com/developers/apps

- Redirect URI should be: `https://carmenta.ai/integrations/oauth/callback`

**Google** (Calendar/Contacts, Gmail): https://console.cloud.google.com/apis/credentials

- Authorized redirect URIs should include:
  `https://carmenta.ai/integrations/oauth/callback`

**Twitter**: https://developer.twitter.com/en/portal/projects-and-apps

- Callback URL should be: `https://carmenta.ai/integrations/oauth/callback`

### 3. Redeploy

After setting the environment variable in Vercel:

```bash
# Trigger a new deployment or wait for next push to main
git push origin main
```

## Testing OAuth Flow

After deploying with `NEXT_PUBLIC_APP_URL` set:

1. Go to https://carmenta.ai/integrations
2. Click "Connect" on any service (e.g., Notion)
3. Should redirect to `/integrations/oauth/authorize/notion`
4. Should redirect to Notion's OAuth page (not show error)
5. Authorize on Notion
6. Should redirect back to carmenta.ai with success message
7. Service should appear as connected in integrations list

## Why This Matters

`NEXT_PUBLIC_APP_URL` is used for:

- Building OAuth callback URLs (CRITICAL for security - prevents Host header
  manipulation)
- Generating deep links in error messages
- Creating reconnection URLs in integration adapters

Without it in production:

- All OAuth connections fail immediately
- Users see generic error message
- No way to connect integrations
- Production is completely broken for OAuth features

## Prevention

- ✅ Added `NEXT_PUBLIC_APP_URL` to `.env.example` (this commit)
- ✅ Documented in this file
- ⚠️ TODO: Add to deployment checklist
- ⚠️ TODO: Add E2E test that verifies OAuth flow works
