# Minimatch security fix and lint compatibility

Date: October 31, 2026.

The unchanged `npm run audit` command now reports zero vulnerabilities.
A normal clean `npm ci` also reports zero vulnerabilities.
The fix uses minimatch 11.0.3 overrides scoped to three lint-toolchain consumers.
The CI workflow and its moderate-severity audit threshold are unchanged.

## Cause and repair

The reviewed baseline is `bb47f1e`.
Its full audit reports 12 moderate development-package findings from [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The advisory affects minimatch versions below 11.0.1.
The current upstream packages still request minimatch 10.
No patched minimatch 10 release was available during this check.

| Consumer | Checked version | Declared minimatch range | Scoped override |
| --- | --- | --- | --- |
| ESLint | 10.14.0 | `^10.2.6` | 11.0.3 |
| `@eslint/config-array` | 0.23.5 | `^10.2.4` | 11.0.3 |
| `@typescript-eslint/typescript-estree` | 8.72.1 | `^10.2.2` | 11.0.3 |

These overrides deliberately exceed the upstream semver ranges.
They apply only to the three consumers listed above.
The lockfile resolves every affected dependency path to the published minimatch 11.0.3 package.

Minimatch 11 has API changes.
Its [changelog](https://github.com/isaacs/minimatch/blob/v11.0.3/changelog.md) lists removed methods and changed matcher internals.
The checked consumers use retained matching methods and the pattern string.
They do not use the removed APIs.
The compatibility checks exercise their actual file-discovery and parser workflows.
Minimatch 11.0.3 supports the repository's Node.js engine ranges.

The lockfile also adds the new matcher dependency and completes existing optional WASI dependency records.
Existing package versions remain unchanged except for minimatch.

## Regression evidence

The new [compatibility suite](../../scripts/__tests__/lintDependencyCompatibility.test.ts) contains six tests.
Each security test resolves minimatch through its actual consuming package.
This avoids assumptions about dependency hoisting.

Three tests cover the advisory's pattern-expansion behavior.
Before the fix, a requested limit of 16 produced 256 expanded patterns on every affected dependency path.
After the fix, all three paths respect the limit.
The test uses a small input, so the vulnerable version fails quickly without exhausting memory.
The [upstream correction](https://github.com/isaacs/minimatch/commit/77a0f5c) documents the expansion limit.

The remaining tests check these consumer workflows:

- ESLint discovers nested JavaScript, TypeScript, and TSX files through recursive brace globs.
- ESLint excludes generated dot directories, coverage output, and ignored test files.
- The TypeScript project service accepts allowed root files, including dotfiles, and rejects unrelated nested files.

These checks pass on the original matching APIs and the replacement package.
The security regressions fail before the override and pass afterward.

## Validation

Checks use the configured Node.js 24.22.1 and npm 12.2.1.

| Check | Result |
| --- | --- |
| Normal clean `npm ci` | Passed; zero vulnerabilities |
| Unchanged `npm run audit` | Passed; zero vulnerabilities |
| `npm ls minimatch --all` | All three paths resolve to 11.0.3; no invalid dependencies |
| Focused compatibility suite | Six passed |
| ESLint and TypeScript checks | Passed |
| Full Vitest coverage run | 1,802 passed in 121 files |
| Python temperature tests | 17 passed |
| Smoke browsers | 79 passed; five expected skips |
| Production trip browsers | 200 passed; 10 expected skips |
| Full production build with fresh imports | Passed |
| Full development build with fresh imports | Passed |
| `npm outdated --json` | Empty object |

Browser checks include Chromium and WebKit.
Both builds use an isolated source copy to preserve generated local previews.
The production import contains three published stories.
The development import contains 11 published and draft records.

Lockfile regeneration needed npm 12's command-only `--allow-remote=all` option for existing registry URL entries.
Every resolved tarball still uses `registry.npmjs.org`.
Normal clean installation needs no such option.
No remote-package policy change is saved in the project or CI configuration.

An actual Linux GitHub Actions run remains unverified.
The local Docker daemon was unavailable for an additional Linux container check.
Local verification logs use `/private/tmp/rsmb-audit-fix-*`.

## Maintenance

Remove the three overrides when their upstream dependency ranges accept a patched release.
Run the [focused and complete dependency checks](../../README.md#lint-security-override) after removal.
Track that remaining work in [TODO.md](../../TODO.md#build-and-maintenance).
The earlier audit findings remain in their dated reports, with links to this correction.
