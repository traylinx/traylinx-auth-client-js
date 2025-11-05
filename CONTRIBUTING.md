# Contributing to TraylinxAuthClient (JavaScript)

Thank you for your interest in contributing to the TraylinxAuthClient JavaScript library! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that promotes a welcoming and inclusive environment. By participating, you agree to uphold these standards:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept responsibility for mistakes
- Prioritize community well-being
- Report unacceptable behavior to the maintainers

## Getting Started

### Prerequisites

- Node.js 14 or higher
- npm or yarn for package management
- Git for version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/traylinx-auth-client-js.git
   cd traylinx-auth-client-js
   ```

## Development Setup

### Install Dependencies

1. Install project dependencies:
   ```bash
   npm install
   ```
   
   Or with Yarn:
   ```bash
   yarn install
   ```

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure your test environment variables:
   ```bash
   # .env
   TRAYLINX_CLIENT_ID=your_test_client_id
   TRAYLINX_CLIENT_SECRET=your_test_client_secret
   TRAYLINX_API_BASE_URL=https://your-test-api.com
   TRAYLINX_AGENT_USER_ID=your-test-uuid
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:
- `feature/add-new-validation`
- `bugfix/fix-token-refresh`
- `docs/update-readme`
- `test/add-error-scenarios`

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style guidelines
3. Add or update tests for your changes
4. Update documentation if needed
5. Commit your changes with clear messages

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(auth): add input validation for client configuration`
- `fix(network): handle connection timeout errors properly`
- `docs(readme): add troubleshooting section`
- `test(client): add tests for error scenarios`

## Testing

### Running Tests

Run the full test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run specific test files:
```bash
npm test -- tests/client.test.js
```

Run tests with verbose output:
```bash
npm test -- --verbose
```

### Test Requirements

- All new features must include comprehensive tests
- Bug fixes must include regression tests
- Maintain >90% test coverage
- Tests should cover both success and error scenarios
- Include integration tests for complex features

### Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── client.test.js      # Main client functionality
│   ├── validation.test.js  # Input validation
│   ├── errors.test.js      # Error classes
│   └── tokenManager.test.js # Token management
├── integration/            # Integration tests
│   ├── authFlow.test.js    # End-to-end authentication
│   └── errorScenarios.test.js # Error handling
└── fixtures/               # Test data and mocks
    └── mockResponses.js    # Mock API responses
```

### Writing Tests

Use Jest conventions and best practices:

```javascript
const { TraylinxAuthClient } = require('../src');
const { ValidationError } = require('../src/errors');

describe('TraylinxAuthClient', () => {
    describe('constructor validation', () => {
        it('should throw ValidationError for invalid client ID', () => {
            expect(() => {
                new TraylinxAuthClient({
                    clientId: 'invalid@client',  // Invalid character
                    clientSecret: 'valid_secret',
                    apiBaseUrl: 'https://api.example.com',
                    agentUserId: '550e8400-e29b-41d4-a716-446655440000'
                });
            }).toThrow(ValidationError);
        });
    });
});

// Mock setup
const mockAxios = {
    post: jest.fn(),
    get: jest.fn(),
    create: jest.fn(() => mockAxios)
};

jest.mock('axios', () => mockAxios);

beforeEach(() => {
    jest.clearAllMocks();
});
```

## Code Style

### JavaScript Style Guidelines

- Follow ESLint configuration provided in the project
- Use modern ES6+ features (async/await, destructuring, etc.)
- Maximum line length: 100 characters
- Use descriptive variable and function names
- Add JSDoc comments to all public methods and classes

### Code Formatting

Use Prettier for code formatting:
```bash
npm run format
```

Check formatting:
```bash
npm run format:check
```

### Linting

Run ESLint for linting:
```bash
npm run lint
```

Fix linting issues automatically:
```bash
npm run lint:fix
```

### Pre-commit Hooks

Install pre-commit hooks to automatically format and lint:
```bash
npm run prepare
```

## Submitting Changes

### Pull Request Process

1. Ensure all tests pass and coverage is maintained
2. Update documentation for any API changes
3. Add entries to CHANGELOG.md for notable changes
4. Create a pull request with:
   - Clear title and description
   - Reference to related issues
   - List of changes made
   - Testing instructions

### Pull Request Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Coverage maintained above 90%

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

### Review Process

1. Automated checks must pass (tests, linting, coverage)
2. At least one maintainer review required
3. Address all review feedback
4. Squash commits before merging (if requested)

## Release Process

### Version Numbering

Follow Semantic Versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md with release notes
3. Create release branch: `release/v1.x.x`
4. Run full test suite and quality checks
5. Create GitHub release with tag
6. Publish to npm: `npm publish`

## Getting Help

### Documentation

- [README.md](README.md) - Basic usage and installation
- [API Documentation](docs/api.md) - Detailed API reference
- [Design Document](docs/design.md) - Architecture and design decisions

### Communication

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Security**: See [SECURITY.md](SECURITY.md) for security-related issues

### Maintainers

Current maintainers:
- [@maintainer1](https://github.com/maintainer1)
- [@maintainer2](https://github.com/maintainer2)

## Development Tips

### Debugging

Enable debug logging:
```javascript
const client = new TraylinxAuthClient({
    // ... config
    logLevel: 'DEBUG'
});

// Or set environment variable
process.env.DEBUG = 'traylinx-auth-client:*';
```

### Testing Against Real API

For integration testing against a real API:
1. Set up test credentials in `.env`
2. Use the test environment endpoints
3. Never commit real credentials to version control

### Performance Testing

Run performance tests:
```bash
npm run test:performance
```

Monitor memory usage:
```bash
node --inspect your_test_script.js
```

### Express Middleware Development

When working on Express middleware:

```javascript
const express = require('express');
const { authMiddleware } = require('./src');

const app = express();

// Test middleware locally
app.use('/test', authMiddleware({
    clientId: process.env.TRAYLINX_CLIENT_ID,
    clientSecret: process.env.TRAYLINX_CLIENT_SECRET,
    apiBaseUrl: process.env.TRAYLINX_API_BASE_URL,
    agentUserId: process.env.TRAYLINX_AGENT_USER_ID
}));

app.get('/test/protected', (req, res) => {
    res.json({ message: 'Authenticated!', user: req.user });
});

app.listen(3000, () => {
    console.log('Test server running on port 3000');
});
```

### Async/Await Best Practices

```javascript
// ✅ Good: Proper error handling
async function authenticateUser() {
    try {
        const result = await client.authenticate();
        return result;
    } catch (error) {
        if (error instanceof AuthenticationError) {
            // Handle auth errors specifically
            throw new Error('Authentication failed');
        }
        throw error; // Re-throw other errors
    }
}

// ❌ Bad: No error handling
async function authenticateUser() {
    return await client.authenticate(); // Errors will bubble up unhandled
}
```

### Package Scripts

Available npm scripts:
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run build` - Build the package (if applicable)
- `npm run docs` - Generate documentation

Thank you for contributing to TraylinxAuthClient! Your efforts help make this library better for everyone.