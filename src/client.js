const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
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
            timeout: options.timeout || 30000,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            cacheTokens: options.cacheTokens !== undefined ? options.cacheTokens : true,
            logLevel: options.logLevel || 'INFO'
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
        this.apiBaseUrl = this.config.apiBaseUrl;
        this.agentUserId = this.config.agentUserId;

        this.accessToken = null;
        this.agentSecretToken = null;
        this.tokenExpiration = null;
        
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
            maxRedirects: 5,
            maxContentLength: 50 * 1024 * 1024, // 50MB
            maxBodyLength: 50 * 1024 * 1024
        });

        // Add retry interceptor
        instance.interceptors.response.use(
            (response) => response, // Success case - return response as-is
            async (error) => {
                const config = error.config;
                
                // Initialize retry count if not present
                if (!config.__retryCount) {
                    config.__retryCount = 0;
                }

                // Check if we should retry
                const shouldRetry = this._shouldRetry(error, config);
                
                if (shouldRetry && config.__retryCount < this.config.maxRetries) {
                    config.__retryCount++;
                    
                    // Calculate delay with exponential backoff
                    const delay = this._calculateRetryDelay(config.__retryCount);
                    
                    // Wait before retrying
                    await this._sleep(delay);
                    
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
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                const errorMessage = responseData.message || responseData.error || statusText || 'Unknown error';
                throw new NetworkError(
                    `HTTP error (${status}) during ${context}: ${errorMessage}`,
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
            `Unexpected error during ${context}: ${error.message}`,
            'UNKNOWN_ERROR'
        );
    }

    async _fetchTokens() {
        try {
            const response = await this.axiosInstance.post(`${this.apiBaseUrl}/oauth/token`, new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'a2a',
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });

            const tokenData = response.data;
            
            // Validate token response structure
            const requiredFields = ['access_token', 'agent_secret_token', 'expires_in'];
            const missingFields = requiredFields.filter(field => !(field in tokenData));
            if (missingFields.length > 0) {
                throw new AuthenticationError(
                    `Invalid token response: missing fields ${missingFields.join(', ')}`,
                    'MALFORMED_TOKEN_RESPONSE',
                    200
                );
            }

            this.accessToken = tokenData.access_token;
            this.agentSecretToken = tokenData.agent_secret_token;
            this.tokenExpiration = Date.now() + (tokenData.expires_in * 1000);
            
        } catch (error) {
            if (error instanceof TraylinxAuthError) {
                throw error; // Re-throw our custom errors
            }
            this._handleRequestError(error, 'token fetch');
        }
    }

    async getAccessToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiration) {
            await this._fetchTokens();
        }
        
        if (!this.accessToken) {
            throw new TokenExpiredError(
                'Access token is not available. Token fetch may have failed.',
                'TOKEN_UNAVAILABLE',
                401
            );
        }
        
        return this.accessToken;
    }

    async getAgentSecretToken() {
        if (!this.agentSecretToken || Date.now() >= this.tokenExpiration) {
            await this._fetchTokens();
        }
        
        if (!this.agentSecretToken) {
            throw new TokenExpiredError(
                'Agent secret token is not available. Token fetch may have failed.',
                'TOKEN_UNAVAILABLE',
                401
            );
        }
        
        return this.agentSecretToken;
    }

    async getRequestHeaders() {
        // Get headers for calling the auth service (includes access_token)
        const accessToken = await this.getAccessToken();
        const agentSecretToken = await this.getAgentSecretToken();

        return {
            'Authorization': `Bearer ${accessToken}`,
            'X-Agent-Secret-Token': agentSecretToken,
            'X-Agent-User-Id': this.agentUserId,
        };
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
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.axiosInstance.post(
                `${this.apiBaseUrl}/oauth/agent/introspect`,
                new URLSearchParams({
                    agent_secret_token: agentSecretToken,
                    agent_user_id: agentUserId,
                }),
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            );

            if (response.status === 200) {
                try {
                    return response.data.active === true;
                } catch (parseError) {
                    throw new AuthenticationError(
                        `Failed to parse token validation response: ${parseError.message}`,
                        'INVALID_VALIDATION_RESPONSE',
                        200
                    );
                }
            } else if (response.status === 401) {
                // Invalid access token used for validation
                throw new AuthenticationError(
                    'Access token invalid for token validation',
                    'INVALID_ACCESS_TOKEN',
                    401
                );
            }
            
            return false;
            
        } catch (error) {
            if (error instanceof TraylinxAuthError) {
                throw error; // Re-throw our custom errors
            }
            this._handleRequestError(error, 'token validation');
        }
    }

    async rpcCall(method, params, rpcUrl = null, includeAgentCredentials = null) {
        rpcUrl = rpcUrl || `${this.apiBaseUrl}/a2a/rpc`;
        
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
                    const errorMessage = errorInfo.message || 'RPC call failed';
                    
                    if (errorCode === -32600) { // Invalid Request
                        throw new ValidationError(
                            `Invalid RPC request: ${errorMessage}`,
                            'INVALID_RPC_REQUEST',
                            400
                        );
                    } else if (errorCode === -32601) { // Method not found
                        throw new ValidationError(
                            `RPC method '${method}' not found: ${errorMessage}`,
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
                            `RPC error (${errorCode}): ${errorMessage}`,
                            String(errorCode),
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
                    `Failed to parse RPC response: ${parseError.message}`,
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
        /**
         * Validate A2A request supporting both Bearer tokens and custom headers.
         * 
         * This method provides dual-mode validation:
         * 1. Bearer token format: Authorization: Bearer {token}
         * 2. Custom header format: X-Agent-Secret-Token: {token}
         * 
         * @param {Object} headers - Request headers object (case-insensitive)
         * @returns {Promise<boolean>} True if authentication is valid
         */
        // Normalize headers to lowercase for case-insensitive lookup
        const normalizedHeaders = {};
        Object.keys(headers).forEach(key => {
            normalizedHeaders[key.toLowerCase()] = headers[key];
        });

        // Try Bearer token format first (A2A standard)
        const authHeader = normalizedHeaders.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            const agentId = normalizedHeaders['x-agent-user-id'];
            if (token && agentId) {
                return await this.validateToken(token, agentId);
            }
        }

        // Fall back to custom header format (backward compatibility)
        const customToken = normalizedHeaders['x-agent-secret-token'];
        const agentId = normalizedHeaders['x-agent-user-id'];
        if (customToken && agentId) {
            return await this.validateToken(customToken, agentId);
        }

        return false;
    }

    detectAuthMode(headers) {
        /**
         * Detect authentication mode from request headers.
         * 
         * @param {Object} headers - Request headers object
         * @returns {string} 'bearer' for Bearer token, 'custom' for custom headers, 'none' if no auth
         */
        const normalizedHeaders = {};
        Object.keys(headers).forEach(key => {
            normalizedHeaders[key.toLowerCase()] = headers[key];
        });

        if ((normalizedHeaders.authorization || '').startsWith('Bearer ')) {
            return 'bearer';
        } else if (normalizedHeaders['x-agent-secret-token']) {
            return 'custom';
        } else {
            return 'none';
        }
    }
}

module.exports = TraylinxAuthClient;
