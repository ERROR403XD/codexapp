# 公开验证 / Public verification

## 0.2.16 source and release

Prerequisites: Node.js 24, pnpm 11, dependencies installed; use an isolated CODEX_HOME and synthetic data for runtime checks.

1. Run `pnpm run build`; expect Vue type checking and frontend/CLI builds to pass.
2. Run `pnpm run test:unit`; record failures without treating a partial run as full acceptance.
3. Run `node -e "process.argv=['node','codexapp','--help'];require('./dist-cli/index.js')"` on Node.js 24; expect help and exit 0. This is a CLI entry point, not a library export API.
4. Run `pnpm pack --pack-destination /tmp`; inspect the archive for dist, dist-cli, LICENSE, THIRD_PARTY_NOTICES.md, and resources/api-proxy/LICENSE. It must exclude credentials, private documents, conversations and screenshots.
5. In an isolated runtime, create a project with existing additional directories. Expect its AGENTS.md managed block to preserve unrelated text. Verify invalid paths leave the draft and existing file unchanged.
6. Check Chinese/English switching and light/dark themes; refresh and expect the selected language to persist. User content must remain unchanged.
7. Complete a synthetic conversation, verify completion status in two clients, open it and refresh: the blue dot must clear across clients and remain cleared.

Cleanup: stop only the test instance; remove synthetic projects and temporary CODEX_HOME after inspection. Never use actual quota reset credits for tests. Public release checks and explicit limitations are recorded in [docs/RELEASE-0.2.16.md](docs/RELEASE-0.2.16.md).

## 0.2.17

See [UI regression checks](tests/ui/release-0.2.17.md) and [release verification](docs/RELEASE-0.2.17.md).
