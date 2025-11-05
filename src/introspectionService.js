// DEPRECATED: This file is deprecated and will be removed in a future version.
// Please use the TraylinxAuthClient class in client.js instead.

const axios = require('axios');

class IntrospectionService {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
    }

    async validateToken(agentSecretToken, agentUserId) {
        const apiBaseUrl = process.env.TRAYLINX_API_BASE_URL;
        try {
            const accessToken = await this.tokenManager.getAccessToken();
            const response = await axios.post(
                `${apiBaseUrl}/oauth/agent/introspect`,
                new URLSearchParams({
                    agent_secret_token: agentSecretToken,
                    agent_user_id: agentUserId,
                }),
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return response.data.active === true;
        } catch (error) {
            console.error('Error validating token:', error.message);
            return false;
        }
    }
}

module.exports = IntrospectionService;
