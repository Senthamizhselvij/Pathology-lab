/** Tiny fetch wrapper for the Express API. Cookies carry the login. */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let unauthorizedHandler = null;
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

function withQuery(url, params) {
  if (!params) return url;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') usp.set(k, v);
  });
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(method, url, { params, body } = {}) {
  let res;
  try {
    res = await fetch(`/api${withQuery(url, params)}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is it running?', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    // A 401 on /auth/login just means wrong password; everywhere else it means "session ended".
    if (res.status === 401 && !url.startsWith('/auth/login') && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  get: (url, params) => request('GET', url, { params }),
  post: (url, body = {}) => request('POST', url, { body }),
  put: (url, body = {}) => request('PUT', url, { body }),
  del: (url) => request('DELETE', url),
};
