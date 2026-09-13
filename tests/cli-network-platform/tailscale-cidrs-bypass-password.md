### Feature: Tailscale CIDRs bypass password

#### Prerequisites/Setup

- App is running from this repository via CLI with password protection enabled.
- A Tailscale client can reach the host over Tailscale IPv4 (`100.64.0.0/10`) or IPv6 (`fd7a:115c:a1e0::/48`).

#### Exact Actions

1. Start the CLI with `npx codexapp --port 5900 --strict-port`.
2. From a Tailscale client, open the host tailnet IPv4 address and confirm the app opens directly.
3. If IPv6 is available, repeat with the host address in `fd7a:115c:a1e0::/48`.
4. From an untrusted reverse-proxy origin, confirm password authentication is still required.

#### Expected Results

- Tailscale IPv4 and IPv6 requests remain trusted and bypass the password page.
- Removing the built-in tunnel does not change CIDR trust or user-managed reverse-proxy authentication.

#### Rollback/Cleanup

- Stop the disposable CLI process and clear test-origin cookies if needed.
