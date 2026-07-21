# Contributing to Flumen

First off, thank you for considering contributing to Flumen! It's people like you that make Flumen such a great tool.

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for our commit messages. This allows us to automatically generate changelogs and manage versions.

Commit messages should be formatted as follows:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Example

`feat(ui): add smooth scroll to task shelf`

## Development Workflow

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies**: `npm install`.
3. **Make your changes**.
4. **Ensure tests pass**: `npm test`.
5. **Commit your changes**: We recommend using the interactive CLI to ensure your commit messages follow the convention:
   ```bash
   npm run commit
   ```
   Alternatively, standard `git commit` messages will be validated by pre-commit hooks.
6. **Push to your fork** and submit a Pull Request.

## Release Process

`release-it` bumps the version, updates the changelog, and pushes a git tag.
GitHub Actions (triggered by the tag) builds the Universal Binary, generates
the Sparkle appcast, publishes the GitHub Release with artifacts, and commits
the updated appcast back to the target branch.

### Staging

```bash
git checkout staging
git pull origin staging
# merge feature branch(es) as needed; ensure release workflow fixes are present
npm run release:staging
```

### Production

```bash
git checkout main
git pull origin main
# merge staging/feature into main; ensure release workflow fixes are present
npm run release
```

### Verify

- Exactly one GitHub Release exists for the tag, with `Flumen_macOS_Universal.zip` and the appcast attached.
- The target branch (`staging` or `main`) has a follow-up `chore: update …appcast… [skip ci]` commit.
- Staging feed: `https://raw.githubusercontent.com/saranshbarua/flumen/staging/flumen-appcast-staging.xml`
- Production feed: `https://raw.githubusercontent.com/saranshbarua/flumen/main/flumen-appcast.xml`

> GitHub runs the workflow YAML from the tagged commit. Land pipeline fixes on
> the branch **before** cutting the next tag; re-running an old tag will not
> pick up newer workflow changes.

---

Built with ❤️ for deep thinkers.
