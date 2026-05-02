export const ACCESS_TOKEN_COOKIE = "tc_access";
export const REFRESH_TOKEN_COOKIE = "tc_refresh";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const ACCESS_TOKEN_EXPIRY_MS = 1000 * 60 * 30; // 30 minutes
export const REFRESH_TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Backwards-compatible export used by legacy code paths; maps to access token cookie
export const COOKIE_NAME = ACCESS_TOKEN_COOKIE;

export const SUPER_USER_TOKEN_COOKIE = "tc_su";
export const SUPER_USER_TOKEN_EXPIRY_MS = 1000 * 60 * 60; // 60 minutes
export const NOT_SUPER_USER_ERR_MSG = 'Super-user verification required (10003)';
