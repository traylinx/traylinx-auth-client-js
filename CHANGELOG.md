# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-09

### Added
- **Agent-to-Agent (A2A) Protocol Support**: Full implementation of Google's A2A Protocol for seamless agent communication
  - `getA2AHeaders()` method for A2A-compliant Bearer token format
  - `validateA2ARequest()` method supporting dual-mode authentication (Bearer + custom headers)
  - `detectAuthMode()` for automatic authentication format detection
  - `requireDualAuth` Express middleware for flexible endpoint protection
  - JSON-RPC methods: `rpcCall()`, `rpcIntrospectToken()`, `rpcGetCapabilities()`, `rpcHealthCheck()`
  - Full backward compatibility with existing custom header format
  - Migration-friendly design supporting gradual A2A adoption
- **Comprehensive Input Validation**: Added Joi-based configuration validation for all client parameters
  - Client ID format validation (alphanumeric, hyphens, underscores only)
  - URL format validation for API base URL
  - UUID format validation for agent user ID
  - Client secret security requirements validation
  - Timeout and retry parameter range validation
- **Custom Error Hierarchy**: Implemented structured error handling with specific error classes
  - `TraylinxAuthError`: Base error class with error codes and status codes
  - `AuthenticationError`: For authentication failures and credential issues
  - `TokenExpiredError`: For token expiration scenarios
  - `NetworkError`: For network connectivity and timeout issues
  - `ValidationError`: For input validation failures
- **Enhanced Error Handling**: Comprehensive HTTP error code handling with meaningful messages
  - Specific handling for 401 (authentication), 429 (rate limiting), 5xx (server errors)
  - Detailed error context and debugging information
  - Network exception handling (ECONNABORTED, ENOTFOUND, ECONNREFUSED)
- **Timeout and Retry Logic**: Robust network resilience features
  - Configurable timeout settings (default 30 seconds)
  - Exponential backoff retry strategy for transient failures
  - Axios interceptors for automatic retry handling
  - Automatic retry for rate limits and server errors
- **Production Readiness Features**:
  - Async-safe token management for concurrent requests
  - Configurable logging without exposing sensitive data
  - Request timing and performance monitoring capabilities
  - Secure credential handling and memory management
- **Enhanced Package Configuration**:
  - Updated to version 1.0.0 for stable release
  - Comprehensive package metadata with keywords and description
  - MIT License inclusion
  - Proper dependency management with security updates

### Changed
- **Backward Compatible API**: All existing public methods maintain the same signatures and behavior
- **Improved Token Management**: Enhanced caching and refresh logic while maintaining existing functionality
- **Enhanced Documentation**: Expanded README with comprehensive usage examples and troubleshooting

### Security
- **Input Sanitization**: All configuration parameters are validated to prevent injection attacks
- **Credential Protection**: Tokens and secrets are never logged or exposed in error messages
- **Secure Defaults**: HTTPS enforcement and proper certificate validation
- **Memory Safety**: Secure handling of sensitive data in memory

### Technical Details
- **Dependencies**: 
  - Added: `joi ^17.0.0` for input validation
  - Added: `axios-retry ^4.0.0` for enhanced retry logic
  - Maintained: `axios` for HTTP client functionality
- **Node.js Compatibility**: Supports Node.js 14, 16, 18, 20+
- **Test Coverage**: Comprehensive test suite with >90% coverage using Jest
- **Performance**: Optimized request handling and token caching

### Migration Guide
This release is fully backward compatible. Existing code will continue to work without changes. New validation and error handling features are automatically enabled.

To take advantage of new configuration options:
```javascript
const { TraylinxAuthClient } = require('traylinx-auth-client');

// New optional configuration parameters
const client = new TraylinxAuthClient({
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    apiBaseUrl: 'https://your-api.com',
    agentUserId: 'your-uuid',
    timeout: 30000,  // New: configurable timeout (ms)
    maxRetries: 3,   // New: configurable retry attempts
    retryDelay: 1000, // New: configurable retry delay (ms)
    logLevel: 'INFO' // New: configurable logging
});
```

### Express Middleware
Enhanced middleware with better error handling:
```javascript
const { authMiddleware } = require('traylinx-auth-client');

app.use('/protected', authMiddleware({
    clientId: process.env.TRAYLINX_CLIENT_ID,
    clientSecret: process.env.TRAYLINX_CLIENT_SECRET,
    apiBaseUrl: process.env.TRAYLINX_API_BASE_URL,
    agentUserId: process.env.TRAYLINX_AGENT_USER_ID,
    // New configuration options available
    timeout: 30000,
    maxRetries: 3,
    logLevel: 'INFO'
}));
```

## [Unreleased]

### Planned
- TypeScript definitions for better IDE support
- Additional authentication methods
- Enhanced monitoring and metrics
- Performance optimizations
- React hooks for frontend integration

---

For more information about this release, see the [Requirements Document](https://github.com/your-org/traylinx-auth-client-js/blob/main/docs/requirements.md) and [Design Document](https://github.com/your-org/traylinx-auth-client-js/blob/main/docs/design.md).