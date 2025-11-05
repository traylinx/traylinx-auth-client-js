const request = require('supertest');
const express = require('express');

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-1234')
}));

// Mock axios
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        post: jest.fn(),
        interceptors: {
            response: {
                use: jest.fn()
            }
        }
    })),
    request: jest.fn()
}));

// Mock the client methods we need
const mockGetRequestHeaders = jest.fn();
const mockGetAgentRequestHeaders = jest.fn();
const mockValidateToken = jest.fn();
const mockValidateA2ARequest = jest.fn();
const mockDetectAuthMode = jest.fn();
const mockGetA2AHeaders = jest.fn();

jest.mock('../src/client', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getRequestHeaders: mockGetRequestHeaders,
            getAgentRequestHeaders: mockGetAgentRequestHeaders,
            validateToken: mockValidateToken,
            validateA2ARequest: mockValidateA2ARequest,
            detectAuthMode: mockDetectAuthMode,
            getA2AHeaders: mockGetA2AHeaders,
        };
    });
});

const { 
    getRequestHeaders, 
    getAgentRequestHeaders,
    validateA2ARequest,
    requireA2AAuth, 
    detectAuthMode,
    validateDualAuthRequest,
    requireDualAuth
} = require('../src/index');

describe('Index Module Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRequestHeaders', () => {
        it('should return headers from client', async () => {
            const expectedHeaders = {
                'Authorization': 'Bearer test_access_token',
                'X-Agent-Secret-Token': 'test_agent_secret_token',
                'X-Agent-User-Id': 'test_user_id',
            };
            
            mockGetRequestHeaders.mockResolvedValue(expectedHeaders);

            const headers = await getRequestHeaders();

            expect(headers).toEqual(expectedHeaders);
            expect(mockGetRequestHeaders).toHaveBeenCalledTimes(1);
        });

        it('should handle client errors', async () => {
            mockGetRequestHeaders.mockRejectedValue(new Error('Client error'));

            await expect(getRequestHeaders()).rejects.toThrow('Client error');
        });
    });

    describe('getAgentRequestHeaders', () => {
        it('should return agent headers from client', async () => {
            const expectedHeaders = {
                'X-Agent-Secret-Token': 'test_agent_secret_token',
                'X-Agent-User-Id': 'test_user_id',
            };
            
            mockGetAgentRequestHeaders.mockResolvedValue(expectedHeaders);

            const headers = await getAgentRequestHeaders();

            expect(headers).toEqual(expectedHeaders);
            expect(mockGetAgentRequestHeaders).toHaveBeenCalledTimes(1);
        });
    });

    describe('validateA2ARequest', () => {
        it('should validate request with valid headers', async () => {
            const headers = {
                'x-agent-secret-token': 'valid_token',
                'x-agent-user-id': 'test_user'
            };
            
            mockValidateToken.mockResolvedValue(true);

            const isValid = await validateA2ARequest(headers);

            expect(isValid).toBe(true);
            expect(mockValidateToken).toHaveBeenCalledWith('valid_token', 'test_user');
        });

        it('should return false for missing headers', async () => {
            const headers = {};

            const isValid = await validateA2ARequest(headers);

            expect(isValid).toBe(false);
            expect(mockValidateToken).not.toHaveBeenCalled();
        });

        it('should return false for missing token', async () => {
            const headers = {
                'x-agent-user-id': 'test_user'
            };

            const isValid = await validateA2ARequest(headers);

            expect(isValid).toBe(false);
        });

        it('should return false for missing user id', async () => {
            const headers = {
                'x-agent-secret-token': 'valid_token'
            };

            const isValid = await validateA2ARequest(headers);

            expect(isValid).toBe(false);
        });
    });

    describe('detectAuthMode', () => {
        it('should detect auth mode from headers', () => {
            const headers = {
                'Authorization': 'Bearer test_token'
            };
            
            mockDetectAuthMode.mockReturnValue('bearer');

            const mode = detectAuthMode(headers);

            expect(mode).toBe('bearer');
            expect(mockDetectAuthMode).toHaveBeenCalledWith(headers);
        });
    });

    describe('validateDualAuthRequest', () => {
        it('should validate dual auth request', async () => {
            const headers = {
                'Authorization': 'Bearer test_token',
                'X-Agent-User-Id': 'test_user'
            };
            
            mockValidateA2ARequest.mockResolvedValue(true);

            const isValid = await validateDualAuthRequest(headers);

            expect(isValid).toBe(true);
            expect(mockValidateA2ARequest).toHaveBeenCalledWith(headers);
        });
    });
});

describe('Express Middleware', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
    });

    describe('requireA2AAuth', () => {
        beforeEach(() => {
            app.get('/protected', requireA2AAuth, (req, res) => {
                res.status(200).json({ message: 'ok' });
            });
        });

        it('should allow access with valid authentication', async () => {
            mockValidateToken.mockResolvedValue(true);

            await request(app)
                .get('/protected')
                .set('x-agent-secret-token', 'valid_token')
                .set('x-agent-user-id', 'test_user')
                .expect(200, { message: 'ok' });
        });

        it('should deny access with invalid authentication', async () => {
            mockValidateToken.mockResolvedValue(false);

            await request(app)
                .get('/protected')
                .set('x-agent-secret-token', 'invalid_token')
                .set('x-agent-user-id', 'test_user')
                .expect(401, { error: 'Invalid or missing A2A authentication' });
        });

        it('should deny access with missing headers', async () => {
            await request(app)
                .get('/protected')
                .expect(401, { error: 'Invalid or missing A2A authentication' });
        });

        it('should handle validation errors', async () => {
            mockValidateToken.mockRejectedValue(new Error('Service error'));

            await request(app)
                .get('/protected')
                .set('x-agent-secret-token', 'valid_token')
                .set('x-agent-user-id', 'test_user')
                .expect(500, { error: 'Internal server error' });
        });
    });

    describe('requireDualAuth', () => {
        beforeEach(() => {
            app.get('/protected', requireDualAuth, (req, res) => {
                res.status(200).json({ 
                    message: 'ok',
                    authMode: req.authMode
                });
            });
        });

        it('should allow access with valid dual authentication', async () => {
            mockValidateA2ARequest.mockResolvedValue(true);
            mockDetectAuthMode.mockReturnValue('bearer');

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer valid_token')
                .set('X-Agent-User-Id', 'test_user')
                .expect(200);

            expect(response.body.message).toBe('ok');
            expect(response.body.authMode).toBe('bearer');
        });

        it('should deny access with invalid authentication', async () => {
            mockValidateA2ARequest.mockResolvedValue(false);
            mockDetectAuthMode.mockReturnValue('bearer');

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer invalid_token')
                .set('X-Agent-User-Id', 'test_user')
                .expect(401, { error: 'Invalid or missing authentication' });
        });

        it('should handle validation errors', async () => {
            mockValidateA2ARequest.mockRejectedValue(new Error('Service error'));
            mockDetectAuthMode.mockReturnValue('bearer');

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer valid_token')
                .set('X-Agent-User-Id', 'test_user')
                .expect(500, { error: 'Internal server error' });
        });
    });
});