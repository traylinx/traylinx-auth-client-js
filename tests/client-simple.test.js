/**
 * Simplified test suite for TraylinxAuthClient focusing on core functionality.
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

describe('TraylinxAuthClient - Core Functionality', () => {
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

    describe('Constructor', () => {
        it('should create client with valid configuration', () => {
            const client = new TraylinxAuthClient(
                'test-client-123',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
            
            expect(client.clientId).toBe('test-client-123');
            expect(client.clientSecret).toBe('super-secret-key-12345');
            expect(client.apiBaseUrl).toBe('https://api.example.com');
            expect(client.agentUserId).toBe('12345678-1234-1234-1234-123456789abc');
        });

        it('should throw ValidationError for invalid configuration', () => {
            expect(() => {
                new TraylinxAuthClient('ab', 'short', 'http://insecure.com', 'not-a-uuid');
            }).toThrow();
        });

        it('should use environment variables when parameters are not provided', () => {
            process.env.TRAYLINX_CLIENT_ID = 'env-client-id';
            process.env.TRAYLINX_CLIENT_SECRET = 'env-client-secret-12345';
            process.env.TRAYLINX_API_BASE_URL = 'https://env.example.com';
            process.env.TRAYLINX_AGENT_USER_ID = '87654321-4321-4321-4321-210987654321';
            
            const client = new TraylinxAuthClient();
            
            expect(client.clientId).toBe('env-client-id');
            expect(client.clientSecret).toBe('env-client-secret-12345');
            expect(client.apiBaseUrl).toBe('https://env.example.com');
            expect(client.agentUserId).toBe('87654321-4321-4321-4321-210987654321');
            
            // Clean up
            delete process.env.TRAYLINX_CLIENT_ID;
            delete process.env.TRAYLINX_CLIENT_SECRET;
            delete process.env.TRAYLINX_API_BASE_URL;
            delete process.env.TRAYLINX_AGENT_USER_ID;
        });
    });

    describe('Configuration Options', () => {
        it('should create client with custom options', () => {
            const options = {
                timeout: 60000,
                maxRetries: 5,
                retryDelay: 2000,
                cacheTokens: false,
                logLevel: 'DEBUG'
            };
            
            const client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc',
                options
            );
            
            expect(client.config.timeout).toBe(60000);
            expect(client.config.maxRetries).toBe(5);
            expect(client.config.retryDelay).toBe(2000);
            expect(client.config.cacheTokens).toBe(false);
            expect(client.config.logLevel).toBe('DEBUG');
        });

        it('should apply default values for optional fields', () => {
            const client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
            
            expect(client.config.timeout).toBe(30000);
            expect(client.config.maxRetries).toBe(3);
            expect(client.config.retryDelay).toBe(1000);
            expect(client.config.cacheTokens).toBe(true);
            expect(client.config.logLevel).toBe('INFO');
        });
    });

    describe('Retry Logic Helpers', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc',
                { maxRetries: 2, retryDelay: 100 }
            );
        });

        describe('_shouldRetry', () => {
            it('should retry on network errors', () => {
                const networkErrors = ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'];
                
                networkErrors.forEach(code => {
                    const error = { code };
                    const config = { __retryCount: 0 };
                    expect(client._shouldRetry(error, config)).toBe(true);
                });
            });

            it('should retry on retryable HTTP status codes', () => {
                const retryableStatuses = [429, 500, 502, 503, 504];
                
                retryableStatuses.forEach(status => {
                    const error = { response: { status } };
                    const config = { __retryCount: 0 };
                    expect(client._shouldRetry(error, config)).toBe(true);
                });
            });

            it('should not retry on non-retryable HTTP status codes', () => {
                const nonRetryableStatuses = [400, 401, 403, 404];
                
                nonRetryableStatuses.forEach(status => {
                    const error = { response: { status } };
                    const config = { __retryCount: 0 };
                    expect(client._shouldRetry(error, config)).toBe(false);
                });
            });

            it('should not retry if maxRetries is 0', () => {
                client.config.maxRetries = 0;
                const error = { code: 'ECONNABORTED' };
                const config = { __retryCount: 0 };
                expect(client._shouldRetry(error, config)).toBe(false);
            });
        });

        describe('_calculateRetryDelay', () => {
            it('should calculate exponential backoff delay', () => {
                client.config.retryDelay = 1000;
                
                const delay1 = client._calculateRetryDelay(1);
                const delay2 = client._calculateRetryDelay(2);
                const delay3 = client._calculateRetryDelay(3);
                
                expect(delay1).toBeGreaterThanOrEqual(1000);
                expect(delay1).toBeLessThan(1200); // With 10% jitter
                expect(delay2).toBeGreaterThanOrEqual(2000);
                expect(delay2).toBeLessThan(2400);
                expect(delay3).toBeGreaterThanOrEqual(4000);
                expect(delay3).toBeLessThan(4800);
            });

            it('should cap delay at 30 seconds', () => {
                client.config.retryDelay = 10000;
                
                const delay = client._calculateRetryDelay(10); // Would be very large without cap
                expect(delay).toBeLessThanOrEqual(30000);
            });
        });

        describe('_sleep', () => {
            it('should sleep for specified duration', async () => {
                const start = Date.now();
                await client._sleep(50); // Reduced sleep time for faster tests
                const end = Date.now();
                
                expect(end - start).toBeGreaterThanOrEqual(40); // Allow some variance
                expect(end - start).toBeLessThan(150); // More generous upper bound
            });
        });
    });

    describe('Error Handling', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
        });

        describe('_handleRequestError', () => {
            it('should handle timeout errors', () => {
                const error = { code: 'ECONNABORTED' };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Request timeout during test operation');
            });

            it('should handle DNS errors', () => {
                const error = { code: 'ENOTFOUND' };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('DNS resolution failed during test operation');
            });

            it('should handle connection refused errors', () => {
                const error = { code: 'ECONNREFUSED' };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Connection refused during test operation');
            });

            it('should handle HTTP 401 errors', () => {
                const error = {
                    response: {
                        status: 401,
                        statusText: 'Unauthorized',
                        data: {}
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Authentication failed during test operation');
            });

            it('should handle HTTP 429 errors', () => {
                const error = {
                    response: {
                        status: 429,
                        statusText: 'Too Many Requests',
                        data: {}
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Rate limit exceeded during test operation');
            });

            it('should handle HTTP 5xx errors', () => {
                const error = {
                    response: {
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: {}
                    }
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Server error (500) during test operation');
            });

            it('should handle request setup errors', () => {
                const error = {
                    request: {},
                    message: 'Request setup failed'
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Network request failed during test operation');
            });

            it('should handle unknown errors', () => {
                const error = {
                    message: 'Unknown error occurred'
                };
                
                expect(() => {
                    client._handleRequestError(error, 'test operation');
                }).toThrow('Unexpected error during test operation');
            });
        });
    });

    describe('Authentication Mode Detection', () => {
        let client;

        beforeEach(() => {
            client = new TraylinxAuthClient(
                'test-client',
                'super-secret-key-12345',
                'https://api.example.com',
                '12345678-1234-1234-1234-123456789abc'
            );
        });

        describe('detectAuthMode', () => {
            it('should detect Bearer token mode', () => {
                const headers = {
                    'Authorization': 'Bearer test_token',
                    'X-Agent-User-Id': 'test_user'
                };
                
                const mode = client.detectAuthMode(headers);
                expect(mode).toBe('bearer');
            });

            it('should detect custom header mode', () => {
                const headers = {
                    'X-Agent-Secret-Token': 'test_token',
                    'X-Agent-User-Id': 'test_user'
                };
                
                const mode = client.detectAuthMode(headers);
                expect(mode).toBe('custom');
            });

            it('should detect no authentication', () => {
                const headers = {};
                const mode = client.detectAuthMode(headers);
                expect(mode).toBe('none');
            });

            it('should handle case-insensitive headers', () => {
                const headers = {
                    'authorization': 'Bearer test_token',
                    'x-agent-user-id': 'test_user'
                };
                
                const mode = client.detectAuthMode(headers);
                expect(mode).toBe('bearer');
            });
        });
    });
});