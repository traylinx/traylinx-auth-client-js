# Traylinx Auth Client (JavaScript)

Sentinel Pass authentication for Traylinx agent-to-agent communication.

> **2.0.0: the hardened Sentinel Pass client.** A major version: Node.js 22+, HTTPS only and
> stricter credentials break 1.0.x callers, so `^1` ranges are not upgraded. See HARDENING.md.

## Install

Requires **Node.js 22 or later**. Runtime dependencies: Axios 1.x (`>=1.20.0`)
and Joi 17.x (`>=17.13.8`), installed automatically.

```bash
npm install traylinx-auth-client@^2
```

2.0.0 is the 1.1.0-rc.1 code unchanged, released 9 November 2026. Deployment approval is still
integration-specific: see "Deployment gates" in HARDENING.md.

## Deployment status — 26 October 2026

The exact sealed 1.1.0-rc.1 archive (same code as 2.0.0) is deployed in the explicitly granted html2md
capture integration. Bounded production proof/grant/revocation and human-compatibility
checks passed. The receiver adds its own bounded verifier-token reuse while retaining
two live caller checks; this does not change SDK bytes or provide a general positive
authorization cache. No throughput, long-running stability or all-platform guarantee
is implied. Other integrations need their own gates.

## Configure

Supply these values securely through your application's environment or secret manager:

| Variable | Meaning |
|---|---|
| `TRAYLINX_CLIENT_ID` | Sentinel OAuth client id |
| `TRAYLINX_CLIENT_SECRET` | Sentinel OAuth client secret |
| `TRAYLINX_API_BASE_URL` | Trusted Sentinel HTTPS base URL |
| `TRAYLINX_AGENT_USER_ID` | Agent UUID |

These identify the calling/verifying agent, not credentials for websites it visits.
Do not commit credentials or include them in logs.

## Call a trusted agent

```javascript
const { makeA2ARequest } = require('traylinx-auth-client');

async function fetchStatus() {
    // Fixed application-approved destination, not an untrusted input URL.
    return makeA2ARequest('GET', 'https://agent.example/status');
}

async function submitTask() {
    return makeA2ARequest('POST', 'https://agent.example/tasks', {
        data: { operation: 'inspect' },
        timeout: 30000
    });
}
```

Allowed request options: `headers`, `params`, `data`, `timeout` and `signal`.
Timeouts are milliseconds. Authentication, host and cookie header overrides are rejected.
POST is not automatically replayed.

## Verify incoming proof

`requireA2AAuth` and `validateA2ARequest` accept the custom header pair
`X-Agent-Secret-Token` / `X-Agent-User-Id`. `requireDualAuth` and
`validateDualAuthRequest` additionally accept a **Sentinel agent pass** in
`Authorization: Bearer ...`, with `X-Agent-User-Id`.
This does not validate ordinary user bearer tokens or arbitrary OAuth tokens.

For resource-level authorization, use verified introspection metadata rather than
trusting an agent id supplied in headers:

```javascript
const { TraylinxAuthClient } = require('traylinx-auth-client');
const client = new TraylinxAuthClient(); // Reads the environment above.

async function verifyPass(pass, claimedAgentId) {
    const principal = await client.introspectToken(pass, claimedAgentId);
    if (!principal.active) return null;
    // Caller must authorize principal.agent_id for the requested resource.
    return principal;
}
```

Validate duplicate/mixed headers before extracting proof in custom middleware.
Do not invoke business logic if introspection fails or throws.
`validateToken(pass, agentId)` remains the boolean API.
`getAgentRequestHeaders()` returns custom agent headers;
`getA2ARequestHeaders()` returns agent bearer headers.
`getRequestHeaders()` is **Sentinel-only**, not incoming agent proof.

Constructor options include `timeout`, `maxRetries`, `retryDelay`, `cacheTokens`,
`agentTokenTtlSeconds` and `refreshSkewSeconds`. Set `agentTokenTtlSeconds` only
when the server's pass lifetime has been verified independently.

## Security and compatibility

- This is **Sentinel Pass authentication**, not a full A2A task-protocol SDK.
- HTTPS with certificate verification is required. Credential-bearing redirects,
  URL userinfo, fragments, duplicate/mixed authentication and credential overrides
  are rejected. Request/decoded-response bounds are 4 MiB, or 64 KiB for auth responses.
- Only eligible GET/HEAD operations in the configured client retry path may retry.
  Token exchanges, introspection, RPC and other writes are never automatically replayed.
  The high-level remote-agent helper does not promise automatic retries.
- Access tokens stay with Sentinel. Remote-agent helpers send an agent pass and
  agent id, not the Sentinel access token. Never send these credentials to an
  arbitrary URL supplied by a user or scraped page; destinations must be trusted
  application configuration. This SDK is not an SSRF policy engine.
- Introspection validates agent binding, scope, active status and expiry. A valid
  pass authenticates a principal; the application must still authorize access to
  resources and enforce ownership, grants and quotas.
- Middleware rejects invalid/missing proof with 401 and fails closed with 503 when
  verification is unavailable. Never fall back to another principal after failed proof.
- Access and pass lifetimes are independent. If the server does not return
  `agent_secret_token_expires_in`, a pass is not reused across sequential operations
  unless an operator supplies a verified pass lifetime. Do not guess the lifetime.
- Header helpers return credentials to the caller. If you use your own HTTP client,
  TLS, redirects, timeouts, safe destinations and secret-free logging become your
  responsibility. Do not print or persist returned headers or tokens.

Existing helper entry points remain, but HTTPS enforcement, runtime floors,
stricter verification and error behavior are intentional migration changes.
See [HARDENING.md](HARDENING.md) for the full contract and transport limitations.

## Integration checklist

1. Create the caller agent and securely store its OAuth credentials and UUID.
2. Configure the receiving service with a dedicated verifier agent. Independently
   check its OAuth application owner; setting `agentUserId` alone does not prove
   that the client credentials belong to that UUID.
3. Verify incoming proof with Sentinel, then separately enforce the receiving
   service's grants. Keep ordinary user authentication separate; never fall back
   to it after an agent proof fails.
4. Test invalid/expired/revoked proof, disabled caller and verifier, missing grants,
   TLS failure, cancellation and service outages before enabling real traffic.
5. Recheck authentication before releasing long-running sensitive results.
   Budget for the extra introspection and token exchanges; do not claim capacity
   from a small fixture test.

## Qualification

Tests use synthetic credentials and owned loopback HTTPS fixtures. Local tests do
not establish production readiness. Before production adoption, independently
review the integration, verify deployed server deactivation/revocation and token
lifetimes, and qualify platform support, throughput and cancellation behavior.
See [QUALIFICATION.md](QUALIFICATION.md) for measured coverage and remaining gates.

Publishing this candidate does not change any server, install it into an existing
application, or replace ordinary user-token authentication.

## License

MIT. See [LICENSE](LICENSE).

## Development

```bash
npm ci
npm test -- --runInBand
```

### Consumer-side verifier reuse (local candidate)

The html2md integration candidate wraps this unchanged SDK in a bounded, memory-only
verifier lifecycle. Shared token refresh is separate from request-local introspection
transport and cancellation. Caller authorization is still checked before capture and
before content release. One safe introspection retry may follow an invalid verifier
token; this does not enable generic OAuth issuance or business-action replay.

These consumer changes are not an SDK feature; the SDK code is the same in 1.1.0-rc.1 and 2.0.0.
