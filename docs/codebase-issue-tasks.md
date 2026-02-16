# Codebase Issue Triage Tasks

This backlog captures four concrete follow-up tasks based on a quick codebase review.

## 1) Typo Fix Task

**Title:** Correct the npm package name typo (`mananger` → `manager`).

**Why this matters:** The `name` field in `package.json` is currently misspelled as `mananger`, which can leak into package metadata, lockfile tools, and CI/CD package reporting.

**Where observed:** `package.json`.

**Suggested scope:**
- Update `package.json` name to `manager`.
- Regenerate lockfile only if tooling requires it.
- Run lint/build to verify no side effects.

**Acceptance criteria:**
- `package.json` contains `"name": "manager"`.
- Existing scripts (`dev`, `build`, `lint`) still run.

## 2) Bug Fix Task

**Title:** Remove duplicate timer/status automation call in `updateTask`.

**Why this matters:** `updateTask` invokes `handleTimerAutomation(taskId, data.status)` twice when `status` is provided, causing duplicate DB updates and potentially double-counting elapsed time logic.

**Where observed:** `app/actions/projects.ts` in `updateTask`.

**Suggested scope:**
- Ensure status/timer automation is executed once per update.
- Keep parent status synchronization behavior intact.
- Add a short code comment describing the single-update intent.

**Acceptance criteria:**
- Exactly one automation query executes for a status update path.
- Parent task sync still runs when needed.

## 3) Comment/Documentation Discrepancy Task

**Title:** Align architecture docs with actual authentication implementation.

**Why this matters:** `docs/reference.md` describes `Neon Auth`, while the implementation uses `better-auth`, which can mislead contributors and cause incorrect setup assumptions.

**Where observed:** `docs/reference.md`, `src/lib/auth.ts`.

**Suggested scope:**
- Replace references to `Neon Auth` with `better-auth`.
- Update any related setup notes (session behavior, config location, provider assumptions).
- Keep terminology consistent across docs.

**Acceptance criteria:**
- Auth sections in `docs/reference.md` accurately describe `better-auth`.
- No contradictory auth references remain in project docs.

## 4) Test Improvement Task

**Title:** Add regression tests for task status/timer updates and parent sync.

**Why this matters:** Core task mutation logic includes timing accumulation and parent-child status rollups, but there are currently no automated tests in the repository, increasing risk of regressions.

**Where observed:** business logic in `app/actions/projects.ts`; no test scripts/framework configured in `package.json`.

**Suggested scope:**
- Introduce a test runner (e.g., Vitest) for server action logic.
- Add tests around:
  - status transition calling automation exactly once,
  - timer accumulation only in `working` state,
  - parent status synchronization for subtask changes.
- Mock database queries to validate SQL execution counts/arguments.

**Acceptance criteria:**
- A test command exists in `package.json`.
- New regression tests cover the update and timer logic paths.
- Tests pass in CI/local environment.
