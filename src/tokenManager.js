// DEPRECATED: This file is deprecated and will be removed in a future version.
// Please use the TraylinxAuthClient class in client.js instead.

const axios = require('axios');
const { deadlineSignal, destination, tokenState, AUTH_RESPONSE } = require('./security');

class TokenManager {
    constructor() {
        this.clientId = process.env.TRAYLINX_CLIENT_ID;
        this.clientSecret = process.env.TRAYLINX_CLIENT_SECRET;
        this.apiBaseUrl = process.env.TRAYLINX_API_BASE_URL;

        this.accessToken = null;
        this.agentSecretToken = null;
        this.tokenExpiration = null;
        this.agentTokenExpiration = 0;
        this._fetchPromise = null; // For handling concurrent requests
    }

    _validateConfig() {
        if (!this.clientId || !this.clientSecret || !this.apiBaseUrl ||
            this.clientId.trim() === '' || this.clientSecret.trim() === '' || this.apiBaseUrl.trim() === '') {
            throw new Error('Missing required environment variables: TRAYLINX_CLIENT_ID, TRAYLINX_CLIENT_SECRET, TRAYLINX_API_BASE_URL');
        }
    }

    async _fetchTokens() {
        const bound = deadlineSignal(30000);
        try {
            // Validate configuration before making request
            this._validateConfig();
            destination(this.apiBaseUrl, true);
            const started = Date.now();

            const response = await axios.post(`${this.apiBaseUrl}/oauth/token`, new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'a2a',
            }), {
                signal: bound.signal, timeout: 30000, maxRedirects: 0, maxContentLength: AUTH_RESPONSE, maxBodyLength: AUTH_RESPONSE,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            Object.assign(this, tokenState(response.data, started));
        } catch (error) {
            this.accessToken = this.agentSecretToken = null;
            this.tokenExpiration = this.agentTokenExpiration = 0;
            throw new Error('Could not fetch tokens from Traylinx Sentinel');
        } finally {
            bound.cleanup();
        }
    }

    async getAccessToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiration) {
            // Handle concurrent requests by reusing the same promise
            if (!this._fetchPromise) {
                this._fetchPromise = this._fetchTokens().finally(() => { this._fetchPromise = null; });
            }
            await this._fetchPromise;
        }
        return this.accessToken;
    }

    async getAgentSecretToken() {
        if (!this.agentSecretToken || Date.now() >= this.agentTokenExpiration) {
            // Handle concurrent requests by reusing the same promise
            if (!this._fetchPromise) {
                this._fetchPromise = this._fetchTokens().finally(() => { this._fetchPromise = null; });
            }
            await this._fetchPromise;
        }
        return this.agentSecretToken;
    }
}

module.exports = TokenManager;
