### Feature: Strict port startup and no startup login

#### Prerequisites/Setup

- Build the CLI from the current branch.
- Use an empty disposable `CODEX_HOME` and two unused local ports.

#### Exact Actions

1. Start one listener on the first port.
2. Run `CODEX_HOME=<empty-home> node dist-cli/index.js --port <occupied-port> --strict-port --no-password --no-open`.
3. Confirm the process fails with `EADDRINUSE` and does not listen on the next port.
4. Start again on the unused port with the same flags.
5. Inspect startup output and child processes.

#### Expected Results

- Strict mode never increments the requested port.
- The empty home can serve the UI without creating `auth.json` or starting `codex login`.
- CLI help has no `--tunnel`, `--no-tunnel`, `--login`, `--no-login`, or `login` subcommand.

#### Rollback/Cleanup

- Stop both disposable listeners and remove only the disposable home.
