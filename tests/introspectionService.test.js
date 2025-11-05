const axios = require('axios');
const IntrospectionService = require('../src/introspectionService');
const TokenManager = require('../src/tokenManager');
const { NetworkError, AuthenticationError } = require('../src/errors');

jest.mock('axios');

describe('IntrospectionService', () => {
    let tokenManager;
    let introspectionService;

    beforeEach(() => {
        jest.clearAllMocks();
        tokenManager = new TokenManager();
        tokenManager.getAccessToken = jest.fn().mockResolvedValue('test_access_token');
        introspectionService = new IntrospectionService(tokenManager);
    });

    describe('Token Validation', () => {
        it('should return true for a valid token', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: true } 
            });

            const isValid = await introspectionService.validateToken('valid_secret', 'user123');

            expect(isValid).toBe(true);
            expect(axios.post).toHaveBeenCalledTimes(1);
            expect(tokenManager.getAccessToken).toHaveBeenCalledTimes(1);
            
            // Verify request parameters
            const [url, data, config] = axios.post.mock.calls[0];
            expect(config.headers.Authorization).toBe('Bearer test_access_token');
            expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });

        it('should return false for an invalid token', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: false } 
            });

            const isValid = await introspectionService.validateToken('invalid_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle missing active field in response', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: {} 
            });

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle null response data', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: null 
            });

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle malformed JSON response', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: 'invalid json string' 
            });

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should return false if the introspection request fails', async () => {
            axios.post.mockRejectedValue(new Error('Request failed'));

            const isValid = await introspectionService.validateToken('any_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle network timeout errors', async () => {
            const timeoutError = new Error('timeout of 30000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            axios.post.mockRejectedValue(timeoutError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle connection refused errors', async () => {
            const connectionError = new Error('connect ECONNREFUSED');
            connectionError.code = 'ECONNREFUSED';
            axios.post.mockRejectedValue(connectionError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle DNS resolution errors', async () => {
            const dnsError = new Error('getaddrinfo ENOTFOUND');
            dnsError.code = 'ENOTFOUND';
            axios.post.mockRejectedValue(dnsError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle 401 authentication errors', async () => {
            const authError = new Error('Request failed with status code 401');
            authError.response = {
                status: 401,
                data: { error: 'invalid_token' }
            };
            axios.post.mockRejectedValue(authError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle 403 forbidden errors', async () => {
            const forbiddenError = new Error('Request failed with status code 403');
            forbiddenError.response = {
                status: 403,
                data: { error: 'insufficient_scope' }
            };
            axios.post.mockRejectedValue(forbiddenError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle rate limiting (429) errors', async () => {
            const rateLimitError = new Error('Request failed with status code 429');
            rateLimitError.response = {
                status: 429,
                data: { error: 'rate_limit_exceeded' }
            };
            axios.post.mockRejectedValue(rateLimitError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle server errors (5xx)', async () => {
            const serverError = new Error('Request failed with status code 500');
            serverError.response = {
                status: 500,
                data: { error: 'internal_server_error' }
            };
            axios.post.mockRejectedValue(serverError);

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle token manager errors', async () => {
            tokenManager.getAccessToken.mockRejectedValue(new Error('Token fetch failed'));

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });
    });

    describe('Request Format', () => {
        it('should send correct introspection request format', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: true } 
            });

            await introspectionService.validateToken('test_secret_token', 'test_user_id');

            const [url, data, config] = axios.post.mock.calls[0];
            
            expect(url).toContain('/oauth/agent/introspect');
            expect(config.headers.Authorization).toBe('Bearer test_access_token');
            expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            
            const formData = new URLSearchParams(data);
            expect(formData.get('agent_secret_token')).toBe('test_secret_token');
            expect(formData.get('agent_user_id')).toBe('test_user_id');
        });

        it('should handle special characters in token and user ID', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: true } 
            });

            const specialToken = 'token+with&special=chars';
            const specialUserId = 'user@domain.com';

            await introspectionService.validateToken(specialToken, specialUserId);

            const [, data] = axios.post.mock.calls[0];
            const formData = new URLSearchParams(data);
            
            expect(formData.get('agent_secret_token')).toBe(specialToken);
            expect(formData.get('agent_user_id')).toBe(specialUserId);
        });

        it('should handle empty token and user ID', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: false } 
            });

            const isValid = await introspectionService.validateToken('', '');

            expect(isValid).toBe(false);
            
            const [, data] = axios.post.mock.calls[0];
            const formData = new URLSearchParams(data);
            
            expect(formData.get('agent_secret_token')).toBe('');
            expect(formData.get('agent_user_id')).toBe('');
        });
    });

    describe('Response Handling', () => {
        it('should handle response with additional metadata', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { 
                    active: true,
                    scope: 'a2a',
                    client_id: 'test_client',
                    exp: 1234567890
                } 
            });

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(true);
        });

        it('should handle response with active: false and error details', async () => {
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { 
                    active: false,
                    error: 'token_expired',
                    error_description: 'The token has expired'
                } 
            });

            const isValid = await introspectionService.validateToken('expired_token', 'user123');

            expect(isValid).toBe(false);
        });

        it('should handle non-200 status codes with valid JSON', async () => {
            axios.post.mockResolvedValue({ 
                status: 400,
                data: { 
                    error: 'invalid_request',
                    error_description: 'Missing required parameter'
                } 
            });

            const isValid = await introspectionService.validateToken('test_secret', 'user123');

            expect(isValid).toBe(false);
        });
    });

    describe('Concurrent Validation', () => {
        it('should handle multiple concurrent validation requests', async () => {
            let requestCount = 0;
            
            axios.post.mockImplementation(() => {
                requestCount++;
                return Promise.resolve({ 
                    status: 200,
                    data: { active: true } 
                });
            });

            const promises = [
                introspectionService.validateToken('token1', 'user1'),
                introspectionService.validateToken('token2', 'user2'),
                introspectionService.validateToken('token3', 'user3')
            ];

            const results = await Promise.all(promises);

            expect(results).toEqual([true, true, true]);
            expect(requestCount).toBe(3);
            expect(tokenManager.getAccessToken).toHaveBeenCalledTimes(3);
        });

        it('should handle mixed success and failure in concurrent requests', async () => {
            axios.post
                .mockResolvedValueOnce({ status: 200, data: { active: true } })
                .mockResolvedValueOnce({ status: 200, data: { active: false } })
                .mockRejectedValueOnce(new Error('Network error'));

            const promises = [
                introspectionService.validateToken('valid_token', 'user1'),
                introspectionService.validateToken('invalid_token', 'user2'),
                introspectionService.validateToken('error_token', 'user3')
            ];

            const results = await Promise.all(promises);

            expect(results).toEqual([true, false, false]);
        });
    });

    describe('Configuration and Environment', () => {
        it('should use correct API base URL from environment', async () => {
            process.env.TRAYLINX_API_BASE_URL = 'https://custom.api.com';
            
            axios.post.mockResolvedValue({ 
                status: 200,
                data: { active: true } 
            });

            await introspectionService.validateToken('test_secret', 'user123');

            const [url] = axios.post.mock.calls[0];
            expect(url).toBe('https://custom.api.com/oauth/agent/introspect');
            
            // Clean up
            delete process.env.TRAYLINX_API_BASE_URL;
        });

        it('should handle missing API base URL gracefully', async () => {
            delete process.env.TRAYLINX_API_BASE_URL;
            
            // This should be handled by the TokenManager or service initialization
            const isValid = await introspectionService.validateToken('test_secret', 'user123');
            
            // The exact behavior depends on implementation, but it should not crash
            expect(typeof isValid).toBe('boolean');
        });
    });
});