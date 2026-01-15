# Autotask Session: unified-composer

Started: 2026-01-14 Complexity: balanced

## Phase: PR Creation

## Requirements

- Eliminate separate hire page by extending CarmentaSidecar
- Add `endpoint`, `initialMessages`, `auxiliaryContent`, `onPlaybookReady` props
- Convert hire API to streaming with data parts
- Update AI Team page to use sidecar for hire mode
- Delete hire page after consolidation

## Todos

- [x] Planning (approved)
- [x] Implementation
  - [x] Extend CarmentaSidecar props
  - [x] Add auxiliary slot to SidecarThread
  - [x] Convert hire API to streaming
  - [x] Create PlaybookPreviewCard component
  - [x] Update AI Team page
  - [x] Delete hire page
- [x] Validation
- [x] Review (logic review completed, issues fixed)
- [ ] PR Creation
- [ ] Bot Feedback
- [ ] Completion

## Decisions Made

- Auxiliary content renders below messages, above composer (420px too narrow for split)
- Use streaming with data parts for playbook extraction (consistent with existing
  patterns)
- TypeScript types pass
- Added key prop to force remount when switching modes (fixes message persistence bug)
- Added toast error feedback for failed hires
- Added isHiring double-click guard
- Changed READY_TO_HIRE to HTML comment (won't render in markdown)

## Blockers

None
