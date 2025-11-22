export function fetchWithAuth(url, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { ...(opts.headers || {}) };
  if (!headers['Content-Type'] && !(opts && opts.body && opts.headers && opts.headers['Content-Type'])) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}
