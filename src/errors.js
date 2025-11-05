/**
 * Custom error hierarchy for TraylinxAuthClient.
 * 
 * This module defines a comprehensive error class hierarchy for handling
 * various error conditions in the TraylinxAuthClient library.
 */

/**
 * Base error class for all TraylinxAuthClient errors.
 * 
 * All errors thrown by the TraylinxAuthClient library inherit from this base class.
 * This allows for easy catching of all library-specific errors.
 */
class TraylinxAuthError extends Error {
    /**
     * Create a TraylinxAuthError.
     * @param {string} message - Error message
     * @param {string} [code] - Error code identifier
     * @param {number} [statusCode] - HTTP status code (if applicable)
     */
    constructor(message, code = null, statusCode = null) {
        super(message);
        this.name = 'TraylinxAuthError';
        this.code = code;
        this.statusCode = statusCode;
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TraylinxAuthError);
        }
    }
}

/**
 * Thrown when authentication fails.
 * 
 * This includes invalid credentials, malformed responses from the auth service,
 * or other authentication-related failures.
 */
class AuthenticationError extends TraylinxAuthError {
    /**
     * Create an AuthenticationError.
     * @param {string} [message='Authentication failed'] - Error message
     * @param {string} [code='AUTH_ERROR'] - Error code
     * @param {number} [statusCode=401] - HTTP status code
     */
    constructor(message = 'Authentication failed', code = 'AUTH_ERROR', statusCode = 401) {
        super(message, code, statusCode);
        this.name = 'AuthenticationError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthenticationError);
        }
    }
}

/**
 * Thrown when a token has expired and cannot be refreshed.
 * 
 * This is a specific type of authentication error that occurs when
 * tokens expire and automatic refresh fails.
 */
class TokenExpiredError extends TraylinxAuthError {
    /**
     * Create a TokenExpiredError.
     * @param {string} [message='Token has expired'] - Error message
     * @param {string} [code='TOKEN_EXPIRED'] - Error code
     * @param {number} [statusCode=401] - HTTP status code
     */
    constructor(message = 'Token has expired', code = 'TOKEN_EXPIRED', statusCode = 401) {
        super(message, code, statusCode);
        this.name = 'TokenExpiredError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TokenExpiredError);
        }
    }
}

/**
 * Thrown when network communication fails.
 * 
 * This includes timeouts, connection failures, DNS resolution errors,
 * rate limiting, and server errors.
 */
class NetworkError extends TraylinxAuthError {
    /**
     * Create a NetworkError.
     * @param {string} message - Error message
     * @param {string} [code='NETWORK_ERROR'] - Error code
     * @param {number} [statusCode] - HTTP status code (if applicable)
     */
    constructor(message, code = 'NETWORK_ERROR', statusCode = null) {
        super(message, code, statusCode);
        this.name = 'NetworkError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NetworkError);
        }
    }
}

/**
 * Thrown when input validation fails.
 * 
 * This includes invalid configuration parameters, malformed URLs,
 * invalid UUIDs, and other input validation failures.
 */
class ValidationError extends TraylinxAuthError {
    /**
     * Create a ValidationError.
     * @param {string} message - Error message
     * @param {string} [code='VALIDATION_ERROR'] - Error code
     * @param {number} [statusCode=400] - HTTP status code
     */
    constructor(message, code = 'VALIDATION_ERROR', statusCode = 400) {
        super(message, code, statusCode);
        this.name = 'ValidationError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ValidationError);
        }
    }
}

module.exports = {
    TraylinxAuthError,
    AuthenticationError,
    TokenExpiredError,
    NetworkError,
    ValidationError
};