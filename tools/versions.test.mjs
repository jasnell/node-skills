import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvailable, compare } from './versions.mjs';

test('compare orders versions numerically', () => {
  assert.ok(compare('v24.10.0', 'v24.9.0') > 0);
  assert.equal(compare('v26.1.0', '26.1.0'), 0);
});

test('isAvailable follows YAML added: semantics for backports', () => {
  const added = ['v26.8.0', 'v24.22.0'];
  assert.equal(isAvailable(added, 'v24.21.0'), false);
  assert.equal(isAvailable(added, 'v24.22.0'), true);
  assert.equal(isAvailable(added, 'v25.9.0'), false, 'v25 is skipped by the backport');
  assert.equal(isAvailable(added, 'v26.7.0'), false);
  assert.equal(isAvailable(added, 'v26.8.0'), true);
  assert.equal(isAvailable(added, 'v28.0.0-pre'), true);
  assert.equal(isAvailable(['v24.0.0'], 'v22.99.0'), false);
});
