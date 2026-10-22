"use strict";
const { ValidationError, AuthenticationError } = require('./errors');
const MAX_RESPONSE = 4 * 1024 * 1024;
const AUTH_RESPONSE = 64 * 1024;
const SECRET_HEADERS = new Set(['authorization', 'proxy-authorization', 'x-agent-secret-token', 'x-agent-user-id', 'host', 'cookie']);
function destination(value, base = false) {
    let url;
    try { url = new URL(value); } catch { throw new ValidationError('Invalid HTTPS destination', 'UNSAFE_DESTINATION'); }
    if (typeof value !== 'string' || !value.startsWith('https://') || /[\x00-\x20\x7f\\]/.test(value) || url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash || (base && url.search)) {
        throw new ValidationError('Invalid HTTPS destination', 'UNSAFE_DESTINATION');
    }
    return url;
}
function credential(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 16384 && !/[\s,]/.test(value);
}
function normalHeaders(headers) {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return null;
    const out = Object.create(null);
    for (const [key, value] of Object.entries(headers)) {
        const k = key.toLowerCase();
        if (Object.hasOwn(out, k) || typeof value !== 'string' || /[\r\n]/.test(key + value)) return null;
        out[k] = value;
    }
    return out;
}
function credentialsFrom(headers, dual = true) {
    const h = normalHeaders(headers);
    if (!h || !credential(h['x-agent-user-id']) || h['x-agent-user-id'].length > 256) return null;
    const auth = h.authorization, custom = h['x-agent-secret-token'];
    if (auth !== undefined && custom !== undefined) return null; // Never silently choose a principal.
    if (custom !== undefined && credential(custom)) return { token: custom, id: h['x-agent-user-id'], mode: 'custom' };
    if (dual && typeof auth === 'string' && /^Bearer [^\s,]+$/.test(auth) && credential(auth.slice(7))) return { token: auth.slice(7), id: h['x-agent-user-id'], mode: 'bearer' };
    return null;
}
function outboundOptions(options = {}, timeout = 30000) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ValidationError('Invalid request options');
    const permitted = new Set(['headers', 'params', 'data', 'timeout', 'signal']);
    if (Object.keys(options).some(k => !permitted.has(k))) throw new ValidationError('Unsafe or unsupported request option', 'UNSAFE_OPTIONS');
    const headers = normalHeaders(options.headers || {});
    if (!headers || Object.keys(headers).some(k => SECRET_HEADERS.has(k))) throw new ValidationError('Authentication headers cannot be overridden', 'AUTH_HEADER_OVERRIDE');
    const ms = options.timeout ?? timeout;
    if (!Number.isFinite(ms) || ms < 1 || ms > 300000) throw new ValidationError('Invalid request timeout');
    return { ...options, headers: { ...headers }, timeout: ms, maxRedirects: 0,
        maxBodyLength: MAX_RESPONSE, maxContentLength: MAX_RESPONSE,
        validateStatus: status => status >= 200 && status < 300 };
}
// Wall-clock bound, including slow-drip responses. Clean up on every outcome.
function deadlineSignal(timeout, caller) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, timeout);
    timer.unref?.();
    if (caller?.aborted) abort();
    else caller?.addEventListener('abort', abort, { once: true });
    return { signal: controller.signal, cleanup() {
        clearTimeout(timer);
        caller?.removeEventListener('abort', abort);
    } };
}
function tokenState(data, started, configuredTtl = null, skew = 30) {
    const validTtl = v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 2678400;
    if (!data || typeof data !== 'object' || !credential(data.access_token) || !credential(data.agent_secret_token) || !validTtl(data.expires_in)) throw new AuthenticationError('Invalid token response', 'INVALID_TOKEN_RESPONSE');
    const reported = data.agent_secret_token_expires_in;
    if (reported !== undefined && !validTtl(reported)) throw new AuthenticationError('Invalid token expiry', 'INVALID_TOKEN_RESPONSE');
    const ttl = reported ?? configuredTtl;
    const expiry = seconds => started + (seconds - Math.min(skew, seconds / 10)) * 1000;
    const accessExpires = expiry(data.expires_in);
    const agentExpires = ttl == null ? 0 : expiry(Math.min(data.expires_in, ttl));
    if (accessExpires <= Date.now() || (ttl != null && agentExpires <= Date.now())) throw new AuthenticationError('Token expired during exchange', 'INVALID_TOKEN_RESPONSE');
    return { accessToken: data.access_token, agentSecretToken: data.agent_secret_token,
        tokenExpiration: accessExpires, agentTokenExpiration: agentExpires };
}
function validIntrospection(data, id) {
    return data && data.active === true && data.agent_id === id && data.is_active !== false &&
        typeof data.expires_at === 'number' && Number.isFinite(data.expires_at) && data.expires_at > Date.now()/1000 &&
        typeof data.scopes === 'string' && data.scopes.split(/\s+/).includes('a2a');
}
module.exports = { deadlineSignal, destination, credential, credentialsFrom, outboundOptions, tokenState, validIntrospection, MAX_RESPONSE, AUTH_RESPONSE };
