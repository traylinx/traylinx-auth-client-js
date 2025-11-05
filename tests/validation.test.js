/**
 * Comprehensive test suite for Joi validation module.
 * 
 * Tests all validation rules, edge cases, and error scenarios
 * to ensure robust input validation.
 */

const {
    configSchema,
    validateConfig,
    validateParameter,
    getDefaultConfig,
    getMissingRequiredFields,
    sanitizeConfigForLogging
} = require('../src/validation');

describe('Configuration Validation', () => {
    describe('validateConfig - Complete Configuration', () => {
        it('should validate a complete valid configuration', () => {
            const validConfig = {
                clientId: 'test-client-123',
                clientSecret: 'super-secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc',
                timeout: 30000,
                maxRetries: 3,
                retryDelay: 1000,
                cacheTokens: true,
                logLevel: 'INFO'
            };
            
            const result = validateConfig(validConfig);
            
            expect(result).toEqual(validConfig);
            expect(result.clientId).toBe('test-client-123');
            expect(result.timeout).toBe(30000);
            expect(result.cacheTokens).toBe(true);
        });

        it('should apply default values for optional fields', () => {
            const minimalConfig = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc'
            };
            
            const result = validateConfig(minimalConfig);
            
            expect(result.timeout).toBe(30000);
            expect(result.maxRetries).toBe(3);
            expect(result.retryDelay).toBe(1000);
            expect(result.cacheTokens).toBe(true);
            expect(result.logLevel).toBe('INFO');
        });

        it('should strip unknown properties', () => {
            const configWithExtra = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc',
                unknownProperty: 'should-be-removed',
                anotherUnknown: 123
            };
            
            const result = validateConfig(configWithExtra);
            
            expect(result.unknownProperty).toBeUndefined();
            expect(result.anotherUnknown).toBeUndefined();
            expect(result.clientId).toBe('test-client');
        });

        it('should normalize apiBaseUrl by removing trailing slash', () => {
            const config = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com/',
                agentUserId: '12345678-1234-1234-1234-123456789abc'
            };
            
            const result = validateConfig(config);
            
            expect(result.apiBaseUrl).toBe('https://api.example.com');
        });

        it('should normalize agentUserId to lowercase with hyphens', () => {
            const config = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678123412341234123456789ABC'
            };
            
            const result = validateConfig(config);
            
            expect(result.agentUserId).toBe('12345678-1234-1234-1234-123456789abc');
        });

        it('should normalize logLevel to uppercase', () => {
            const config = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc',
                logLevel: 'debug'
            };
            
            const result = validateConfig(config);
            
            expect(result.logLevel).toBe('DEBUG');
        });
    });

    describe('validateConfig - Client ID Validation', () => {
        const baseConfig = {
            clientSecret: 'secret-key-12345',
            apiBaseUrl: 'https://api.example.com',
            agentUserId: '12345678-1234-1234-1234-123456789abc'
        };

        it('should accept valid client IDs', () => {
            const validIds = [
                'client123',
                'test-client',
                'client_name',
                'ABC-123_def',
                '123'
            ];
            
            validIds.forEach(clientId => {
                const config = { ...baseConfig, clientId };
                expect(() => validateConfig(config)).not.toThrow();
            });
        });

        it('should reject invalid client ID patterns', () => {
            const invalidIds = [
                'client@123',      // Contains @
                'client 123',      // Contains space
                'client.123',      // Contains dot
                'client#123',      // Contains #
                'client+123'       // Contains +
            ];
            
            invalidIds.forEach(clientId => {
                const config = { ...baseConfig, clientId };
                expect(() => validateConfig(config)).toThrow(/Client ID must contain only alphanumeric/);
            });
        });

        it('should reject client ID that is too short', () => {
            const config = { ...baseConfig, clientId: 'ab' };
            expect(() => validateConfig(config)).toThrow(/Client ID must be at least 3 characters/);
        });

        it('should reject client ID that is too long', () => {
            const config = { ...baseConfig, clientId: 'a'.repeat(101) };
            expect(() => validateConfig(config)).toThrow(/Client ID must be no more than 100 characters/);
        });

        it('should reject empty client ID', () => {
            const config = { ...baseConfig, clientId: '' };
            expect(() => validateConfig(config)).toThrow(/Client ID cannot be empty/);
        });

        it('should require client ID', () => {
            expect(() => validateConfig(baseConfig)).toThrow(/Client ID is required/);
        });
    });

    describe('validateConfig - Client Secret Validation', () => {
        const baseConfig = {
            clientId: 'test-client',
            apiBaseUrl: 'https://api.example.com',
            agentUserId: '12345678-1234-1234-1234-123456789abc'
        };

        it('should accept valid client secrets', () => {
            const validSecrets = [
                'super-secret-key-12345',
                'a'.repeat(10),
                'complex!@#$%^&*()secret',
                'very-long-secret-' + 'x'.repeat(50)
            ];
            
            validSecrets.forEach(clientSecret => {
                const config = { ...baseConfig, clientSecret };
                expect(() => validateConfig(config)).not.toThrow();
            });
        });

        it('should reject client secret that is too short', () => {
            const config = { ...baseConfig, clientSecret: 'short' };
            expect(() => validateConfig(config)).toThrow(/Client secret must be at least 10 characters/);
        });

        it('should reject client secret that is too long', () => {
            const config = { ...baseConfig, clientSecret: 'a'.repeat(501) };
            expect(() => validateConfig(config)).toThrow(/Client secret must be no more than 500 characters/);
        });

        it('should reject common weak secrets', () => {
            const weakSecrets = ['password', 'secret', '123456', 'admin'];
            
            weakSecrets.forEach(clientSecret => {
                const config = { ...baseConfig, clientSecret };
                expect(() => validateConfig(config)).toThrow(/Client secret appears to be a common weak value/);
            });
        });

        it('should reject empty client secret', () => {
            const config = { ...baseConfig, clientSecret: '' };
            expect(() => validateConfig(config)).toThrow(/Client secret cannot be empty/);
        });

        it('should require client secret', () => {
            expect(() => validateConfig(baseConfig)).toThrow(/Client secret is required/);
        });
    });

    describe('validateConfig - API Base URL Validation', () => {
        const baseConfig = {
            clientId: 'test-client',
            clientSecret: 'secret-key-12345',
            agentUserId: '12345678-1234-1234-1234-123456789abc'
        };

        it('should accept valid HTTPS URLs', () => {
            const validUrls = [
                'https://api.example.com',
                'https://subdomain.example.com',
                'https://api.example.com:8443',
                'https://api.example.com/path',
                'https://192.168.1.1:8443'
            ];
            
            validUrls.forEach(apiBaseUrl => {
                const config = { ...baseConfig, apiBaseUrl };
                expect(() => validateConfig(config)).not.toThrow();
            });
        });

        it('should reject HTTP URLs (require HTTPS)', () => {
            const config = { ...baseConfig, apiBaseUrl: 'http://api.example.com' };
            expect(() => validateConfig(config)).toThrow(/API base URL must be a valid HTTPS URL/);
        });

        it('should reject invalid URL formats', () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'api.example.com',
                'https://',
                'https://.'
            ];
            
            invalidUrls.forEach(apiBaseUrl => {
                const config = { ...baseConfig, apiBaseUrl };
                expect(() => validateConfig(config)).toThrow(/API base URL must be a valid HTTPS URL/);
            });
        });

        it('should require API base URL', () => {
            expect(() => validateConfig(baseConfig)).toThrow(/API base URL is required/);
        });
    });

    describe('validateConfig - Agent User ID Validation', () => {
        const baseConfig = {
            clientId: 'test-client',
            clientSecret: 'secret-key-12345',
            apiBaseUrl: 'https://api.example.com'
        };

        it('should accept valid UUID formats', () => {
            const validUuids = [
                '12345678-1234-1234-1234-123456789abc',
                'ABCDEF12-3456-7890-ABCD-EF1234567890',
                '00000000-0000-0000-0000-000000000000',
                'ffffffff-ffff-ffff-ffff-ffffffffffff'
            ];
            
            validUuids.forEach(agentUserId => {
                const config = { ...baseConfig, agentUserId };
                const result = validateConfig(config);
                expect(result.agentUserId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            });
        });

        it('should normalize UUID to lowercase with hyphens', () => {
            const config = { ...baseConfig, agentUserId: 'ABCDEF123456789012345678901234567890' };
            const result = validateConfig(config);
            expect(result.agentUserId).toBe('abcdef12-3456-7890-1234-567890123456');
        });

        it('should reject invalid UUID formats', () => {
            const invalidUuids = [
                'not-a-uuid',
                '12345678-1234-1234-1234',  // too short
                '12345678-1234-1234-1234-123456789abcdef',  // too long
                'gggggggg-1234-1234-1234-123456789abc'  // invalid hex characters
            ];
            
            invalidUuids.forEach(agentUserId => {
                const config = { ...baseConfig, agentUserId };
                expect(() => validateConfig(config)).toThrow(/Agent User ID must be a valid UUID/);
            });
        });

        it('should require agent user ID', () => {
            expect(() => validateConfig(baseConfig)).toThrow(/Agent User ID is required/);
        });
    });

    describe('validateConfig - Numeric Parameter Validation', () => {
        const baseConfig = {
            clientId: 'test-client',
            clientSecret: 'secret-key-12345',
            apiBaseUrl: 'https://api.example.com',
            agentUserId: '12345678-1234-1234-1234-123456789abc'
        };

        describe('timeout validation', () => {
            it('should accept valid timeout values', () => {
                const validTimeouts = [1000, 30000, 60000, 300000];
                
                validTimeouts.forEach(timeout => {
                    const config = { ...baseConfig, timeout };
                    expect(() => validateConfig(config)).not.toThrow();
                });
            });

            it('should reject timeout values that are too small', () => {
                const config = { ...baseConfig, timeout: 500 };
                expect(() => validateConfig(config)).toThrow(/Timeout must be at least 1000ms/);
            });

            it('should reject timeout values that are too large', () => {
                const config = { ...baseConfig, timeout: 400000 };
                expect(() => validateConfig(config)).toThrow(/Timeout must be no more than 300000ms/);
            });

            it('should reject non-integer timeout values', () => {
                const config = { ...baseConfig, timeout: 30000.5 };
                expect(() => validateConfig(config)).toThrow(/Timeout must be an integer/);
            });

            it('should reject non-numeric timeout values', () => {
                const config = { ...baseConfig, timeout: 'thirty-seconds' };
                expect(() => validateConfig(config)).toThrow(/Timeout must be a number/);
            });
        });

        describe('maxRetries validation', () => {
            it('should accept valid maxRetries values', () => {
                const validRetries = [0, 1, 3, 5, 10];
                
                validRetries.forEach(maxRetries => {
                    const config = { ...baseConfig, maxRetries };
                    expect(() => validateConfig(config)).not.toThrow();
                });
            });

            it('should reject negative maxRetries', () => {
                const config = { ...baseConfig, maxRetries: -1 };
                expect(() => validateConfig(config)).toThrow(/Max retries cannot be negative/);
            });

            it('should reject maxRetries that are too large', () => {
                const config = { ...baseConfig, maxRetries: 15 };
                expect(() => validateConfig(config)).toThrow(/Max retries must be no more than 10/);
            });

            it('should reject non-integer maxRetries', () => {
                const config = { ...baseConfig, maxRetries: 3.5 };
                expect(() => validateConfig(config)).toThrow(/Max retries must be an integer/);
            });
        });

        describe('retryDelay validation', () => {
            it('should accept valid retryDelay values', () => {
                const validDelays = [100, 1000, 5000, 60000];
                
                validDelays.forEach(retryDelay => {
                    const config = { ...baseConfig, retryDelay };
                    expect(() => validateConfig(config)).not.toThrow();
                });
            });

            it('should reject retryDelay that is too small', () => {
                const config = { ...baseConfig, retryDelay: 50 };
                expect(() => validateConfig(config)).toThrow(/Retry delay must be at least 100ms/);
            });

            it('should reject retryDelay that is too large', () => {
                const config = { ...baseConfig, retryDelay: 70000 };
                expect(() => validateConfig(config)).toThrow(/Retry delay must be no more than 60000ms/);
            });

            it('should accept decimal retryDelay values', () => {
                const config = { ...baseConfig, retryDelay: 1500.5 };
                expect(() => validateConfig(config)).not.toThrow();
            });
        });
    });

    describe('validateConfig - Boolean and String Parameter Validation', () => {
        const baseConfig = {
            clientId: 'test-client',
            clientSecret: 'secret-key-12345',
            apiBaseUrl: 'https://api.example.com',
            agentUserId: '12345678-1234-1234-1234-123456789abc'
        };

        describe('cacheTokens validation', () => {
            it('should accept boolean values', () => {
                [true, false].forEach(cacheTokens => {
                    const config = { ...baseConfig, cacheTokens };
                    expect(() => validateConfig(config)).not.toThrow();
                });
            });

            it('should reject non-boolean values', () => {
                ['true', 'false', 1, 0, null].forEach(cacheTokens => {
                    const config = { ...baseConfig, cacheTokens };
                    expect(() => validateConfig(config)).toThrow(/Cache tokens must be a boolean/);
                });
            });
        });

        describe('logLevel validation', () => {
            it('should accept valid log levels', () => {
                const validLevels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL'];
                
                validLevels.forEach(logLevel => {
                    const config = { ...baseConfig, logLevel };
                    expect(() => validateConfig(config)).not.toThrow();
                });
            });

            it('should normalize log level to uppercase', () => {
                const config = { ...baseConfig, logLevel: 'debug' };
                const result = validateConfig(config);
                expect(result.logLevel).toBe('DEBUG');
            });

            it('should reject invalid log levels', () => {
                const invalidLevels = ['TRACE', 'VERBOSE', 'FATAL', 'OFF', 'ALL'];
                
                invalidLevels.forEach(logLevel => {
                    const config = { ...baseConfig, logLevel };
                    expect(() => validateConfig(config)).toThrow(/Log level must be one of/);
                });
            });
        });
    });

    describe('validateConfig - Error Handling', () => {
        it('should return all validation errors when abortEarly is false', () => {
            const invalidConfig = {
                clientId: 'ab',  // Too short
                clientSecret: 'short',  // Too short
                apiBaseUrl: 'http://example.com',  // Not HTTPS
                agentUserId: 'not-a-uuid',  // Invalid UUID
                timeout: 500,  // Too small
                maxRetries: -1  // Negative
            };
            
            expect(() => validateConfig(invalidConfig)).toThrow();
            
            try {
                validateConfig(invalidConfig);
            } catch (error) {
                // Should contain multiple error messages
                expect(error.message).toContain('Client ID must be at least 3 characters');
                expect(error.message).toContain('Client secret must be at least 10 characters');
                expect(error.message).toContain('API base URL must be a valid HTTPS URL');
                expect(error.message).toContain('Agent User ID must be a valid UUID');
                expect(error.message).toContain('Timeout must be at least 1000ms');
                expect(error.message).toContain('Max retries cannot be negative');
            }
        });

        it('should handle null and undefined config gracefully', () => {
            expect(() => validateConfig(null)).toThrow();
            expect(() => validateConfig(undefined)).toThrow();
        });

        it('should handle empty config object', () => {
            expect(() => validateConfig({})).toThrow(/Client ID is required/);
        });
    });

    describe('validateParameter - Individual Parameter Validation', () => {
        it('should validate individual parameters correctly', () => {
            expect(() => validateParameter('clientId', 'valid-client')).not.toThrow();
            expect(() => validateParameter('timeout', 30000)).not.toThrow();
            expect(() => validateParameter('cacheTokens', true)).not.toThrow();
        });

        it('should reject invalid individual parameters', () => {
            expect(() => validateParameter('clientId', 'ab')).toThrow(/Client ID must be at least 3 characters/);
            expect(() => validateParameter('timeout', 500)).toThrow(/Timeout must be at least 1000ms/);
            expect(() => validateParameter('cacheTokens', 'true')).toThrow(/Cache tokens must be a boolean/);
        });

        it('should throw error for unknown parameters', () => {
            expect(() => validateParameter('unknownParam', 'value')).toThrow(/Unknown configuration parameter/);
        });

        it('should return normalized values for individual parameters', () => {
            const result1 = validateParameter('logLevel', 'debug');
            expect(result1).toBe('DEBUG');
            
            const result2 = validateParameter('apiBaseUrl', 'https://example.com/');
            expect(result2).toBe('https://example.com');
        });
    });

    describe('getDefaultConfig', () => {
        it('should return configuration with default values', () => {
            const defaults = getDefaultConfig();
            
            expect(defaults.timeout).toBe(30000);
            expect(defaults.maxRetries).toBe(3);
            expect(defaults.retryDelay).toBe(1000);
            expect(defaults.cacheTokens).toBe(true);
            expect(defaults.logLevel).toBe('INFO');
        });

        it('should not include required fields in defaults', () => {
            const defaults = getDefaultConfig();
            
            expect(defaults.clientId).toBeUndefined();
            expect(defaults.clientSecret).toBeUndefined();
            expect(defaults.apiBaseUrl).toBeUndefined();
            expect(defaults.agentUserId).toBeUndefined();
        });
    });

    describe('getMissingRequiredFields', () => {
        it('should return empty array for complete config', () => {
            const completeConfig = {
                clientId: 'test-client',
                clientSecret: 'secret-key-12345',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc'
            };
            
            const missing = getMissingRequiredFields(completeConfig);
            expect(missing).toEqual([]);
        });

        it('should return missing required field names', () => {
            const incompleteConfig = {
                clientId: 'test-client',
                apiBaseUrl: 'https://api.example.com'
            };
            
            const missing = getMissingRequiredFields(incompleteConfig);
            expect(missing).toContain('clientSecret');
            expect(missing).toContain('agentUserId');
            expect(missing).toHaveLength(2);
        });

        it('should return all required fields for empty config', () => {
            const missing = getMissingRequiredFields({});
            expect(missing).toContain('clientId');
            expect(missing).toContain('clientSecret');
            expect(missing).toContain('apiBaseUrl');
            expect(missing).toContain('agentUserId');
            expect(missing).toHaveLength(4);
        });
    });

    describe('sanitizeConfigForLogging', () => {
        it('should redact client secret', () => {
            const config = {
                clientId: 'test-client',
                clientSecret: 'super-secret-key',
                apiBaseUrl: 'https://api.example.com',
                agentUserId: '12345678-1234-1234-1234-123456789abc'
            };
            
            const sanitized = sanitizeConfigForLogging(config);
            
            expect(sanitized.clientSecret).toBe('***REDACTED***');
            expect(sanitized.clientId).toBe('test-client');
            expect(sanitized.apiBaseUrl).toBe('https://api.example.com');
            expect(sanitized.agentUserId).toBe('12345678-1234-1234-1234-123456789abc');
        });

        it('should handle config without client secret', () => {
            const config = {
                clientId: 'test-client',
                apiBaseUrl: 'https://api.example.com'
            };
            
            const sanitized = sanitizeConfigForLogging(config);
            
            expect(sanitized.clientSecret).toBeUndefined();
            expect(sanitized.clientId).toBe('test-client');
        });

        it('should not modify original config object', () => {
            const config = {
                clientId: 'test-client',
                clientSecret: 'super-secret-key'
            };
            
            const sanitized = sanitizeConfigForLogging(config);
            
            expect(config.clientSecret).toBe('super-secret-key');
            expect(sanitized.clientSecret).toBe('***REDACTED***');
        });
    });
});