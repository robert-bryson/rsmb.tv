# Trip browser budget review: 2026-10-07

## Scope

The initial working tree contained one modified browser test.
This review covers that change, its measurement helper, regression tests, and related instructions.
It does not certify all application code, infrastructure, or authored content.
No dependency, production service, or publication setting was changed.

## Findings and corrections

### P2: the test measured a second response

The pending change requested each script again through Playwright's API client.
That response could differ from the response supplied to the browser.
The test now reads the captured browser response body.
It uses gzip level 6 to produce a consistent compressed size.
It counts each complete URL once. Different query strings remain separate resources.
The budgets are unchanged.

### P2: the script filter could omit resources

The pending filter required a `.js` filename.
It could omit extensionless scripts and `.mjs` preload requests.
The helper now checks the request type and the URL path.
It rejects missing responses, failed responses, and an empty script set.
Tests verify resource selection, duplicate requests, query strings, compressed sizes, and response failures.

### P3: one route failure prevented later checks

The test checked four routes in one loop and reused one browser context.
A failure stopped the remaining route checks.
Each route now has a separate test and browser context.
The test removes its request listener even when navigation or a content assertion fails.

### P3: global network silence controlled the check

The pending change used `networkidle` to wait for all requests.
Unrelated network activity could delay or stop a budget check.
The test now waits for the initial route content and reads the captured script bodies.
It does not measure scripts loaded by later user actions.

## Validation

| Check | Result |
| --- | --- |
| Budget unit tests | 8 passed |
| Focused helper coverage | 100% statements, branches, functions, and lines |
| Full unit suite | 1,187 tests passed in 86 files |
| Trip browser suite | 32 desktop and phone Chromium tests passed |
| ESLint and TypeScript | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Synthetic production build | Passed |
| WebKit | Blocked by missing host libraries |

The full suite measured 74.94% statements, 67.69% branches, 72.25% functions, and 77.50% lines.
These values describe measured source files, not every repository file.
The focused helper suite verifies all helper branches. The former inline calculation had no unit tests.
The earlier dashboard report is not a controlled coverage baseline for this change.

## Remaining risks

CI reported 223,953 bytes against a 185,000-byte blog limit with the former resource timing calculation.
The local WebKit browser could not start. This review does not prove the cause of that byte difference.
Duplicate timing entries and browser byte-reporting differences remain unconfirmed explanations.
The replacement measures unique gzip bundle size, not actual wire traffic.
Run the WebKit checks before treating the reported failure as verified on that browser.
The build still reports a large visualization chunk and a Tailwind source-map warning.
See [TODO.md](../../TODO.md) for incomplete checks.

## Documentation

The repository guide defines the measurement, limits, and focused commands.
The documentation index links this report. The TODO list retains one WebKit task with explicit budget checks.
The revised text follows the repository ASD-STE100 writing rules. No formal language certification was performed.
