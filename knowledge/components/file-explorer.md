# File Explorer

Collapsible file browser for code mode, enabling users to browse their codebase while
chatting with Claude.

**Status:** Implemented (PR #568) **Location:** `components/code-mode/file-explorer.tsx`

## Current Implementation

Our custom implementation follows patterns from competitor analysis (claudecodeui,
opcode) and incorporates best practices from the open-source ecosystem.

### Architecture

```
FileExplorer (container)
├── Search input with debounce (300ms)
├── FileTree (recursive rendering)
│   └── FileTreeItem (memoized, with keyboard nav)
└── FilePreview (modal with syntax highlighting)
```

### Key Files

- `app/api/code/[repo]/files/route.ts` - Directory listing API
- `app/api/code/[repo]/files/content/route.ts` - File content API
- `components/code-mode/file-explorer.tsx` - Main container
- `components/code-mode/file-tree.tsx` - Recursive tree
- `components/code-mode/file-preview.tsx` - Content viewer
- `lib/code-mode/file-utils.ts` - Icon mapping, formatting helpers

### Design Decisions ✅

1. **Custom implementation over package** - Direct control, smaller bundle, exact UX
2. **Global caching** - `Map<string, FileEntry[]>` persists across remounts
3. **Lazy loading** - Fetch directory contents on expand, not upfront
4. **AbortController** - Prevents race conditions in file preview
5. **Parallelized stat()** - Promise.all for directory listing performance
6. **Set<string> for expanded state** - O(1) lookups

## Open Source Landscape

### Package Comparison

| Package               | Downloads/wk | Stars | Virtualization | Lazy Load | Accessibility |
| --------------------- | ------------ | ----- | -------------- | --------- | ------------- |
| react-arborist        | 74,000       | 3,500 | Yes            | Yes       | Basic         |
| react-complex-tree    | 19,000       | 1,300 | No             | Yes       | W3C           |
| MUI X Tree View (Pro) | Enterprise   | -     | Yes            | Yes       | MUI           |

### react-arborist

**GitHub:** https://github.com/brimdata/react-arborist **Best for:** VSCode-style file
trees, 10,000+ nodes

Key features:

- Virtualization via react-window
- Full keyboard navigation
- Drag-and-drop with granular control
- Inline renaming
- Custom render points (nodes, rows, drag preview)
- Controlled and uncontrolled modes

API highlights:

- `idAccessor`/`childrenAccessor` - Map any data shape
- `searchTerm` + `searchMatch` - Built-in filtering with parent visibility
- `selectionFollowsFocus` - Accessibility pattern
- `overscanCount`/`rowHeight` - Performance tuning

**When to use:** Projects with 1,000+ files, need drag-and-drop or inline editing.

### react-complex-tree

**GitHub:** https://github.com/lukasbach/react-complex-tree **Best for:**
Accessibility-first, headless approach

Key features:

- W3C-compliant keyboard navigation
- Provider-based architecture (multiple trees share state)
- Completely unopinionated styling
- F2 for rename mode
- Zero dependencies

**When to use:** Strict accessibility requirements, need headless control.

### MUI X Tree View

**Docs:** https://mui.com/x/react-tree-view/rich-tree-view/lazy-loading/ **Best for:**
MUI ecosystem, enterprise features

Key features:

- Rich Tree View with lazy loading
- `dataSource` prop for server-side data
- `DataSourceCacheDefault` with TTL
- Virtualization (Pro)
- Reordering (Pro)

**When to use:** Already using MUI, need enterprise support.

## Gap Assessment

### Achievable Now ✅

Our current implementation covers:

- Directory tree with expand/collapse
- File type icons
- Search with auto-expand
- File content preview
- Keyboard navigation (Enter, Space, Arrow keys)
- Mobile-friendly collapsible panel
- Global caching with background refresh

### Emerging (6-12 months)

Features that packages offer that we could add:

- **Virtualization** - react-arborist pattern for 1,000+ files
- **Drag-and-drop** - File organization within code mode
- **Inline renaming** - F2 to rename files
- **Multi-select** - Shift/Cmd+click patterns

### When to Migrate

Consider adopting react-arborist if:

1. Users report performance issues with large projects (1,000+ files visible)
2. We need drag-and-drop file organization
3. We want inline file renaming

Current implementation is sufficient for most use cases. The 200-item threshold for
virtual scrolling hasn't been a bottleneck because lazy loading limits visible nodes.

## Patterns from Competitors

### claudecodeui

**Smart search:** Auto-expands parent directories when matches found. We implemented
this with `getExpandedPathsForSearch()`.

**Global caching:** Immediate display from cache + background refresh. We implemented
with `globalDirectoryCache`.

### opcode

**Virtual scrolling:** TanStack Virtual for long sessions. Relevant if file lists grow
large.

**Two-phase scroll:** Virtualizer scroll + direct scroll for reliability. Not needed for
our non-virtualized implementation.

## Future Enhancements

1. **Virtual scrolling** - Add when projects exceed 500 visible files
2. **Gitignore parsing** - Currently hardcoded hidden patterns
3. **File type filtering** - Show only .ts, .tsx, etc.
4. **Breadcrumb navigation** - Current path as clickable breadcrumbs
5. **Context menu** - Right-click for copy path, open in editor

## Sources

- [react-arborist GitHub](https://github.com/brimdata/react-arborist)
- [react-complex-tree GitHub](https://github.com/lukasbach/react-complex-tree)
- [MUI X Tree View Lazy Loading](https://mui.com/x/react-tree-view/rich-tree-view/lazy-loading/)
- [NPM Trends Comparison](https://npmtrends.com/react-arborist-vs-react-complex-tree)
- Competitor analysis: `knowledge/code-mode/competitors/`
