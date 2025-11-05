/**
 * Configuration validation module for TraylinxAuthClient.
 * 
 * This module provides comprehensive input validation using Joi
 * to ensure security and prevent runtime errors.
 */

const Joi = require('joi');

/**
 * Configuration schema with comprehensive validation rules.
 */
const configSchema = Joi.object({
    clientId: Joi.string()
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Client ID cannot be empty',
            'string.pattern.base': 'Client ID must contain only alphanumeric characters, hyphens, and underscores',
            'string.min': 'Client ID must be at least 3 characters long',
            'string.max': 'Client ID must be no more than 100 characters long',
            'any.required': 'Client ID is required'
        }),
    
    clientSecret: Joi.string()
        .min(10)
        .max(500)
        .required()
        .custom((value, helpers) => {
            // Check for common weak patterns
            const weakPatterns = ['password', 'secret', '123456', 'admin'];
            if (weakPatterns.includes(value.toLowerCase())) {
                return helpers.error('any.invalid');
            }
            return value;
        })
        .messages({
            'string.empty': 'Client secret cannot be empty',
            'string.min': 'Client secret must be at least 10 characters long for security',
            'string.max': 'Client secret must be no more than 500 characters long',
            'any.required': 'Client secret is required',
            'any.invalid': 'Client secret appears to be a common weak value'
        }),
    
    apiBaseUrl: Joi.string()
        .uri({ scheme: ['https'] })
        .required()
        .custom((value, helpers) => {
            // Additional validation for edge cases
            try {
                const url = new URL(value);
                // Check for invalid hostnames
                if (!url.hostname || url.hostname === '.' || url.hostname === '') {
                    return helpers.error('string.uri');
                }
            } catch (e) {
                return helpers.error('string.uri');
            }
            
            // Remove trailing slash for consistency
            if (value.endsWith('/')) {
                return value.slice(0, -1);
            }
            return value;
        })
        .messages({
            'string.empty': 'API base URL cannot be empty',
            'string.uri': 'API base URL must be a valid HTTPS URL',
            'string.uriCustomScheme': 'API base URL must be a valid HTTPS URL',
            'any.required': 'API base URL is required'
        }),
    
    agentUserId: Joi.string()
        .required()
        .custom((value, helpers) => {
            // Check if it contains hyphens (UUID format)
            if (value.includes('-')) {
                // Standard UUID format: 8-4-4-4-12 = 36 chars with hyphens
                if (value.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    return helpers.error('string.guid');
                }
                return value.toLowerCase();
            } else {
                // Hex string without hyphens
                const cleanUuid = value.toLowerCase();
                
                // Check if it's a valid hex string and has at least 32 characters
                if (cleanUuid.length < 32 || !/^[0-9a-f]+$/i.test(cleanUuid)) {
                    return helpers.error('string.guid');
                }
                
                // Take first 32 characters and format as UUID
                const uuid32 = cleanUuid.slice(0, 32);
                return `${uuid32.slice(0, 8)}-${uuid32.slice(8, 12)}-${uuid32.slice(12, 16)}-${uuid32.slice(16, 20)}-${uuid32.slice(20)}`;
            }
        })
        .messages({
            'string.empty': 'Agent User ID cannot be empty',
            'string.guid': 'Agent User ID must be a valid UUID',
            'any.required': 'Agent User ID is required'
        }),
    
    timeout: Joi.number()
        .integer()
        .min(1000)
        .max(300000)
        .default(30000)
        .messages({
            'number.base': 'Timeout must be a number',
            'number.integer': 'Timeout must be an integer',
            'number.min': 'Timeout must be at least 1000ms (1 second)',
            'number.max': 'Timeout must be no more than 300000ms (5 minutes)'
        }),
    
    maxRetries: Joi.number()
        .integer()
        .min(0)
        .max(10)
        .default(3)
        .messages({
            'number.base': 'Max retries must be a number',
            'number.integer': 'Max retries must be an integer',
            'number.min': 'Max retries cannot be negative',
            'number.max': 'Max retries must be no more than 10 to prevent excessive delays'
        }),
    
    retryDelay: Joi.number()
        .min(100)
        .max(60000)
        .default(1000)
        .messages({
            'number.base': 'Retry delay must be a number',
            'number.min': 'Retry delay must be at least 100ms',
            'number.max': 'Retry delay must be no more than 60000ms (60 seconds)'
        }),
    
    cacheTokens: Joi.boolean()
        .strict()
        .default(true)
        .messages({
            'boolean.base': 'Cache tokens must be a boolean value'
        }),
    
    logLevel: Joi.string()
        .default('INFO')
        .custom((value, helpers) => {
            const upperValue = value.toUpperCase();
            const validLevels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL'];
            if (!validLevels.includes(upperValue)) {
                return helpers.error('any.only');
            }
            return upperValue;
        })
        .messages({
            'string.base': 'Log level must be a string',
            'any.only': 'Log level must be one of: DEBUG, INFO, WARN, WARNING, ERROR, CRITICAL'
        })
}).options({
    stripUnknown: true,  // Remove unknown properties
    abortEarly: false    // Return all validation errors, not just the first
});

/**
 * Validate configuration parameters.
 * 
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validated and normalized configuration
 * @throws {Error} If validation fails
 */
function validateConfig(config) {
    if (config === null || config === undefined) {
        throw new Error('Configuration validation failed: Configuration cannot be null or undefined');
    }
    
    const { error, value } = configSchema.validate(config);
    
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        throw new Error(`Configuration validation failed: ${errorMessages.join('; ')}`);
    }
    
    return value;
}

/**
 * Validate individual configuration parameter.
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @param {*} paramValue - Value to validate
 * @returns {*} Validated value
 * @throws {Error} If validation fails
 */
function validateParameter(paramName, paramValue) {
    let paramSchema;
    try {
        paramSchema = configSchema.extract(paramName);
    } catch (error) {
        throw new Error(`Unknown configuration parameter: ${paramName}`);
    }
    
    const { error: validationError, value } = paramSchema.validate(paramValue);
    
    if (validationError) {
        throw new Error(`Parameter '${paramName}' validation failed: ${validationError.message}`);
    }
    
    return value;
}

/**
 * Get default configuration values.
 * 
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    const { value } = configSchema.validate({});
    return value;
}

/**
 * Check if a configuration object has all required fields.
 * 
 * @param {Object} config - Configuration object to check
 * @returns {Array<string>} Array of missing required field names
 */
function getMissingRequiredFields(config) {
    const { error } = configSchema.validate(config);
    
    if (!error) {
        return [];
    }
    
    return error.details
        .filter(detail => detail.type === 'any.required')
        .map(detail => detail.path[0]);
}

/**
 * Sanitize configuration for logging (removes sensitive data).
 * 
 * @param {Object} config - Configuration object to sanitize
 * @returns {Object} Sanitized configuration safe for logging
 */
function sanitizeConfigForLogging(config) {
    const sanitized = { ...config };
    
    // Remove or mask sensitive fields
    if (sanitized.clientSecret) {
        sanitized.clientSecret = '***REDACTED***';
    }
    
    return sanitized;
}

module.exports = {
    configSchema,
    validateConfig,
    validateParameter,
    getDefaultConfig,
    getMissingRequiredFields,
    sanitizeConfigForLogging
};