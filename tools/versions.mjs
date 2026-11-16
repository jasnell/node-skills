// Version helpers shared by the example runner and the probe script.
//
// Node.js docs record availability as a list of `added:` versions, one per
// release line the feature shipped in (for example `[v26.8.0, v24.22.0]`).
// A version has the feature when it is at or above the newest entry, or when
// some entry is on the same major line and the version is at or above it.
// v25.x does not have a feature added in `[v26.8.0, v24.22.0]`.

export function parse(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) throw new TypeError(`not a version: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compare(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export function isAvailable(added, version = process.version) {
  if (added.length === 0) return false;
  const sorted = [...added].sort(compare);
  const newest = sorted.at(-1);
  if (compare(version, newest) >= 0) return true;
  const major = parse(version)[0];
  return sorted.some((a) => parse(a)[0] === major && compare(version, a) >= 0);
}
