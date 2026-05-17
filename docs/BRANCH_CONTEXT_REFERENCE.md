# Branch Context Reference

Generated: 2026-04-30

## Governance Defaults

- Canonical branch: `main`
- Merge style: squash merge to `main`
- Deletion policy: delete merged feature/fix branches immediately after merge
- Approval gate: no branch/worktree deletion unless `USER_DECISION` is explicitly set

## Branch Decision Ledger

Legend:
- `RECOMMENDATION`: automated recommendation for review
- `USER_DECISION`: must be one of `KEEP`, `MERGE`, `KILL`, `ARCHIVE_TAG_THEN_KILL`

| BRANCH | HEAD | AHEAD_vs_main | BEHIND_vs_main | MERGED_INTO_main | UPSTREAM | UPSTREAM_STATUS | RECOMMENDATION | USER_DECISION | NOTES |
|---|---:|---:|---:|---|---|---|---|---|---|
| `main` | `71f5cf3` | 0 | 0 | yes | `origin/main` | exists | KEEP | KEEP | canonical branch |
| `chore/post-merge-validation` | `0ccc0fe` | 0 | 1 | yes | `origin/main` | exists | KILL |  | merged, no unique commits |
| `ci-lint-changed` | `224bd47` | 0 | 23 | yes | `origin/ci-lint-changed` | exists | KILL |  | merged, stale feature line |
| `feature/auth-otp-retry-fix` | `0f62ea1` | 7 | 8 | no | `(none)` | none | KILL |  | duplicate head of other active lines |
| `feature/openings-delete-immediate-refresh` | `0f62ea1` | 7 | 8 | no | `(none)` | none | MERGE |  | active branch, primary merge candidate from duplicate head set |
| `fix/account-dropdown-from-remote` | `ce25cf8` | 1 | 4 | no | `origin/fix/account-dropdown-from-remote` | gone | KILL |  | remote branch is gone |
| `fix/onboarding-success-state-20260327` | `0f62ea1` | 7 | 8 | no | `origin/fix/onboarding-success-state-20260327` | exists | KILL |  | duplicate head of active merge candidate |
| `release/minstaff-live` | `71f5cf3` | 0 | 0 | yes | `origin/release/minstaff-live` | exists | KILL |  | same commit as `main` |
| `release/onboarding-redesign-live-20260327` | `7173bd4` | 1 | 7 | no | `origin/release/onboarding-redesign-live-20260327` | exists | MERGE |  | contains unique commit not in `main` |
| `release/settings-live-refresh` | `a2fd698` | 2 | 0 | no | `(none)` | none | MERGE |  | contains local-only settings refresh commits |
| `release/waitlist-live` | `176285c` | 0 | 7 | yes | `(none)` | none | KILL |  | merged, stale release line |

## Worktree Decision Ledger

| WORKTREE_PATH | HEAD | ATTACHED_BRANCH | STATE | RECOMMENDATION | USER_DECISION | NOTES |
|---|---:|---|---|---|---|---|
| `/Users/evankirsh/Cursor/quick-booking-now` | `0f62ea1` | `feature/openings-delete-immediate-refresh` | active | KEEP | KEEP | primary working directory |
| `/private/tmp/openalert-release` | `176285c` | `release/waitlist-live` | prunable | KILL |  | stale/prunable temp worktree |
| `/private/tmp/qbn-main-sync-RkxfaG` | `0ccc0fe` | `chore/post-merge-validation` | prunable | KILL |  | stale/prunable temp worktree |
| `/private/tmp/qbn-minstaff-release` | `71f5cf3` | `main` | prunable | KILL |  | stale/prunable temp worktree |
| `/Users/evankirsh/.cursor/worktrees/quick-booking-now/rhi` | `1bdf73d` | detached | detached | KEEP |  | likely agent-managed; leave unless you want cleanup |
| `/Users/evankirsh/.cursor/worktrees/quick-booking-now/tec` | `1bdf73d` | detached | detached | KEEP |  | likely agent-managed; leave unless you want cleanup |
| `/Users/evankirsh/Cursor/quick-booking-now-live` | `a2fd698` | `release/settings-live-refresh` | active | KEEP_UNTIL_MERGED |  | keep until branch integrated |
| `/Users/evankirsh/Cursor/quick-booking-now-release` | `7173bd4` | `release/onboarding-redesign-live-20260327` | active | KEEP_UNTIL_MERGED |  | keep until branch integrated |

## Approval Rules (Hard Gate)

1. If `USER_DECISION` is blank, no delete and no remote cleanup happens.
2. `KILL` can run only after preserving the branch head SHA in this file.
3. `ARCHIVE_TAG_THEN_KILL` requires creating a tag before branch removal.
4. `MERGE` requires PR flow into `main` with squash merge.

## Post-Merge Hygiene Checklist

- `git switch main`
- `git pull --ff-only origin main`
- delete merged branch local + remote
- remove prunable temp worktree (if approved)
- verify no branch remains without purpose or owner