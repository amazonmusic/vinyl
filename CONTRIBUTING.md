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
[`.github/workflows/release-publish.yml`](.github/workflows/release-publish.yml).
When a `release/v*` pull request is merged into `main`, that workflow tags the
version, creates a GitHub release, strips dev-only exports
(`npm run prepare:publish`), and runs `npm publish --workspaces`. It
authenticates to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — note
`permissions: id-token: write` and the absence of any npm token — so npm
verifies the publish came from this repo's workflow rather than a stored
credential.

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
    - Leave the environment blank (the workflow does not use a GitHub
      Environment).
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
