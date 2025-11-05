# Traylinx Auth Client (Node.js) - Design Specification (v2)

## 1. Overview

This document outlines the design for the Node.js version of the `traylinx-auth-client` library. This library will provide a comprehensive solution for agents written in Node.js to interact with the Traylinx authentication system, which uses a dual-token mechanism for security.

The library will handle two primary use cases:
1.  **Client-side Authentication:** Getting tokens and preparing headers for secure calls to other services.
2.  **Server-side Validation:** Protecting an agent's own API endpoints by validating incoming requests using the custom introspection flow.

## 2. Core Components

### 2.1. Configuration

The library will be configured via environment variables:
- `TRAYLINX_CLIENT_ID`: The agent's unique client ID.
- `TRAYLINX_CLIENT_SECRET`: The agent's client secret.
- `TRAYLINX_AGENT_USER_ID`: The agent's own user ID (UUID).
- `TRAYLINX_API_BASE_URL`: The base URL for the authentication service (e.g., `https://api.makakoo.com/ma-authentication-ms/v1/api`).

### 2.2. `TokenManager` (Internal)

A singleton class that will manage the lifecycle of the agent's tokens.
- It will fetch **both** the `access_token` and the `agent_secret_token` from the `/oauth/token` endpoint.
- It will cache these tokens in memory.
- It will automatically refresh the tokens before they expire.
- It will expose methods like `getAccessToken()` and `getAgentSecretToken()` for internal library use.

## 3. Public API

### 3.1. Client-Side: `getRequestHeaders()`

This function is used when the agent needs to call another service. It provides all the necessary headers for the custom A2A authentication flow.

- **Signature:** `async function getRequestHeaders(): Promise<object>`
- **Functionality:**
  - Retrieves a valid `access_token` and `agent_secret_token` from the internal `TokenManager`.
  - Retrieves the agent's own user ID from the `TRAYLINX_AGENT_USER_ID` environment variable.
  - Constructs and returns a promise that resolves to an object of headers:
    ```javascript
    {
        'Authorization': 'Bearer <access_token>',
        'X-Agent-Secret-Token': '<agent_secret_token>',
        'X-Agent-User-Id': '<agent_user_id>'
    }
    ```
- **Example Usage:**
  ```javascript
  const { getRequestHeaders } = require('traylinx-auth-client');
  const axios = require('axios');

  async function callAgentB() {
    // Get all required headers in one call
    const headers = await getRequestHeaders();

    // Make a request to another agent
    const response = await axios.post("https://agent-b.com/api/v1/process", {}, { headers });
    return response.data;
  }
  ```

### 3.2. Server-Side: `requireA2AAuth` Middleware

This middleware function is used to protect an agent's API endpoints.

- **Functionality:**
  1.  Extracts the caller's `access_token` from the `Authorization` header.
  2.  Extracts the caller's `agent_secret_token` from the `x-agent-secret-token` header.
  3.  Extracts the caller's `agent_user_id` from the `x-agent-user-id` header.
  4.  Uses the library's own `TokenManager` to get the **receiving agent's own** `access_token`.
  5.  Calls the `POST /oauth/agent/introspect` endpoint. The call is authorized with the receiving agent's `access_token`. The body contains the `agent_secret_token` and `agent_user_id` of the **calling agent**.
  6.  Checks that the `active` field in the introspection response is `true`.
  7.  If valid, it calls `next()` to pass control to the next middleware.
  8.  If invalid, it immediately sends a `401 Unauthorized` error response.

- **Example Usage (Express):**
  ```javascript
  const express = require('express');
  const { requireA2AAuth } = require('traylinx-auth-client');

  const app = express();

  app.post('/some_protected_endpoint', requireA2AAuth, (req, res) => {
    // This code only runs if the calling agent is successfully validated
    res.json({ message: 'This is a protected resource.' });
  });
  ```

### 3.3. Introspection Service

The introspection service will be a class that can be used to validate an agent's secret token.

- **Signature:** `IntrospectionService.validate(agentSecretToken: string, agentUserId: string): Promise<boolean>`
- **Functionality:**
    - Uses the library's own `TokenManager` to get the **receiving agent's own** `access_token`.
    - Calls the `POST /oauth/agent/introspect` endpoint. The call is authorized with the receiving agent's `access_token`. The body contains the `agent_secret_token` and `agent_user_id` of the **calling agent**.
    - Checks that the `active` field in the introspection response is `true`.
    - Returns `true` if the token is valid, `false` otherwise.