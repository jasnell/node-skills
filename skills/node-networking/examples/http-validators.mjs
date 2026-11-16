// @node-skills {"added":["v26.11.0"]}
// http.isValidHeaderName / isValidHeaderValue: boolean (non-throwing) versions of validateHeaderName/Value.
import assert from 'node:assert/strict';
import { isValidHeaderName, isValidHeaderValue } from 'node:http';

assert.equal(isValidHeaderName('X-Request-Id'), true);
assert.equal(isValidHeaderName('GET'), true);          // methods are tokens too
for (const bad of ['', 'bad header', 'x:y', 42]) assert.equal(isValidHeaderName(bad), false);

assert.equal(isValidHeaderValue('text/html'), true);
assert.equal(isValidHeaderValue(123), true);            // non-strings are stringified
assert.equal(isValidHeaderValue(undefined), false);
assert.equal(isValidHeaderValue(Symbol('s')), false);
assert.equal(isValidHeaderValue('a\r\nb'), false);       // CRLF injection
assert.equal(isValidHeaderValue('a\x01b'), false);       // control char: rejected by 'strict' (default)
assert.equal(isValidHeaderValue('a\x01b', { httpValidation: 'relaxed' }), true);
assert.equal(isValidHeaderValue('café'), true);          // non-ASCII (obs-text) passes even 'strict'
assert.throws(() => isValidHeaderValue('x', { httpValidation: 'insecure' }), { code: 'ERR_INVALID_ARG_VALUE' });
