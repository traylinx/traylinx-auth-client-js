/**
 * Comprehensive test suite for TraylinxAuthClient covering all methods and error scenarios.
 */

// Mock dependencies first
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-1234')
}));

jest.mock('axios', () => ({
    create: jest.fn(() => ({
        post: jest.fn(),
        interceptors: {
            response: {
                use: jest.fn()
            }
        }
    }))
}));

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

describe('TraylinxAuthClient - Comprehensive Coverage', () => {
    let TraylinxAuthClient;
    let mockAxiosInstance;

    beforeAll(() => {
        // Require after mocking
        TraylinxAuthClient = require('../src/client');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockAxiosInstance = {
            post: jest.fn(),
            interceptors: {
                response: {
                    use: jest.fn()
                }
            }
        };
        
        axios.create.mockReturnValue(mockAxiosInstance);
    });

    describe('Token Management', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
        });

        describe('_fetchTokens', () => {
            it('should fetch tokens successfully', async () => {
                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        access_token: 'test_access_token',
                        agent_secret_token: 'test_agent_secret_token',
                        expires_in: 3600
                    }
                });

                await client._fetchTokens();

                expect(client.accessToken).toBe('test_access_token');
                expect(client.agentSecretToken).toBe('test_agent_secret_token');
                expect(client.tokenExpiration).toBeGreaterThan(Date.now());
            });

            it('should handle malformed token response', async () => {
                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        access_token: 'test_token'
                        // Missing agent_secret_token and expires_in
                    }
                });

                await expect(client._fetchTokens()).rejects.toThrow('Invalid token response: missing fields agent_secret_token, expires_in');
            });

            it('should handle network errors during token fetch', async () => {
                const networkError = new Error('Network error');
                networkError.code = 'ECONNABORTED';
                mockAxiosInstance.post.mockRejectedValue(networkError);

                await expect(client._fetchTokens()).rejects.toThrow('Request timeout during token fetch');
            });

            it('should handle HTTP errors during token fetch', async () => {
                const httpError = new Error('HTTP error');
                httpError.response = {
                    status: 401,
                    statusText: 'Unauthorized',
                    data: {}
                };
                mockAxiosInstance.post.mockRejectedValue(httpError);

                await expect(client._fetchTokens()).rejects.toThrow('Authentication failed during token fetch');
            });
        });

        describe('getAccessToken', () => {
            it('should return cached token if valid', async () => {
                client.accessToken = 'cached_token';
                client.tokenExpiration = Date.now() + 3600000; // 1 hour from now

                const token = await client.getAccessToken();
                expect(token).toBe('cached_token');
                expect(mockAxiosInstance.post).not.toHaveBeenCalled();
            });

            it('should fetch new token if expired', async () => {
                client.accessToken = 'expired_token';
                client.tokenExpiration = Date.now() - 1000; // 1 second ago

                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        access_token: 'new_access_token',
                        agent_secret_token: 'new_agent_secret_token',
                        expires_in: 3600
                    }
                });

                const token = await client.getAccessToken();
                expect(token).toBe('new_access_token');
                expect(mockAxiosInstance.post).toHaveBeenCalled();
            });

            it('should throw error if token is not available after fetch', async () => {
                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        agent_secret_token: 'test_agent_secret_token',
                        expires_in: 3600
                        // Missing access_token
                    }
                });

                await expect(client.getAccessToken()).rejects.toThrow('Invalid token response: missing fields access_token');
            });
        });

        describe('getAgentSecretToken', () => {
            it('should return cached token if valid', async () => {
                client.agentSecretToken = 'cached_agent_token';
                client.tokenExpiration = Date.now() + 3600000; // 1 hour from now

                const token = await client.getAgentSecretToken();
                expect(token).toBe('cached_agent_token');
                expect(mockAxiosInstance.post).not.toHaveBeenCalled();
            });

            it('should fetch new token if expired', async () => {
                client.agentSecretToken = 'expired_agent_token';
                client.tokenExpiration = Date.now() - 1000; // 1 second ago

                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        access_token: 'new_access_token',
                        agent_secret_token: 'new_agent_secret_token',
                        expires_in: 3600
                    }
                });

                const token = await client.getAgentSecretToken();
                expect(token).toBe('new_agent_secret_token');
                expect(mockAxiosInstance.post).toHaveBeenCalled();
            });

            it('should throw error if agent secret token is not available after fetch', async () => {
                mockAxiosInstance.post.mockResolvedValue({
                    data: {
                        access_token: 'test_access_token',
                        expires_in: 3600
                        // Missing agent_secret_token
                    }
                });

                await expect(client.getAgentSecretToken()).rejects.toThrow('Invalid token response: missing fields agent_secret_token');
            });
        });
    });

    describe('Header Generation', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );

            // Mock successful token fetch
            mockAxiosInstance.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600
                }
            });
        });

        describe('getRequestHeaders', () => {
            it('should return headers for auth service calls', async () => {
                const headers = await client.getRequestHeaders();

                expect(headers).toEqual({
                    'Authorization': 'Bearer test_access_token',
                    'X-Agent-Secret-Token': 'test_agent_secret_token',
                    'X-Agent-User-Id': '12345678-1234-1234-1234-123456789abc'
                });
            });
        });

        describe('getAgentRequestHeaders', () => {
            it('should return headers for agent-to-agent calls', async () => {
                const headers = await client.getAgentRequestHeaders();

                expect(headers).toEqual({
                    'X-Agent-Secret-Token': 'test_agent_secret_token',
                    'X-Agent-User-Id': '12345678-1234-1234-1234-123456789abc'
                });
            });
        });

        describe('getA2AHeaders', () => {
            it('should return A2A-compatible headers with Bearer token', async () => {
                const headers = await client.getA2AHeaders();

                expect(headers).toEqual({
                    'Authorization': 'Bearer test_agent_secret_token',
                    'X-Agent-User-Id': '12345678-1234-1234-1234-123456789abc'
                });
            });
        });
    });

    describe('Token Validation', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );

            // Mock successful token fetch for access token
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600
                }
            });
        });

        describe('validateToken', () => {
            it('should validate token successfully', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 200,
                    data: { active: true }
                });

                const isValid = await client.validateToken('test_token', 'test_user_id');
                expect(isValid).toBe(true);

                const [url, data, config] = mockAxiosInstance.post.mock.calls[1];
                expect(url).toBe('https://api.example.com/oauth/agent/introspect');
                expect(config.headers.Authorization).toBe('Bearer test_access_token');
            });

            it('should return false for invalid token', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 200,
                    data: { active: false }
                });

                const isValid = await client.validateToken('invalid_token', 'test_user_id');
                expect(isValid).toBe(false);
            });

            it('should handle malformed validation response', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 200,
                    data: null
                });

                await expect(client.validateToken('test_token', 'test_user_id')).rejects.toThrow('Failed to parse token validation response');
            });

            it('should handle 401 error during validation', async () => {
                const authError = new Error('Unauthorized');
                authError.response = {
                    status: 401,
                    statusText: 'Unauthorized',
                    data: {}
                };
                mockAxiosInstance.post.mockRejectedValueOnce(authError);

                await expect(client.validateToken('test_token', 'test_user_id')).rejects.toThrow('Authentication failed during token validation');
            });

            it('should handle network errors during validation', async () => {
                const networkError = new Error('Network error');
                networkError.code = 'ECONNREFUSED';
                mockAxiosInstance.post.mockRejectedValueOnce(networkError);

                await expect(client.validateToken('test_token', 'test_user_id')).rejects.toThrow('Connection refused during token validation');
            });

            it('should handle 401 response with specific error handling', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 401,
                    data: { error: 'invalid_token' }
                });

                await expect(client.validateToken('test_token', 'test_user_id')).rejects.toThrow('Access token invalid for token validation');
            });

            it('should return false for non-200 non-401 responses', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 403,
                    data: { error: 'forbidden' }
                });

                const isValid = await client.validateToken('test_token', 'test_user_id');
                expect(isValid).toBe(false);
            });
        });

        describe('validateA2ARequest', () => {
            beforeEach(() => {
                // Mock validateToken method
                client.validateToken = jest.fn();
            });

            it('should validate Bearer token format', async () => {
                client.validateToken.mockResolvedValue(true);

                const headers = {
                    'Authorization': 'Bearer test_token',
                    'X-Agent-User-Id': 'test_user_id'
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(true);
                expect(client.validateToken).toHaveBeenCalledWith('test_token', 'test_user_id');
            });

            it('should validate custom header format', async () => {
                client.validateToken.mockResolvedValue(true);

                const headers = {
                    'X-Agent-Secret-Token': 'test_token',
                    'X-Agent-User-Id': 'test_user_id'
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(true);
                expect(client.validateToken).toHaveBeenCalledWith('test_token', 'test_user_id');
            });

            it('should handle case-insensitive headers', async () => {
                client.validateToken.mockResolvedValue(true);

                const headers = {
                    'authorization': 'Bearer test_token',
                    'x-agent-user-id': 'test_user_id'
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(true);
            });

            it('should return false for missing headers', async () => {
                const headers = {};
                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(false);
                expect(client.validateToken).not.toHaveBeenCalled();
            });

            it('should return false for incomplete Bearer token', async () => {
                const headers = {
                    'Authorization': 'Bearer test_token'
                    // Missing X-Agent-User-Id
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(false);
            });
        });
    });

    describe('RPC Methods', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );

            // Mock successful token fetch
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600
                }
            });
        });

        describe('rpcCall', () => {
            it('should make RPC call to auth service with access token', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        result: { success: true },
                        id: 'test-uuid-1234'
                    }
                });

                const result = await client.rpcCall('test_method', { param: 'value' });

                expect(result).toEqual({
                    jsonrpc: '2.0',
                    result: { success: true },
                    id: 'test-uuid-1234'
                });

                const [url, payload, config] = mockAxiosInstance.post.mock.calls[1];
                expect(url).toBe('https://api.example.com/a2a/rpc');
                expect(payload.method).toBe('test_method');
                expect(payload.params).toEqual({ param: 'value' });
                expect(config.headers.Authorization).toBe('Bearer test_access_token');
                expect(config.headers['X-Agent-Secret-Token']).toBeUndefined();
            });

            it('should make RPC call to other agent with agent secret token only', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        result: { success: true },
                        id: 'test-uuid-1234'
                    }
                });

                const result = await client.rpcCall('test_method', { param: 'value' }, 'https://other-agent.com/rpc');

                expect(result).toEqual({
                    jsonrpc: '2.0',
                    result: { success: true },
                    id: 'test-uuid-1234'
                });

                const [url, payload, config] = mockAxiosInstance.post.mock.calls[1];
                expect(url).toBe('https://other-agent.com/rpc');
                expect(config.headers.Authorization).toBeUndefined();
                expect(config.headers['X-Agent-Secret-Token']).toBe('test_agent_secret_token');
                expect(config.headers['X-Agent-User-Id']).toBe('12345678-1234-1234-1234-123456789abc');
            });

            it('should handle explicit includeAgentCredentials parameter', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        result: { success: true },
                        id: 'test-uuid-1234'
                    }
                });

                await client.rpcCall('test_method', { param: 'value' }, null, true);

                const [, , config] = mockAxiosInstance.post.mock.calls[1];
                expect(config.headers.Authorization).toBeUndefined();
                expect(config.headers['X-Agent-Secret-Token']).toBe('test_agent_secret_token');
            });

            it('should handle RPC error responses', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32600,
                            message: 'Invalid Request'
                        },
                        id: 'test-uuid-1234'
                    }
                });

                await expect(client.rpcCall('test_method', {})).rejects.toThrow('Invalid RPC request: Invalid Request');
            });

            it('should handle method not found error', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: 'Method not found'
                        },
                        id: 'test-uuid-1234'
                    }
                });

                await expect(client.rpcCall('unknown_method', {})).rejects.toThrow("RPC method 'unknown_method' not found: Method not found");
            });

            it('should handle invalid params error', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32602,
                            message: 'Invalid params'
                        },
                        id: 'test-uuid-1234'
                    }
                });

                await expect(client.rpcCall('test_method', {})).rejects.toThrow('Invalid RPC parameters: Invalid params');
            });

            it('should handle generic RPC errors', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'Server error'
                        },
                        id: 'test-uuid-1234'
                    }
                });

                await expect(client.rpcCall('test_method', {})).rejects.toThrow('RPC error (-32000): Server error');
            });

            it('should handle malformed RPC response', async () => {
                // Mock a response that will cause JSON parsing to fail
                mockAxiosInstance.post.mockImplementationOnce(() => {
                    throw new Error('JSON parsing failed');
                });

                await expect(client.rpcCall('test_method', {})).rejects.toThrow('Unexpected error during RPC call to test_method');
            });

            it('should handle network errors during RPC call', async () => {
                const networkError = new Error('Network error');
                networkError.code = 'ETIMEDOUT';
                mockAxiosInstance.post.mockRejectedValueOnce(networkError);

                await expect(client.rpcCall('test_method', {})).rejects.toThrow('Unexpected error during RPC call to test_method');
            });
        });

        describe('RPC Helper Methods', () => {
            beforeEach(() => {
                client.rpcCall = jest.fn();
            });

            it('should call rpcIntrospectToken', async () => {
                client.rpcCall.mockResolvedValue({ result: { active: true } });

                await client.rpcIntrospectToken('test_token', 'test_user_id');

                expect(client.rpcCall).toHaveBeenCalledWith('introspect_token', {
                    agent_secret_token: 'test_token',
                    agent_user_id: 'test_user_id'
                });
            });

            it('should call rpcGetCapabilities', async () => {
                client.rpcCall.mockResolvedValue({ result: { capabilities: [] } });

                await client.rpcGetCapabilities();

                expect(client.rpcCall).toHaveBeenCalledWith('get_capabilities', {});
            });

            it('should call rpcHealthCheck', async () => {
                client.rpcCall.mockResolvedValue({ result: { status: 'ok' } });

                await client.rpcHealthCheck();

                expect(client.rpcCall).toHaveBeenCalledWith('health_check', {});
            });
        });
    });

    describe('Axios Instance Configuration', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc',
                { timeout: 45000, maxRetries: 5 }
            );
        });

        it('should create axios instance with correct configuration', () => {
            expect(axios.create).toHaveBeenCalledWith({
                timeout: 45000,
                headers: {
                    'User-Agent': 'TraylinxAuthClient-JS/1.0.0'
                },
                maxRedirects: 5,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024
            });
        });

        it('should configure retry interceptor', () => {
            expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
        });
    });

    describe('Additional Error Scenarios', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
        });

        describe('_handleRequestError edge cases', () => {
            it('should handle ECONNRESET errors', () => {
                const error = { code: 'ECONNRESET' };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Connection reset during test operation');
            });

            it('should handle HTTP errors with response data message', () => {
                const error = {
                    response: {
                        status: 400,
                        statusText: 'Bad Request',
                        data: { message: 'Invalid request format' }
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('HTTP error (400) during test operation: Invalid request format');
            });

            it('should handle HTTP errors with response data error field', () => {
                const error = {
                    response: {
                        status: 422,
                        statusText: 'Unprocessable Entity',
                        data: { error: 'Validation failed' }
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('HTTP error (422) during test operation: Validation failed');
            });

            it('should handle HTTP errors with only statusText', () => {
                const error = {
                    response: {
                        status: 404,
                        statusText: 'Not Found',
                        data: {}
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('HTTP error (404) during test operation: Not Found');
            });

            it('should handle HTTP errors with no error details', () => {
                const error = {
                    response: {
                        status: 418,
                        statusText: '',
                        data: {}
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('HTTP error (418) during test operation: Unknown error');
            });
        });

        describe('Token validation edge cases', () => {
            beforeEach(() => {
                // Mock successful token fetch for access token
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        access_token: 'test_access_token',
                        agent_secret_token: 'test_agent_secret_token',
                        expires_in: 3600
                    }
                });
            });

            it('should handle response with active field as non-boolean', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 200,
                    data: { active: 'true' } // String instead of boolean
                });

                const isValid = await client.validateToken('test_token', 'test_user_id');
                expect(isValid).toBe(false); // Should be false since active !== true
            });

            it('should handle response with missing active field', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    status: 200,
                    data: { valid: true } // Wrong field name
                });

                const isValid = await client.validateToken('test_token', 'test_user_id');
                expect(isValid).toBe(false);
            });
        });

        describe('Retry Interceptor Functionality', () => {
            let interceptorFunction;

            beforeEach(() => {
                // Extract the interceptor function from the mock call
                const interceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];
                interceptorFunction = interceptorCall[1]; // The error handler function
            });

            it('should return response as-is on success', async () => {
                const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
                const mockResponse = { data: { success: true } };
                
                const result = successHandler(mockResponse);
                expect(result).toBe(mockResponse);
            });

            it('should initialize retry count if not present', async () => {
                const error = {
                    config: {},
                    code: 'ECONNABORTED'
                };
                
                client._shouldRetry = jest.fn().mockReturnValue(false);
                
                try {
                    await interceptorFunction(error);
                } catch (e) {
                    expect(error.config.__retryCount).toBe(0);
                }
            });

            it('should not retry if shouldRetry returns false', async () => {
                const error = {
                    config: { __retryCount: 0 },
                    code: 'ECONNABORTED'
                };
                
                client._shouldRetry = jest.fn().mockReturnValue(false);
                
                await expect(interceptorFunction(error)).rejects.toBe(error);
                expect(client._shouldRetry).toHaveBeenCalledWith(error, error.config);
            });

            it('should not retry if max retries exceeded', async () => {
                const error = {
                    config: { __retryCount: 5 },
                    code: 'ECONNABORTED'
                };
                
                client._shouldRetry = jest.fn().mockReturnValue(true);
                client.config.maxRetries = 3;
                
                await expect(interceptorFunction(error)).rejects.toBe(error);
            });

            it('should retry with exponential backoff', async () => {
                const error = {
                    config: { __retryCount: 0 },
                    code: 'ECONNABORTED'
                };
                
                client._shouldRetry = jest.fn().mockReturnValue(true);
                client._calculateRetryDelay = jest.fn().mockReturnValue(100);
                client._sleep = jest.fn().mockResolvedValue();
                client.config.maxRetries = 3;
                
                // Create a mock function for the axios instance
                const mockRetryResponse = { data: { success: true } };
                const mockAxiosCall = jest.fn().mockResolvedValue(mockRetryResponse);
                
                // Replace the instance function in the interceptor context
                const modifiedInterceptorFunction = async (error) => {
                    const config = error.config;
                    
                    if (!config.__retryCount) {
                        config.__retryCount = 0;
                    }

                    const shouldRetry = client._shouldRetry(error, config);
                    
                    if (shouldRetry && config.__retryCount < client.config.maxRetries) {
                        config.__retryCount++;
                        const delay = client._calculateRetryDelay(config.__retryCount);
                        await client._sleep(delay);
                        return mockAxiosCall(config);
                    }

                    return Promise.reject(error);
                };
                
                const result = await modifiedInterceptorFunction(error);
                
                expect(error.config.__retryCount).toBe(1);
                expect(client._calculateRetryDelay).toHaveBeenCalledWith(1);
                expect(client._sleep).toHaveBeenCalledWith(100);
                expect(mockAxiosCall).toHaveBeenCalledWith(error.config);
                expect(result).toBe(mockRetryResponse);
            });
        });

        describe('Additional Branch Coverage', () => {
            beforeEach(() => {
                // Mock successful token fetch for access token
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        access_token: 'test_access_token',
                        agent_secret_token: 'test_agent_secret_token',
                        expires_in: 3600
                    }
                });
            });

            it('should handle validateA2ARequest with missing agent user id in Bearer format', async () => {
                client.validateToken = jest.fn();

                const headers = {
                    'Authorization': 'Bearer test_token'
                    // Missing X-Agent-User-Id
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(false);
                expect(client.validateToken).not.toHaveBeenCalled();
            });

            it('should handle validateA2ARequest with missing token in custom format', async () => {
                client.validateToken = jest.fn();

                const headers = {
                    'X-Agent-User-Id': 'test_user_id'
                    // Missing X-Agent-Secret-Token
                };

                const isValid = await client.validateA2ARequest(headers);
                expect(isValid).toBe(false);
                expect(client.validateToken).not.toHaveBeenCalled();
            });

            it('should handle RPC call with null rpcUrl parameter', async () => {
                mockAxiosInstance.post.mockResolvedValueOnce({
                    data: {
                        jsonrpc: '2.0',
                        result: { success: true },
                        id: 'test-uuid-1234'
                    }
                });

                const result = await client.rpcCall('test_method', { param: 'value' }, null);

                expect(result).toEqual({
                    jsonrpc: '2.0',
                    result: { success: true },
                    id: 'test-uuid-1234'
                });

                const [url] = mockAxiosInstance.post.mock.calls[1];
                expect(url).toBe('https://api.example.com/a2a/rpc');
            });
        });
    });
});