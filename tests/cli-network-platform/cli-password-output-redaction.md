### CLI password output redaction

#### Feature/Change Name
CLI startup output does not print the configured password.

#### Prerequisites/Setup
1. Project dependencies are installed.
2. CLI build is available from the current branch.

#### Steps
1. Run `pnpm run build:cli`.
2. Start the CLI with a disposable password: `node dist-cli/index.js --no-open --strict-port --port 5998 --password TEST_SECRET_SHOULD_NOT_PRINT`.
3. Confirm startup output includes the local and network URLs.
4. Confirm startup output does not include `Password:` or `TEST_SECRET_SHOULD_NOT_PRINT`.
5. Start the CLI without an explicit password and confirm startup output prints `Generated password file:` with a path under `$CODEX_HOME`.
6. Confirm the generated password file exists, is readable by the current user, and has `0600` permissions.

#### Expected Results
- Password-protected startup still works.
- The password is not printed as a standalone line.
- Auto-generated passwords remain discoverable through the generated password file path.

#### Rollback/Cleanup
- Stop the disposable CLI process.

---
