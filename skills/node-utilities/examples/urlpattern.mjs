// @node-skills {"added":["v24.0.0"]}
// URLPattern is a global (also exported by node:url): route matching without a polyfill.
import { URLPattern as FromUrl } from 'node:url';
import assert from 'node:assert/strict';

assert.equal(FromUrl, globalThis.URLPattern);

const route = new URLPattern({ pathname: '/users/:id(\\d+)/posts/:slug?' });
const m = route.exec('https://example.com/users/42/posts/hello?x=1');
assert.deepEqual({ ...m.pathname.groups }, { id: '42', slug: 'hello' });
assert.equal(route.test('https://example.com/users/abc/posts'), false); // (\d+) rejects 'abc'
assert.equal(route.hasRegExpGroups, true);

// String patterns that are relative need a base URL, else TypeError (ERR_INVALID_URL_PATTERN).
assert.equal(new URLPattern('/api/*', 'https://example.com').test('https://example.com/api/v1/x'), true);
assert.throws(() => new URLPattern('/api/*'), { name: 'TypeError', code: 'ERR_INVALID_URL_PATTERN' });

// Wildcard groups are numbered; inputs can be URL parts; ignoreCase is an option.
const docs = new URLPattern('https://nodejs.org/docs/latest/api/*.html');
assert.equal(docs.exec('https://nodejs.org/docs/latest/api/dns.html').pathname.groups[0], 'dns');
assert.equal(new URLPattern({ pathname: '/Foo' }, { ignoreCase: true }).test({ pathname: '/foo' }), true);
