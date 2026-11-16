// @node-skills {"added":["v24.9.0"]}
// assert.Assert instances (v24.6.0, v22.19.0) with options; skipPrototype (v24.9.0).
import { Assert } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';

class Foo { constructor(a) { this.a = a; } }
class Bar { constructor(a) { this.a = a; } }

const shapeOnly = new Assert({ skipPrototype: true });
shapeOnly.deepStrictEqual(new Foo(1), new Bar(1));           // passes: prototypes ignored
assert.equal(isDeepStrictEqual(new Foo(1), new Bar(1), { skipPrototype: true }), true);

// Destructured methods lose the instance options.
const { deepStrictEqual } = shapeOnly;
assert.throws(() => deepStrictEqual(new Foo(1), new Bar(1)), { code: 'ERR_ASSERTION' });

// strict defaults to true: equal() behaves like strictEqual() unless strict: false.
assert.throws(() => new Assert().equal(1, '1'), { code: 'ERR_ASSERTION' });
new Assert({ strict: false }).equal(1, '1');
