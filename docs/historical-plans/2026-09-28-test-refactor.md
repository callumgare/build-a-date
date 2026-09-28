# Test refactor

Written after the work, as a record of it. The unit suite took about 13.5s, most of it one file, and the e2e suite about 6 minutes, with some tests failing only when run alongside the others. Every test was reviewed for whether it tests what it says, whether it's worth testing, and whether another test already covers it.

## Why the e2e tests failed in parallel

- **Clicking before the page's script ran.** Playwright waits for the page to load, not for React to take it over. Under load that gap grew to seconds, and a click in it was lost. The slot test measured the blank slot in that gap, before the shrunk plan made room for its scrollbar, and so failed even on its own. Fix: `HydratedMark` marks `<html data-hydrated>`, and the fixtures' `goto`/`reload` wait for it.
- **Counting frames.** Animation tests asked for more than N frames part way through a 250–500ms animation, and started watching only after `click()` returned. A busy machine draws fewer frames. Fix: press from inside the page, ask for a few frames part way or for a running animation, and compare positions on the same frame.
- **Long flows against the 30s default.** Sign up, share, save a plan and edit it took longer than that under load. Fix: a 60s timeout.
- **One server under load.** About 50 tests signed someone up and made a deck only so a guest could open a builder, and each left the owner's page drawing and uploading a link preview. Fix: those tests use `/sample`.

## Speed

- **Unit.** Motion's animations are skipped in jsdom, and `userEvent` has no delay between keystrokes. `PlanBuilder.test.tsx` was split into six files by area, with shared fixtures in `src/test/plan-builder.tsx`. `isolate: false` was tried and rejected: the stand-ins' module-level state leaks between files.
- **E2E.** Builder tests moved to `/sample`. Files run fully in parallel. The two long stress runs (29 fixed steps, 40 random ones) became one 25-step random run. Fixed sleeps that stood in for "settled" now wait for the actual condition. The database starts empty each run.

## Found along the way

- **The sample deck's bar changes height on a narrow screen.** Below about 600px, **To save a plan**, **Create your own deck** and **Clear plan** wrap onto two lines where the prompt takes one, so the first pick pushes the page down (docs/card-layout.md § "Save plan and Clear plan" says it doesn't). The test is kept, marked `test.fail`. *(Post-implementation, 2026-09-28, Claude at Callum's request: Callum decided this edge case is acceptable, so the narrow case was dropped from the test and the doc notes the exception.)*
- **Safari's container units under `zoom`**, and its underlines under the halo, were fixed separately, in the commit before this one.

## Removed as redundant or weak

Tests that repeated another test at the same level were removed or merged. Those whose assertions couldn't fail were fixed: a conditional `if (prompt) expect(…)`, negative checks run before the handler had finished, a glint cap the test data never reached, and a reduced-motion check that looked once, after anything would have faded. Their replacements are in the same files.
