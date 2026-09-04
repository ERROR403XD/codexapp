# Multi-account isolated login and transactional switching

## Feature / change

Validate the versioned account credential store, isolated Codex OAuth login, explicit quota refresh, global idle-boundary account switching, thread continuity checks, rollback behavior, and the packaged development instance on port `59001`.

## Prerequisites / setup

- Keep the production `codexapp.service` running on port `5900`; do not restart it for this test.
- Use the packaged `codexapp-multi-account-dev:latest` image with Codex CLI `0.147.0`.
- Run `scripts/run-multi-account-dev.sh`. The container must use the `codexapp-multi-account-dev-home` volume as `/codex-home` and must not mount `/root/.codex`.
- Confirm `http://127.0.0.1:59001/` is reachable and `GET /codex-api/accounts` returns an empty or test-only account pool.
- Have two disposable or explicitly approved real ChatGPT/Codex accounts available for the final P6 steps. Never record OAuth callback URLs or credential contents in this document, terminal history, screenshots, or issue comments.

## Automated checks

1. Run:

   ```bash
   pnpm exec vitest run src/cli/listenOnPort.test.ts src/server/accountAuthStore.test.ts src/server/accountAuthCoordinator.test.ts src/server/accountAppServerProbe.test.ts src/server/accountTokenRefresh.test.ts src/server/codexAppServerBridge.authRefresh.test.ts src/api/codexGateway.test.ts
   pnpm run build
   ```

2. Run `node scripts/verify-multi-account-ui.cjs` against `http://127.0.0.1:59001`.
3. Run the startup profiler:

   ```bash
   PROFILE_BASE_URL=http://127.0.0.1:59001 \
   PROFILE_WAIT_MS=7000 \
   PROFILE_BROWSER_EXECUTABLE=/snap/bin/chromium \
   pnpm run profile:browser
   ```

4. While the development instance is running, start a second packaged instance with host networking and `--port 59001 --strict-port`; it must exit non-zero with `EADDRINUSE` and must not select another port.

## Final P6 manual actions

1. Open `http://192.168.50.46:59001/`, open **Settings**, and expand **Accounts**.
2. Click **Add account** for account A, complete OAuth in the browser, paste only the localhost callback URL into the open login modal, and submit it.
3. Confirm A is added once and is not activated implicitly. Explicitly click **Switch** to activate A.
4. Click **Add account** for account B and complete the same flow. Confirm B is added once while A remains active.
5. Use **Add account** to sign in to B again. Confirm the outcome is re-authentication, B remains one card, its credential revision advances, and A remains active.
6. On B's card, click **Re-authenticate** but intentionally sign in as A. Confirm the modal reports an identity mismatch and neither account entry is overwritten or duplicated.
7. Click **Refresh quota** on A and B. Confirm the status and quota belong to the selected card; a revoked token shows **Re-authenticate**, a payment failure shows **Payment required**, and a transient network failure remains retryable.
8. In a test project under `/home/Code`, create a test thread while A is active. Record only its thread ID, cwd, route, visible message count, and last visible item ID.
9. With no active turn, queued message, approval, or second account operation, switch A → B → A. After each switch, confirm `account/read`/quota reflect the target account while the thread ID, cwd, route, rollout path, visible messages, and project list remain unchanged.
10. Start a harmless test turn or queue a test message and attempt another switch. Confirm the server returns a blocked/conflict result, the composer stays disabled during recovery, and no turn is replayed under another account.
11. Open a second browser tab using the same initial active account. Switch in the first tab, then attempt a stale switch in the second tab. Confirm `expectedActiveStorageId` produces a deterministic conflict instead of silently switching again.
12. Refresh the page and confirm the same active account remains highlighted. Repeat one switch after a normal token refresh to prove rotated credentials were persisted.

## Expected results

- Server startup never starts `codex login`, opens a browser, or creates an active `auth.json` by itself.
- Each login process uses `accounts/.pending/<loginSessionId>` and cleans it after completion or cancellation.
- Adding or re-authenticating an account does not change the active quota source; only an explicit successful switch does.
- Account identity mismatches, stale browser state, busy runtime state, and concurrent account operations have structured, non-destructive failures.
- A successful switch is reported only after target probing, credential materialization, app-server restart, account verification, and optional thread continuity verification succeed.
- A failed switch restores the previous active credential and readable thread; incomplete recovery is reported as degraded rather than successful.
- No credentials, access tokens, refresh tokens, or callback URLs appear in logs or screenshots.

## Rollback / cleanup

- Stop only the development container with `docker stop codexapp-multi-account-dev` if the test must pause. Keep `codexapp-multi-account-dev-home` for diagnosis unless deletion is explicitly authorized.
- Re-run the development container with `CODEXAPP_REPLACE_DEV=1 scripts/run-multi-account-dev.sh` after rebuilding. This replaces only `codexapp-multi-account-dev` and preserves its independent volume.
- Do not edit `/home/docker/codexapp`, restart `codexapp.service`, remove the production `5900` listener, or copy production `/root/.codex` state into the test volume.

## Current execution status (2026-09-05)

- Automated unit, type, build, packed-image, strict-port, empty-startup, light/dark UI, refresh persistence, and startup performance checks are complete.
- The development container is available on `59001` with an independent `CODEX_HOME` and fixed Codex CLI `0.147.0`.
- The real two-account login and remote A → B → A acceptance steps above are intentionally pending for the user to execute manually.
