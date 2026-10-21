# Code cleanup audit

## Definition of done

This cleanup is complete when all of these statements are true:

- Every source area has a recorded audit result based on imports, call sites, state flow,
  tests, or runtime contracts.
- Every high-confidence dead or redundant code finding is removed or has a concrete reason
  to remain.
- Every confirmed bug found during the audit has a regression check and a focused fix.
- The cleanup adds no product behavior.
- Application and widget TypeScript pass with unused locals and parameters rejected.
- Tests, lint, widget verification, and the production build pass.
- Hand-authored production code is smaller or materially easier to trace. Generated files,
  tests, and audit documents do not count toward this comparison.

## Scope and rigor

The baseline has 104 tracked files and 9,762 lines across `src` TypeScript, TSX, and CSS.
The largest files are `src/widget/widget.ts` at 1,602 lines,
`src/components/block/dashboard-shell.tsx` at 1,067 lines, and
`src/components/block/active-sessions.tsx` at 710 lines.

This is a high-rigor pass because it touches runtime state, API routes, database queries,
and a separately compiled widget. All work stays on `codex/unslop-audit`. Each cleanup
unit must pass its relevant checks before the next unit starts.

## Workflow

1. Capture the clean baseline and run strict unused-code compiler checks.
2. Audit the widget, dashboard, and backend as separate read-only slices.
3. Rank findings by proof and blast radius. Reject speculative cleanup.
4. Remove dead files, exports, dependencies, comments, and wrappers first.
5. Simplify duplicated state and control flow without changing behavior.
6. Fix only confirmed existing bugs and add regression checks.
7. Rebuild generated widget files and run the complete verification suite.
8. Compare the final tree with the baseline and record every accepted or rejected finding.

## Baseline

- Commit: `f62f72b2c5dabc001db7446816b15e9932825d73`
- Branch: `codex/unslop-audit`
- Application strict unused check: passed
- Widget strict unused check: passed
- Existing test suite: 15 tests
- Existing lint result: no errors and four `no-img-element` warnings
- Existing production build: passed
- Existing widget verification: passed

## Findings

The source/import graph, route entry points, public assets, compiler diagnostics, and
the widget release path were checked. The read-only parallel reviews were interrupted
by the workspace spend cap, so the final decisions below use direct repository checks.

| Finding | Evidence | Decision |
| --- | --- | --- |
| Old live-visitors component and stylesheet | No source import reaches either file; `/dashboard/visitors` renders `ComingSoon` | Delete both files (762 lines) and correct `flow.md` |
| Starter SVGs, old widget JPEG, and bundled font | No source, script, or documentation references these URLs; the launcher uses `textbox-160.png` and the font option has no default URL | Delete seven unused assets |
| Public exports used only inside their modules | Repository-wide references and strict unused checks | Keep the implementations, make the helpers and types private |
| Invalid conversation status enters the inbox | `supabase/schema.sql` defines unconstrained `status text`; the mapper and realtime patch cast it to a three-value union | Normalize both boundaries and test valid, invalid, and missing statuses |
| Repeated relative-time calculation | One row mapping called `minutesSince` three times for the same timestamp | Calculate once for both the numeric value and label |
| Stale future-tense implementation comments | Supabase is already in use; the comments described it as planned | Remove or correct those comments |

Retained after inspection: the mock inbox data is the explicit no-backend fallback;
`src/widget/embed.ts` is a separate browser entry point despite having no source import;
the generated `public/widget/*.js` and Cuelume files are used by the release scripts;
all declared packages have current imports. Dashboard radio menu pieces are used by
`DashboardFilterMenu`, so their implementations remain private within the module.

No other confirmed runtime bug was found in this pass. Large stateful components were
not split merely for size: that would add interfaces without proving redundant logic.

### Area results

- Widget: `embed.ts` and `widget.ts` are release entry points. The generated JavaScript,
  Cuelume runtime, and current launcher image are used and verified. No source module
  or widget state branch was proven dead.
- Dashboard: the visitors implementation was unreachable; the route already showed
  a placeholder. Internal shell controls remain because the filter menu renders them.
  The inbox's live status patch now validates the three supported values.
- Data and API: Supabase row mapping now validates status, and canned response, tag,
  and conversation helpers with no outside callers are private. Widget request routes
  use the existing Zod schemas; no route was proven redundant.

## Verification

- Source TypeScript/CSS: 9,762 → 9,001 lines (includes one regression test).
- Application and widget TypeScript pass with unused locals and parameters rejected.
- 16 tests pass; widget release and runtime regression checks pass.
- Lint has zero errors and the same four image warnings as baseline.
- Production build and `git diff --check` pass.
