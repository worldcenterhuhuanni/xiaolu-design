# Xiaolu design (dsh-xiaolu-design)

[中文](README.md) | English

A conversation plugin for DeepSeek Harness (dsh). It shows a conversation as layers stacked in depth. Ask a question while looking at any earlier turn and a branch starts there; the original conversation is left as it was.

## What it does

- **Depth stage**: the current turn faces you and earlier turns recede, showing only their top edge. It replaces the Chat view entirely, with no tabs and no title row.
- **Branches**: a question sent while reading an earlier turn, a regenerated answer and a rewritten question each start a branch. A branch inherits the whole conversation before the fork; after it, the main line and the branch cannot see each other. Branches under the same turn can be switched left and right.
- **Timeline**: lists every turn of the Session on the right and searches what you asked in this Session; starting a search loads the earlier history.
- **Search palette**: `Ctrl/Cmd+K` finds a turn of the current Session or message content of other Sessions.
- **Answer tools**: outline jumps, copy, quote, ratings and focused reading.
- **Water background**: drawn with WebGL and driven by thinking and answering; without WebGL the application background stays.

## Requirements

- dsh `0.2.2-rc.1` or later, Web.
- **dsh must provide the `conversation/input-deliver` event** (`@deepseek-ai/dsh-client-ui-conversation`). It is how a question from the composer is redirected to a branch. On a dsh version without it the stage still shows, but a composer question sent while reading an earlier turn goes to the current Session instead of a new branch; regeneration is unaffected.

## Install

```sh
dsh plugin --profile web add github:worldcenterhuhuanni/xiaolu-design
```

The repository carries the built `lib/`, so installation needs no build approval. A locally packed tarball also works:

```sh
dsh plugin --profile web add ./dsh-xiaolu-design-0.1.0.tgz
```

Check and launch:

```sh
dsh --profile web --dump-config   # shows a "# == dsh-xiaolu-design" layer
dsh --profile web
```

Remove it with `dsh plugin --profile web remove dsh-xiaolu-design`. The conversation column returns to Chat.

## What it adds to dsh

`cordis.patch.yml` does two things:

- It inserts one row, `xiaolu-design`, which brings up both the Host half and the browser half.
- It sets `openAt` of `session-query-sqlite` to `first-search`, so the search palette can find message content of other Sessions. The index is in memory and opens on the first search.

The Host half provides two services. Both keep their data in a dsh storage domain, outside Session logs, and nothing reaches the model:

| Service | Content |
| --- | --- |
| `ctx.sessionLineage` | which Session and event each branch came from, and which action started it |
| `ctx.sessionGroups` | user-named Session groups and the group each Session belongs to |

A branch is an ordinary dsh Session created by dsh's own Session fork. After its record is deleted or the plugin is removed, it remains a Session that opens on its own.

## Known limitations

- Regeneration resends only the question's text; attachments of the original question do not reach the new branch.
- Without a search, the earlier turns of a very long Session do not appear on the timeline.
- Sessions forked through dsh itself are not recorded in the branch tree.
- The Session shelf and overview are still being designed; their code is in the repository but not registered (see the TODO in `src/client/index.ts`).

## Development

The source builds inside a dsh source checkout, because it uses dsh's Remote manifest generator and client bundler:

1. Place this repository at `packages/experimental/xiaolu-design` of the dsh checkout.
2. Register the package there: `devDependencies` of the root `package.json`, `paths` of `tsconfig.base.json`, `references` of `tsconfig.host.json` and `tsconfig.client.json`, and `scripts/experimental-package-policy.ts`.
3. From the dsh checkout root run:

```sh
pnpm install
pnpm exec tsx scripts/generate-typert.ts
pnpm run build:artifacts
pnpm exec vitest run packages/experimental/xiaolu-design
```

The build writes to `lib/` in this directory, which is committed with the repository.

## License

MIT, see [LICENSE](LICENSE). Third-party libraries bundled into `lib/client.js` are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
