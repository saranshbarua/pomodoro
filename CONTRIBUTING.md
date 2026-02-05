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

Releases are automated using `release-it`. When a maintainer runs `npm run release`, the following happens:
1. Version is bumped in `package.json`.
2. `CHANGELOG.md` is updated.
3. A new Git tag is created and pushed.
4. GitHub Actions builds the Universal Binary and attaches it to a new GitHub Release.

---

Built with ❤️ for deep thinkers.
