# How To Release oplink

This project ships via the Node script at `scripts/release.ts`. The script bumps versions across all packages in the monorepo, creates git commits and tags, and publishes packages to npm.

## Prerequisites
- Node 18+ (or Node 20+)
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate` works too)
- npm auth: `npm whoami` works; 2FA ready if enabled
- Clean `main` branch with all changes committed and pushed to origin

## Project Structure
This is a monorepo with multiple packages:
- **Root** (`@instructa/oplink`): Private, version bumped but not published
- **@oplink/core** (`packages/oplink`): Published as public
- **oplink** (`packages/cli`): Published as public (CLI package)
- **@oplink/test-utils** (`packages/test-utils`): Version bumped but not published

## Prepare
- Ensure all changes are committed and pushed to `main`
- Run lint and tests to verify everything passes:
  - `pnpm lint`
  - `pnpm test:ci` (runs build + tests non-interactively)
- Update any user-facing documentation if needed

## Quick Release (with Preflight)
- Patch/minor/major bump and publish:
  - `pnpm dlx tsx scripts/release.ts patch` (or `minor`/`major`)
  - Or use a specific version: `pnpm dlx tsx scripts/release.ts 0.1.0`
- The script will now run a preflight before any version bump/tag/publish:
  1. Verify a clean working tree (fails if uncommitted changes exist)
  2. Dependency guard for publishable packages (`oplink`, `@oplink/core`):
     - Rejects runtime specifiers `workspace:` and `catalog:` in `dependencies`, `peerDependencies`, and `optionalDependencies`
  3. Build once to generate artifacts
  4. Artifact checks:
     - CLI: `bin/oplink.mjs`, `dist/schema/oplink-workflows.schema.json`, `dist/schema/oplink-servers.schema.json`
  5. `npm pack --dry-run` must succeed for each publishable package
  
  If any preflight step fails, the script aborts before changing versions or creating tags.

- On success, the script then:
  - Bumps versions in root and all packages
  - Creates commit `chore: release vX.Y.Z`
  - Creates tag `vX.Y.Z`
  - Pushes commit and tags
  - Publishes `@oplink/core` and `oplink` to npm with `--access public`
  - Skips `@oplink/test-utils` (not configured for publishing)

### Preflight Only (no version bump)
- Run just the checks without publishing:
  - `pnpm dlx tsx scripts/release.ts preflight`
  - Exits non‑zero on failure; prints the exact blocking step.

## Full Release Checklist

Before you start
- `git status` is clean on `main` and pushed.
- `npm whoami` succeeds; 2FA ready if enabled.
- Node 18+ or 20+; pnpm installed.

Run preflight (required)
- `pnpm dlx tsx scripts/release.ts preflight`
  - Blocks on:
    - runtime deps using `workspace:`/`catalog:` specifiers
    - missing CLI/core artifacts (schemas/presets/bin)
    - failing `npm pack --dry-run`

Publish
- Choose bump: `patch` | `minor` | `major` | `<X.Y.Z>`
  - `pnpm dlx tsx scripts/release.ts patch`

Post‑publish verification
- `npm view oplink version` and `npm view @oplink/core version`
- Quick smoke:
  - `npx -y oplink@latest --help`
  - `npx -y oplink@latest validate --config examples/deepwiki-demo/.mcp-workflows`
- Push tag created by script is visible: `git tag -l v*`

Deprecate broken versions (if needed)
- `npm deprecate oplink@<bad> "Deprecated. Please use oplink@<good> or later."`
- `npm deprecate @oplink/core@<bad> "Deprecated. Please use @oplink/core@<good> or later."`

## Sanity Checks (optional but recommended)
- Build locally before releasing:
  - `pnpm build` (builds all packages)
- Verify packages after publish:
  - Check npm pages: `https://www.npmjs.com/package/oplink` and `https://www.npmjs.com/package/@oplink/core`
  - Test installation: `npx oplink@latest --version`
  - Verify git tag exists: `git tag -l v*`

## Deprecation Policy
- If an early version has known issues (e.g., missing files or unusable/broken workflows), deprecate it to guide users to a working version:
  - `npm deprecate oplink@<bad> "Deprecated. Please use oplink@<good> or later."`
  - `npm deprecate @oplink/core@<bad> "Deprecated. Please use @oplink/core@<good> or later."`
- Prefer deprecating over unpublishing. Only unpublish if absolutely necessary and within the npm time window.

## Troubleshooting Preflight
- Error about `workspace:`/`catalog:` in deps:
  - Replace those specifiers with real semver ranges for publishable packages.
- Missing artifact error:
  - Ensure build outputs land in `dist/` (schemas/bin). Update build configs if needed.
- `npm pack --dry-run` fails:
  - Inspect the error, then re-run the release after fixing.

## GitHub Releases
The release script does not automatically create GitHub Releases. After publishing:
- Manually create a GitHub Release from the tag if needed
- Include release notes describing changes in the new version

## Prereleases / Dist-Tags
The current script doesn't support dist-tags. To publish a prerelease:
1. Run the release script normally to bump versions and create tags
2. Manually publish with a tag:
   - `pnpm -C packages/oplink publish --no-git-checks --tag alpha`
   - `pnpm -C packages/cli publish --no-git-checks --tag alpha`

## Rollback / Deprecation
- Prefer deprecation over unpublish:
  - `npm deprecate oplink@X.Y.Z "Reason…"`
  - `npm deprecate @oplink/core@X.Y.Z "Reason…"`
- Only unpublish if necessary and allowed (within 72 hours):
  - `npm unpublish oplink@X.Y.Z --force`
  - `npm unpublish @oplink/core@X.Y.Z --force`
- Create a follow-up patch release that fixes the issue

## Troubleshooting
- `npm ERR! code E403` or auth failures: run `npm login` and retry
- Working tree not clean: commit or stash changes before running release script
- Tag push rejected: pull/rebase or fast-forward `main`, then rerun
- Package build failures: ensure `pnpm build` succeeds before running release script
