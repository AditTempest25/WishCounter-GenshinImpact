import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://localhost:3000';
const checks = [
  ['GET', '/api/backend/auth/me', undefined, 401],
  ['GET', '/api/backend/accounts/800000123/archive', undefined, 401],
  ['GET', '/api/backend/not-allowed', undefined, 404],
  ['POST', '/api/backend/auth/login', 'https://untrusted.example', 403],
  ['POST', '/api/backend/auth/login', undefined, 403],
];
for (const [method, path, origin, status] of checks) {
  const response = await fetch(base + path, { method, headers: method === 'POST' ? { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) } : {}, body: method === 'POST' ? '{}' : undefined, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, status, `${method} ${path}`);
  assert.equal(response.headers.has('set-cookie'), false, 'Rejected requests must not create a session');
}
console.log('PASS: guest access, proxy allowlist, missing-origin and cross-site rejection (5 checks).');
