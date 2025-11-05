/**
 * High-level functions and middleware for Traylinx A2A authentication.
 * 
 * This module provides convenient functions and Express.js middleware for common
 * authentication tasks, including making authenticated requests, protecting endpoints,
 * and validating incoming requests.
 * 
 * @module traylinx-auth-client
 */

const TraylinxAuthClient = require('./client');
const { validateConfig, validateParameter } = require('./validation');
const {
    TraylinxAuthError,
    AuthenticationError,
    TokenExpiredError,
    NetworkError,
    ValidationError
} = require('./errors');

// Default client instance
let defaultClient = null;

/**
 * Get or create the default TraylinxAuthClient instance.
 * 
 * This function implements a singleton pattern for the default client,
 * creating it on first access using environment variables.
 * 
 * @returns {TraylinxAuthClient} The default client instance
 * 
 * @example
 * const client = getDefaultClient();
 * const token = await client.getAccessToken();
 */
function getDefaultClient() {
    if (!defaultClient) {
        defaultClient = new TraylinxAuthClient();
    }
    return defaultClient;
}

/**
 * Get headers for calling the Traylinx auth service.
 * 
 * Returns headers that include both access_token and agent_secret_token,
 * suitable for making requests to Traylinx Sentinel API endpoints.
 * 
 * @async
 * @returns {Promise<Object>} Headers object containing:
 *   - Authorization: Bearer <access_token>
 *   - X-Agent-Secret-Token: <agent_secret_token>
 *   - X-Agent-User-Id: <agent_user_id>
 * 
 * @throws {ValidationError} If client configuration is invalid
 * @throws {AuthenticationError} If token acquisition fails
 * @throws {NetworkError} If network issues occur during token fetch
 * 
 * @example
 * const headers = await getRequestHeaders();
 * const response = await axios.get('https://auth.traylinx.com/a2a/rpc', { headers });
 */
async function getRequestHeaders() {
    return await getDefaultClient().getRequestHeaders();
}

/**
 * Get headers for calling other agents (agent-to-agent communication).
 * 
 * Returns headers that include ONLY the agent_secret_token, suitable for
 * making requests to other Traylinx agents.
 * 
 * @async
 * @returns {Promise<Object>} Headers object containing:
 *   - X-Agent-Secret-Token: <agent_secret_token>
 *   - X-Agent-User-Id: <agent_user_id>
 * 
 * @throws {ValidationError} If client configuration is invalid
 * @throws {AuthenticationError} If token acquisition fails
 * @throws {NetworkError} If network issues occur during token fetch
 * 
 * @example
 * const headers = await getAgentRequestHeaders();
 * const response = await axios.post('https://other-agent.com/api', data, { headers });
 */
async function getAgentRequestHeaders() {
    return await getDefaultClient().getAgentRequestHeaders();
}

/**
 * Validate an incoming A2A request using custom header format.
 * 
 * Validates incoming requests that use the custom header format:
 * - X-Agent-Secret-Token: <token>
 * - X-Agent-User-Id: <agent_id>
 * 
 * @async
 * @param {Object} headers - Request headers object (case-insensitive)
 * @returns {Promise<boolean>} True if the request is valid and authenticated, false otherwise
 * 
 * @throws {AuthenticationError} If validation request to auth service fails
 * @throws {NetworkError} If network issues occur during validation
 * 
 * @example
 * // In Express.js route handler
 * app.post('/endpoint', async (req, res) => {
 *     if (!await validateA2ARequest(req.headers)) {
 *         return res.status(401).json({ error: 'Unauthorized' });
 *     }
 *     res.json({ message: 'Authenticated' });
 * });
 */
async function validateA2ARequest(headers) {
    const agentSecretToken = headers['x-agent-secret-token'];
    const agentUserId = headers['x-agent-user-id'];

    if (!agentSecretToken || !agentUserId) {
        return false;
    }

    return await getDefaultClient().validateToken(agentSecretToken, agentUserId);
}

/**
 * Express.js middleware for protecting endpoints with A2A authentication.
 * 
 * This middleware automatically validates incoming requests using the custom
 * header format (X-Agent-Secret-Token) and returns HTTP 401 if authentication
 * fails.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * 
 * @example
 * const express = require('express');
 * const { requireA2AAuth } = require('@traylinx/auth-client');
 * 
 * const app = express();
 * 
 * app.get('/protected', requireA2AAuth, (req, res) => {
 *     res.json({ message: 'This endpoint requires A2A authentication' });
 * });
 * 
 * @example
 * // Protect all routes under /api
 * app.use('/api', requireA2AAuth);
 */
function requireA2AAuth(req, res, next) {
    validateA2ARequest(req.headers)
        .then(isValid => {
            if (isValid) {
                next();
            } else {
                res.status(401).json({ error: 'Invalid or missing A2A authentication' });
            }
        })
        .catch(error => {
            console.error('Error in A2A auth middleware:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
}

/**
 * Make an authenticated A2A request to another agent.
 * 
 * This is the primary function for making authenticated requests to other
 * Traylinx agents. It automatically adds the required authentication headers
 * and handles the HTTP request using axios.
 * 
 * @async
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
 * @param {string} url - Target agent's URL (must be a valid HTTP/HTTPS URL)
 * @param {Object} [options={}] - Additional options passed to axios, such as:
 *   - json: JSON data to send in request body
 *   - data: Form data to send in request body
 *   - params: URL parameters
 *   - timeout: Request timeout in milliseconds
 *   - headers: Additional headers (merged with auth headers)
 * 
 * @returns {Promise<*>} Response data from the target agent
 * 
 * @throws {ValidationError} If client configuration is invalid
 * @throws {AuthenticationError} If token acquisition fails
 * @throws {NetworkError} If network issues occur
 * @throws {Error} If the HTTP request fails (4xx, 5xx status codes)
 * 
 * @example
 * // Simple GET request
 * const data = await makeA2ARequest('GET', 'https://other-agent.com/api/users');
 * 
 * @example
 * // POST request with JSON data
 * const result = await makeA2ARequest('POST', 'https://other-agent.com/api/process', {
 *     json: { items: ['item1', 'item2'] },
 *     timeout: 60000
 * });
 * 
 * @example
 * // PUT request with custom headers
 * const response = await makeA2ARequest('PUT', 'https://other-agent.com/api/update/123', {
 *     json: { status: 'completed' },
 *     headers: { 'X-Custom-Header': 'value' }
 * });
 */
async function makeA2ARequest(method, url, options = {}) {
    const axios = require('axios');
    const headers = await getAgentRequestHeaders();
    
    // Merge any additional headers
    if (options.headers) {
        Object.assign(headers, options.headers);
        delete options.headers;
    }
    
    const response = await axios.request({
        method,
        url,
        headers,
        ...options
    });
    
    return response.data;
}

// A2A Extension Functions

/**
 * Get A2A-compatible authentication headers using Bearer token format.
 * 
 * Returns headers in the standard A2A format using Bearer token authentication,
 * which is compatible with the broader A2A ecosystem.
 * 
 * @async
 * @returns {Promise<Object>} Headers object containing:
 *   - Authorization: Bearer <agent_secret_token>
 *   - X-Agent-User-Id: <agent_user_id>
 * 
 * @throws {ValidationError} If client configuration is invalid
 * @throws {AuthenticationError} If token acquisition fails
 * @throws {NetworkError} If network issues occur during token fetch
 * 
 * @example
 * const headers = await getA2ARequestHeaders();
 * const response = await axios.get('https://a2a-agent.com/api', { headers });
 */
async function getA2ARequestHeaders() {
    return await getDefaultClient().getA2AHeaders();
}

/**
 * Validate incoming requests supporting both Bearer tokens and custom headers.
 * 
 * This function provides dual-mode authentication validation, supporting both:
 * 1. A2A standard format: Authorization: Bearer {agent_secret_token}
 * 2. TraylinxAuth custom format: X-Agent-Secret-Token: {agent_secret_token}
 * 
 * The function tries Bearer token format first, then falls back to custom
 * headers for backward compatibility.
 * 
 * @async
 * @param {Object} headers - Request headers object (case-insensitive)
 * @returns {Promise<boolean>} True if authentication is valid using either format, false otherwise
 * 
 * @throws {AuthenticationError} If validation request to auth service fails
 * @throws {NetworkError} If network issues occur during validation
 * 
 * @example
 * // Works with Bearer token format
 * const headers1 = {
 *     'Authorization': 'Bearer agent-secret-token',
 *     'X-Agent-User-Id': 'agent-id'
 * };
 * const isValid = await validateDualAuthRequest(headers1);
 * 
 * @example
 * // Also works with custom header format
 * const headers2 = {
 *     'X-Agent-Secret-Token': 'agent-secret-token',
 *     'X-Agent-User-Id': 'agent-id'
 * };
 * const isValid = await validateDualAuthRequest(headers2);
 */
async function validateDualAuthRequest(headers) {
    return await getDefaultClient().validateA2ARequest(headers);
}

/**
 * Detect authentication mode from request headers.
 * 
 * Analyzes request headers to determine which authentication format is being used.
 * This is useful for logging, monitoring, and debugging authentication issues.
 * 
 * @param {Object} headers - Request headers object (case-insensitive)
 * @returns {string} Authentication mode detected:
 *   - 'bearer': Authorization header with Bearer token
 *   - 'custom': X-Agent-Secret-Token custom header
 *   - 'none': No authentication headers detected
 * 
 * @example
 * const headers = { 'Authorization': 'Bearer token123', 'X-Agent-User-Id': 'agent1' };
 * const mode = detectAuthMode(headers);
 * console.log(mode); // Output: 'bearer'
 * 
 * @example
 * const headers = { 'X-Agent-Secret-Token': 'token123', 'X-Agent-User-Id': 'agent1' };
 * const mode = detectAuthMode(headers);
 * console.log(mode); // Output: 'custom'
 */
function detectAuthMode(headers) {
    return getDefaultClient().detectAuthMode(headers);
}

/**
 * Enhanced Express.js middleware supporting both Bearer tokens and custom headers.
 * 
 * This middleware provides flexible authentication that accepts both A2A standard
 * Bearer token format and TraylinxAuth custom header format. It's useful for
 * endpoints that need to support multiple authentication methods during
 * migration periods.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * 
 * @example
 * app.post('/flexible-endpoint', requireDualAuth, (req, res) => {
 *     // This endpoint accepts both authentication formats:
 *     // 1. Authorization: Bearer {token}
 *     // 2. X-Agent-Secret-Token: {token}
 *     const authMode = req.authMode; // Added by middleware
 *     res.json({ authMode, message: 'Authenticated' });
 * });
 */
function requireDualAuth(req, res, next) {
    validateDualAuthRequest(req.headers)
        .then(isValid => {
            if (isValid) {
                // Add auth mode info to request for debugging
                req.authMode = detectAuthMode(req.headers);
                next();
            } else {
                res.status(401).json({ error: 'Invalid or missing authentication' });
            }
        })
        .catch(error => {
            console.error('Error in dual auth middleware:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
}

module.exports = {
    // Existing functions
    getRequestHeaders,
    getAgentRequestHeaders,
    validateA2ARequest,
    requireA2AAuth,
    makeA2ARequest,
    TraylinxAuthClient,
    // A2A Extension functions
    getA2ARequestHeaders,
    validateDualAuthRequest,
    detectAuthMode,
    requireDualAuth,
    // Configuration and validation
    validateConfig,
    validateParameter,
    // Error classes
    TraylinxAuthError,
    AuthenticationError,
    TokenExpiredError,
    NetworkError,
    ValidationError
};
