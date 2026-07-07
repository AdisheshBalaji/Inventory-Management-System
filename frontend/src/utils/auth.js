/**
 * auth.js — shared JWT helpers for the frontend.
 *
 * Tokens are stored in localStorage under the key 'token'.
 * Both employee and customer sessions use the same key; the decoded
 * role field inside the JWT differentiates them when needed.
 */

const API = 'http://localhost:8000';

/** Read the raw JWT string from localStorage. */
export function getToken() {
    return localStorage.getItem('token');
}

/**
 * Returns fetch headers that include the JWT Bearer token.
 * Always includes Content-Type: application/json.
 */
export function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

/**
 * Logs the current user out.
 *   1. Calls POST /api/logout so the server blacklists the token's jti.
 *   2. Clears all auth state from localStorage regardless of network result.
 *   3. Navigates to the correct login page.
 *
 * @param {Function} navigate — React Router's navigate function
 * @param {'employee'|'customer'} [role] — determines the redirect target
 */
export async function logout(navigate, role = 'employee') {
    try {
        // Tell the server to revoke this token (best-effort — we clear
        // localStorage even if the request fails so the user is never stuck)
        await fetch(`${API}/api/logout`, {
            method: 'POST',
            headers: authHeaders()
        });
    } catch (_) {
        // Network error — silently continue; local clear below still protects the client
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        localStorage.removeItem('customer');
        localStorage.removeItem('cart');
        navigate(role === 'customer' ? '/customer-login' : '/login');
    }
}

/**
 * Call when a 401 is received from a protected endpoint.
 * Clears auth state and navigates to the appropriate login page.
 *
 * @param {Function} navigate — React Router's navigate function
 * @param {'employee'|'customer'} [role] — who was logged in (determines redirect)
 */
export function handleUnauthorized(navigate, role = 'employee') {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    localStorage.removeItem('customer');
    localStorage.removeItem('cart');
    navigate(role === 'customer' ? '/customer-login' : '/login');
}

/** Returns true when an employee token is present in localStorage. */
export function isEmployeeLoggedIn() {
    return !!localStorage.getItem('employee') && !!getToken();
}

/** Returns true when a customer token is present in localStorage. */
export function isCustomerLoggedIn() {
    return !!localStorage.getItem('customer') && !!getToken();
}
