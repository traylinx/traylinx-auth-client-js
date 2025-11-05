// DEPRECATED: This file is deprecated and will be removed in a future version.
// Please use the TraylinxAuthClient class in client.js instead.

const axios = require('axios');

class TokenManager {
    constructor() {
        this.clientId = process.env.TRAYLINX_CLIENT_ID;
        this.clientSecret = process.env.TRAYLINX_CLIENT_SECRET;
        this.apiBaseUrl = process.env.TRAYLINX_API_BASE_URL;

        this.accessToken = null;
        this.agentSecretToken = null;
        this.tokenExpiration = null;
        this._fetchPromise = null; // For handling concurrent requests
    }
    
    _validateConfig() {
        if (!this.clientId || !this.clientSecret || !this.apiBaseUrl || 
            this.clientId.trim() === '' || this.clientSecret.trim() === '' || this.apiBaseUrl.trim() === '') {
            throw new Error('Missing required environment variables: TRAYLINX_CLIENT_ID, TRAYLINX_CLIENT_SECRET, TRAYLINX_API_BASE_URL');
        }
    }

    async _fetchTokens() {
        try {
            // Validate configuration before making request
            this._validateConfig();
            
            const response = await axios.post(`${this.apiBaseUrl}/oauth/token`, new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'a2a',
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const { access_token, agent_secret_token, expires_in } = response.data;
            
            // Validate response structure
            if (!access_token || !agent_secret_token || expires_in === undefined) {
                throw new Error('Invalid token response: missing required fields');
            }
            
            this.accessToken = access_token;
            this.agentSecretToken = agent_secret_token;
            this.tokenExpiration = Date.now() + (expires_in * 1000);
        } catch (error) {
            console.error('Error fetching tokens:', error.message);
            throw new Error('Could not fetch tokens from Traylinx Sentinel');
        } finally {
            this._fetchPromise = null; // Clear the promise after completion
        }
    }

    async getAccessToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiration) {
            // Handle concurrent requests by reusing the same promise
            if (!this._fetchPromise) {
                this._fetchPromise = this._fetchTokens();
            }
            await this._fetchPromise;
        }
        return this.accessToken;
    }

    async getAgentSecretToken() {
        if (!this.agentSecretToken || Date.now() >= this.tokenExpiration) {
            // Handle concurrent requests by reusing the same promise
            if (!this._fetchPromise) {
                this._fetchPromise = this._fetchTokens();
            }
            await this._fetchPromise;
        }
        return this.agentSecretToken;
    }
}

module.exports = TokenManager;