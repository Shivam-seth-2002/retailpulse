/**
 * Deterministically stringifies a JSON object by sorting its keys.
 * This is used to generate cache keys from intent parameters.
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  const parts = [];
  for (const key of keys) {
    if (obj[key] !== undefined) {
      parts.push(`${JSON.stringify(key)}:${stableStringify(obj[key])}`);
    }
  }
  return `{${parts.join(',')}}`;
}

module.exports = stableStringify;
