// DEPRECATED: This file is deprecated and will be removed in a future version.
// Please use the TraylinxAuthClient class in client.js instead.

const axios = require('axios');
const { deadlineSignal, destination, credential, validIntrospection, AUTH_RESPONSE } = require('./security');

class IntrospectionService {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
    }

    async validateToken(agentSecretToken, agentUserId) {
        const apiBaseUrl = process.env.TRAYLINX_API_BASE_URL;
        const bound = deadlineSignal(30000);
        try {
            destination(apiBaseUrl, true);
            if (!credential(agentSecretToken) || !credential(agentUserId)) return false;
            const accessToken = await this.tokenManager.getAccessToken();
            const response = await axios.post(
                `${apiBaseUrl}/oauth/agent/introspect`,
                new URLSearchParams({
                    agent_secret_token: agentSecretToken,
                    agent_user_id: agentUserId,
                }),
                {
                    signal: bound.signal, timeout: 30000, maxRedirects: 0, maxContentLength: AUTH_RESPONSE, maxBodyLength: AUTH_RESPONSE,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return validIntrospection(response.data, agentUserId) === true;
        } catch (error) {
            // Fail closed without logging transport objects or credentials.
            return false;
        } finally { bound.cleanup(); }
    }
}

module.exports = IntrospectionService;
