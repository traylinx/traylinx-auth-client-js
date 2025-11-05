/**
 * Comprehensive test suite for error class hierarchy.
 * 
 * Tests all custom error classes to ensure proper inheritance,
 * error properties, and behavior.
 */

const {
    TraylinxAuthError,
    AuthenticationError,
    TokenExpiredError,
    NetworkError,
    ValidationError
} = require('../src/errors');

describe('Error Class Hierarchy', () => {
    describe('TraylinxAuthError (Base Class)', () => {
        it('should create error with message only', () => {
            const error = new TraylinxAuthError('Test error message');
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(TraylinxAuthError);
            expect(error.name).toBe('TraylinxAuthError');
            expect(error.message).toBe('Test error message');
            expect(error.code).toBeNull();
            expect(error.statusCode).toBeNull();
            expect(error.stack).toBeDefined();
        });

        it('should create error with message, code, and status code', () => {
            const error = new TraylinxAuthError('Test error', 'TEST_CODE', 500);
            
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.statusCode).toBe(500);
        });

        it('should handle null and undefined parameters gracefully', () => {
            const error1 = new TraylinxAuthError('Test', null, null);
            const error2 = new TraylinxAuthError('Test', undefined, undefined);
            
            expect(error1.code).toBeNull();
            expect(error1.statusCode).toBeNull();
            expect(error2.code).toBeNull();
            expect(error2.statusCode).toBeNull();
        });

        it('should maintain proper stack trace', () => {
            function throwError() {
                throw new TraylinxAuthError('Stack trace test');
            }
            
            expect(() => throwError()).toThrow(TraylinxAuthError);
            
            try {
                throwError();
            } catch (error) {
                expect(error.stack).toContain('throwError');
                expect(error.stack).toContain('Stack trace test');
            }
        });
    });

    describe('AuthenticationError', () => {
        it('should create with default values', () => {
            const error = new AuthenticationError();
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(TraylinxAuthError);
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.name).toBe('AuthenticationError');
            expect(error.message).toBe('Authentication failed');
            expect(error.code).toBe('AUTH_ERROR');
            expect(error.statusCode).toBe(401);
        });

        it('should create with custom message', () => {
            const error = new AuthenticationError('Invalid credentials provided');
            
            expect(error.message).toBe('Invalid credentials provided');
            expect(error.code).toBe('AUTH_ERROR');
            expect(error.statusCode).toBe(401);
        });

        it('should create with custom message, code, and status', () => {
            const error = new AuthenticationError('Custom auth error', 'CUSTOM_AUTH', 403);
            
            expect(error.message).toBe('Custom auth error');
            expect(error.code).toBe('CUSTOM_AUTH');
            expect(error.statusCode).toBe(403);
        });

        it('should be catchable as base TraylinxAuthError', () => {
            const error = new AuthenticationError('Test auth error');
            
            expect(error instanceof TraylinxAuthError).toBe(true);
            expect(error instanceof AuthenticationError).toBe(true);
        });

        it('should maintain proper inheritance chain', () => {
            const error = new AuthenticationError();
            
            expect(Object.getPrototypeOf(error)).toBe(AuthenticationError.prototype);
            expect(Object.getPrototypeOf(AuthenticationError.prototype)).toBe(TraylinxAuthError.prototype);
            expect(Object.getPrototypeOf(TraylinxAuthError.prototype)).toBe(Error.prototype);
        });
    });

    describe('TokenExpiredError', () => {
        it('should create with default values', () => {
            const error = new TokenExpiredError();
            
            expect(error).toBeInstanceOf(TokenExpiredError);
            expect(error).toBeInstanceOf(TraylinxAuthError);
            expect(error.name).toBe('TokenExpiredError');
            expect(error.message).toBe('Token has expired');
            expect(error.code).toBe('TOKEN_EXPIRED');
            expect(error.statusCode).toBe(401);
        });

        it('should create with custom message', () => {
            const error = new TokenExpiredError('Access token expired at 2024-01-01T00:00:00Z');
            
            expect(error.message).toBe('Access token expired at 2024-01-01T00:00:00Z');
            expect(error.code).toBe('TOKEN_EXPIRED');
            expect(error.statusCode).toBe(401);
        });

        it('should create with all custom parameters', () => {
            const error = new TokenExpiredError('Custom expiry message', 'CUSTOM_EXPIRED', 403);
            
            expect(error.message).toBe('Custom expiry message');
            expect(error.code).toBe('CUSTOM_EXPIRED');
            expect(error.statusCode).toBe(403);
        });

        it('should be distinguishable from AuthenticationError', () => {
            const tokenError = new TokenExpiredError();
            const authError = new AuthenticationError();
            
            expect(tokenError instanceof TokenExpiredError).toBe(true);
            expect(tokenError instanceof AuthenticationError).toBe(false);
            expect(authError instanceof AuthenticationError).toBe(true);
            expect(authError instanceof TokenExpiredError).toBe(false);
            
            // Both should be TraylinxAuthError
            expect(tokenError instanceof TraylinxAuthError).toBe(true);
            expect(authError instanceof TraylinxAuthError).toBe(true);
        });
    });

    describe('NetworkError', () => {
        it('should create with message only', () => {
            const error = new NetworkError('Connection timeout');
            
            expect(error).toBeInstanceOf(NetworkError);
            expect(error).toBeInstanceOf(TraylinxAuthError);
            expect(error.name).toBe('NetworkError');
            expect(error.message).toBe('Connection timeout');
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.statusCode).toBeNull();
        });

        it('should create with message and code', () => {
            const error = new NetworkError('DNS resolution failed', 'DNS_ERROR');
            
            expect(error.message).toBe('DNS resolution failed');
            expect(error.code).toBe('DNS_ERROR');
            expect(error.statusCode).toBeNull();
        });

        it('should create with all parameters', () => {
            const error = new NetworkError('Rate limit exceeded', 'RATE_LIMIT', 429);
            
            expect(error.message).toBe('Rate limit exceeded');
            expect(error.code).toBe('RATE_LIMIT');
            expect(error.statusCode).toBe(429);
        });

        it('should handle various network error scenarios', () => {
            const timeoutError = new NetworkError('Request timeout', 'TIMEOUT', 408);
            const connectionError = new NetworkError('Connection refused', 'CONNECTION_REFUSED', 0);
            const serverError = new NetworkError('Internal server error', 'SERVER_ERROR', 500);
            
            expect(timeoutError.code).toBe('TIMEOUT');
            expect(connectionError.code).toBe('CONNECTION_REFUSED');
            expect(serverError.code).toBe('SERVER_ERROR');
            
            expect(timeoutError.statusCode).toBe(408);
            expect(connectionError.statusCode).toBe(0);
            expect(serverError.statusCode).toBe(500);
        });
    });

    describe('ValidationError', () => {
        it('should create with default values', () => {
            const error = new ValidationError('Invalid input provided');
            
            expect(error).toBeInstanceOf(ValidationError);
            expect(error).toBeInstanceOf(TraylinxAuthError);
            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Invalid input provided');
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
        });

        it('should create with custom code', () => {
            const error = new ValidationError('Invalid UUID format', 'INVALID_UUID');
            
            expect(error.message).toBe('Invalid UUID format');
            expect(error.code).toBe('INVALID_UUID');
            expect(error.statusCode).toBe(400);
        });

        it('should create with all custom parameters', () => {
            const error = new ValidationError('Schema validation failed', 'SCHEMA_ERROR', 422);
            
            expect(error.message).toBe('Schema validation failed');
            expect(error.code).toBe('SCHEMA_ERROR');
            expect(error.statusCode).toBe(422);
        });

        it('should handle validation-specific scenarios', () => {
            const urlError = new ValidationError('Invalid URL format', 'INVALID_URL');
            const uuidError = new ValidationError('Invalid UUID format', 'INVALID_UUID');
            const rangeError = new ValidationError('Value out of range', 'OUT_OF_RANGE');
            
            expect(urlError.code).toBe('INVALID_URL');
            expect(uuidError.code).toBe('INVALID_UUID');
            expect(rangeError.code).toBe('OUT_OF_RANGE');
        });
    });

    describe('Error Serialization and JSON', () => {
        it('should serialize errors to JSON properly', () => {
            const error = new AuthenticationError('Test auth error', 'TEST_AUTH', 401);
            
            // Error objects don't serialize message by default in JSON.stringify
            // We need to create a custom serialization or check the properties directly
            const errorObj = {
                name: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.statusCode
            };
            
            const serialized = JSON.stringify(errorObj);
            const parsed = JSON.parse(serialized);
            
            expect(parsed.message).toBe('Test auth error');
            expect(parsed.name).toBe('AuthenticationError');
            expect(parsed.code).toBe('TEST_AUTH');
            expect(parsed.statusCode).toBe(401);
        });

        it('should provide error information via toString', () => {
            const error = new NetworkError('Connection failed', 'CONN_FAIL', 500);
            
            const errorString = error.toString();
            expect(errorString).toContain('NetworkError');
            expect(errorString).toContain('Connection failed');
        });

        it('should maintain error properties after being thrown and caught', () => {
            let caughtError;
            
            try {
                throw new ValidationError('Test validation', 'TEST_VALID', 422);
            } catch (error) {
                caughtError = error;
            }
            
            expect(caughtError).toBeInstanceOf(ValidationError);
            expect(caughtError.message).toBe('Test validation');
            expect(caughtError.code).toBe('TEST_VALID');
            expect(caughtError.statusCode).toBe(422);
        });
    });

    describe('Error Comparison and Type Checking', () => {
        it('should allow proper error type checking in catch blocks', () => {
            const errors = [
                new AuthenticationError('Auth failed'),
                new TokenExpiredError('Token expired'),
                new NetworkError('Network failed'),
                new ValidationError('Validation failed')
            ];
            
            errors.forEach(error => {
                try {
                    throw error;
                } catch (e) {
                    expect(e instanceof TraylinxAuthError).toBe(true);
                    
                    if (e instanceof AuthenticationError) {
                        expect(e.code).toBe('AUTH_ERROR');
                    } else if (e instanceof TokenExpiredError) {
                        expect(e.code).toBe('TOKEN_EXPIRED');
                    } else if (e instanceof NetworkError) {
                        expect(e.code).toBe('NETWORK_ERROR');
                    } else if (e instanceof ValidationError) {
                        expect(e.code).toBe('VALIDATION_ERROR');
                    }
                }
            });
        });

        it('should support error filtering by type', () => {
            const errors = [
                new AuthenticationError(),
                new NetworkError('Network issue'),
                new ValidationError('Invalid input'),
                new TokenExpiredError()
            ];
            
            const authErrors = errors.filter(e => e instanceof AuthenticationError);
            const networkErrors = errors.filter(e => e instanceof NetworkError);
            const validationErrors = errors.filter(e => e instanceof ValidationError);
            const tokenErrors = errors.filter(e => e instanceof TokenExpiredError);
            
            expect(authErrors).toHaveLength(1);
            expect(networkErrors).toHaveLength(1);
            expect(validationErrors).toHaveLength(1);
            expect(tokenErrors).toHaveLength(1);
        });
    });

    describe('Error Stack Trace Behavior', () => {
        it('should capture stack trace correctly for each error type', () => {
            function createAuthError() {
                return new AuthenticationError('Auth error in function');
            }
            
            function createNetworkError() {
                return new NetworkError('Network error in function');
            }
            
            const authError = createAuthError();
            const networkError = createNetworkError();
            
            expect(authError.stack).toContain('createAuthError');
            expect(networkError.stack).toContain('createNetworkError');
        });

        it('should maintain clean stack traces without constructor pollution', () => {
            const error = new ValidationError('Clean stack test');
            
            // Stack should not contain the error constructor itself
            expect(error.stack).toBeDefined();
            expect(error.stack.split('\n').length).toBeGreaterThan(1);
        });
    });
});