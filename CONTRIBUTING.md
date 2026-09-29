# Contributing Guidelines

Thank you for your interest in contributing to our project. Whether it's a bug
report, new feature, correction, or additional documentation, we greatly value
feedback and contributions from our community.

Please read through this document before submitting any issues or pull requests
to ensure we have all the necessary information to effectively respond to your
bug report or contribution.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest
features.

When filing an issue, please check existing open, or recently closed, issues to
make sure somebody else hasn't already reported the issue. Please try to include
as much information as you can. Details like these are incredibly useful:

- A reproducible test case or series of steps
- The version of our code being used
- Any modifications you've made relevant to the bug
- Anything unusual about your environment or deployment

## Contributing via Pull Requests

Contributions via pull requests are much appreciated. Before sending us a pull
request, please ensure that:

1. You are working against the latest source on the _main_ branch.
2. You check existing open, and recently merged, pull requests to make sure
   someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your
   time to be wasted.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please focus on the specific change you are contributing.
   If you also reformat all the code, it will be hard for us to focus on your
   change.
3. Ensure local tests pass.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request
   interface.
6. Pay attention to any automated CI failures reported in the pull request, and
   stay involved in the conversation.

GitHub provides additional document on
[forking a repository](https://help.github.com/articles/fork-a-repo/) and
[creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## Releasing and publishing packages

Releases are published to npm automatically by
[`.github/workflows/release-publish.yml`](.github/workflows/release-publish.yml)
when a release commit lands on `main` or a `hotfix/**` branch. It authenticates
to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC) — note `permissions: id-token: write` and the absence of any npm token —
and runs in the `npm-publish` GitHub environment, which only `main` and
`hotfix/**` may deploy to. npm verifies each publish came from that workflow and
environment rather than a stored credential, and attaches a provenance
attestation to every version.

Never publish from a local machine: a local publish skips the dev-export strip
below, has no provenance, and can move the `latest` dist-tag by mistake.

### Regular releases

1. Run **Actions → Version** from `main`. It bumps versions from the
   conventional commits since the last release, writes the changelogs, and opens
   a `release/vX.Y.Z` pull request against `main`.
2. Review and **squash or rebase** merge it. The pushed commit keeps its
   `chore(release): X.Y.Z` message, which is what triggers the publish.
3. The publish workflow tags `vX.Y.Z`, creates a GitHub release marked Latest,
   strips dev-only exports (`npm run prepare:publish`), and runs
   `npm publish --workspaces` under the `latest` dist-tag. The tag push deploys
   GitHub Pages.

### Hotfix releases

A hotfix ships a patch on an older release line without releasing `main`. Each
line has one long-lived, protected `hotfix/<name>` branch, published under the
npm dist-tag `hotfix-<name>` so `latest` never moves.

1. **Cut the line (once).** Run **Actions → Create Hotfix Branch** from `main`
   with `from` set to the release to patch (e.g. `v1.2.2`). It creates
   `hotfix/1.2` at that release, named for its major.minor unless you pass
   `name`, and opens a `hotfix-setup/1.2` pull request bringing `main`'s release
   tooling onto it. Merge that PR first: a branch runs its own copy of the
   workflows, and an older release predates the hotfix-aware ones.
2. **Land the fixes.** Cherry-pick each fix from `main` onto a branch off the
   hotfix branch and open a pull request into it:
    ```bash
    git switch -c fix/drm-session-leak --no-track origin/hotfix/1.2
    git cherry-pick -x <sha>
    ```
    CI runs on the pull request, and it needs the same review as `main`.
3. **Release.** Run **Actions → Version** with **Use workflow from** set to
   `hotfix/1.2`. It opens a patch-only `release/v1.2.3` pull request against
   `hotfix/1.2`; squash or rebase merge it.
4. **Publish is automatic.** The workflow tags `v1.2.3`, creates a GitHub
   release that is _not_ marked Latest, and publishes under `hotfix-1.2`. GitHub
   Pages only deploys tags on `main`, so the live site is unchanged. Consumers
   install the line with `npm install @amazon/vinyl@hotfix-1.2`.

Hotfix branches are protected by the same rules as `main`: no direct pushes,
deletion, or force-pushes, and every change merges through a reviewed pull
request.

### Branch rulesets

The `main` and `hotfix/**` rulesets are kept as code in
[`.github/rulesets/`](.github/rulesets/), one JSON file per ruleset in the
GitHub REST API's format. To change one, edit its file and apply it; changes
made in the GitHub UI should be copied back into the file.

```bash
.github/rulesets/apply.sh --check   # report drift from the live rulesets; changes nothing
.github/rulesets/apply.sh           # create or update each ruleset, matched by name
```

Applying needs the `gh` CLI with repository admin rights. Enterprise-managed
rulesets are never touched.

### One-time repository setup

These live in GitHub and npm settings rather than in the repository. Apply them
in this order; the npm step goes last because once it requires the environment,
a workflow that doesn't use it can no longer publish.

1. **`npm-publish` environment**, limited to the release branches:
    ```bash
    gh api -X PUT repos/amazonmusic/vinyl/environments/npm-publish \
      --input - <<< '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
    for b in main 'hotfix/**'; do
      gh api -X POST repos/amazonmusic/vinyl/environments/npm-publish/deployment-branch-policies \
        -f name="$b" -f type=branch
    done
    ```
2. **Branch rulesets:** `.github/rulesets/apply.sh` (see
   [Branch rulesets](#branch-rulesets)).
3. **Require the environment in each package's trusted publisher.** npm allows
   one trusted publisher per package, so replace the existing one (workflow
   `release-publish.yml`, no environment). This needs npm 11.10+ and an account
   with 2FA and publish rights; the first call prompts for 2FA, and npm offers
   to skip it for the next five minutes:
    ```bash
    for pkg in $(npx lerna ls --json | node -p "JSON.parse(require('fs').readFileSync(0)).map(p => p.name).join(' ')"); do
      id=$(npm trust list "$pkg" --json | node -p "JSON.parse(require('fs').readFileSync(0))[0]?.id ?? ''")
      [ -n "$id" ] && npm trust revoke "$pkg" --id="$id"
      npm trust github "$pkg" --repo amazonmusic/vinyl --file release-publish.yml \
        --env npm-publish --allow-publish --yes
      sleep 2
    done
    ```

### Publishing a brand-new package for the first time

Trusted publishing can only be configured for a package that **already exists**
on npm — the trusted-publisher settings live on the package's npm page. A new
workspace therefore fails its first automated publish (npm has nothing to match
the OIDC claim against). Bootstrap it once, by hand, then hand ongoing publishes
back to the workflow.

Using `@amazon/vinyl-example` as the illustration:

1. **Confirm it is meant to be public.** The package's `package.json` must have
   `"publishConfig": { "access": "public" }` and must not be `"private": true`
   (private workspaces like `vinyl-website` are skipped by
   `npm publish --workspaces`).
2. **Build and strip dev-only exports**, exactly as the workflow does, so the
   tarball matches what CI will later publish:
    ```bash
    npm ci
    npm run release
    npm run prepare:publish   # strips the ./src development export condition; dirties the tree
    ```
3. **Publish once, manually, with a personal npm token** (a member of the
   `@amazon` scope with publish rights):
    ```bash
    npm login   # or set NODE_AUTH_TOKEN / ~/.npmrc
    npm publish -w @amazon/vinyl-example --access public
    ```
    This creates the package on npm so a trusted publisher can be attached to
    it. Discard the `prepare:publish` tree changes afterward (`git checkout .`).
4. **Add the trusted publisher on npm.** On
   `https://www.npmjs.com/package/@amazon/vinyl-example` → **Settings** →
   **Trusted Publisher**, add a GitHub Actions publisher:
    - Organization / repository: `amazonmusic/vinyl`
    - Workflow filename: `release-publish.yml`
    - Environment: `npm-publish`
5. **Verify.** The next `release/v*` merge should publish
   `@amazon/vinyl-example` automatically via OIDC, with no manual step and no
   stored token.

Repeat steps 1–4 for each new public workspace. Existing packages need no
action.

## Finding contributions to work on

Looking at the existing issues is a great way to find something to contribute
on. As our projects, by default, use the default GitHub issue labels
(enhancement/bug/duplicate/help wanted/invalid/question/wontfix), looking at any
'help wanted' issues is a great place to start.

## Code of Conduct

This project has adopted the
[Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct). For
more information see the
[Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.

## Security issue notifications

If you discover a potential security issue in this project we ask that you
notify AWS/Amazon Security via our
[vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/).
Please do **not** create a public github issue.

## Licensing

See the [LICENSE](LICENSE) file for our project's licensing. We will ask you to
confirm the licensing of your contribution.
