const { LRUCache } = require('../../src/dataStructures/LRUCache');
const stableStringify = require('../../src/utils/stableStringify');

describe('LRUCache', () => {
  test('stores and returns values', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', { x: 2 });
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toEqual({ x: 2 });
    expect(cache.size).toBe(2);
  });

  test('returns undefined for a missing key and counts a miss', () => {
    const cache = new LRUCache();
    expect(cache.get('nope')).toBeUndefined();
    expect(cache.stats().misses).toBe(1);
  });

  test('evicts the least recently used entry when full', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // "a" is now most recently used, so "b" is the LRU entry
    cache.set('d', 4); // over capacity -> evict "b"

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.stats().evictions).toBe(1);
  });

  test('keys() lists entries from most to least recently used', () => {
    const cache = new LRUCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');
    expect(cache.keys()).toEqual(['a', 'c', 'b']);
  });

  test('updating an existing key replaces the value and marks it recent', () => {
    const cache = new LRUCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 100); // update -> "a" becomes most recent
    cache.set('c', 3); // evicts "b"
    expect(cache.get('a')).toBe(100);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test('expired entries count as a miss and are removed', () => {
    jest.useFakeTimers();
    try {
      const cache = new LRUCache();
      cache.set('short', 'value', 1000);
      cache.set('forever', 'value'); // no TTL
      expect(cache.get('short')).toBe('value');

      jest.advanceTimersByTime(1001);

      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('forever')).toBe('value');
      expect(cache.size).toBe(1);
      expect(cache.stats()).toMatchObject({ hits: 2, misses: 1 });
    } finally {
      jest.useRealTimers();
    }
  });

  test('uses defaultTtlMs when no TTL is given', () => {
    jest.useFakeTimers();
    try {
      const cache = new LRUCache({ defaultTtlMs: 500 });
      cache.set('k', 1);
      jest.advanceTimersByTime(501);
      expect(cache.get('k')).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test('delete() and clear() remove entries', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    expect(cache.get('a')).toBeUndefined();

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.keys()).toEqual([]);
    cache.set('c', 3); // still works after clear
    expect(cache.get('c')).toBe(3);
  });

  test('stats() reports hits, misses, size and hit rate', () => {
    const cache = new LRUCache({ maxSize: 10 });
    cache.set('a', 1);
    cache.get('a');
    cache.get('a');
    cache.get('zzz');
    expect(cache.stats()).toEqual({
      hits: 2,
      misses: 1,
      size: 1,
      maxSize: 10,
      evictions: 0,
      hitRate: 0.6667,
    });
  });

  test('rejects an invalid maxSize', () => {
    expect(() => new LRUCache({ maxSize: 0 })).toThrow();
  });

  test('get/set stay O(1): 100k operations finish quickly and size stays bounded', () => {
    const cache = new LRUCache({ maxSize: 1000 });
    const start = Date.now();
    for (let i = 0; i < 100_000; i += 1) {
      cache.set(`key${i}`, i);
      cache.get(`key${i - 500}`);
    }
    const elapsed = Date.now() - start;
    expect(cache.size).toBe(1000);
    // An O(n) implementation (e.g. array scans) would take many seconds here
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('stableStringify', () => {
  test('produces the same string regardless of key order', () => {
    const a = stableStringify({ b: 1, a: { d: [1, 2], c: 'x' } });
    const b = stableStringify({ a: { c: 'x', d: [1, 2] }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":"x","d":[1,2]},"b":1}');
  });

  test('keeps array order (arrays are ordered data)', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  test('handles primitives, null and undefined values', () => {
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});
