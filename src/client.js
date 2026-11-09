const axios = require('axios');
const { randomUUID: uuidv4 } = require('node:crypto');
const { deadlineSignal, destination, credential, credentialsFrom, tokenState, validIntrospection, MAX_RESPONSE, AUTH_RESPONSE } = require('./security');
const { validateConfig } = require('./validation');
const {
    TraylinxAuthError,
    AuthenticationError,
    TokenExpiredError,
    NetworkError,
    ValidationError
} = require('./errors');

class TraylinxAuthClient {
    constructor(clientId, clientSecret, apiBaseUrl, agentUserId, options = {}) {
        /**
         * Initialize TraylinxAuthClient with comprehensive input validation.
         *
         * @param {string} clientId - OAuth client ID (or set TRAYLINX_CLIENT_ID env var)
         * @param {string} clientSecret - OAuth client secret (or set TRAYLINX_CLIENT_SECRET env var)
         * @param {string} apiBaseUrl - Base URL for Traylinx API (or set TRAYLINX_API_BASE_URL env var)
         * @param {string} agentUserId - Agent user UUID (or set TRAYLINX_AGENT_USER_ID env var)
         * @param {Object} options - Additional configuration options
         * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
         * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
         * @param {number} options.retryDelay - Base delay between retries in milliseconds (default: 1000)
         * @param {boolean} options.cacheTokens - Whether to cache tokens (default: true)
         * @param {string} options.logLevel - Logging level (default: "INFO")
         *
         * @throws {Error} If any configuration parameter is invalid
         */

        // Prepare configuration object
        const configParams = {
            clientId: clientId || process.env.TRAYLINX_CLIENT_ID,
            clientSecret: clientSecret || process.env.TRAYLINX_CLIENT_SECRET,
            apiBaseUrl: apiBaseUrl || process.env.TRAYLINX_API_BASE_URL,
            agentUserId: agentUserId || process.env.TRAYLINX_AGENT_USER_ID,
            timeout: options.timeout ?? 30000,
            maxRetries: options.maxRetries ?? 3,
            retryDelay: options.retryDelay ?? 1000,
            cacheTokens: options.cacheTokens !== undefined ? options.cacheTokens : true,
            logLevel: options.logLevel || 'INFO',
            agentTokenTtlSeconds: options.agentTokenTtlSeconds ?? null,
            refreshSkewSeconds: options.refreshSkewSeconds ?? 30
        };

        // Validate configuration
        try {
            this.config = validateConfig(configParams);
        } catch (error) {
            // Convert validation errors to our custom ValidationError
            // The validateConfig function already formats Joi errors properly
            throw new ValidationError(
                error.message,
                'CONFIG_VALIDATION_ERROR',
                400
            );
        }

        // Set instance attributes from validated config
        this.clientId = this.config.clientId;
        this.clientSecret = this.config.clientSecret;
        // Normalize apiBaseUrl by removing trailing slash to prevent double slashes
        this.apiBaseUrl = this.config.apiBaseUrl.replace(/\/+$/, '');
        this.agentUserId = this.config.agentUserId;

        this.accessToken = null;
        this.agentSecretToken = null;
        this.tokenExpiration = null;
        this.agentTokenExpiration = 0;
        this._fetchPromise = null;

        // Initialize axios instance with retry configuration
        this.axiosInstance = this._createAxiosInstanceWithRetries();
    }

    /**
     * Create an axios instance with retry configuration and connection management.
     *
     * @returns {Object} Configured axios instance with retry logic
     */
    _createAxiosInstanceWithRetries() {
        const instance = axios.create({
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'TraylinxAuthClient-JS/1.0.0'
            },
            // Connection management
            maxRedirects: 0,
            maxContentLength: MAX_RESPONSE, // 4 MiB
            maxBodyLength: MAX_RESPONSE
        });

        // One deadline across safe read retries; no redirect may carry credentials.
        instance.interceptors.request?.use(config => {
            destination(config.url);
            config.maxRedirects = 0;
            config.__deadline ??= Date.now() + (config.timeout || this.config.timeout);
            if (!Object.hasOwn(config, '__callerSignal')) config.__callerSignal = config.signal || null;
            const bound = deadlineSignal(Math.max(1, config.__deadline - Date.now()), config.__callerSignal);
            config.signal = bound.signal;
            config.__cleanupDeadline = bound.cleanup;
            return config;
        });
        // Add retry interceptor
        instance.interceptors.response.use(
            (response) => { response.config?.__cleanupDeadline?.(); return response; },
            async (error) => {
                const config = error.config;
                config?.__cleanupDeadline?.();
                if (!config || config.signal?.aborted) return Promise.reject(error);

                // Initialize retry count if not present
                if (!config.__retryCount) {
                    config.__retryCount = 0;
                }

                // Check if we should retry
                const shouldRetry = this._shouldRetry(error, config);

                if (shouldRetry && config.__retryCount < this.config.maxRetries) {
                    config.__retryCount++;

                    // Calculate delay with exponential backoff
                    const header = error.response?.headers?.['retry-after'];
                    const after = header == null ? 0 : (/^\d+(?:\.\d+)?$/.test(header) ? Number(header)*1000 : Date.parse(header)-Date.now());
                    const delay = Math.max(this._calculateRetryDelay(config.__retryCount), Number.isFinite(after) ? Math.max(0, after) : 0);
                    const remaining = (config.__deadline ?? Date.now()) - Date.now();
                    if (remaining <= delay) return Promise.reject(error);

                    // Wait before retrying
                    await this._sleep(delay, config.__callerSignal || config.signal);
                    config.timeout = Math.max(1, config.__deadline - Date.now());

                    // Retry the request
                    return instance(config);
                }

                // No more retries or shouldn't retry - reject with original error
                return Promise.reject(error);
            }
        );

        return instance;
    }

    /**
     * Determine if a request should be retried based on error type and configuration.
     *
     * @param {Error} error - The error that occurred
     * @param {Object} config - The request configuration
     * @returns {boolean} True if the request should be retried
     */
    _shouldRetry(error, config) {
        if (!['GET', 'HEAD'].includes(String(config?.method || '').toUpperCase()) || config?.signal?.aborted) return false;
        // Don't retry if retries are disabled
        if (this.config.maxRetries === 0) {
            return false;
        }

        // Don't retry if this is not a network or server error
        if (!error.response && !error.code) {
            return false;
        }

        // Retry on network errors
        if (error.code && ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) {
            return true;
        }

        // Retry on specific HTTP status codes
        if (error.response) {
            const status = error.response.status;
            const retryableStatuses = [429, 500, 502, 503, 504];
            return retryableStatuses.includes(status);
        }

        return false;
    }

    /**
     * Calculate retry delay with exponential backoff.
     *
     * @param {number} retryCount - Current retry attempt number (1-based)
     * @returns {number} Delay in milliseconds
     */
    _calculateRetryDelay(retryCount) {
        // Exponential backoff: baseDelay * (2 ^ (retryCount - 1))
        // Add jitter to prevent thundering herd
        const baseDelay = this.config.retryDelay;
        const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
        const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter

        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    /**
     * Sleep for the specified number of milliseconds.
     *
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after the delay
     */
    _sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new NetworkError('Request cancelled', 'CANCELLED'));
            const onAbort = () => { clearTimeout(timer); reject(new NetworkError('Request cancelled', 'CANCELLED')); };
            const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
            signal?.addEventListener('abort', onAbort, { once: true });
        });
    }

    /**
     * Handle and convert axios errors to custom error classes.
     *
     * @param {Error} error - The original axios error
     * @param {string} context - Description of what operation was being performed
     * @throws {NetworkError|AuthenticationError|TraylinxAuthError}
     */
    _handleRequestError(error, context = 'request') {
        // Handle axios-specific errors
        if (error.code === 'ERR_CANCELED') throw new NetworkError('Request cancelled or deadline exceeded', 'CANCELLED');
        if (error.code === 'ECONNABORTED') {
            throw new NetworkError(
                `Request timeout during ${context}. Check network connectivity and consider increasing timeout.`,
                'TIMEOUT',
                408
            );
        } else if (error.code === 'ENOTFOUND') {
            throw new NetworkError(
                `DNS resolution failed during ${context}. Check the API URL and network connectivity.`,
                'DNS_ERROR',
                0
            );
        } else if (error.code === 'ECONNREFUSED') {
            throw new NetworkError(
                `Connection refused during ${context}. The service may be down or unreachable.`,
                'CONNECTION_REFUSED',
                0
            );
        } else if (error.code === 'ECONNRESET') {
            throw new NetworkError(
                `Connection reset during ${context}. Network connection was interrupted.`,
                'CONNECTION_RESET',
                0
            );
        }

        // Handle HTTP response errors
        if (error.response) {
            const status = error.response.status;
            const statusText = error.response.statusText || '';
            const responseData = error.response.data || {};

            if (status === 401) {
                throw new AuthenticationError(
                    `Authentication failed during ${context}. Check client credentials.`,
                    'INVALID_CREDENTIALS',
                    401
                );
            } else if (status === 429) {
                throw new NetworkError(
                    `Rate limit exceeded during ${context}. Please retry after some time.`,
                    'RATE_LIMIT',
                    429
                );
            } else if (status >= 500 && status < 600) {
                throw new NetworkError(
                    `Server error (${status}) during ${context}. The service may be temporarily unavailable.`,
                    'SERVER_ERROR',
                    status
                );
            } else {
                throw new NetworkError(
                    `HTTP error (${status}) during ${context}`,
                    'HTTP_ERROR',
                    status
                );
            }
        }

        // Handle request setup errors
        if (error.request) {
            throw new NetworkError(
                `Network request failed during ${context}. No response received from server.`,
                'NO_RESPONSE',
                0
            );
        }

        // Handle other errors
        throw new TraylinxAuthError(
            `Unexpected error during ${context}`,
            'UNKNOWN_ERROR'
        );
    }

    async _fetchTokens() {
        if (this._fetchPromise) return this._fetchPromise;
        const pending = (async () => {
            const started = Date.now();
            try {
                destination(this.apiBaseUrl, true);
                const response = await this.axiosInstance.post(`${this.apiBaseUrl}/oauth/token`, new URLSearchParams({
                    grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret, scope: 'a2a'
                }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, maxContentLength: AUTH_RESPONSE });
                const pair = tokenState(response.data, started, this.config.agentTokenTtlSeconds, this.config.refreshSkewSeconds);
                Object.assign(this, pair);
                return pair;
            } catch (error) {
                this.accessToken = this.agentSecretToken = null;
                this.tokenExpiration = this.agentTokenExpiration = 0;
                if (error instanceof TraylinxAuthError) throw error;
                this._handleRequestError(error, 'token fetch');
            }
        })();
        this._fetchPromise = pending;
        try { return await pending; } finally { if (this._fetchPromise === pending) this._fetchPromise = null; }
    }

    async getAccessToken() {
        if (!this.config.cacheTokens || !this.accessToken || Date.now() >= this.tokenExpiration) return (await this._fetchTokens()).accessToken;
        return this.accessToken;
    }

    async getAgentSecretToken() {
        if (!this.config.cacheTokens || !this.agentSecretToken || Date.now() >= this.agentTokenExpiration) return (await this._fetchTokens()).agentSecretToken;
        return this.agentSecretToken;
    }

    async getRequestHeaders() {
        // Obtain a coherent pair, including when caching is disabled/TTL unknown.
        let pair = this;
        if (!this.config.cacheTokens || !this.accessToken || !this.agentSecretToken || Date.now() >= Math.min(this.tokenExpiration, this.agentTokenExpiration)) pair = await this._fetchTokens();
        return { Authorization: `Bearer ${pair.accessToken}`, 'X-Agent-Secret-Token': pair.agentSecretToken, 'X-Agent-User-Id': this.agentUserId };
    }

    async getAgentRequestHeaders() {
        // Get headers for calling other agents (ONLY agent_secret_token, NO access_token)
        const agentSecretToken = await this.getAgentSecretToken();

        return {
            'X-Agent-Secret-Token': agentSecretToken,
            'X-Agent-User-Id': this.agentUserId,
        };
    }

    async validateToken(agentSecretToken, agentUserId) {
        return (await this.introspectToken(agentSecretToken, agentUserId)).active;
    }

    async introspectToken(agentSecretToken, agentUserId) {
        if (!credential(agentSecretToken) || !credential(agentUserId) || agentUserId.length > 256) return { active: false };
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.axiosInstance.post(`${this.apiBaseUrl}/oauth/agent/introspect`, new URLSearchParams({
                agent_secret_token: agentSecretToken, agent_user_id: agentUserId
            }), { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' }, maxContentLength: AUTH_RESPONSE });
            if (response.status === 401) throw new AuthenticationError('Access token invalid for token validation', 'INVALID_CREDENTIALS', 401);
            if (response.status && response.status !== 200) return { active:false };
            const d = response.data;
            if (!validIntrospection(d, agentUserId)) return { active: false };
            return { active: true, agent_id: d.agent_id, scopes: d.scopes, expires_at: d.expires_at, agent_type: d.agent_type };
        } catch (error) {
            if (error.response?.status === 400) return { active: false };
            if (error instanceof TraylinxAuthError) throw error;
            this._handleRequestError(error, 'token validation');
        }
    }

    async rpcCall(method, params, rpcUrl = null, includeAgentCredentials = null) {
        rpcUrl = rpcUrl || `${this.apiBaseUrl}/a2a/rpc`;
        const target = destination(rpcUrl);
        if (includeAgentCredentials === false && target.origin !== destination(this.apiBaseUrl).origin) throw new ValidationError('Access token may only be sent to Sentinel', 'UNSAFE_DESTINATION');

        // Auto-detect: if calling auth service (default), only use access_token
        // If calling another agent, use ONLY agent_secret_token (NO access_token!)
        if (includeAgentCredentials === null) {
            includeAgentCredentials = rpcUrl !== `${this.apiBaseUrl}/a2a/rpc`;
        }

        const payload = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: uuidv4(),
        };

        let headers = {
            'Content-Type': 'application/json',
        };

        if (includeAgentCredentials) {
            // When calling other agents: use ONLY agent_secret_token
            const agentSecretToken = await this.getAgentSecretToken();
            headers['X-Agent-Secret-Token'] = agentSecretToken;
            headers['X-Agent-User-Id'] = this.agentUserId;
        } else {
            // When calling auth service: use access_token
            const accessToken = await this.getAccessToken();
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        try {
            const response = await this.axiosInstance.post(rpcUrl, payload, {
                headers
            });

            try {
                const result = response.data;

                // Check for JSON-RPC error response
                if (result.error) {
                    const errorInfo = result.error;
                    const errorCode = errorInfo.code || 'RPC_ERROR';
                    const errorMessage = 'RPC call failed';

                    if (errorCode === -32600) { // Invalid Request
                        throw new ValidationError(
                            `Invalid RPC request: ${errorMessage}`,
                            'INVALID_RPC_REQUEST',
                            400
                        );
                    } else if (errorCode === -32601) { // Method not found
                        throw new ValidationError(
                            `RPC method not found: ${errorMessage}`,
                            'METHOD_NOT_FOUND',
                            404
                        );
                    } else if (errorCode === -32602) { // Invalid params
                        throw new ValidationError(
                            `Invalid RPC parameters: ${errorMessage}`,
                            'INVALID_RPC_PARAMS',
                            400
                        );
                    } else {
                        throw new TraylinxAuthError(
                            errorMessage,
                            'RPC_ERROR',
                            500
                        );
                    }
                }

                return result;

            } catch (parseError) {
                if (parseError instanceof TraylinxAuthError) {
                    throw parseError; // Re-throw our custom errors
                }
                throw new TraylinxAuthError(
                    'Invalid RPC response',
                    'INVALID_RPC_RESPONSE',
                    200
                );
            }

        } catch (error) {
            if (error instanceof TraylinxAuthError) {
                throw error; // Re-throw our custom errors
            }
            this._handleRequestError(error, `RPC call to ${method}`);
        }
    }

    async rpcIntrospectToken(agentSecretToken, agentUserId) {
        const params = {
            agent_secret_token: agentSecretToken,
            agent_user_id: agentUserId,
        };
        return await this.rpcCall('introspect_token', params);
    }

    async rpcGetCapabilities() {
        return await this.rpcCall('get_capabilities', {});
    }

    async rpcHealthCheck() {
        return await this.rpcCall('health_check', {});
    }

    // A2A Extension Methods
    async getA2AHeaders() {
        /**
         * Get A2A-compatible authentication headers using Bearer token format.
         *
         * Returns headers in A2A-compliant format:
         * - Authorization: Bearer {agent_secret_token}
         * - X-Agent-User-Id: {agent_user_id}
         *
         * @returns {Promise<Object>} A2A-compatible authentication headers
         */
        const agentSecretToken = await this.getAgentSecretToken();
        return {
            'Authorization': `Bearer ${agentSecretToken}`,
            'X-Agent-User-Id': this.agentUserId,
        };
    }

    async validateA2ARequest(headers) {
        const auth = credentialsFrom(headers);
        return auth ? this.validateToken(auth.token, auth.id) : false;
    }

    detectAuthMode(headers) {
        return credentialsFrom(headers)?.mode || 'none';
    }
}

module.exports = TraylinxAuthClient;
