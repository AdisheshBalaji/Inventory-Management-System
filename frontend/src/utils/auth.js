/**
 * auth.js — shared JWT helpers for the frontend.
 *
 * Tokens are stored in localStorage under the key 'token'.
 * Both employee and customer sessions use the same key; the decoded
 * role field inside the JWT differentiates them when needed.
 */

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
