# Page Metadata Strategy

## Philosophy

Browser tabs serve multiple functions: brand recognition, page identification, and chat
history. We optimize for each with different signals.

**Favicon** does the brand work — it's the primary visual identifier in a crowded tab
bar. Users recognize the Carmenta icon instantly.

**Page title** does the content work — it identifies what's on the page. When someone
hovers over a tab or looks at browser history, the title tells them what they're looking
at.

**Separator** connects them invisibly. The middle dot (·) is subtle enough to fade from
attention while providing clear visual separation.

## Page Title Format

### Standard Pages

Format: `{Page Identity} · Carmenta`

Examples:

- `Welcome Back · Carmenta` (sign-in)
- `Welcome · Carmenta` (sign-up)
- `Create · Carmenta` (new connection)
- `Fresh Start · Carmenta` (page reset)
- `Reconnecting · Carmenta` (offline)
- `Our Partnership · Carmenta` (terms of service)
- `Your Privacy · Carmenta` (privacy policy)
- `Our Security · Carmenta` (security)
- `Lost · Carmenta` (404)

### Chat/Connection Pages

Format: `{Chat Title} · Carmenta` (dynamic)

Examples:

- `Design System Refactor · Carmenta`
- `Feature Brainstorm · Carmenta`
- `Code Review · Carmenta`

For untitled conversations: `Create · Carmenta`

### Homepage (Exception)

The homepage uses the full brand tagline because it IS the brand statement:

`Carmenta – Create at the Speed of Thought`

This appears in:

- Browser title
- OpenGraph (social sharing)
- Twitter card

**Why the exception?** The homepage isn't a feature—it's the headline. The tagline is
our promise, our identity. It deserves the full statement.

## Separator Choice: Middle Dot (·)

**Character:** `·` (Unicode: U+00B7)

**Why this separator:**

- Visually subtle — doesn't compete with the meaningful part (the page title)
- Minimal, elegant, premium feel
- Doesn't add visual noise to narrow browser tabs
- Modern and refined (used by Apple in some contexts)
- The favicon handles all brand identification, so the separator can disappear

**Alternative considered:** En dash (–)

- More editorial, more established
- Takes slightly more visual weight
- Better for publication/magazine aesthetic
- Works well but slightly heavier for tab identification

## Meta Description Pattern

Descriptions should:

- Be warm and human-centered
- Reference the Carmenta experience (partnership, flow, memory)
- Stay under 155 characters for optimal display in search results
- Match the page's purpose, not just describe the feature

Examples:

- **Sign In:** "Welcome back. Pick up where we left off."
- **Sign Up:** "Start building together. Create your account."
- **Connection:** "Start a connection. We'll think through it together."
- **Privacy:** "How we collect, use, and protect our data."

## OpenGraph & Social Sharing

When pages are shared:

- Title uses the full `{Page Identity} · Carmenta` format
- Image uses consistent brand assets (same across all pages)
- Description explains the page's value in sharing context

Special case (homepage):

- Title: `Carmenta – Create at the Speed of Thought`
- Description includes the full brand promise
- Image is the hero visual

## Implementation Notes

### Metadata Generation

For static pages, use `export const metadata`:

```typescript
export const metadata: Metadata = {
  title: "Welcome Back · Carmenta",
  description: "Welcome back. Pick up where we left off.",
};
```

For dynamic pages (like connections), use `generateMetadata`:

```typescript
export async function generateMetadata({
  params,
}: ConnectionPageProps): Promise<Metadata> {
  const title = chatTitle ? `${chatTitle} · Carmenta` : "Create · Carmenta";

  return { title, description: "..." };
}
```

### Chat Title Use Case

When users see their chats in browser history or tabs, they see:

`Budget Planning Q1 2025 · Carmenta`

This is the primary value of the title format—making individual conversations easily
identifiable while keeping Carmenta visible as the platform.

## Favicon & Theme Colors

The favicon is handled by:

- File-based icons in `public/` directory
- Viewport theme colors that match light/dark mode

See `app/layout.tsx` for implementation.

## Future Considerations

- If we add breadcrumbs or contextual navigation, the separator pattern extends
  naturally
- Chat titles with special characters (/, ·, etc.) will display correctly as they're
  URI-encoded
- The middle dot pattern is consistent across all contexts (browser, history, search
  results)
