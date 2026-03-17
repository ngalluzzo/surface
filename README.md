# surface (monorepo)

This repository is a monorepo containing two packages:

- **[@gooios/schemarr](packages/schemarr/README.md)** — Schema conversion and codegen (JSON Schema, Zod, GraphQL, Drizzle, SQL). Includes a CLI.
- **[@gooios/surface](packages/surface/README.md)** — Operation framework for building servers and clients (HTTP, GraphQL, jobs, events, etc.). Depends on @gooios/schemarr.

Both packages are published to npm independently.

## Development

```bash
bun install
```

Run typecheck and tests across the workspace:

```bash
cd packages/schemarr && bun run typecheck && bun test
cd packages/surface && bun run typecheck && bun test
```

Build both packages (required before publishing):

```bash
cd packages/schemarr && bun run build
cd packages/surface && bun run build
```

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

1. **Create a changeset** after making changes:
   ```bash
   bun run changeset
   ```
   Choose which package(s) changed and the version bump type (patch, minor, major). This creates a markdown file in `.changeset/`.

2. **Version and update changelogs** (e.g. when preparing a release):
   ```bash
   bun run version
   ```
   This consumes the changeset files, bumps versions, updates `workspace:*` dependencies to real versions, and updates `CHANGELOG.md` in each package.

3. **Build and publish** to npm:
   ```bash
   bun run release
   ```
   Ensure both packages are built first (`bun run build` in each package). You must be logged in to npm (`npm login`) and have publish access.

First-time publish order: publish **@gooios/schemarr** first, then **@gooios/surface** (since surface depends on schemarr).
