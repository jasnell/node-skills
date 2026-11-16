// @node-skills {"added":["v25.4.0","v24.13.1"]}
// module.registerHooks(): synchronous, in-thread resolve/load hooks that apply to
// import, import() and require(). Hooks chain LIFO; deregister() removes them.
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';

const seen = [];
const virtual = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'virtual:config') {
      return { url: 'virtual:config', format: 'module', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'virtual:config') {
      return { format: 'module', source: 'export default { env: "test" }', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// Registered later, so it runs first. Transform the result of nextLoad.
const transform = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== 'virtual:config') return result;
    seen.push(url);
    // Spread first, then override. `{ source: x, ...result }` silently keeps the old source.
    return { ...result, source: String(result.source).replace('test', 'prod') };
  },
});

assert.deepEqual((await import('virtual:config')).default, { env: 'prod' });
assert.deepEqual(seen, ['virtual:config']);

// Same hooks also serve require() (a CJS source returned from load).
const cjs = registerHooks({
  resolve: (s, c, n) => (s === 'virtual:cjs' ? { url: 'virtual:cjs', shortCircuit: true } : n(s, c)),
  load: (u, c, n) => (u === 'virtual:cjs' ? { format: 'commonjs', source: 'module.exports = 7', shortCircuit: true } : n(u, c)),
});
assert.equal(createRequire(import.meta.url)('virtual:cjs'), 7);

for (const h of [cjs, transform, virtual]) h.deregister();
await assert.rejects(import('virtual:other'), { code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME' });
