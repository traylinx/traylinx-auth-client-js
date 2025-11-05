const axios = require('axios');
const TokenManager = require('../src/tokenManager');
const { NetworkError, AuthenticationError } = require('../src/errors');

jest.mock('axios');

describe('TokenManager', () => {
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Save original environment
        originalEnv = { ...process.env };
        
        // Set up test environment
        process.env.TRAYLINX_CLIENT_ID = 'test_client_id';
        process.env.TRAYLINX_CLIENT_SECRET = 'test_client_secret';
        process.env.TRAYLINX_API_BASE_URL = 'https://test.com';
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Token Fetching', () => {
        it('should fetch tokens on first call', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600,
                },
            });

            const tokenManager = new TokenManager();
            const accessToken = await tokenManager.getAccessToken();
            const agentSecretToken = await tokenManager.getAgentSecretToken();

            expect(accessToken).toBe('test_access_token');
            expect(agentSecretToken).toBe('test_agent_secret_token');
            expect(axios.post).toHaveBeenCalledTimes(1);
            
            // Verify request parameters
            const [url, data, config] = axios.post.mock.calls[0];
            expect(url).toBe('https://test.com/oauth/token');
            expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });

        it('should use cached tokens on subsequent calls', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();
            await tokenManager.getAgentSecretToken();
            const accessToken = await tokenManager.getAccessToken();
            const agentSecretToken = await tokenManager.getAgentSecretToken();

            expect(accessToken).toBe('test_access_token');
            expect(agentSecretToken).toBe('test_agent_secret_token');
            expect(axios.post).toHaveBeenCalledTimes(1);
        });

        it('should refresh expired tokens', async () => {
            axios.post
                .mockResolvedValueOnce({
                    data: {
                        access_token: 'first_access_token',
                        agent_secret_token: 'first_agent_secret_token',
                        expires_in: 0.1, // Expires in 100ms
                    },
                })
                .mockResolvedValueOnce({
                    data: {
                        access_token: 'refreshed_access_token',
                        agent_secret_token: 'refreshed_agent_secret_token',
                        expires_in: 3600,
                    },
                });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            await new Promise(resolve => setTimeout(resolve, 200));

            const accessToken = await tokenManager.getAccessToken();

            expect(accessToken).toBe('refreshed_access_token');
            expect(axios.post).toHaveBeenCalledTimes(2);
        });

        it('should handle concurrent token requests without duplicate fetches', async () => {
            let fetchCount = 0;
            
            axios.post.mockImplementation(() => {
                fetchCount++;
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            data: {
                                access_token: 'concurrent_access_token',
                                agent_secret_token: 'concurrent_agent_secret_token',
                                expires_in: 3600,
                            },
                        });
                    }, 100);
                });
            });

            const tokenManager = new TokenManager();
            
            // Make multiple concurrent requests
            const promises = [
                tokenManager.getAccessToken(),
                tokenManager.getAccessToken(),
                tokenManager.getAgentSecretToken(),
                tokenManager.getAgentSecretToken()
            ];

            const results = await Promise.all(promises);

            expect(results[0]).toBe('concurrent_access_token');
            expect(results[1]).toBe('concurrent_access_token');
            expect(results[2]).toBe('concurrent_agent_secret_token');
            expect(results[3]).toBe('concurrent_agent_secret_token');
            expect(fetchCount).toBe(1); // Only one fetch should occur
        });
    });

    describe('Error Handling', () => {
        it('should handle authentication errors (401)', async () => {
            const authError = new Error('Request failed with status code 401');
            authError.response = {
                status: 401,
                data: { error: 'invalid_client' }
            };
            
            axios.post.mockRejectedValue(authError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle network timeout errors', async () => {
            const timeoutError = new Error('timeout of 30000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            
            axios.post.mockRejectedValue(timeoutError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle connection refused errors', async () => {
            const connectionError = new Error('connect ECONNREFUSED');
            connectionError.code = 'ECONNREFUSED';
            
            axios.post.mockRejectedValue(connectionError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle DNS resolution errors', async () => {
            const dnsError = new Error('getaddrinfo ENOTFOUND');
            dnsError.code = 'ENOTFOUND';
            
            axios.post.mockRejectedValue(dnsError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle rate limiting (429)', async () => {
            const rateLimitError = new Error('Request failed with status code 429');
            rateLimitError.response = {
                status: 429,
                data: { error: 'rate_limit_exceeded' }
            };
            
            axios.post.mockRejectedValue(rateLimitError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle server errors (5xx)', async () => {
            const serverError = new Error('Request failed with status code 500');
            serverError.response = {
                status: 500,
                data: { error: 'internal_server_error' }
            };
            
            axios.post.mockRejectedValue(serverError);

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle malformed token responses', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_token'
                    // Missing agent_secret_token and expires_in
                }
            });

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should handle empty token responses', async () => {
            axios.post.mockResolvedValue({
                data: {}
            });

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });
    });

    describe('Configuration', () => {
        it('should use environment variables for configuration', async () => {
            process.env.TRAYLINX_CLIENT_ID = 'env_client_id';
            process.env.TRAYLINX_CLIENT_SECRET = 'env_client_secret';
            process.env.TRAYLINX_API_BASE_URL = 'https://env.example.com';

            axios.post.mockResolvedValue({
                data: {
                    access_token: 'env_access_token',
                    agent_secret_token: 'env_agent_secret_token',
                    expires_in: 3600,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            const [url, data] = axios.post.mock.calls[0];
            expect(url).toBe('https://env.example.com/oauth/token');
            
            // Check that the correct credentials were sent
            const formData = new URLSearchParams(data);
            expect(formData.get('client_id')).toBe('env_client_id');
            expect(formData.get('client_secret')).toBe('env_client_secret');
        });

        it('should handle missing environment variables', async () => {
            delete process.env.TRAYLINX_CLIENT_ID;
            delete process.env.TRAYLINX_CLIENT_SECRET;
            delete process.env.TRAYLINX_API_BASE_URL;

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });

        it('should validate required configuration parameters', async () => {
            process.env.TRAYLINX_CLIENT_ID = '';
            process.env.TRAYLINX_CLIENT_SECRET = 'test_secret';
            process.env.TRAYLINX_API_BASE_URL = 'https://test.com';

            const tokenManager = new TokenManager();
            
            await expect(tokenManager.getAccessToken()).rejects.toThrow();
        });
    });

    describe('Token Expiration Logic', () => {
        it('should correctly calculate token expiration', async () => {
            const currentTime = Date.now();
            const expiresIn = 3600; // 1 hour
            
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: expiresIn,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            // Check that expiration is set correctly (within a reasonable margin)
            expect(tokenManager.tokenExpiration).toBeGreaterThan(currentTime + (expiresIn * 1000) - 1000);
            expect(tokenManager.tokenExpiration).toBeLessThan(currentTime + (expiresIn * 1000) + 1000);
        });

        it('should handle zero expiration time', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 0,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            // Token should be considered expired immediately
            expect(tokenManager.tokenExpiration).toBeLessThanOrEqual(Date.now());
        });

        it('should handle negative expiration time', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: -100,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            // Token should be considered expired
            expect(tokenManager.tokenExpiration).toBeLessThan(Date.now());
        });
    });

    describe('Request Format', () => {
        it('should send correct OAuth request format', async () => {
            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            const [url, data, config] = axios.post.mock.calls[0];
            
            expect(url).toBe('https://test.com/oauth/token');
            expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            
            const formData = new URLSearchParams(data);
            expect(formData.get('grant_type')).toBe('client_credentials');
            expect(formData.get('client_id')).toBe('test_client_id');
            expect(formData.get('client_secret')).toBe('test_client_secret');
            expect(formData.get('scope')).toBe('a2a');
        });

        it('should handle URL encoding in form data', async () => {
            process.env.TRAYLINX_CLIENT_ID = 'client+with+special&chars';
            process.env.TRAYLINX_CLIENT_SECRET = 'secret=with&special+chars';

            axios.post.mockResolvedValue({
                data: {
                    access_token: 'test_access_token',
                    agent_secret_token: 'test_agent_secret_token',
                    expires_in: 3600,
                },
            });

            const tokenManager = new TokenManager();
            await tokenManager.getAccessToken();

            const [, data] = axios.post.mock.calls[0];
            const formData = new URLSearchParams(data);
            
            expect(formData.get('client_id')).toBe('client+with+special&chars');
            expect(formData.get('client_secret')).toBe('secret=with&special+chars');
        });
    });
});